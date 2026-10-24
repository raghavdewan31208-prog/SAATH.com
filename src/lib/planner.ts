import { DEMO_AREA, demoRouteOptions, inDemoArea } from '@shared/demo'
import { approvedRouteReports } from '@shared/reporting'
import { recommendRoutes } from '@shared/recommend'
import type { LatLng, Place, Report, RouteOption, RoutePlan } from '@shared/types'

let planCounter = 0

function planId(): string {
  planCounter += 1
  return `plan-${Date.now().toString(36)}-${planCounter}`
}

export function buildDemoPlan(start: Place, destination: Place, reports: Report[], now: number): RoutePlan {
  const routes = demoRouteOptions(now, approvedRouteReports(reports))
  const recommendation = recommendRoutes(routes, now)
  return {
    id: planId(),
    createdAt: now,
    start,
    destination,
    routes,
    recommendedId: recommendation.recommendedId,
    reasons: recommendation.reasons,
    confidence: recommendation.confidence,
    area: 'demo',
    dataNote:
      'Conditions come from Saath’s fictional sample dataset for the Koramangala demo area. Map tiles are real; observations are not live data.',
    liveGeometry: false,
  }
}

interface OsrmRoute {
  duration: number
  distance: number
  geometry: { coordinates: [number, number][] }
}

interface OsrmResponse {
  code: string
  routes?: OsrmRoute[]
}

function osrmRouteToOption(route: OsrmRoute, index: number): RouteOption {
  return {
    id: `osrm-${index + 1}`,
    label: index === 0 ? 'Fastest route' : `Alternative ${index}`,
    summary: 'Live road routing. Walking conditions are unknown.',
    durationMin: Math.max(1, Math.round(route.duration / 60)),
    distanceKm: Math.round((route.distance / 1000) * 10) / 10,
    geometry: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
    source: 'osm',
    observations: [],
    transport: { available: false, modes: [], waitMinutes: null, note: 'Transport information is unknown for this area.' },
    warnings: ['Lighting, walkway and recent-incident information is unavailable for this area.'],
  }
}

/** OSRM's public demo server provides live alternative road routes. */
export async function fetchLivePlan(
  start: Place,
  destination: Place,
  now: number,
): Promise<RoutePlan> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${start.lng},${start.lat};${destination.lng},${destination.lat}` +
    `?alternatives=3&overview=full&geometries=geojson&steps=false`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 9000)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`routing-${res.status}`)
    const data = (await res.json()) as OsrmResponse
    if (data.code !== 'Ok' || !data.routes?.length) throw new Error('no-route')
    const routes = data.routes.slice(0, 3).map(osrmRouteToOption)
    const recommendation = recommendRoutes(routes, now)
    return {
      id: planId(),
      createdAt: now,
      start,
      destination,
      routes,
      recommendedId: routes.length > 1 ? recommendation.recommendedId : routes[0].id,
      reasons:
        routes.length > 1
          ? recommendation.reasons
          : ['Only one live route is available for this start and destination.'],
      confidence: 'low',
      area: 'outside-demo',
      dataNote:
        'Travel time, distance and geometry are live from the OSRM public routing service. Lighting, walkway, activity, incidents and public-transport waits are Unknown for this area. Missing reports are not evidence of safety.',
      liveGeometry: true,
    }
  } finally {
    clearTimeout(timer)
  }
}

export function destinationIsDemoArea(destination: LatLng): boolean {
  return inDemoArea(destination)
}

export const DEMO_AREA_LABEL = DEMO_AREA.label

export function parseCoordinates(value: string): LatLng | null {
  const parts = value.split(',').map((p) => Number.parseFloat(p.trim()))
  if (parts.length !== 2 || parts.some((n) => Number.isNaN(n))) return null
  const [lat, lng] = parts
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}
