import type { AppState, AssistantTurn, Lang, ReportAiSuggestion, ReportCategory } from '@shared/types'

export interface HealthResponse {
  ok: boolean
  serverTime: string
  ai: { configured: boolean; provider: string | null }
  voice: { configured: boolean; provider: string; note: string }
  sharing: { configured: boolean; note: string }
  emergency: { configured: boolean; note: string }
}

const TIMEOUT = 6000

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  if (typeof fetch !== 'function') return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT)
  try {
    const res = await fetch(path, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
      signal: controller.signal,
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export function getHealth(): Promise<HealthResponse | null> {
  return fetchJson<HealthResponse>('/api/health')
}

/**
 * Remote assistant turns exist only when a server-side provider is configured.
 * The app always keeps the local, scripted simulation as the fallback so the
 * safety demonstration works offline and without credentials.
 */
export async function requestRemoteAssistantTurn(input: {
  facts: AppState['sos'] extends infer _ ? NonNullable<AppState['sos']>['sharedFacts'] : never
  contactName: string
  lang: Lang
  input: string
}): Promise<AssistantTurn | null> {
  const response = await fetchJson<AssistantTurn>('/api/ai/agent', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!response || typeof response.reply !== 'string') return null
  const allowed = ['read_location', 'read_journey', 'read_contacts_notified', 'request_acknowledgement', 'end_call']
  if (!response.action || !allowed.includes(response.action.kind)) return null
  return {
    reply: response.reply.slice(0, 900),
    action: response.action,
    usedFacts: Array.isArray(response.usedFacts) ? response.usedFacts.slice(0, 6) : [],
  }
}

export async function requestRemoteReportSuggestion(input: {
  description: string
  category: ReportCategory
  lang: Lang
  existing: { id: string; category: ReportCategory; description: string }[]
}): Promise<ReportAiSuggestion | null> {
  const response = await fetchJson<ReportAiSuggestion>('/api/ai/report', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!response || response.source !== 'provider') return null
  return response
}

export async function requestRemoteRouteExplanation(input: {
  reasons: string[]
  routeLabels: string[]
  lang: Lang
}): Promise<string | null> {
  const response = await fetchJson<{ summary: string }>('/api/ai/route-explain', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!response || typeof response.summary !== 'string') return null
  return response.summary.slice(0, 500)
}
