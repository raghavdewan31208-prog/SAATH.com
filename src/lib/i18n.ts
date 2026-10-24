import type { Lang } from '@shared/types'

export function t(lang: Lang, en: string, hi: string): string {
  return lang === 'hi' ? hi : en
}

export function locale(lang: Lang): string {
  return lang === 'hi' ? 'hi-IN' : 'en-IN'
}

export function formatTime(ts: number, lang: Lang): string {
  return new Intl.DateTimeFormat(locale(lang), { hour: 'numeric', minute: '2-digit' }).format(ts)
}

export function formatDateTime(ts: number, lang: Lang): string {
  return new Intl.DateTimeFormat(locale(lang), {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(ts)
}

export function formatDay(ts: number, lang: Lang): string {
  return new Intl.DateTimeFormat(locale(lang), { weekday: 'short', day: 'numeric', month: 'short' }).format(ts)
}

export function formatDuration(minutes: number, lang: Lang): string {
  const rounded = Math.max(0, Math.round(minutes))
  return lang === 'hi' ? `${rounded} मिनट` : `${rounded} min`
}

export function formatDistance(km: number, lang: Lang): string {
  if (km < 1) {
    const m = Math.round(km * 1000)
    return lang === 'hi' ? `${m} मी` : `${m} m`
  }
  return lang === 'hi' ? `${km.toFixed(1)} किमी` : `${km.toFixed(1)} km`
}

export function formatEta(ts: number, now: number, lang: Lang): string {
  const minutes = Math.max(0, Math.round((ts - now) / 60_000))
  if (minutes <= 1) return lang === 'hi' ? 'अभी' : 'now'
  return formatDuration(minutes, lang)
}

export function countContacts(n: number, lang: Lang): string {
  return lang === 'hi' ? `${n} संपर्क` : `${n} contact${n === 1 ? '' : 's'}`
}
