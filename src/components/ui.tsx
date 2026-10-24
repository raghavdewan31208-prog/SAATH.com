import { useEffect, useId, useRef, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../lib/store'
import { Icon, type IconName } from './Icon'
import type { SosActionState, Confidence, ReportStatus } from '@shared/types'
import { confidenceLabel } from '@shared/recommend'

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  // Track the latest onClose without listing it as an effect dependency. The app
  // re-renders every second (a clock tick), so an inline onClose would otherwise
  // re-run this effect each second and its cleanup would steal focus out of any
  // field the user is typing in — which dismissed the mobile keyboard mid-entry.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Focus the dialog itself once when it opens. Depending only on `open` (never
    // on parent re-renders) keeps the caret in a field the user is typing in.
    const focusTimer = window.setTimeout(() => panelRef.current?.focus(), 30)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [open])

  if (!open) return null

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={panelRef}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-grab" aria-hidden="true" />
        <div className="row-between" style={{ marginBottom: 14 }}>
          <h2 id={titleId} className="h2">
            {title}
          </h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {children}
          {footer}
        </div>
      </div>
    </div>
  )
}

export function SwitchRow({
  label,
  description,
  checked,
  onChange,
  disabled,
  badge,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  badge?: ReactNode
}) {
  const id = useId()
  return (
    <div className="row" style={{ alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <label htmlFor={id} style={{ fontWeight: 600, fontSize: '0.95rem' }}>
            {label}
          </label>
          {badge}
        </div>
        {description ? (
          <p id={`${id}-help`} className="hint">
            {description}
          </p>
        ) : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-help` : undefined}
        className="toggle"
        onClick={() => onChange(!checked)}
        disabled={disabled}
        aria-label={label}
      >
        <span className="toggle-knob" aria-hidden="true" />
      </button>
    </div>
  )
}

export function TopBar({
  title,
  subtitle,
  back,
  right,
}: {
  title: string
  subtitle?: string
  back?: string | true
  right?: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <header className="topbar">
      {back ? (
        <button
          type="button"
          className="icon-btn"
          aria-label="Back"
          onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
        >
          <Icon name="arrowLeft" />
        </button>
      ) : null}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{ fontSize: '1.05rem', fontWeight: 740, letterSpacing: '-0.01em' }}>{title}</h1>
        {subtitle ? <p className="hint" style={{ marginTop: 1 }}>{subtitle}</p> : null}
      </div>
      {right}
    </header>
  )
}

export function Chip({
  children,
  tone = 'neutral',
  icon,
}: {
  children: ReactNode
  tone?: 'brand' | 'neutral' | 'warn' | 'danger' | 'ok'
  icon?: IconName
}) {
  return (
    <span className={`chip chip-${tone}`}>
      {icon ? <Icon name={icon} size={13} /> : null}
      {children}
    </span>
  )
}

export function DemoBadge({ children = 'Sample data' }: { children?: ReactNode }) {
  return (
    <span className="chip chip-warn" title="This is fictional sample data, not live information">
      <Icon name="info" size={13} />
      {children}
    </span>
  )
}

export function ConfidenceChip({ value }: { value: Confidence }) {
  const { lang } = useApp()
  return (
    <Chip tone={value === 'high' ? 'ok' : value === 'medium' ? 'brand' : 'neutral'}>
      {lang === 'hi' ? 'विश्वास' : 'Confidence'}: {confidenceLabel(value, lang)}
    </Chip>
  )
}

export function ToastHost() {
  const { toasts, dismissToast } = useApp()
  if (toasts.length === 0) return null
  return (
    <div className="toast-wrap" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.variant === 'danger' ? 'toast-danger' : ''}`}>
          <div className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
            <span>{toast.message}</span>
            <button
              type="button"
              className="icon-btn"
              style={{ width: 30, height: 30, borderRadius: 9 }}
              aria-label="Dismiss"
              onClick={() => dismissToast(toast.id)}
            >
              <Icon name="x" size={15} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

const SOS_STATE: Record<SosActionState, { en: string; hi: string; tone: 'brand' | 'neutral' | 'warn' | 'danger' | 'ok'; icon: IconName }> = {
  pending: { en: 'Pending', hi: 'लंबित', tone: 'neutral', icon: 'clock' },
  sent: { en: 'Sent', hi: 'भेजा गया', tone: 'brand', icon: 'send' },
  delivered: { en: 'Delivered (simulated)', hi: 'पहुँचा (सिम्युलेटेड)', tone: 'brand', icon: 'check' },
  calling: { en: 'Calling', hi: 'कॉल हो रही है', tone: 'warn', icon: 'phone' },
  answered: { en: 'Answered — help not confirmed', hi: 'उत्तर मिला — मदद की पुष्टि नहीं', tone: 'warn', icon: 'phone' },
  unanswered: { en: 'Unanswered', hi: 'कोई उत्तर नहीं', tone: 'warn', icon: 'phoneOff' },
  acknowledged: { en: 'Acknowledged', hi: 'पुष्टि हुई', tone: 'ok', icon: 'check' },
  failed: { en: 'Failed', hi: 'विफल', tone: 'danger', icon: 'alert' },
  opened: { en: 'Dialler attempt — not a call', hi: 'डायलर प्रयास — कॉल नहीं', tone: 'neutral', icon: 'phone' },
  cancelled: { en: 'Cancelled', hi: 'रद्द', tone: 'neutral', icon: 'slashCircle' },
}

export function SosStateChip({ state }: { state: SosActionState }) {
  const { lang } = useApp()
  const meta = SOS_STATE[state]
  return (
    <Chip tone={meta.tone} icon={meta.icon}>
      {lang === 'hi' ? meta.hi : meta.en}
    </Chip>
  )
}

export function sosStateLabel(state: SosActionState, lang: 'en' | 'hi'): string {
  return lang === 'hi' ? SOS_STATE[state].hi : SOS_STATE[state].en
}

const REPORT_STATUS: Record<ReportStatus, { en: string; hi: string; tone: 'neutral' | 'ok' | 'danger' }> = {
  pending: { en: 'In moderation queue', hi: 'मॉडरेशन कतार में', tone: 'neutral' },
  approved: { en: 'Approved · public', hi: 'स्वीकृत · सार्वजनिक', tone: 'ok' },
  rejected: { en: 'Not approved', hi: 'स्वीकृत नहीं', tone: 'danger' },
}

export function ReportStatusChip({ status }: { status: ReportStatus }) {
  const { lang } = useApp()
  const meta = REPORT_STATUS[status]
  return <Chip tone={meta.tone}>{lang === 'hi' ? meta.hi : meta.en}</Chip>
}

export function Banner({
  tone = 'neutral',
  icon,
  title,
  children,
  action,
}: {
  tone?: 'neutral' | 'danger' | 'warn' | 'brand'
  icon?: IconName
  title?: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className={`banner ${tone === 'danger' ? 'banner-danger' : tone === 'warn' ? 'banner-warn' : tone === 'brand' ? 'banner-brand' : ''}`} role={tone === 'danger' ? 'alert' : undefined}>
      {icon ? (
        <span style={{ color: tone === 'danger' ? 'var(--saath-danger)' : 'var(--saath-brand)', flex: '0 0 auto', marginTop: 1 }}>
          <Icon name={icon} size={19} />
        </span>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0, flex: 1 }}>
        {title ? <strong style={{ fontSize: '0.92rem' }}>{title}</strong> : null}
        <div className="hint" style={{ color: 'inherit', opacity: tone === 'neutral' ? 1 : 0.95 }}>
          {children}
        </div>
        {action}
      </div>
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  illustration,
}: {
  icon: IconName
  title: string
  body: string
  action?: ReactNode
  illustration?: ReactNode
}) {
  return (
    <div className="card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      {illustration ?? (
        <span
          aria-hidden="true"
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            display: 'grid',
            placeItems: 'center',
            background: 'var(--saath-brand-soft)',
            color: 'var(--saath-brand)',
          }}
        >
          <Icon name={icon} size={26} />
        </span>
      )}
      <h3 className="section-title">{title}</h3>
      <p className="hint" style={{ maxWidth: 330 }}>{body}</p>
      {action}
    </div>
  )
}

export function Skeleton({ height = 16, width = '100%' }: { height?: number; width?: number | string }) {
  return <div className="skeleton" style={{ height, width }} aria-hidden="true" />
}

export function PageLoader({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} role="status" aria-live="polite">
      <span className="hint">{label}</span>
      <Skeleton height={120} />
      <Skeleton height={16} width="70%" />
      <Skeleton height={16} width="45%" />
    </div>
  )
}
