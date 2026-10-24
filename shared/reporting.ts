import type { LatLng, Lang, Report, ReportAiSuggestion, ReportCategory } from './types'

export const REPORT_CATEGORIES: { id: ReportCategory; label: [string, string]; hint: [string, string] }[] = [
  {
    id: 'lighting',
    label: ['Broken or missing lighting', 'टूटी या गायब रोशनी'],
    hint: ['A street light, stairwell or underpass is dark.', 'स्ट्रीट लाइट, सीढ़ी या अंडरपास में रोशनी नहीं है।'],
  },
  {
    id: 'walkway',
    label: ['Blocked or broken walkway', 'अवरुद्ध या टूटा फुटपाथ'],
    hint: ['Construction, parked vehicles or damage blocks the path.', 'निर्माण, खड़े वाहन या क्षति से रास्ता बंद है।'],
  },
  {
    id: 'harassment',
    label: ['Harassment or unwanted attention', 'उत्पीड़न या अवांछित ध्यान'],
    hint: ['Describe what happened and where. Do not name or identify anyone.', 'क्या और कहाँ हुआ बताएं। किसी का नाम या पहचान न दें।'],
  },
  { id: 'stray', label: ['Stray animals', 'आवारा जानवर'], hint: ['Aggressive dogs or another animal concern.', 'आक्रामक कुत्ते या जानवर से जुड़ी चिंता।'] },
  { id: 'transport', label: ['Transport problem', 'परिवहन समस्या'], hint: ['A stop is unlit, closed or feels unsafe to wait at.', 'स्टॉप पर रोशनी नहीं, बंद है या इंतज़ार असुरक्षित लगता है।'] },
  { id: 'other', label: ['Something else', 'कुछ और'], hint: ['Anything about the walking environment.', 'पैदल चलने के माहौल से जुड़ी कोई भी बात।'] },
]

export function categoryLabel(id: ReportCategory, lang: Lang): string {
  return REPORT_CATEGORIES.find((c) => c.id === id)?.label[lang === 'hi' ? 1 : 0] ?? id
}

export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

const KEYWORDS: Record<ReportCategory, string[]> = {
  lighting: ['light', 'dark', 'lamp', 'streetlight', 'रोशनी', 'लाइट', 'अंधेरा'],
  walkway: ['footpath', 'sidewalk', 'walkway', 'blocked', 'construction', 'फुटपाथ', 'रास्ता', 'निर्माण'],
  harassment: ['follow', 'harass', 'stare', 'comment', 'touch', 'छेड़', 'पीछा', 'टिप्पणी'],
  stray: ['dog', 'stray', 'animal', 'कुत्ता', 'आवारा', 'जानवर'],
  transport: ['bus', 'auto', 'stop', 'wait', 'बस', 'ऑटो', 'स्टॉप'],
  other: [],
}

export function detectCategory(description: string, fallback: ReportCategory): ReportCategory {
  const text = description.toLowerCase()
  let best: { category: ReportCategory; score: number } = { category: fallback, score: 0 }
  for (const [category, words] of Object.entries(KEYWORDS) as [ReportCategory, string[]][]) {
    const score = words.reduce((sum, word) => (text.includes(word) ? sum + 1 : sum), 0)
    if (score > best.score) best = { category, score }
  }
  return best.category
}

export function findDuplicates(
  reports: Report[],
  category: ReportCategory,
  location: LatLng | null,
  now: number,
): Report[] {
  return reports.filter((r) => {
    if (r.category !== category) return false
    if (now - r.createdAt > 30 * 86_400_000) return false
    if (!location || !r.coarseLocation) return false
    return haversineMeters(location, r.coarseLocation) <= 400
  })
}

/**
 * Deterministic local interpretation. It is labelled as rule-based in the UI when
 * no provider is configured. It suggests, never decides: a human moderator must
 * approve before anything becomes public or affects route comparison.
 */
export function interpretReportLocally(input: {
  description: string
  category: ReportCategory
  reports: Report[]
  location: LatLng | null
  now: number
  lang: Lang
}): ReportAiSuggestion {
  const category = detectCategory(input.description, input.category)
  const duplicates = findDuplicates(input.reports, category, input.location, input.now)
  const note =
    input.lang === 'hi'
      ? `स्थानीय नियम-आधारित सहायक: सुझाई श्रेणी "${categoryLabel(category, 'hi')}"। ${
          duplicates.length > 0 ? `${duplicates.length} संभावित समान रिपोर्ट मिलीं — कोई स्वतः विलय नहीं हुआ।` : 'कोई संभावित डुप्लिकेट नहीं मिला।'
        } मॉडरेटर की समीक्षा के बाद ही यह सार्वजनिक या मार्ग सुझावों में उपयोग होगी।`
      : `Local rule-based assistant: suggested category "${categoryLabel(category, 'en')}". ${
          duplicates.length > 0
            ? `${duplicates.length} possible duplicate report${duplicates.length === 1 ? '' : 's'} found — nothing was merged automatically.`
            : 'No likely duplicates found.'
        } A moderator must review this before it appears publicly or informs route comparisons.`

  return { category, duplicateIds: duplicates.map((d) => d.id), note, source: 'local-rules' }
}

/** Approved, route-sharing reports only. Pending reports never influence a route. */
export function approvedRouteReports(reports: Report[]): Report[] {
  return reports.filter((r) => r.status === 'approved' && r.shareWithRoutes)
}

export function redactForDisplay(description: string): string {
  // Reports must not expose identifying details. Very light-touch redaction for
  // obvious phone numbers and email addresses in the UI preview.
  return description
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email removed]')
    .replace(/\+?\d[\d\s-]{7,}\d/g, '[number removed]')
}
