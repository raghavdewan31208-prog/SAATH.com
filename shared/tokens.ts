import type { ShareSession } from './types'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

/** 144 bits of entropy by default, URL-safe, never derived from user data. */
export function createShareToken(bytes = 18): string {
  const buffer = new Uint8Array(bytes)
  globalThis.crypto.getRandomValues(buffer)
  let out = ''
  for (const byte of buffer) out += ALPHABET[byte & 63]
  return out
}

export function shareIsLive(session: ShareSession | null | undefined, now: number): boolean {
  if (!session) return false
  if (session.revokedAt !== null) return false
  return session.expiresAt > now
}

export function shareExpired(session: ShareSession | null | undefined, now: number): boolean {
  return Boolean(session && session.expiresAt <= now)
}

export function maskToken(token: string): string {
  if (token.length <= 8) return token
  return `${token.slice(0, 6)}…${token.slice(-4)}`
}

export function minutesUntil(timestamp: number, now: number): number {
  return Math.max(0, Math.ceil((timestamp - now) / 60_000))
}
