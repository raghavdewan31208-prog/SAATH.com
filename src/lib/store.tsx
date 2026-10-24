import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { reducer, type Action } from '@shared/engine'
import type { AppState, Lang } from '@shared/types'
import { loadState, saveState } from './storage'
import { t as translate } from './i18n'

export interface Toast {
  id: string
  message: string
  variant: 'default' | 'danger'
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface StoreValue {
  state: AppState
  dispatch: React.Dispatch<Action>
  now: number
  online: boolean
  forcedOffline: boolean
  setForcedOffline: (value: boolean) => void
  lang: Lang
  t: (en: string, hi: string) => string
  toast: (message: string, variant?: Toast['variant']) => void
  toasts: Toast[]
  dismissToast: (id: string) => void
  resolvedTheme: 'light' | 'dark'
  installAvailable: boolean
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>
  standalone: boolean
}

const StoreContext = createContext<StoreValue | null>(null)

function useSystemDark(): boolean {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (event: MediaQueryListEvent) => setDark(event.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return dark
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)
  const [now, setNow] = useState(() => Date.now())
  const [browserOnline, setBrowserOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const [forcedOffline, setForcedOffline] = useState(false)
  const online = browserOnline && !forcedOffline
  const [toasts, setToasts] = useState<Toast[]>([])
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const systemDark = useSystemDark()
  const timers = useRef<number[]>([])
  const stateRef = useRef(state)

  const lang = state.profile.lang
  const resolvedTheme: 'light' | 'dark' =
    state.profile.theme === 'system' ? (systemDark ? 'dark' : 'light') : state.profile.theme

  const t = useCallback((en: string, hi: string) => translate(lang, en, hi), [lang])

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback((message: string, variant: Toast['variant'] = 'default') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setToasts((current) => [...current.slice(-2), { id, message, variant }])
    const timer = window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id))
    }, 4200)
    timers.current.push(timer)
  }, [])

  useEffect(() => {
    return () => {
      for (const timer of timers.current) window.clearTimeout(timer)
    }
  }, [])

  // Clock for derived UI (ETA, freshness, hold timers).
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  // Persist locally, debounced. Nothing leaves the device except API calls.
  stateRef.current = state
  useEffect(() => {
    const timer = window.setTimeout(() => saveState(state), 300)
    return () => window.clearTimeout(timer)
  }, [state])

  // Flush immediately when the page is hidden or unloaded, so ending a journey
  // or revoking sharing cannot be lost by a quick reload.
  useEffect(() => {
    const flush = () => saveState(stateRef.current)
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  // Theme + document language.
  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', resolvedTheme === 'dark' ? '#0E1728' : '#F7F8FC')
  }, [resolvedTheme])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  // Connectivity.
  useEffect(() => {
    const goOnline = () => setBrowserOnline(true)
    const goOffline = () => setBrowserOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  // Deterministic ticker: check-ins, escalation, simulated delivery states.
  useEffect(() => {
    const tick = () => dispatch({ type: 'journey/tick', now: Date.now(), online })
    tick()
    const interval = window.setInterval(tick, 5000)
    return () => window.clearInterval(interval)
  }, [online])

  // PWA install prompt.
  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const standalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true)

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!installEvent) return 'unavailable'
    await installEvent.prompt()
    const choice = await installEvent.userChoice
    setInstallEvent(null)
    return choice.outcome
  }, [installEvent])

  const value = useMemo<StoreValue>(
    () => ({
      state,
      dispatch,
      now,
      online,
      forcedOffline,
      setForcedOffline,
      lang,
      t,
      toast,
      toasts,
      dismissToast,
      resolvedTheme,
      installAvailable: Boolean(installEvent) && !standalone,
      promptInstall,
      standalone,
    }),
    [state, now, online, forcedOffline, lang, t, toast, toasts, dismissToast, resolvedTheme, installEvent, standalone, promptInstall],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useApp(): StoreValue {
  const value = useContext(StoreContext)
  if (!value) throw new Error('useApp must be used inside StoreProvider')
  return value
}

export function useDispatch() {
  return useApp().dispatch
}
