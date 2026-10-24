import type {
  Contact,
  LatLng,
  Place,
  Report,
  RouteOption,
  Settings,
  AppState,
} from './types'

/**
 * Fictional demo dataset for a small, walkable area of Koramangala 5th Block,
 * Bengaluru. Every observation, contact and report here is sample data written
 * for this demo — it is not live condition data and must never be presented as
 * such in the UI.
 */
export const DEMO_AREA = {
  id: 'koramangala-5th-block',
  label: 'Koramangala 5th Block (demo area)',
  center: { lat: 12.9338, lng: 77.6186 } as LatLng,
  bounds: { south: 12.9255, west: 77.6045, north: 12.9405, east: 77.6325 },
}

export function inDemoArea(p: LatLng): boolean {
  const b = DEMO_AREA.bounds
  return p.lat >= b.south && p.lat <= b.north && p.lng >= b.west && p.lng <= b.east
}

export const DEMO_START: Place = {
  label: '80 Feet Road, 4th Block',
  lat: 12.9338,
  lng: 77.6265,
  kind: 'demo',
}

export const DEMO_DESTINATION: Place = {
  label: 'Forum Mall, Hosur Road',
  lat: 12.9342,
  lng: 77.6102,
  kind: 'demo',
}

/** A tiny offline place list. Saath has no geocoder in this MVP. */
export const DEMO_PLACES: Place[] = [
  DEMO_START,
  DEMO_DESTINATION,
  { label: 'Sony World Junction', lat: 12.9332, lng: 77.6129, kind: 'demo' },
  { label: '5th Block Park gate', lat: 12.9318, lng: 77.6222, kind: 'demo' },
  { label: '30th Main bus stop', lat: 12.9358, lng: 77.6215, kind: 'demo' },
  { label: 'Christ University main gate', lat: 12.9364, lng: 77.6062, kind: 'demo' },
  { label: 'Koramangala 6th Block, 80 Feet Road', lat: 12.9389, lng: 77.6238, kind: 'demo' },
]

const HOUR = 3_600_000
const DAY = 24 * HOUR

export function demoRouteOptions(now: number, approvedReports: Report[] = []): RouteOption[] {
  const routeA: RouteOption = {
    id: 'demo-main-road',
    label: '30th Main → Hosur Road',
    summary: 'Main roads, bus option, more verified observations',
    durationMin: 21,
    distanceKm: 1.6,
    source: 'sample',
    geometry: [
      { lat: 12.9338, lng: 77.6265 },
      { lat: 12.9349, lng: 77.6242 },
      { lat: 12.9358, lng: 77.6215 },
      { lat: 12.9362, lng: 77.6185 },
      { lat: 12.9352, lng: 77.6155 },
      { lat: 12.9342, lng: 77.6125 },
      { lat: 12.9342, lng: 77.6102 },
    ],
    observations: [
      {
        id: 'obs-a-light',
        polarity: 'positive',
        kind: 'lighting',
        summary: 'Street lights working along 30th Main and the Hosur Road service lane.',
        detail: 'Walking survey covered both sides of the road. One stretch near the bus stop has no footpath light.',
        observedAt: now - 2 * DAY,
        source: 'sample',
        confidence: 'high',
        status: 'approved',
      },
      {
        id: 'obs-a-walk',
        polarity: 'neutral',
        kind: 'walkway',
        summary: 'Continuous footpath, narrow near the 30th Main bus stop.',
        observedAt: now - 6 * DAY,
        source: 'sample',
        confidence: 'medium',
        status: 'approved',
      },
      {
        id: 'obs-a-incident',
        polarity: 'negative',
        kind: 'incident',
        summary: 'Anonymous verbal-harassment report logged near the 30th Main junction.',
        detail: 'Reported to Saath sample moderation; no person is named. A report does not prove current conditions.',
        observedAt: now - 9 * DAY,
        source: 'sample',
        confidence: 'medium',
        status: 'approved',
      },
      {
        id: 'obs-a-activity',
        polarity: 'positive',
        kind: 'activity',
        summary: 'Shops open until about 22:00 in the sample survey; foot traffic noted as moderate.',
        detail: 'This is a time-stamped human observation, not a crowd measurement.',
        observedAt: now - 3 * DAY,
        source: 'sample',
        confidence: 'medium',
        status: 'approved',
      },
    ],
    transport: {
      available: true,
      modes: ['Bus 352', 'Auto'],
      waitMinutes: 8,
      note: 'Sample timetable suggests service until about 22:30. Not live vehicle data.',
    },
    warnings: ['Footpath is narrow beside the bus stop.'],
  }

  const routeB: RouteOption = {
    id: 'demo-inner-lanes',
    label: '5th Block park lanes',
    summary: 'Shorter walk through inner residential lanes',
    durationMin: 15,
    distanceKm: 1.3,
    source: 'sample',
    geometry: [
      { lat: 12.9338, lng: 77.6265 },
      { lat: 12.9325, lng: 77.6248 },
      { lat: 12.9318, lng: 77.6222 },
      { lat: 12.9325, lng: 77.6192 },
      { lat: 12.9331, lng: 77.616 },
      { lat: 12.9339, lng: 77.6128 },
      { lat: 12.9342, lng: 77.6102 },
    ],
    observations: [
      {
        id: 'obs-b-light',
        polarity: 'negative',
        kind: 'lighting',
        summary: 'Two street lights not working along the park edge; one lane is dark.',
        detail: 'Verified in person the day before this demo was generated.',
        observedAt: now - 1 * DAY,
        source: 'sample',
        confidence: 'high',
        status: 'approved',
      },
      {
        id: 'obs-b-walk',
        polarity: 'negative',
        kind: 'walkway',
        summary: 'Construction material has blocked part of the footpath near the park gate.',
        observedAt: now - 4 * DAY,
        source: 'sample',
        confidence: 'medium',
        status: 'approved',
      },
      {
        id: 'obs-b-activity',
        polarity: 'negative',
        kind: 'activity',
        summary: 'Residents reported very little activity after about 21:30 in the sample survey.',
        detail: 'Sample observation from three residents; not a measurement of the number of people present.',
        observedAt: now - 5 * DAY,
        source: 'sample',
        confidence: 'low',
        status: 'approved',
      },
    ],
    transport: {
      available: false,
      modes: [],
      waitMinutes: null,
      note: 'Nearest bus stop is about 650 m away (sample estimate).',
    },
    warnings: ['No wait estimate: no bus serves this lane directly.'],
  }

  // Approved community reports may inform conditions near their coarse area.
  // Pending or rejected reports are ignored here even if a caller passes them.
  for (const report of approvedReports) {
    if (report.status !== 'approved' || !report.shareWithRoutes) continue
    if (report.category !== 'lighting' && report.category !== 'walkway') continue
    if (!report.coarseLocation) continue
    const candidates = [routeA, routeB].map((route) => ({
      route,
      distance: Math.min(...route.geometry.map((point) => metersApart(report.coarseLocation!, point))),
    }))
    candidates.sort((a, b) => a.distance - b.distance)
    const nearest = candidates[0]
    if (!nearest || nearest.distance > 500) continue
    nearest.route.observations.push({
      id: `report-${report.id}`,
      kind: report.category,
      summary:
        report.category === 'lighting'
          ? `Approved community lighting report: ${report.description}`
          : `Approved community walkway report: ${report.description}`,
      observedAt: report.createdAt,
      source: 'community',
      confidence: 'low',
      status: 'approved',
      polarity: 'negative',
    })
  }

  return [routeA, routeB]
}

export const DEMO_CONTACTS: Contact[] = [
  {
    id: 'contact-meera',
    name: 'Meera Sharma',
    relation: 'Sister · demo contact',
    phone: '+91 00000 00001',
    priority: 1,
    share: { location: true, journey: true, notes: true },
    aiConsent: true,
    isDemo: true,
    createdAt: 0,
  },
  {
    id: 'contact-arjun',
    name: 'Arjun Nair',
    relation: 'Friend · demo contact',
    phone: '+91 00000 00002',
    priority: 2,
    share: { location: true, journey: false, notes: false },
    aiConsent: true,
    isDemo: true,
    createdAt: 0,
  },
  {
    id: 'contact-fatima',
    name: 'Fatima Qureshi',
    relation: 'Colleague · demo contact',
    phone: '+91 00000 00003',
    priority: 3,
    share: { location: false, journey: true, notes: false },
    aiConsent: false,
    isDemo: true,
    createdAt: 0,
  },
]

export const DEMO_REPORTS: Report[] = [
  {
    id: 'report-demo-lighting',
    createdAt: Date.now() - 1 * DAY,
    category: 'lighting',
    description: 'Two lights out along the park edge; the lane is dark for about 40 metres.',
    areaLabel: '5th Block park lane (coarse area)',
    coarseLocation: { lat: 12.932, lng: 77.622 },
    status: 'approved',
    anonymous: true,
    aiSuggestion: null,
    moderation: { at: Date.now() - 20 * HOUR, decision: 'approved', reason: 'Demo moderator approved' },
    shareWithRoutes: true,
  },
  {
    id: 'report-demo-walkway',
    createdAt: Date.now() - 20 * HOUR,
    category: 'walkway',
    description: 'Construction material is blocking half the footpath near the park gate.',
    areaLabel: '5th Block park gate (coarse area)',
    coarseLocation: { lat: 12.9318, lng: 77.6222 },
    status: 'pending',
    anonymous: true,
    aiSuggestion: null,
    moderation: null,
    shareWithRoutes: false,
  },
]

export const DEFAULT_SETTINGS: Settings = {
  sos: {
    shareLocation: true,
    callPriority: true,
    aiCall: true,
    openDialer: false,
  },
  checkin: {
    intervalMin: 15,
    stopMinutes: 6,
    deviationMeters: 300,
    escalate: true,
    graceSeconds: 90,
  },
  contactDefaults: { location: true, journey: true, notes: false },
  safetyCheckins: true,
  aiCallsAllowed: true,
}

export function createInitialState(now = Date.now()): AppState {
  return {
    version: 1,
    profile: {
      name: '',
      lang: 'en',
      theme: 'light',
      onboardedAt: null,
      permissions: { location: 'unknown', notifications: 'unknown', microphone: 'unknown' },
    },
    contacts: [],
    settings: structuredClone(DEFAULT_SETTINGS),
    plan: null,
    journey: null,
    sos: null,
    reports: DEMO_REPORTS.map((r) => ({ ...r })),
    alerts: [],
    lastActiveAt: now,
  }
}

/** Facts used by the simulated assistant. Everything here is authorised data. */
export const SIMULATED_ASSISTANT_LABEL = 'Saath automated assistant (simulation)'

function metersApart(a: LatLng, b: LatLng): number {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}
