import { STATE_VERSION } from '@shared/engine'
import { createInitialState } from '@shared/demo'
import type { AppState } from '@shared/types'

const KEY = 'saath.state'

function looksValid(value: unknown): value is AppState {
  if (!value || typeof value !== 'object') return false
  const s = value as AppState
  return (
    s.version === STATE_VERSION &&
    typeof s.profile === 'object' &&
    Array.isArray(s.contacts) &&
    typeof s.settings === 'object' &&
    Array.isArray(s.reports) &&
    Array.isArray(s.alerts)
  )
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return createInitialState()
    const parsed: unknown = JSON.parse(raw)
    if (!looksValid(parsed)) return createInitialState()
    return parsed
  } catch {
    return createInitialState()
  }
}

export function saveState(state: AppState): void {
  try {
    const snapshot: AppState = { ...state, lastActiveAt: Date.now() }
    localStorage.setItem(KEY, JSON.stringify(snapshot))
  } catch {
    // Storage may be full or blocked (private mode). The app keeps working in memory.
  }
}

export function clearStorage(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}

export function resetState(now = Date.now()): AppState {
  const fresh = createInitialState(now)
  saveState(fresh)
  return fresh
}
