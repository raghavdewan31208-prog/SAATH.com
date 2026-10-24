import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  DEMO_CONTACTS,
  DEMO_DESTINATION,
  DEMO_START,
  createInitialState,
  demoRouteOptions,
} from './demo'
import { journeyEtaAt, reducer } from './engine'
import type { AppState, Report } from './types'
import { recommendRoutes } from './recommend'
import { approvedRouteReports } from './reporting'
import { shareIsLive } from './tokens'
import { assistantReply, isAcknowledgement } from './assistant'

const NOW = 1_760_000_000_000
const MIN = 60_000

function makeState(): AppState {
  const state = createInitialState(NOW)
  state.profile = { ...state.profile, name: 'Aanya', onboardedAt: NOW }
  state.contacts = DEMO_CONTACTS.map((contact) => ({
    ...contact,
    share: { ...contact.share },
    createdAt: NOW,
  }))
  state.settings = structuredClone(DEFAULT_SETTINGS)
  state.alerts = []
  return state
}

function startJourney(state: AppState, token?: string): AppState {
  return reducer(state, {
    type: 'journey/start',
    now: NOW,
    route: demoRouteOptions(NOW)[0],
    start: DEMO_START,
    destination: DEMO_DESTINATION,
    token,
  })
}

describe('journey check-ins', () => {
  it('raises only one pending check-in for overlapping triggers', () => {
    let state = startJourney(makeState())
    state = reducer(state, { type: 'journey/simulate', now: NOW + 1_000, kind: 'deviation' })
    state = reducer(state, { type: 'journey/simulate', now: NOW + 2_000, kind: 'deviation' })
    state = reducer(state, { type: 'journey/simulate', now: NOW + 3_000, kind: 'stop' })

    expect(state.journey?.checkin.history).toHaveLength(1)
    expect(state.alerts.filter((alert) => alert.kind === 'checkin')).toHaveLength(1)
    expect(state.journey?.checkin.pending?.kind).toBe('deviation')
  })

  it('escalates at most once per check-in', () => {
    let state = makeState()
    state.settings.checkin.escalate = true
    state.settings.checkin.graceSeconds = 10
    state = startJourney(state)
    state = reducer(state, { type: 'journey/simulate', now: NOW + 1_000, kind: 'deviation' })

    state = reducer(state, { type: 'journey/tick', now: NOW + 20_000, online: true })
    expect(state.journey?.checkin.pending?.escalatedAt).not.toBeNull()
    expect(state.alerts.filter((alert) => alert.kind === 'escalation')).toHaveLength(1)

    state = reducer(state, { type: 'journey/tick', now: NOW + 10 * MIN, online: true })
    expect(state.alerts.filter((alert) => alert.kind === 'escalation')).toHaveLength(1)
  })

  it('resolves a check-in and schedules the next one', () => {
    let state = startJourney(makeState())
    state = reducer(state, { type: 'journey/simulate', now: NOW + 1_000, kind: 'deviation' })
    state = reducer(state, { type: 'journey/checkin', now: NOW + 5_000, response: 'ok' })

    expect(state.journey?.checkin.pending).toBeNull()
    expect(state.journey?.checkin.history[0].resolution).toBe('ok')
    expect(state.journey?.checkin.nextDueAt).toBe(NOW + 5_000 + 15 * MIN)
  })

  it('keeps timers working offline without pretending the location is fresh', () => {
    let state = startJourney(makeState())
    state = reducer(state, { type: 'journey/tick', now: NOW + 16 * MIN, online: false })

    expect(state.journey?.checkin.pending).not.toBeNull()
    expect(state.journey?.lastFixAt).toBe(NOW)
    expect(state.journey?.position).toEqual(demoRouteOptions(NOW)[0].geometry[0])
    expect(state.journey?.offline).toBe(true)
  })
})

describe('SOS and sharing', () => {
  it('does not create a second SOS while one is active', () => {
    const first = reducer(makeState(), { type: 'sos/activate', now: NOW })
    const second = reducer(first, { type: 'sos/activate', now: NOW + 1_000 })
    expect(second.sos?.id).toBe(first.sos?.id)
  })

  it('advances simulated delivery only while online', () => {
    let state = reducer(makeState(), { type: 'sos/activate', now: NOW })
    const share = state.sos!.actions.find((action) => action.kind === 'share')!

    state = reducer(state, { type: 'journey/tick', now: NOW + 10_000, online: false })
    expect(state.sos?.actions.find((action) => action.id === share.id)?.state).toBe('pending')

    state = reducer(state, { type: 'journey/tick', now: NOW + 20_000, online: true })
    expect(state.sos?.actions.find((action) => action.id === share.id)?.state).toBe('sent')
    state = reducer(state, { type: 'journey/tick', now: NOW + 40_000, online: true })
    expect(state.sos?.actions.find((action) => action.id === share.id)?.state).toBe('delivered')
  })

  it('never treats opening the dialler as a delivered call', () => {
    let state = reducer(makeState(), { type: 'sos/activate', now: NOW })
    const call = state.sos!.actions.find((action) => action.kind === 'call')!
    state = reducer(state, {
      type: 'sos/action',
      now: NOW + 5_000,
      actionId: call.id,
      state: 'opened',
      note: 'Dialler attempt',
    })
    const updated = state.sos!.actions.find((action) => action.id === call.id)!
    expect(updated.state).toBe('opened')
    expect(state.sos!.actions.some((action) => action.state === 'delivered' && action.kind === 'call')).toBe(false)

    state = reducer(state, { type: 'sos/ack', now: NOW + 6_000, contactId: DEMO_CONTACTS[0].id })
    expect(state.sos?.ack?.byContactId).toBe(DEMO_CONTACTS[0].id)
    expect(state.sos!.actions.find((action) => action.id === call.id)?.state).toBe('opened')
  })

  it('revokes the journey and SOS sharing sessions when a journey ends', () => {
    let state = startJourney(makeState())
    state = reducer(state, { type: 'sos/activate', now: NOW + 1_000 })
    state = reducer(state, { type: 'journey/end', now: NOW + 2_000 })

    expect(state.journey?.status).toBe('ended')
    expect(state.journey?.sharing.revokedAt).toBe(NOW + 2_000)
    expect(state.sos?.share?.revokedAt).toBe(NOW + 2_000)
  })

  it('cancels the alert, its pending actions and its share session', () => {
    let state = reducer(makeState(), { type: 'sos/activate', now: NOW })
    state = reducer(state, { type: 'sos/cancel', now: NOW + 3_000, reason: 'Accidental' })

    expect(state.sos?.status).toBe('cancelled')
    expect(state.sos?.share?.revokedAt).toBe(NOW + 3_000)
    expect(state.sos?.actions.every((action) => ['cancelled', 'failed'].includes(action.state))).toBe(true)
    expect(state.sos?.cancelReason).toBe('Accidental')
  })

  it('enforces token expiry and immediate revocation', () => {
    const state = startJourney(makeState(), 'fixed-test-token-123456')
    const sharing = state.journey!.sharing
    expect(sharing.token).toBe('fixed-test-token-123456')
    expect(shareIsLive(sharing, NOW + 1_000)).toBe(true)
    expect(shareIsLive(sharing, sharing.expiresAt + 1)).toBe(false)

    const revoked = reducer(state, { type: 'share/revoke', now: NOW + 5_000 })
    expect(shareIsLive(revoked.journey!.sharing, NOW + 6_000)).toBe(false)
  })
})

describe('route data honesty', () => {
  it('recommends the longer, better-verified route with a factual reason', () => {
    const recommendation = recommendRoutes(demoRouteOptions(NOW), NOW)
    expect(recommendation.recommendedId).toBe('demo-main-road')
    const reasons = recommendation.reasons.join(' ')
    expect(reasons).toMatch(/minute/)
    expect(reasons.toLowerCase()).toMatch(/lighting/)
    expect(recommendation.confidence).toBe('medium')
  })

  it('ignores pending community reports but uses approved ones near the route', () => {
    const pending: Report = {
      ...DEMO_REPORTS()[1],
      id: 'report-pending-test',
      status: 'pending',
      shareWithRoutes: true,
      coarseLocation: { lat: 12.9318, lng: 77.6222 },
    }
    const pendingRoutes = demoRouteOptions(NOW, [pending])
    expect(pendingRoutes.some((route) => route.observations.some((obs) => obs.id === 'report-report-pending-test'))).toBe(false)

    const approved: Report = { ...pending, status: 'approved' }
    const approvedRoutes = demoRouteOptions(NOW, [approved])
    const parkRoute = approvedRoutes.find((route) => route.id === 'demo-inner-lanes')!
    expect(parkRoute.observations.some((obs) => obs.id === 'report-report-pending-test')).toBe(true)
    expect(approvedRouteReports([pending])).toHaveLength(0)
  })
})

describe('journey timing and preferences', () => {
  it('does not age the ETA while a journey is paused', () => {
    let state = startJourney(makeState())
    state = reducer(state, { type: 'journey/pause', now: NOW + 5 * MIN })
    const etaAtPause = journeyEtaAt(state.journey!, NOW + 5 * MIN)
    expect(journeyEtaAt(state.journey!, NOW + 8 * MIN)).toBe(etaAtPause)
    state = reducer(state, { type: 'journey/resume', now: NOW + 10 * MIN })
    expect(journeyEtaAt(state.journey!, NOW + 10 * MIN)).toBe(etaAtPause + 5 * MIN)
    expect(state.journey?.pausedMs).toBe(5 * MIN)
  })

  it('keeps recipient preferences and priority separate', () => {
    const state = makeState()
    const [first, second] = state.contacts
    state.contacts = state.contacts.map((contact) =>
      contact.id === first.id
        ? { ...contact, share: { location: false, journey: true, notes: false } }
        : contact,
    )
    let journeyState = startJourney(state)
    expect(journeyState.journey?.sharing.contactIds).toContain(first.id)
    expect(journeyState.journey?.sharing.contactIds[0]).toBe(first.id)

    journeyState = reducer(journeyState, { type: 'contacts/move', id: second.id, direction: -1 })
    expect(journeyState.contacts[0].id).toBe(second.id)
    journeyState = reducer(journeyState, { type: 'contacts/remove', id: second.id, now: NOW })
    expect(journeyState.contacts.map((contact) => contact.priority)).toEqual([1, 2])
  })
})

describe('AI boundaries', () => {
  const emptyFacts = {
    location: null,
    locationAt: null,
    destination: null,
    journeyActive: false,
    contactsNotified: 0,
  }

  it('states unknown location instead of inventing one', () => {
    const reply = assistantReply(emptyFacts, 'Meera', 'en', 'Where is she right now?', NOW)
    expect(reply.reply.toLowerCase()).toContain('no location is available')
    expect(reply.reply.toLowerCase()).not.toMatch(/\b\d{1,3}\.\d{3,}/)
  })

  it('does not invent a reason for the alert', () => {
    const reply = assistantReply(emptyFacts, 'Meera', 'en', 'What happened to her?', NOW)
    expect(reply.reply.toLowerCase()).toContain('not given any further reason')
  })

  it('records acknowledgement only from explicit deterministic phrases', () => {
    expect(isAcknowledgement('I acknowledge the alert', 'en')).toBe(true)
    expect(isAcknowledgement('Where is the latest location?', 'en')).toBe(false)
    expect(isAcknowledgement('मैं अलर्ट प्राप्त होने की पुष्टि करता हूँ', 'hi')).toBe(true)
    expect(isAcknowledgement('नवीनतम लोकेशन क्या है?', 'hi')).toBe(false)
  })
})

// DEMO_REPORTS is created at module load; this keeps the test relative to NOW.
function DEMO_REPORTS() {
  const base = createInitialState(NOW).reports
  return base
}
