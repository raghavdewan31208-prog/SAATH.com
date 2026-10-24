import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'

export function HoldToActivate({
  label,
  holdingLabel,
  hint,
  seconds = 3,
  disabled,
  onComplete,
}: {
  label: string
  holdingLabel: string
  hint: string
  seconds?: number
  disabled?: boolean
  onComplete: () => void
}) {
  const [progress, setProgress] = useState(0)
  const [holding, setHolding] = useState(false)
  const startedAt = useRef<number | null>(null)
  const interval = useRef<number | null>(null)
  const completed = useRef(false)
  const hintId = 'hold-hint'

  const stop = () => {
    if (interval.current !== null) {
      window.clearInterval(interval.current)
      interval.current = null
    }
    startedAt.current = null
    setHolding(false)
    setProgress(0)
  }

  const begin = () => {
    if (disabled || interval.current !== null) return
    completed.current = false
    startedAt.current = performance.now()
    setHolding(true)
    interval.current = window.setInterval(() => {
      if (startedAt.current === null) return
      const elapsed = performance.now() - startedAt.current
      const next = Math.min(1, elapsed / (seconds * 1000))
      setProgress(next)
      if (next >= 1 && !completed.current) {
        completed.current = true
        if (interval.current !== null) {
          window.clearInterval(interval.current)
          interval.current = null
        }
        setHolding(false)
        navigator.vibrate?.(35)
        onComplete()
      }
    }, 50)
  }

  useEffect(() => {
    return () => {
      if (interval.current !== null) window.clearInterval(interval.current)
    }
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button
        type="button"
        className="btn btn-danger btn-block"
        style={{ position: 'relative', overflow: 'hidden', minHeight: 66, touchAction: 'none', fontSize: '1.02rem' }}
        onPointerDown={(event) => {
          if (event.button !== 0 && event.pointerType === 'mouse') return
          event.currentTarget.setPointerCapture?.(event.pointerId)
          begin()
        }}
        onPointerUp={stop}
        onPointerCancel={stop}
        onPointerLeave={stop}
        onContextMenu={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
            event.preventDefault()
            begin()
          }
        }}
        onKeyUp={(event) => {
          if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault()
            stop()
          }
        }}
        onBlur={stop}
        disabled={disabled}
        aria-describedby={hintId}
        aria-label={`${label}. ${hint}`}
      >
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            width: `${Math.round(progress * 100)}%`,
            background: 'rgba(0,0,0,0.24)',
            transition: holding ? 'width 50ms linear' : 'width 140ms ease',
          }}
        />
        <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 9 }}>
          <Icon name="shield" size={22} />
          {holding ? `${holdingLabel} ${Math.max(1, Math.ceil(seconds - progress * seconds))}` : label}
        </span>
      </button>
      <p id={hintId} className="hint">
        {hint}
      </p>
    </div>
  )
}
