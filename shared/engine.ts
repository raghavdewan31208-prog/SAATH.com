import type {
  AppAlert,
  AppState,
  CheckinEvent,
  Contact,
  Journey,
  JourneyEvent,
  LatLng,
  Place,
  Report,
  RouteOption,
  ShareSession,
  SosAction,
  SosActionState,
  SosEvent,
  SosConfig,
} from './types'
import { createShareToken } from './tokens'
import { createInitialState, DEMO_CONTACTS, DEMO_REPORTS } from './demo'

export const STATE_VERSION = 1
const JOURNEY_SHARE_TTL = 4 * 3_600_000
const SOS_SHARE_TTL = 2 * 3_600_000
const ARRIVAL_GRACE_MS = 120_000

function uid(prefix: string): string {
  const rand =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}-${Date.now().toString(36)}-${rand}`
}

function addAlert(
  state: AppState,
  input: {
    dedupeKey: string
    kind: AppAlert['kind']
    severity: AppAlert['severity']
    at: number
    title: string
    titleHi: string
    body: string
    bodyHi: string
  },
): AppState {
  if (state.alerts.some((a) => a.dedupeKey === input.dedupeKey)) return state
  const alert: AppAlert = {
    id: uid('alert'),
    kind: input.kind,
    title: input.title,
    titleHi: input.titleHi,
    body: input.body,
    bodyHi: input.bodyHi,
    at: input.at,
    read: false,
    dedupeKey: input.dedupeKey,
    severity: input.severity,
  }
  return { ...state, alerts: [alert, ...state.alerts].slice(0, 60) }
}

function addJourneyEvent(journey: Journey, event: Omit<JourneyEvent, 'id'>): Journey {
  return { ...journey, events: [...journey.events, { ...event, id: uid('jevent') }].slice(-80) }
}

function bumpShareContacts(state: AppState): string[] {
  return state.contacts
    .filter((c) => c.share.location || c.share.journey || c.share.notes)
    .sort((a, b) => a.priority - b.priority)
    .map((c) => c.id)
}

function activeContacts(state: AppState): Contact[] {
  return [...state.contacts].sort((a, b) => a.priority - b.priority)
}

function normalizePriorities(contacts: Contact[]): Contact[] {
  return [...contacts]
    .sort((a, b) => a.priority - b.priority)
    .map((c, index) => ({ ...c, priority: index + 1 }))
}

function createShare(now: number, contactIds: string[], ttl: number, token?: string): ShareSession {
  return {
    token: token ?? createShareToken(),
    createdAt: now,
    expiresAt: now + ttl,
    contactIds,
    revokedAt: null,
    simulated: true,
  }
}

export function journeyElapsedMs(journey: Journey, now: number): number {
  const end = journey.status === 'paused' ? (journey.pausedAt ?? now) : journey.status === 'ended' ? (journey.endedAt ?? now) : now
  return Math.max(0, end - journey.startedAt - journey.pausedMs)
}

export function journeyProgressAt(journey: Journey, now: number): number {
  const total = Math.max(1, (journey.plannedDurationMin + journey.extendedMin) * 60_000)
  return Math.min(1, journeyElapsedMs(journey, now) / total)
}

export function journeyEtaAt(journey: Journey, now: number): number {
  const total = (journey.plannedDurationMin + journey.extendedMin) * 60_000
  const remaining = Math.max(0, total - journeyElapsedMs(journey, now))
  // A paused journey's ETA is anchored to the pause time, not to the current
  // clock, so it does not drift forward while no progress is being made.
  const anchor = journey.status === 'paused' ? (journey.pausedAt ?? now) : now
  return anchor + remaining
}

export function interpolateRoute(geometry: LatLng[], progress: number): LatLng {
  if (geometry.length === 0) return { lat: 0, lng: 0 }
  if (geometry.length === 1) return geometry[0]
  const clamped = Math.min(1, Math.max(0, progress))
  const scaled = clamped * (geometry.length - 1)
  const index = Math.min(geometry.length - 2, Math.floor(scaled))
  const t = scaled - index
  const a = geometry[index]
  const b = geometry[index + 1]
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t }
}

export function sortedContacts(state: AppState): Contact[] {
  return activeContacts(state)
}

export function priorityContact(state: AppState): Contact | null {
  return activeContacts(state)[0] ?? null
}

export function aiConsentingContact(state: AppState): Contact | null {
  return activeContacts(state).find((c) => c.aiConsent) ?? null
}

function raiseCheckin(
  state: AppState,
  journey: Journey,
  kind: CheckinEvent['kind'],
  now: number,
): { state: AppState; journey: Journey } {
  if (!journey.checkin.enabled) return { state, journey }
  if (journey.checkin.pending) return { state, journey }
  if (state.sos?.status === 'active') return { state, journey }

  const event: CheckinEvent = {
    id: uid('checkin'),
    kind,
    raisedAt: now,
    resolvedAt: null,
    resolution: null,
    escalatedAt: null,
  }
  const nextJourney = addJourneyEvent(
    { ...journey, checkin: { ...journey.checkin, pending: event, history: [...journey.checkin.history, event].slice(-20) } },
    { at: now, kind: 'checkin-raised', detail: kind },
  )

  const copy = {
    scheduled: {
      en: ['Check-in time', 'Saath has not heard from you for a while. Are you okay?'],
      hi: ['चेक-इन का समय', 'साथ ने आपसे कुछ समय से कोई अपडेट नहीं पाया। क्या आप ठीक हैं?'],
    },
    deviation: {
      en: ['Route deviation noticed', 'You seem to be off the planned route. This is not treated as danger — just check in.'],
      hi: ['मार्ग से हटना दिखा', 'आप योजना से अलग मार्ग पर लग रहे हैं। इसे ख़तरा नहीं माना गया — बस चेक-इन करें।'],
    },
    stop: {
      en: ['Unexpected stop', 'You have been in one place longer than planned. Please check in when you can.'],
      hi: ['अचानक रुकावट', 'आप योजना से अधिक समय एक ही जगह हैं। जब संभव हो चेक-इन करें।'],
    },
    overdue: {
      en: ['Arrival overdue', 'Your planned arrival time has passed. Please check in.'],
      hi: ['आगमन देर से', 'आपका तय पहुँचने का समय बीत गया है। कृपया चेक-इन करें।'],
    },
  }[kind]

  return {
    journey: nextJourney,
    state: addAlert(state, {
      dedupeKey: `checkin:${event.id}`,
      kind: 'checkin',
      severity: 'warn',
      at: now,
      title: copy.en[0],
      titleHi: copy.hi[0],
      body: copy.en[1],
      bodyHi: copy.hi[1],
    }),
  }
}

function resolvePending(
  state: AppState,
  journey: Journey,
  resolution: 'ok' | 'extended' | 'help',
  now: number,
  extraMin = 0,
): AppState {
  const pending = journey.checkin.pending
  if (!pending) return state

  const resolved: CheckinEvent = { ...pending, resolvedAt: now, resolution }
  const history = journey.checkin.history.map((c) => (c.id === pending.id ? resolved : c))
  let next: Journey = {
    ...journey,
    stoppedSince: null,
    checkin: {
      ...journey.checkin,
      pending: null,
      history,
      nextDueAt: now + journey.checkin.intervalMin * 60_000,
    },
    extendedMin: journey.extendedMin + (resolution === 'extended' ? extraMin : 0),
  }
  next = addJourneyEvent(next, { at: now, kind: resolution === 'ok' ? 'checkin-ok' : resolution === 'extended' ? 'checkin-extended' : 'checkin-help' })

  return {
    ...state,
    journey: next,
    alerts: state.alerts.map((a) =>
      a.dedupeKey === `checkin:${pending.id}` ? { ...a, read: true } : a,
    ),
  }
}

function escalateIfDue(state: AppState, journey: Journey, now: number): AppState {
  const pending = journey.checkin.pending
  if (!pending || pending.escalatedAt || !state.settings.checkin.escalate) return state
  if (state.sos?.status === 'active') return state
  if (now - pending.raisedAt < state.settings.checkin.graceSeconds * 1000) return state

  const contact = activeContacts(state).find((c) => c.share.location) ?? activeContacts(state)[0]
  if (!contact) return state

  const escalated: CheckinEvent = {
    ...pending,
    escalatedAt: now,
    escalatedToContactId: contact.id,
  }
  const history = journey.checkin.history.map((c) => (c.id === pending.id ? escalated : c))
  const nextJourney = addJourneyEvent(
    { ...journey, checkin: { ...journey.checkin, pending: escalated, history } },
    { at: now, kind: 'escalated', detail: contact.name },
  )

  const states = addAlert(
    { ...state, journey: nextJourney },
    {
      dedupeKey: `escalation:${pending.id}`,
      kind: 'escalation',
      severity: 'warn',
      at: now,
      title: 'Check-in escalated (simulated)',
      titleHi: 'चेक-इन आगे भेजा गया (सिम्युलेटेड)',
      body: `${contact.name} was sent a simulated check-in request with your shared journey details. No reply has been received.`,
      bodyHi: `${contact.name} को आपकी साझा यात्रा जानकारी के साथ सिम्युलेटेड चेक-इन अनुरोध भेजा गया। कोई उत्तर नहीं मिला।`,
    },
  )
  return states
}

function sosActionsFor(state: AppState, contactIds: string[], now: number): SosAction[] {
  const cfg: SosConfig = state.settings.sos
  const actions: SosAction[] = []
  const contacts = activeContacts(state).filter((c) => contactIds.includes(c.id))
  const priority = contacts[0] ?? null
  const consenting = contacts.find((c) => c.aiConsent) ?? null
  const push = (kind: SosAction['kind'], contact?: Contact | null, note?: string) => {
    const base: SosAction = {
      id: uid('sosact'),
      kind,
      contactId: contact?.id,
      state: note ? 'failed' : 'pending',
      createdAt: now,
      updatedAt: now,
      attempts: 1,
      provider: kind === 'dialer' || kind === 'call' ? 'device' : 'simulation',
      note,
    }
    actions.push(base)
  }

  if (cfg.shareLocation) {
    if (contactIds.length === 0) {
      push('share', null, 'No trusted contacts to share with. Add a contact first.')
    } else {
      push('share')
    }
  }
  if (cfg.callPriority) {
    if (priority) push('call', priority)
    else push('call', null, 'No trusted contact saved.')
  }
  if (cfg.aiCall) {
    if (!state.settings.aiCallsAllowed) {
      push('ai', null, 'AI calls are turned off in Settings.')
    } else if (!consenting) {
      push('ai', null, 'No contact has consented to AI calls. Consent must be explicit.')
    } else {
      push('ai', consenting)
    }
  }
  if (cfg.openDialer) push('dialer', null)
  return actions
}

function deriveFacts(_state: AppState, journey: Journey | null) {
  return {
    location: journey?.position ?? null,
    locationAt: journey?.lastFixAt ?? null,
    destination: journey?.destination.label ?? null,
    journeyActive: Boolean(journey && journey.status === 'active'),
    contactsNotified: 0,
  }
}

function markAction(
  sos: SosEvent,
  actionId: string,
  state: SosActionState,
  now: number,
  note?: string,
): SosEvent {
  return {
    ...sos,
    actions: sos.actions.map((a) =>
      a.id === actionId ? { ...a, state, updatedAt: now, note: note ?? a.note } : a,
    ),
  }
}

function tickSos(_state: AppState, sos: SosEvent, now: number, online: boolean): SosEvent {
  if (sos.status !== 'active') return sos
  let next = sos
  for (const action of sos.actions) {
    if (action.kind === 'share') {
      if (!online) {
        if (action.state === 'pending') continue
        continue
      }
      if (action.state === 'pending' && now - action.updatedAt >= 1200) {
        next = markAction(next, action.id, 'sent', now, 'Sent via Saath simulation')
      } else if (action.state === 'sent' && now - action.updatedAt >= 4800) {
        next = markAction(next, action.id, 'delivered', now, 'Simulated delivery — no live channel')
      }
    }
    if (action.kind === 'ai') {
      if (!online) continue
      if (action.state === 'pending' && now - action.updatedAt >= 1000) {
        next = markAction(next, action.id, 'calling', now, 'Simulated AI call')
      } else if (action.state === 'calling' && now - action.updatedAt >= 60_000) {
        next = markAction(next, action.id, 'unanswered', now, 'Simulated contact did not answer')
      }
    }
  }
  return next
}

export type Action =
  | { type: 'profile/update'; now: number; patch: Partial<AppState['profile']> }
  | { type: 'permission/set'; key: 'location' | 'notifications' | 'microphone'; value: AppState['profile']['permissions']['location'] }
  | { type: 'contacts/add'; contact: Contact }
  | { type: 'contacts/update'; id: string; patch: Partial<Contact> }
  | { type: 'contacts/remove'; id: string; now: number }
  | { type: 'contacts/move'; id: string; direction: -1 | 1 }
  | { type: 'settings/sos'; patch: Partial<SosConfig> }
  | { type: 'settings/checkin'; patch: Partial<AppState['settings']['checkin']> }
  | { type: 'settings/contactDefaults'; patch: Partial<AppState['settings']['contactDefaults']> }
  | { type: 'settings/update'; patch: Partial<Pick<AppState['settings'], 'safetyCheckins' | 'aiCallsAllowed'>> }
  | { type: 'members/demo'; now: number }
  | { type: 'plan/set'; plan: AppState['plan'] }
  | {
      type: 'journey/start'
      now: number
      route: RouteOption
      start: Place
      destination: Place
      token?: string
    }
  | { type: 'journey/tick'; now: number; online: boolean; position?: LatLng }
  | { type: 'journey/pause'; now: number }
  | { type: 'journey/resume'; now: number }
  | { type: 'journey/checkin'; now: number; response: 'ok' | 'extended' | 'help'; extraMin?: number }
  | { type: 'journey/extend'; now: number; minutes: number; note?: string }
  | { type: 'journey/checkin-now'; now: number }
  | { type: 'journey/simulate'; now: number; kind: 'deviation' | 'stop' }
  | { type: 'journey/end'; now: number }
  | { type: 'journey/note'; now: number; text: string }
  | { type: 'share/revoke'; now: number }
  | { type: 'sos/activate'; now: number; token?: string }
  | { type: 'sos/cancel'; now: number; reason: string }
  | { type: 'sos/action'; now: number; actionId: string; state: SosActionState; note?: string }
  | { type: 'sos/retry'; now: number; actionId: string }
  | { type: 'sos/ack'; now: number; contactId: string }
  | { type: 'sos/close'; now: number }
  | { type: 'sos/share-revoke'; now: number }
  | { type: 'report/add'; report: Report }
  | { type: 'report/moderate'; id: string; now: number; decision: 'approved' | 'rejected'; reason?: string }
  | { type: 'report/delete'; id: string }
  | { type: 'alerts/read'; now: number }
  | { type: 'alerts/clear' }
  | { type: 'data/clear'; now: number }
  | { type: 'data/reset'; now: number }
  | { type: 'demo/seed'; now: number }

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'profile/update': {
      return { ...state, profile: { ...state.profile, ...action.patch, permissions: { ...state.profile.permissions, ...(action.patch.permissions ?? {}) } } }
    }
    case 'permission/set': {
      return {
        ...state,
        profile: {
          ...state.profile,
          permissions: { ...state.profile.permissions, [action.key]: action.value },
        },
      }
    }
    case 'contacts/add': {
      const contacts = normalizePriorities([...state.contacts, action.contact])
      return { ...state, contacts }
    }
    case 'contacts/update': {
      return {
        ...state,
        contacts: state.contacts.map((c) =>
          c.id === action.id ? { ...c, ...action.patch, id: c.id, createdAt: c.createdAt } : c,
        ),
      }
    }
    case 'contacts/remove': {
      const contacts = normalizePriorities(state.contacts.filter((c) => c.id !== action.id))
      let next: AppState = { ...state, contacts }
      if (state.journey) {
        next = {
          ...next,
          journey: {
            ...state.journey,
            sharing: {
              ...state.journey.sharing,
              contactIds: state.journey.sharing.contactIds.filter((id) => id !== action.id),
            },
          },
        }
      }
      if (state.sos) {
        next = {
          ...next,
          sos: {
            ...state.sos,
            contactIds: state.sos.contactIds.filter((id) => id !== action.id),
            share: state.sos.share
              ? { ...state.sos.share, contactIds: state.sos.share.contactIds.filter((id) => id !== action.id) }
              : null,
          },
        }
      }
      return next
    }
    case 'contacts/move': {
      const sorted = activeContacts(state)
      const index = sorted.findIndex((c) => c.id === action.id)
      const target = index + action.direction
      if (index < 0 || target < 0 || target >= sorted.length) return state
      const swapped = [...sorted]
      ;[swapped[index], swapped[target]] = [swapped[target], swapped[index]]
      return { ...state, contacts: swapped.map((c, i) => ({ ...c, priority: i + 1 })) }
    }
    case 'settings/sos':
      return { ...state, settings: { ...state.settings, sos: { ...state.settings.sos, ...action.patch } } }
    case 'settings/checkin':
      return {
        ...state,
        settings: { ...state.settings, checkin: { ...state.settings.checkin, ...action.patch } },
      }
    case 'settings/contactDefaults':
      return {
        ...state,
        settings: {
          ...state.settings,
          contactDefaults: { ...state.settings.contactDefaults, ...action.patch },
        },
      }
    case 'settings/update':
      return { ...state, settings: { ...state.settings, ...action.patch } }
    case 'members/demo': {
      const existingIds = new Set(state.contacts.map((c) => c.id))
      const demo = DEMO_CONTACTS.filter((c) => !existingIds.has(c.id)).map((c) => ({
        ...c,
        share: { ...c.share },
        createdAt: action.now,
      }))
      return {
        ...state,
        contacts: normalizePriorities([...state.contacts, ...demo]),
        profile: { ...state.profile, name: state.profile.name || 'Aanya (demo)' },
      }
    }
    case 'plan/set':
      return { ...state, plan: action.plan }
    case 'journey/start': {
      if (state.journey && state.journey.status !== 'ended') return state
      const interval = state.settings.checkin.intervalMin
      const contactIds = bumpShareContacts(state)
      const sharing = createShare(action.now, contactIds, JOURNEY_SHARE_TTL, action.token)
      let journey: Journey = {
        id: uid('journey'),
        startedAt: action.now,
        endedAt: null,
        status: 'active',
        route: action.route,
        start: action.start,
        destination: action.destination,
        plannedDurationMin: action.route.durationMin,
        extendedMin: 0,
        progress: 0,
        position: action.route.geometry[0] ?? { lat: action.start.lat, lng: action.start.lng },
        positionSource: 'simulated',
        lastFixAt: action.now,
        pausedAt: null,
        pausedMs: 0,
        sharing,
        checkin: {
          enabled: state.settings.safetyCheckins,
          intervalMin: interval,
          nextDueAt: action.now + interval * 60_000,
          pending: null,
          history: [],
        },
        events: [],
        stoppedSince: null,
        offline: false,
      }
      journey = addJourneyEvent(journey, { at: action.now, kind: 'started', detail: action.destination.label })
      journey = addJourneyEvent(journey, { at: action.now, kind: 'share-started', detail: `${contactIds.length}` })
      let next: AppState = { ...state, journey, plan: state.plan }
      next = addAlert(next, {
        dedupeKey: `journey-start:${journey.id}`,
        kind: 'share',
        severity: 'info',
        at: action.now,
        title: 'Journey sharing is simulated',
        titleHi: 'यात्रा साझा करना सिम्युलेटेड है',
        body: `${contactIds.length} contact${contactIds.length === 1 ? '' : 's'} would receive updates. No live link is created because Saath has no sharing backend in this MVP.`,
        bodyHi: `${contactIds.length} संपर्कों को अपडेट मिलेंगे। इस MVP में साथ के पास शेयरिंग बैकएंड नहीं है, इसलिए कोई लाइव लिंक नहीं बनाया गया।`,
      })
      return next
    }
    case 'journey/tick': {
      const current = state.journey
      if (!current || current.status !== 'active') {
        if (!state.sos) return state
        const ticked = tickSos(state, state.sos, action.now, action.online)
        return ticked === state.sos ? state : { ...state, sos: ticked }
      }
      let journey: Journey = { ...current, offline: !action.online }
      const progress = journeyProgressAt(journey, action.now)
      journey.progress = progress

      if (action.online) {
        if (action.position) {
          journey.position = action.position
          journey.positionSource = 'device'
          journey.lastFixAt = action.now
        } else if (journey.positionSource === 'simulated') {
          journey.position = interpolateRoute(journey.route.geometry, progress)
          journey.lastFixAt = action.now
        }
      }

      let nextState: AppState = { ...state, journey }

      if (journey.checkin.enabled) {
        if (nowPast(journey.checkin.nextDueAt, action.now)) {
          const raised = raiseCheckin(nextState, journey, 'scheduled', action.now)
          nextState = raised.state
          journey = raised.journey
        }
        if (journey.stoppedSince !== null && action.now - journey.stoppedSince >= state.settings.checkin.stopMinutes * 60_000) {
          const raised = raiseCheckin(nextState, journey, 'stop', action.now)
          nextState = raised.state
          journey = raised.journey
        }
        const arrival = journey.startedAt + (journey.plannedDurationMin + journey.extendedMin) * 60_000 + journey.pausedMs
        if (action.now > arrival + ARRIVAL_GRACE_MS) {
          const raised = raiseCheckin(nextState, journey, 'overdue', action.now)
          nextState = raised.state
          journey = raised.journey
        }
        nextState = { ...nextState, journey }
        nextState = escalateIfDue(nextState, nextState.journey!, action.now)
      }

      if (nextState.sos) {
        const ticked = tickSos(nextState, nextState.sos, action.now, action.online)
        if (ticked !== nextState.sos) nextState = { ...nextState, sos: ticked }
      }

      // Avoid pointless renders when nothing changed.
      const before = current
      const after = nextState.journey!
      const changed =
        before.progress !== after.progress ||
        before.position.lat !== after.position.lat ||
        before.position.lng !== after.position.lng ||
        before.lastFixAt !== after.lastFixAt ||
        before.offline !== after.offline ||
        before.checkin.pending?.id !== after.checkin.pending?.id ||
        before.checkin.pending?.escalatedAt !== after.checkin.pending?.escalatedAt
      if (!changed && nextState.sos === state.sos && nextState.alerts === state.alerts) return state
      return nextState
    }
    case 'journey/pause': {
      const journey = state.journey
      if (!journey || journey.status !== 'active') return state
      const paused = addJourneyEvent(
        {
          ...journey,
          status: 'paused',
          pausedAt: action.now,
          checkin: { ...journey.checkin, nextDueAt: journey.checkin.nextDueAt + 0 },
        },
        { at: action.now, kind: 'paused' },
      )
      return { ...state, journey: paused }
    }
    case 'journey/resume': {
      const journey = state.journey
      if (!journey || journey.status !== 'paused' || !journey.pausedAt) return state
      const pausedFor = action.now - journey.pausedAt
      const resumed = addJourneyEvent(
        {
          ...journey,
          status: 'active',
          pausedMs: journey.pausedMs + pausedFor,
          pausedAt: null,
          checkin: {
            ...journey.checkin,
            nextDueAt: journey.checkin.nextDueAt + pausedFor,
          },
          lastFixAt: action.now,
        },
        { at: action.now, kind: 'resumed' },
      )
      return { ...state, journey: resumed }
    }
    case 'journey/checkin': {
      const journey = state.journey
      if (!journey?.checkin.pending) return state
      return resolvePending(state, journey, action.response, action.now, action.extraMin ?? 0)
    }
    case 'journey/extend': {
      const journey = state.journey
      if (!journey || journey.status === 'ended') return state
      const minutes = Math.max(1, Math.min(60, Math.round(action.minutes)))
      let next: Journey = {
        ...journey,
        extendedMin: journey.extendedMin + minutes,
        checkin: {
          ...journey.checkin,
          nextDueAt: action.now + journey.checkin.intervalMin * 60_000,
        },
      }
      next = addJourneyEvent(next, { at: action.now, kind: 'checkin-extended' })
      if (action.note?.trim()) {
        next = addJourneyEvent(next, { at: action.now, kind: 'note', detail: `+${minutes} min · ${action.note.trim()}` })
      }
      return {
        ...state,
        journey: next,
        alerts: state.alerts.map((alert) => (alert.kind === 'checkin' ? { ...alert, read: true } : alert)),
      }
    }
    case 'journey/checkin-now': {
      const journey = state.journey
      if (!journey || journey.status === 'ended') return state
      const next = addJourneyEvent(
        {
          ...journey,
          stoppedSince: null,
          checkin: {
            ...journey.checkin,
            nextDueAt: action.now + journey.checkin.intervalMin * 60_000,
          },
        },
        { at: action.now, kind: 'note', detail: 'Manual check-in' },
      )
      return {
        ...state,
        journey: next,
        alerts: state.alerts.map((alert) => (alert.kind === 'checkin' ? { ...alert, read: true } : alert)),
      }
    }
    case 'journey/simulate': {
      const journey = state.journey
      if (!journey || journey.status === 'ended') return state
      if (action.kind === 'deviation') {
        const raised = raiseCheckin(state, journey, 'deviation', action.now)
        return { ...raised.state, journey: raised.journey }
      }
      const stopped = {
        ...journey,
        stoppedSince: action.now - state.settings.checkin.stopMinutes * 60_000,
      }
      return { ...state, journey: stopped }
    }
    case 'journey/end': {
      const journey = state.journey
      if (!journey || journey.status === 'ended') return state
      const ended: Journey = addJourneyEvent(
        {
          ...journey,
          status: 'ended',
          endedAt: action.now,
          progress: journeyProgressAt(journey, action.now),
          sharing: { ...journey.sharing, revokedAt: action.now },
          checkin: {
            ...journey.checkin,
            pending: null,
            history: journey.checkin.pending
              ? journey.checkin.history.map((c) =>
                  c.id === journey.checkin.pending?.id
                    ? { ...c, resolvedAt: action.now, resolution: 'ok' as const }
                    : c,
                )
              : journey.checkin.history,
          },
        },
        { at: action.now, kind: 'journey-ended' },
      )
      let next: AppState = { ...state, journey: ended }
      if (state.sos?.status === 'active') {
        next = {
          ...next,
          sos: {
            ...state.sos,
            share: state.sos.share ? { ...state.sos.share, revokedAt: action.now } : null,
          },
        }
      }
      return addAlert(next, {
        dedupeKey: `journey-end:${journey.id}`,
        kind: 'share',
        severity: 'info',
        at: action.now,
        title: 'Journey ended, sharing stopped',
        titleHi: 'यात्रा समाप्त, साझा करना बंद',
        body: 'The journey sharing session was revoked. Contacts no longer receive updates.',
        bodyHi: 'यात्रा साझा सत्र रद्द कर दिया गया। संपर्कों को अब अपडेट नहीं मिलेंगे।',
      })
    }
    case 'journey/note': {
      const journey = state.journey
      if (!journey) return state
      return {
        ...state,
        journey: addJourneyEvent(journey, { at: action.now, kind: 'note', detail: action.text }),
      }
    }
    case 'share/revoke': {
      if (!state.journey?.sharing || state.journey.sharing.revokedAt) return state
      const journey = addJourneyEvent(
        { ...state.journey, sharing: { ...state.journey.sharing, revokedAt: action.now } },
        { at: action.now, kind: 'share-revoked' },
      )
      return {
        ...state,
        journey,
        alerts: state.alerts.map((a) => (a.kind === 'share' ? { ...a, read: true } : a)),
      }
    }
    case 'sos/activate': {
      if (state.sos?.status === 'active') return state
      const journey = state.journey && state.journey.status === 'active' ? state.journey : null
      const contactIds = (journey ? journey.sharing.contactIds : bumpShareContacts(state))
      const recipients = contactIds.length > 0 ? contactIds : bumpShareContacts(state)
      const actions = sosActionsFor(state, recipients, action.now)
      const share = createShare(action.now, recipients, SOS_SHARE_TTL, action.token)
      const sos: SosEvent = {
        id: uid('sos'),
        activatedAt: action.now,
        status: actions.length === 0 ? 'active' : 'active',
        journeyId: journey?.id ?? null,
        contactIds: recipients,
        actions,
        share,
        ack: null,
        cancelledAt: null,
        sharedFacts: {
          ...deriveFacts(state, journey),
          contactsNotified: recipients.length,
        },
      }
      let next: AppState = { ...state, sos }
      if (journey) {
        const updated = addJourneyEvent(
          {
            ...journey,
            checkin: journey.checkin.pending
              ? {
                  ...journey.checkin,
                  pending: { ...journey.checkin.pending, resolvedAt: action.now, resolution: 'help' },
                  history: journey.checkin.history.map((c) =>
                    c.id === journey.checkin.pending?.id
                      ? { ...c, resolvedAt: action.now, resolution: 'help' as const }
                      : c,
                  ),
                }
              : journey.checkin,
          },
          { at: action.now, kind: 'sos-started' },
        )
        next = { ...next, journey: updated }
      }
      return addAlert(next, {
        dedupeKey: `sos:${sos.id}`,
        kind: 'sos',
        severity: 'danger',
        at: action.now,
        title: 'SOS activated',
        titleHi: 'SOS सक्रिय',
        body: 'Saath is using simulation until a trusted contact responds. Your device calling option remains available.',
        bodyHi: 'किसी भरोसेमंद संपर्क के जवाब तक साथ सिम्युलेशन का उपयोग कर रहा है। आपके डिवाइस से कॉल का विकल्प उपलब्ध है।',
      })
    }
    case 'sos/cancel': {
      if (!state.sos || state.sos.status !== 'active') return state
      const sos: SosEvent = {
        ...state.sos,
        status: 'cancelled',
        cancelledAt: action.now,
        cancelReason: action.reason,
        actions: state.sos.actions.map((a) =>
          ['pending', 'calling', 'sent'].includes(a.state)
            ? { ...a, state: 'cancelled', updatedAt: action.now }
            : a,
        ),
        share: state.sos.share ? { ...state.sos.share, revokedAt: action.now } : null,
      }
      return addAlert(
        { ...state, sos },
        {
          dedupeKey: `sos-cancel:${sos.id}`,
          kind: 'sos',
          severity: 'warn',
          at: action.now,
          title: 'SOS cancelled',
          titleHi: 'SOS रद्द',
          body: 'New sharing stopped and the simulated share link was revoked. Contacts who already received details may still have them.',
          bodyHi: 'नई शेयरिंग रुक गई और सिम्युलेटेड लिंक रद्द हो गया। जिन संपर्कों को जानकारी मिल चुकी है, उनके पास वह रह सकती है।',
        },
      )
    }
    case 'sos/action': {
      if (!state.sos) return state
      return { ...state, sos: markAction(state.sos, action.actionId, action.state, action.now, action.note) }
    }
    case 'sos/retry': {
      if (!state.sos || state.sos.status !== 'active') return state
      const actions = state.sos.actions.map((a) =>
        a.id === action.actionId && ['failed', 'unanswered', 'cancelled'].includes(a.state)
          ? { ...a, state: 'pending' as const, updatedAt: action.now, attempts: a.attempts + 1, note: 'Retrying' }
          : a,
      )
      return { ...state, sos: { ...state.sos, actions } }
    }
    case 'sos/ack': {
      if (!state.sos || state.sos.ack) return state
      const contact = state.contacts.find((c) => c.id === action.contactId)
      const sos: SosEvent = {
        ...state.sos,
        ack: { byContactId: action.contactId, at: action.now, channel: 'simulated-ai-call' },
        actions: state.sos.actions.map((a) =>
          a.kind === 'ai' && a.contactId === action.contactId
            ? { ...a, state: 'acknowledged', updatedAt: action.now }
            : a,
        ),
      }
      return addAlert(
        { ...state, sos },
        {
          dedupeKey: `ack:${sos.id}`,
          kind: 'sos',
          severity: 'warn',
          at: action.now,
          title: 'Alert acknowledged',
          titleHi: 'अलर्ट की पुष्टि हुई',
          body: `${contact?.name ?? 'Your contact'} acknowledged receiving the alert in the simulation. Acknowledgement does not confirm that help is on the way.`,
          bodyHi: `${contact?.name ?? 'आपके संपर्क'} ने सिम्युलेशन में अलर्ट मिलने की पुष्टि की। पुष्टि का मतलब यह नहीं कि मदद आ रही है।`,
        },
      )
    }
    case 'sos/close':
      if (!state.sos) return state
      return { ...state, sos: { ...state.sos, status: 'ended' } }
    case 'sos/share-revoke': {
      if (!state.sos?.share || state.sos.share.revokedAt) return state
      return {
        ...state,
        sos: { ...state.sos, share: { ...state.sos.share, revokedAt: action.now } },
      }
    }
    case 'report/add':
      return { ...state, reports: [action.report, ...state.reports] }
    case 'report/moderate': {
      return {
        ...state,
        reports: state.reports.map((r) =>
          r.id === action.id && r.status === 'pending'
            ? {
                ...r,
                status: action.decision,
                shareWithRoutes: action.decision === 'approved' ? r.shareWithRoutes : false,
                moderation: { at: action.now, decision: action.decision, reason: action.reason },
              }
            : r,
        ),
      }
    }
    case 'report/delete':
      return { ...state, reports: state.reports.filter((r) => r.id !== action.id) }
    case 'alerts/read':
      return { ...state, alerts: state.alerts.map((a) => ({ ...a, read: true })) }
    case 'alerts/clear':
      return { ...state, alerts: [] }
    case 'data/clear': {
      return {
        ...state,
        contacts: [],
        plan: null,
        journey: null,
        sos: null,
        reports: [],
        alerts: [],
        lastActiveAt: action.now,
      }
    }
    case 'data/reset': {
      return { ...createInitialState(action.now), reports: [] }
    }
    case 'demo/seed': {
      const existingIds = new Set(state.contacts.map((c) => c.id))
      const demo = DEMO_CONTACTS.filter((c) => !existingIds.has(c.id)).map((c) => ({
        ...c,
        share: { ...c.share },
        createdAt: action.now,
      }))
      const reportIds = new Set(state.reports.map((r) => r.id))
      const reports = [
        ...state.reports,
        ...DEMO_REPORTS.filter((r) => !reportIds.has(r.id)).map((r) => ({ ...r })),
      ]
      return {
        ...state,
        contacts: normalizePriorities([...state.contacts, ...demo]),
        reports,
        profile: { ...state.profile, name: state.profile.name || 'Aanya (demo)' },
      }
    }
    default:
      return state
  }
}

function nowPast(timestamp: number, now: number): boolean {
  return now >= timestamp
}
