import type { Confidence, Lang, Observation, ObservationKind, RouteOption } from './types'

export interface Recommendation {
  recommendedId: string | null
  reasons: string[]
  confidence: Confidence
  coverage: number
}

const CONFIDENCE_SCORE: Record<Confidence, number> = { low: 1, medium: 2, high: 3 }

export function pickObservation(route: RouteOption, kind: ObservationKind): Observation | null {
  const matches = route.observations
    .filter((o) => o.kind === kind && o.status === 'approved')
    .sort((a, b) => b.observedAt - a.observedAt)
  return matches[0] ?? null
}

const CONDITION_KINDS: ObservationKind[] = ['lighting', 'walkway', 'activity', 'incident']

export function routeCoverage(route: RouteOption): number {
  let known = 0
  for (const kind of CONDITION_KINDS) {
    if (pickObservation(route, kind)) known += 1
  }
  if (route.transport.available && route.transport.waitMinutes !== null) known += 1
  return known / (CONDITION_KINDS.length + 1)
}

/** Deterministic, explainable comparison. AI never decides the recommendation. */
export function scoreRoute(route: RouteOption, now = Date.now()): number {
  let score = 100 - route.durationMin * 0.9

  const lighting = pickObservation(route, 'lighting')
  if (lighting) {
    if (lighting.polarity === 'negative') score -= 16
    if (lighting.polarity === 'positive') score += 6 + CONFIDENCE_SCORE[lighting.confidence]
  } else {
    score -= 3 // uncertainty, not a claim of danger
  }

  const walkway = pickObservation(route, 'walkway')
  if (walkway?.polarity === 'negative') score -= 10
  if (walkway?.polarity === 'positive') score += 3

  const activity = pickObservation(route, 'activity')
  if (activity?.polarity === 'negative') score -= 5

  const incident = pickObservation(route, 'incident')
  if (incident && incident.polarity === 'negative') {
    const ageDays = Math.max(0, (now - incident.observedAt) / 86_400_000)
    score -= ageDays <= 14 ? 6 : 2
  }

  if (route.transport.available) {
    score += 4
    if (route.transport.waitMinutes !== null && route.transport.waitMinutes <= 12) score += 2
  } else {
    score -= 2
  }

  return Math.round(score * 10) / 10
}

function ageDays(observation: Observation): number {
  return Math.max(0, (Date.now() - observation.observedAt) / 86_400_000)
}

function freshnessPhrase(observation: Observation): string {
  const d = ageDays(observation)
  if (d < 1) return 'verified in the last day'
  if (d < 2) return 'verified 1 day ago'
  return `verified ${Math.round(d)} days ago`
}

/**
 * Produces the human-readable reasoning behind the recommendation. These strings
 * are built from approved observations only; unavailable facts stay "unknown".
 */
export function recommendRoutes(routes: RouteOption[], now = Date.now()): Recommendation {
  if (routes.length === 0) {
    return { recommendedId: null, reasons: [], confidence: 'low', coverage: 0 }
  }

  const ranked = [...routes].sort((a, b) => scoreRoute(b, now) - scoreRoute(a, now))
  const recommended = ranked[0]
  const other = ranked[1] ?? null
  const reasons: string[] = []

  if (other) {
    const diff = recommended.durationMin - other.durationMin
    if (diff > 0) {
      reasons.push(
        `${diff} minute${diff === 1 ? '' : 's'} longer than ${other.label}, but the conditions below weighed in its favour.`,
      )
    } else if (diff < 0) {
      reasons.push(`${Math.abs(diff)} minute${Math.abs(diff) === 1 ? '' : 's'} shorter than ${other.label}.`)
    } else {
      reasons.push(`Same travel time as ${other.label}.`)
    }

    const recLight = pickObservation(recommended, 'lighting')
    const otherLight = pickObservation(other, 'lighting')
    if (recLight && recLight.polarity === 'positive' && (!otherLight || otherLight.polarity === 'negative')) {
      const otherPhrase = otherLight
        ? ` The alternative's latest lighting note is negative and was ${freshnessPhrase(otherLight)}.`
        : ' The alternative has no recent lighting observation.'
      reasons.push(`More recently verified lighting along the walking section — ${freshnessPhrase(recLight)}.${otherPhrase}`)
    } else if (recLight && otherLight && recLight.polarity === 'positive' && otherLight.polarity === 'positive') {
      reasons.push(`Lighting is positive on both routes; the recommended one was ${freshnessPhrase(recLight)}.`)
    }

    const recWalk = pickObservation(recommended, 'walkway')
    const otherWalk = pickObservation(other, 'walkway')
    if (otherWalk?.polarity === 'negative' && recWalk?.polarity !== 'negative') {
      reasons.push(`${other.label} has an unresolved walkway issue: ${otherWalk.summary}`)
    }

    if (recommended.transport.available && !other.transport.available) {
      const wait = recommended.transport.waitMinutes
      reasons.push(
        wait === null
          ? 'Public transport is available on this route; the wait is unknown.'
          : `Public transport is available on this route with an estimated ${wait}-minute wait (sample timetable).`,
      )
    } else if (!recommended.transport.available) {
      reasons.push('No direct public transport on this route; the wait is unknown.')
    }

    if (recommended.warnings.length > 0) {
      reasons.push(`Still check: ${recommended.warnings[0]}`)
    }
  }

  const allKnownKinds = new Set<string>()
  for (const route of routes) {
    for (const kind of CONDITION_KINDS) {
      if (pickObservation(route, kind)) allKnownKinds.add(kind)
    }
  }
  if (allKnownKinds.size < CONDITION_KINDS.length) {
    reasons.push('Some information is unavailable and shown as Unknown. Missing reports are not evidence that a route is safe.')
  }

  const avgCoverage = routes.reduce((sum, r) => sum + routeCoverage(r), 0) / routes.length
  let confidence: Confidence = avgCoverage >= 0.9 ? 'high' : avgCoverage >= 0.6 ? 'medium' : 'low'
  // Sample-only data is capped at medium confidence.
  if (routes.every((r) => r.source === 'sample')) confidence = confidence === 'high' ? 'medium' : confidence

  const described = reasons.length > 0
  if (!described) {
    reasons.push('Travel time and distance are available, but condition observations are Unknown. Compare with your own knowledge.')
  }

  return {
    recommendedId: recommended.id,
    reasons: reasons.slice(0, 5),
    confidence,
    coverage: Math.round(avgCoverage * 100) / 100,
  }
}

export function formatAge(then: number, now: number, lang: Lang): string {
  const diff = Math.max(0, now - then)
  const min = Math.floor(diff / 60_000)
  const hr = Math.floor(diff / 3_600_000)
  const day = Math.floor(diff / 86_400_000)
  if (lang === 'hi') {
    if (min < 2) return 'अभी'
    if (min < 60) return `${min} मिनट पहले`
    if (hr < 24) return `${hr} घंटे पहले`
    if (day < 30) return `${day} दिन पहले`
    return `${Math.floor(day / 30)} महीने पहले`
  }
  if (min < 2) return 'just now'
  if (min < 60) return `${min} min ago`
  if (hr < 24) return `${hr} hr ago`
  if (day < 30) return `${day} day${day === 1 ? '' : 's'} ago`
  return `${Math.floor(day / 30)} month${day < 60 ? '' : 's'} ago`
}

export function confidenceLabel(c: Confidence, lang: Lang): string {
  if (lang === 'hi') return c === 'high' ? 'उच्च' : c === 'medium' ? 'मध्यम' : 'कम'
  return c === 'high' ? 'High' : c === 'medium' ? 'Medium' : 'Low'
}

export function observationSourceLabel(source: Observation['source'], lang: Lang): string {
  if (lang === 'hi') {
    return source === 'sample'
      ? 'साथ नमूना डेटा'
      : source === 'community'
        ? 'समुदाय रिपोर्ट (स्वीकृत)'
        : 'मानचित्र डेटा'
  }
  return source === 'sample'
    ? 'Saath sample dataset'
    : source === 'community'
      ? 'Community report (approved)'
      : 'Map data'
}
