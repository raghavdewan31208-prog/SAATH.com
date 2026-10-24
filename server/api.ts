/**
 * Web-standard API handlers. Keys are read only on the server; the browser
 * never receives them. When no provider is configured these endpoints return
 * 503 and the client uses its deterministic local simulation.
 */
import type { ReportCategory } from '../shared/types'

export interface ServerEnv {
  SAATH_AI_BASE_URL?: string
  SAATH_AI_API_KEY?: string
  SAATH_AI_MODEL?: string
  SAATH_AI_PROVIDER_LABEL?: string
}

const MAX_BODY_BYTES = 64 * 1024
const REPORT_CATEGORIES: ReportCategory[] = ['lighting', 'walkway', 'harassment', 'stray', 'transport', 'other']
const ASSISTANT_ACTIONS = ['read_location', 'read_journey', 'read_contacts_notified', 'request_acknowledgement', 'end_call']

interface RateBucket {
  count: number
  resetAt: number
}
const rateBuckets = new Map<string, RateBucket>()

function aiConfigured(env: ServerEnv): boolean {
  return Boolean(env.SAATH_AI_BASE_URL && env.SAATH_AI_API_KEY && env.SAATH_AI_MODEL)
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  })
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true
  try {
    return origin === new URL(request.url).origin
  } catch {
    return false
  }
}

function rateLimited(request: Request): boolean {
  const key =
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'local'
  const now = Date.now()
  const bucket = rateBuckets.get(key)
  if (!bucket || bucket.resetAt < now) {
    rateBuckets.set(key, { count: 1, resetAt: now + 60_000 })
    return false
  }
  bucket.count += 1
  if (rateBuckets.size > 500) {
    for (const [entryKey, value] of rateBuckets) {
      if (value.resetAt < now) rateBuckets.delete(entryKey)
    }
  }
  return bucket.count > 40
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  const length = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) return null
  try {
    const text = await request.text()
    if (text.length > MAX_BODY_BYTES) return null
    const parsed: unknown = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

function str(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : ''
}

function extractJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const parsed: unknown = JSON.parse(text.slice(start, end + 1))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

async function callProvider(
  env: ServerEnv,
  system: string,
  user: string,
  maxTokens = 380,
): Promise<string | null> {
  if (!aiConfigured(env)) return null
  const base = (env.SAATH_AI_BASE_URL ?? '').replace(/\/+$/, '')
  const url = `${base}/chat/completions`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env.SAATH_AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.SAATH_AI_MODEL,
        temperature: 0.2,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal: controller.signal,
    })
    if (!response.ok) return null
    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    return data.choices?.[0]?.message?.content ?? null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function sanitiseFacts(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const facts = input as Record<string, unknown>
  const location = facts.location as { lat?: unknown; lng?: unknown } | null
  const lat = location && typeof location.lat === 'number' && Number.isFinite(location.lat) ? location.lat : null
  const lng = location && typeof location.lng === 'number' && Number.isFinite(location.lng) ? location.lng : null
  return {
    location: lat !== null && lng !== null ? { lat, lng } : null,
    locationAt: typeof facts.locationAt === 'number' && Number.isFinite(facts.locationAt) ? facts.locationAt : null,
    destination: str(facts.destination, 120) || null,
    journeyActive: Boolean(facts.journeyActive),
    contactsNotified:
      typeof facts.contactsNotified === 'number' && Number.isFinite(facts.contactsNotified)
        ? Math.max(0, Math.min(20, Math.round(facts.contactsNotified)))
        : 0,
    now: Date.now(),
  }
}

export async function handleApi(request: Request, env: ServerEnv): Promise<Response | null> {
  const url = new URL(request.url)
  if (!url.pathname.startsWith('/api/')) return null

  if (!sameOrigin(request)) return json({ error: 'origin_not_allowed' }, 403)

  if (url.pathname === '/api/health') {
    if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405)
    return json({
      ok: true,
      serverTime: new Date().toISOString(),
      ai: {
        configured: aiConfigured(env),
        provider: aiConfigured(env) ? env.SAATH_AI_PROVIDER_LABEL || 'OpenAI-compatible' : null,
      },
      voice: {
        configured: false,
        provider: 'device-speech',
        note: 'No cloud voice provider is configured. The demo speaks through the device. A future authorised voice integration must permit the use case; it must never be presented as emergency-service calling.',
      },
      sharing: {
        configured: false,
        note: 'No sharing backend is configured. All sharing is explicitly simulated on the device.',
      },
      emergency: {
        configured: false,
        note: 'Saath never contacts police, ambulance or emergency dispatchers. The device dialler remains available.',
      },
    })
  }

  if (!url.pathname.startsWith('/api/ai/')) return json({ error: 'not_found' }, 404)
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  if (!aiConfigured(env)) return json({ error: 'ai_not_configured', configured: false }, 503)
  if (rateLimited(request)) return json({ error: 'rate_limited' }, 429)

  const body = await readJson(request)
  if (!body) return json({ error: 'invalid_json' }, 400)
  const lang = body.lang === 'hi' ? 'hi' : 'en'

  if (url.pathname === '/api/ai/agent') {
    const facts = sanitiseFacts(body.facts)
    if (!facts) return json({ error: 'invalid_facts' }, 400)
    const contactName = str(body.contactName, 60)
    const input = str(body.input, 500)
    const system = [
      "You are Saath's automated AI voice assistant speaking to a trusted contact in a controlled demo.",
      'Identify yourself as an automated AI assistant and name Saath. Never claim to be a human.',
      'State that a Saath user activated an SOS alert.',
      'Use ONLY the FACTS. Never invent or infer incident details, injuries, current location, ETA, delivery, emergency responses, police/ambulance contact, or acknowledgements.',
      'If an answer is not in FACTS, say the information is unknown.',
      'If a location timestamp is present, you may mention how old it is using the provided now timestamp. Call stale after 5 minutes.',
      'Never promise help. An acknowledgement does not mean help is coming.',
      'Ask the contact to acknowledge receiving the alert, unless the contact already has.',
      `Reply in ${lang === 'hi' ? 'Hindi (Devanagari)' : 'English'} in at most 70 words.`,
      `Allowed actions: ${ASSISTANT_ACTIONS.join(', ')}.`,
      'Return ONLY JSON: {"reply": string, "action": {"kind": string}, "usedFacts": string[]}.',
      `FACTS: ${JSON.stringify(facts)}`,
      `CONTACT NAME: ${contactName}`,
    ].join('\n')
    const raw = await callProvider(env, system, input || 'The call just connected. Begin with your opening statement.')
    const parsed = raw ? extractJson(raw) : null
    if (!parsed || typeof parsed.reply !== 'string') return json({ error: 'provider_invalid_response' }, 502)
    const actionKind = (parsed.action as { kind?: unknown } | undefined)?.kind
    const kind = typeof actionKind === 'string' && ASSISTANT_ACTIONS.includes(actionKind) ? actionKind : 'request_acknowledgement'
    const usedFacts = Array.isArray(parsed.usedFacts)
      ? parsed.usedFacts.filter((item): item is string => typeof item === 'string').slice(0, 6)
      : []
    const reply = parsed.reply.slice(0, 900)
    // Server-side guard against common unsafe hallucinations. The client falls
    // back to the scripted simulation if a provider output is rejected.
    const unsafe =
      /(police|ambulance|emergency (services|team|responders)).{0,40}(dispatched|notified|contacted|on the way|coming)/i.test(reply) ||
      /(help|rescue|someone).{0,20}(is|are) (on the way|coming to you)/i.test(reply) ||
      (facts.location === null && /\b-?\d{1,3}\.\d{3,}\b/.test(reply)) ||
      /\b(guaranteed|100% safe|definitely safe)\b/i.test(reply)
    if (unsafe) return json({ error: 'provider_unsafe_response' }, 502)
    return json({
      reply,
      action: { kind },
      usedFacts,
    })
  }

  if (url.pathname === '/api/ai/report') {
    const description = str(body.description, 500)
    if (description.length < 8) return json({ error: 'description_too_short' }, 400)
    const category = REPORT_CATEGORIES.includes(body.category as ReportCategory)
      ? (body.category as ReportCategory)
      : 'other'
    const existing = Array.isArray(body.existing)
      ? body.existing.slice(0, 30).map((item) => {
          const entry = item as Record<string, unknown>
          return {
            id: str(entry.id, 80),
            category: REPORT_CATEGORIES.includes(entry.category as ReportCategory) ? entry.category : 'other',
            description: str(entry.description, 220),
          }
        })
      : []
    const system = [
      'You assist a human moderation queue for anonymous neighbourhood environment reports.',
      'Never invent new report details, people, names or locations.',
      'Suggest one category from the allowed list and possible duplicate ids only from EXISTING_REPORTS.',
      'The note must state that a human moderator must review before anything is public or affects routing. Max 55 words.',
      `Allowed categories: ${REPORT_CATEGORIES.join(', ')}.`,
      `Reply in ${lang === 'hi' ? 'Hindi' : 'English'}.`,
      'Return ONLY JSON: {"category": string, "duplicateIds": string[], "note": string}.',
      `EXISTING_REPORTS: ${JSON.stringify(existing)}`,
    ].join('\n')
    const raw = await callProvider(env, system, description)
    const parsed = raw ? extractJson(raw) : null
    if (!parsed) return json({ error: 'provider_invalid_response' }, 502)
    const allowedIds = new Set(existing.map((entry) => entry.id))
    const duplicateIds = Array.isArray(parsed.duplicateIds)
      ? parsed.duplicateIds.filter((id): id is string => typeof id === 'string' && allowedIds.has(id)).slice(0, 5)
      : []
    const suggested = REPORT_CATEGORIES.includes(parsed.category as ReportCategory)
      ? (parsed.category as ReportCategory)
      : category
    return json({
      category: suggested,
      duplicateIds,
      note: str(parsed.note, 600) || 'A human moderator must review this report before it is public or affects routes.',
      source: 'provider',
    })
  }

  if (url.pathname === '/api/ai/route-explain') {
    const reasons = Array.isArray(body.reasons)
      ? body.reasons.filter((item): item is string => typeof item === 'string').slice(0, 5)
      : []
    const routeLabels = Array.isArray(body.routeLabels)
      ? body.routeLabels.filter((item): item is string => typeof item === 'string').slice(0, 4)
      : []
    if (reasons.length === 0) return json({ error: 'no_reasons' }, 400)
    const system = [
      'You rewrite route recommendation reasons for a travel-safety app.',
      'Use ONLY the supplied REASONS. Do not add facts, numbers, percentages, guarantees or safety claims.',
      'Do not change which route is recommended. Never say a route is safe or guaranteed.',
      'Keep the meaning, including any uncertainty and Unknown information.',
      `Reply in ${lang === 'hi' ? 'Hindi' : 'English'} in at most 70 words.`,
      'Return ONLY JSON: {"summary": string}.',
      `ROUTE_LABELS: ${JSON.stringify(routeLabels)}`,
      `REASONS: ${JSON.stringify(reasons)}`,
    ].join('\n')
    const raw = await callProvider(env, system, 'Summarise the supplied reasons.')
    const parsed = raw ? extractJson(raw) : null
    if (!parsed || typeof parsed.summary !== 'string') return json({ error: 'provider_invalid_response' }, 502)
    return json({ summary: parsed.summary.slice(0, 600) })
  }

  return json({ error: 'not_found' }, 404)
}
