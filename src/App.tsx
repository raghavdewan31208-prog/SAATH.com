import { useEffect } from 'react'
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useApp } from './lib/store'
import { Icon, type IconName } from './components/Icon'
import { ToastHost } from './components/ui'
import HomeScreen from './screens/HomeScreen'
import OnboardingScreen from './screens/OnboardingScreen'
import PlanScreen from './screens/PlanScreen'
import JourneyScreen from './screens/JourneyScreen'
import SosScreen from './screens/SosScreen'
import AssistantCallScreen from './screens/AssistantCallScreen'
import OperatorScreen from './screens/OperatorScreen'
import ContactsScreen from './screens/ContactsScreen'
import SettingsScreen from './screens/SettingsScreen'
import ShareScreen from './screens/ShareScreen'
import ReportsScreen from './screens/ReportsScreen'
import DemoScreen from './screens/DemoScreen'
import NotFoundScreen from './screens/NotFoundScreen'

const HIDE_NAV = ['/onboarding', '/sos', '/sos/assist', '/sos/operator']

export default function App() {
  const { state, t } = useApp()
  const location = useLocation()
  const onboarded = Boolean(state.profile.onboardedAt)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [location.pathname])

  // Keep the on-screen keyboard from covering the active field. When a text
  // input is focused we slide the fixed bottom bar (nav + SOS) out of the way,
  // and bring it back the moment focus leaves so SOS is never far away.
  useEffect(() => {
    const isText = (node: EventTarget | null): boolean =>
      node instanceof HTMLElement &&
      (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.tagName === 'SELECT' || node.isContentEditable)
    const onFocusIn = (event: FocusEvent) => {
      if (isText(event.target)) document.body.classList.add('kb-open')
    }
    const onFocusOut = (event: FocusEvent) => {
      if (!isText(event.relatedTarget)) document.body.classList.remove('kb-open')
    }
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
      document.body.classList.remove('kb-open')
    }
  }, [])

  // Measure how much the on-screen keyboard overlaps the layout viewport and
  // expose it as --saath-kb. Chrome on Android and iOS Safari shrink the visual
  // viewport instead of resizing fixed elements, so sheets need this offset to
  // stay above the keyboard. Devices whose layouts already resize report ~0.
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const apply = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      document.documentElement.style.setProperty('--saath-kb', `${Math.round(inset)}px`)
    }
    apply()
    viewport.addEventListener('resize', apply)
    viewport.addEventListener('scroll', apply)
    return () => {
      viewport.removeEventListener('resize', apply)
      viewport.removeEventListener('scroll', apply)
      document.documentElement.style.removeProperty('--saath-kb')
    }
  }, [])

  if (!onboarded && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }
  if (onboarded && location.pathname === '/onboarding') {
    return <Navigate to="/" replace />
  }

  const hideNav = HIDE_NAV.some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`))

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        {t('Skip to content', 'मुख्य सामग्री पर जाएँ')}
      </a>
      <main id="main">
        <Routes>
          <Route path="/onboarding" element={<OnboardingScreen />} />
          <Route path="/" element={<HomeScreen />} />
          <Route path="/plan" element={<PlanScreen />} />
          <Route path="/journey" element={<JourneyScreen />} />
          <Route path="/sos" element={<SosScreen />} />
          <Route path="/sos/assist" element={<AssistantCallScreen />} />
          <Route path="/sos/operator" element={<OperatorScreen />} />
          <Route path="/contacts" element={<ContactsScreen />} />
          <Route path="/share" element={<ShareScreen />} />
          <Route path="/reports" element={<ReportsScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/demo" element={<DemoScreen />} />
          <Route path="*" element={<NotFoundScreen />} />
        </Routes>
      </main>

      {hideNav ? null : <BottomNav />}
      <ToastHost />
    </div>
  )
}

interface NavEntry {
  to: string
  icon: IconName
  label: string
  badge?: boolean
}

function BottomNav() {
  const { t, state } = useApp()
  const items: NavEntry[] = [
    { to: '/', icon: 'home', label: t('Home', 'होम') },
    { to: '/journey', icon: 'route', label: t('Journey', 'यात्रा'), badge: state.journey?.status === 'active' },
  ]
  const tail: NavEntry[] = [
    { to: '/contacts', icon: 'users', label: t('Contacts', 'संपर्क') },
    { to: '/settings', icon: 'settings', label: t('Settings', 'सेटिंग्स') },
  ]
  const renderItem = (item: NavEntry) => (
    <NavLink key={item.to} to={item.to} end={item.to === '/'} className="nav-item">
      <span className="nav-icon">
        <Icon name={item.icon} size={23} />
        {item.badge ? <span aria-hidden="true" className="nav-dot" /> : null}
      </span>
      {item.label}
    </NavLink>
  )
  return (
    <nav className="bottom-nav" aria-label={t('Main navigation', 'मुख्य नेविगेशन')}>
      {items.map(renderItem)}
      {/* SOS lives in the bar, not floating above it: always one tap away, never
          covering page content and never overlapping a field being typed in. */}
      <NavLink
        to="/sos"
        className="nav-item nav-sos"
        aria-label={t('SOS — open emergency assistance', 'SOS — आपातकालीन सहायता खोलें')}
      >
        <span className="nav-sos-icon" aria-hidden="true">
          <Icon name="shield" size={22} />
        </span>
        <span className="nav-sos-label" aria-hidden="true">
          {t('SOS', 'SOS')}
        </span>
      </NavLink>
      {tail.map(renderItem)}
    </nav>
  )
}
