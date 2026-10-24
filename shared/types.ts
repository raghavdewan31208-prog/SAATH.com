/** Domain types shared by the client, server adapters and unit tests. */

export type Lang = 'en' | 'hi'
export type ThemePref = 'system' | 'light' | 'dark'
export type PermissionValue = 'unknown' | 'granted' | 'denied' | 'unsupported'

export interface LatLng {
  lat: number
  lng: number
}

export interface Place {
  label: string
  lat: number
  lng: number
  kind: 'current' | 'manual' | 'demo'
}

export interface ContactSharePrefs {
  location: boolean
  journey: boolean
  notes: boolean
}

export interface Contact {
  id: string
  name: string
  relation: string
  phone: string
  priority: number
  share: ContactSharePrefs
  /** Explicit opt-in for simulated AI calls. Never assumed. */
  aiConsent: boolean
  isDemo?: boolean
  createdAt: number
}

export interface SosConfig {
  shareLocation: boolean
  callPriority: boolean
  aiCall: boolean
  openDialer: boolean
}

export interface CheckinSettings {
  intervalMin: number
  stopMinutes: number
  deviationMeters: number
  escalate: boolean
  /** Seconds after a check-in prompt before a simulated escalation. */
  graceSeconds: number
}

export interface Settings {
  sos: SosConfig
  checkin: CheckinSettings
  contactDefaults: ContactSharePrefs
  /** Master switch: prompt a check-in on deviation / stop / overdue arrival. */
  safetyCheckins: boolean
  aiCallsAllowed: boolean
}

export interface Profile {
  name: string
  lang: Lang
  theme: ThemePref
  onboardedAt: number | null
  permissions: {
    location: PermissionValue
    notifications: PermissionValue
    microphone: PermissionValue
  }
}

export type ObservationKind = 'lighting' | 'walkway' | 'transport' | 'incident' | 'activity'
export type Confidence = 'low' | 'medium' | 'high'
export type ObservationSource = 'sample' | 'community' | 'osm'

export interface Observation {
  id: string
  kind: ObservationKind
  summary: string
  observedAt: number
  source: ObservationSource
  confidence: Confidence
  status: 'approved' | 'pending'
  /** Explicit polarity keeps comparison deterministic instead of guessing from text. */
  polarity: 'positive' | 'negative' | 'neutral'
  detail?: string
}

export interface TransportInfo {
  available: boolean
  modes: string[]
  waitMinutes: number | null
  note?: string
}

export interface RouteOption {
  id: string
  label: string
  summary: string
  durationMin: number
  distanceKm: number
  geometry: LatLng[]
  source: 'sample' | 'osm'
  observations: Observation[]
  transport: TransportInfo
  warnings: string[]
}

export interface RoutePlan {
  id: string
  createdAt: number
  start: Place
  destination: Place
  routes: RouteOption[]
  recommendedId: string | null
  reasons: string[]
  confidence: Confidence
  area: 'demo' | 'outside-demo'
  dataNote: string
  liveGeometry: boolean
}

export interface CheckinEvent {
  id: string
  kind: 'scheduled' | 'deviation' | 'stop' | 'overdue'
  raisedAt: number
  resolvedAt: number | null
  resolution: 'ok' | 'extended' | 'help' | 'auto-escalated' | null
  escalatedAt: number | null
  /** Set when the pending prompt escalates to a contact. */
  escalatedToContactId?: string
}

export interface ShareSession {
  token: string
  createdAt: number
  expiresAt: number
  contactIds: string[]
  revokedAt: number | null
  /** Saath has no sharing backend in this MVP; links are explicitly simulated. */
  simulated: true
}

export interface JourneyEvent {
  id: string
  at: number
  kind:
    | 'started'
    | 'paused'
    | 'resumed'
    | 'checkin-raised'
    | 'checkin-ok'
    | 'checkin-extended'
    | 'checkin-help'
    | 'escalated'
    | 'share-started'
    | 'share-revoked'
    | 'journey-ended'
    | 'sos-started'
    | 'note'
  label?: string
  detail?: string
}

export type JourneyStatus = 'active' | 'paused' | 'ended'

export interface Journey {
  id: string
  startedAt: number
  endedAt: number | null
  status: JourneyStatus
  route: RouteOption
  start: Place
  destination: Place
  plannedDurationMin: number
  extendedMin: number
  progress: number
  position: LatLng
  positionSource: 'simulated' | 'device'
  lastFixAt: number
  pausedAt: number | null
  pausedMs: number
  sharing: ShareSession
  checkin: {
    enabled: boolean
    intervalMin: number
    nextDueAt: number
    pending: CheckinEvent | null
    history: CheckinEvent[]
  }
  events: JourneyEvent[]
  stoppedSince: number | null
  offline: boolean
}

export type SosActionKind = 'share' | 'call' | 'ai' | 'dialer'
export type SosActionState =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'calling'
  | 'answered'
  | 'unanswered'
  | 'acknowledged'
  | 'failed'
  | 'opened'
  | 'cancelled'

export interface SosAction {
  id: string
  kind: SosActionKind
  contactId?: string
  state: SosActionState
  createdAt: number
  updatedAt: number
  attempts: number
  provider: 'simulation' | 'device'
  note?: string
}

export type SosStatus = 'active' | 'cancelled' | 'ended'

export interface SosAcknowledgement {
  byContactId: string
  at: number
  channel: 'simulated-ai-call' | 'manual-demo'
}

export interface SosEvent {
  id: string
  activatedAt: number
  status: SosStatus
  journeyId: string | null
  contactIds: string[]
  actions: SosAction[]
  share: ShareSession | null
  ack: SosAcknowledgement | null
  cancelReason?: string
  cancelledAt: number | null
  /** Facts the AI assistant is allowed to read out. */
  sharedFacts: {
    location: LatLng | null
    locationAt: number | null
    destination: string | null
    journeyActive: boolean
    contactsNotified: number
  }
}

export type ReportCategory =
  | 'lighting'
  | 'walkway'
  | 'harassment'
  | 'stray'
  | 'transport'
  | 'other'

export type ReportStatus = 'pending' | 'approved' | 'rejected'

export interface ReportAiSuggestion {
  category: ReportCategory
  duplicateIds: string[]
  note: string
  source: 'local-rules' | 'provider'
}

export interface Report {
  id: string
  createdAt: number
  category: ReportCategory
  description: string
  areaLabel: string
  coarseLocation: LatLng | null
  status: ReportStatus
  anonymous: true
  aiSuggestion: ReportAiSuggestion | null
  moderation: {
    at: number
    decision: 'approved' | 'rejected'
    reason?: string
  } | null
  /** A moderator must approve before this can inform any route comparison. */
  shareWithRoutes: boolean
}

export type AlertKind = 'checkin' | 'escalation' | 'sos' | 'share' | 'system'

export interface AppAlert {
  id: string
  kind: AlertKind
  title: string
  titleHi: string
  body: string
  bodyHi: string
  at: number
  read: boolean
  dedupeKey: string
  severity: 'info' | 'warn' | 'danger'
}

export interface AppState {
  version: number
  profile: Profile
  contacts: Contact[]
  settings: Settings
  plan: RoutePlan | null
  journey: Journey | null
  sos: SosEvent | null
  reports: Report[]
  alerts: AppAlert[]
  lastActiveAt: number
}

/** The AI's small, fixed action set. No unrestricted tool access. */
export type AssistantActionKind =
  | 'read_location'
  | 'read_journey'
  | 'read_contacts_notified'
  | 'request_acknowledgement'
  | 'end_call'

export interface AssistantAction {
  kind: AssistantActionKind
  acknowledged?: boolean
}

export interface AssistantTurn {
  reply: string
  action: AssistantAction
  /** Facts actually used in the reply, for the audit line in the UI. */
  usedFacts: string[]
}
