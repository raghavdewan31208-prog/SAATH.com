import type { ReactNode, SVGProps } from 'react'

export type IconName =
  | 'home'
  | 'route'
  | 'users'
  | 'settings'
  | 'shield'
  | 'pin'
  | 'clock'
  | 'walk'
  | 'light'
  | 'bus'
  | 'activity'
  | 'alert'
  | 'phone'
  | 'phoneOff'
  | 'mic'
  | 'sparkles'
  | 'chevronRight'
  | 'chevronLeft'
  | 'arrowLeft'
  | 'arrowUp'
  | 'arrowDown'
  | 'plus'
  | 'trash'
  | 'edit'
  | 'check'
  | 'x'
  | 'refresh'
  | 'share'
  | 'stop'
  | 'play'
  | 'pause'
  | 'info'
  | 'lock'
  | 'wifiOff'
  | 'download'
  | 'globe'
  | 'bell'
  | 'user'
  | 'send'
  | 'message'
  | 'eye'
  | 'map'
  | 'external'
  | 'headset'
  | 'volume'
  | 'navigate'
  | 'flag'
  | 'calendar'
  | 'heart'
  | 'list'
  | 'sun'
  | 'moon'
  | 'monitor'
  | 'copy'
  | 'undo'
  | 'slashCircle'
  | 'key'

const PATHS: Record<IconName, ReactNode> = {
  home: <path d="M3 10.7 12 3l9 7.7V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />,
  route: (
    <>
      <circle cx="6" cy="18.5" r="2.5" />
      <circle cx="18" cy="5.5" r="2.5" />
      <path d="M8.5 18.5H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.4" />
      <path d="M3.2 20c.4-3.3 2.8-5.3 5.8-5.3s5.4 2 5.8 5.3" />
      <circle cx="17.5" cy="9.5" r="2.6" />
      <path d="M16.4 14.7c2.5-.2 4.3 1.5 4.6 4.3" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h8M16 7h4M4 12h3M11 12h9M4 17h9M17 17h3" />
      <circle cx="14" cy="7" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="15" cy="17" r="2" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 5 5.8v5.5c0 4.3 2.9 7.4 7 9.2 4.1-1.8 7-4.9 7-9.2V5.8z" />
      <path d="m9.2 11.9 2 2 3.7-3.9" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z" />
      <circle cx="12" cy="9.8" r="2.4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.3l3.2 2" />
    </>
  ),
  walk: (
    <>
      <circle cx="13" cy="4.6" r="2" />
      <path d="m10.5 21 1.6-5.2-2.2-3 1.2-4.1 3.1 1.4 2.2 2.9 2.6.9M13.9 9.3l-3.1 3.4M9.7 21l1.9-4.9" />
    </>
  ),
  light: (
    <>
      <path d="M9 17.5h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3z" />
    </>
  ),
  bus: (
    <>
      <rect x="4" y="4" width="16" height="13" rx="2.5" />
      <path d="M4 10h16M8 17v2M16 17v2M8.5 13.7h.01M15.5 13.7h.01" />
    </>
  ),
  activity: <path d="M2.5 13h4l2.2-6 4.2 12 2.6-7 1.7 3.5h4.3" />,
  alert: (
    <>
      <path d="M12 3.6 2.7 20.2h18.6z" />
      <path d="M12 9.3v4.5M12 17.2h.01" />
    </>
  ),
  phone: (
    <path d="M7.1 3.5h2.4l1.5 4-2 1.5a12.7 12.7 0 0 0 5.9 5.9l1.5-2 4 1.5V17a3.4 3.4 0 0 1-3.7 3.4C9.5 19.7 4.3 14.5 3.6 7.2A3.4 3.4 0 0 1 7.1 3.5z" />
  ),
  phoneOff: (
    <>
      <path d="M7.1 3.5h2.4l1.5 4-2 1.5a12.7 12.7 0 0 0 5.9 5.9l1.5-2 4 1.5V17a3.4 3.4 0 0 1-3.7 3.4C9.5 19.7 4.3 14.5 3.6 7.2A3.4 3.4 0 0 1 7.1 3.5z" />
      <path d="m3 3 18 18" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="2.8" width="6" height="11.4" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 3 1.8 4.6L18.5 9.5l-4.7 1.9L12 16l-1.8-4.6L5.5 9.5l4.7-1.9z" />
      <path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
    </>
  ),
  chevronRight: <path d="m9 5 7 7-7 7" />,
  chevronLeft: <path d="m15 5-7 7 7 7" />,
  arrowLeft: <path d="M19 12H5m6-6-6 6 6 6" />,
  arrowUp: <path d="M12 20V5m-6 6 6-6 6 6" />,
  arrowDown: <path d="M12 4v15m-6-6 6 6 6-6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  trash: (
    <>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" />
    </>
  ),
  edit: <path d="m4 20 .8-4L16.3 4.5a2.2 2.2 0 0 1 3.2 3.2L8 19.2zM14.8 6l3.2 3.2" />,
  check: <path d="m4.5 12.5 5 5 10-11" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  refresh: (
    <>
      <path d="M20 11.5A8 8 0 0 0 6 6.2L4 8.4" />
      <path d="M4 4v4.4h4.4M4 12.5A8 8 0 0 0 18 17.8l2-2.2" />
      <path d="M20 20v-4.4h-4.4" />
    </>
  ),
  share: (
    <>
      <circle cx="18" cy="5.5" r="2.6" />
      <circle cx="6" cy="12" r="2.6" />
      <circle cx="18" cy="18.5" r="2.6" />
      <path d="m8.3 10.8 7.4-4M8.3 13.2l7.4 4" />
    </>
  ),
  stop: <rect x="5" y="5" width="14" height="14" rx="2" />,
  play: <path d="M7 4.8 19 12 7 19.2z" />,
  pause: <path d="M8 5v14M16 5v14" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.5h.01" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10" width="15" height="10.5" rx="2.5" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10M12 14v2.5" />
    </>
  ),
  wifiOff: (
    <>
      <path d="M3 3l18 18M8.5 14.9a5 5 0 0 1 6 0M5.3 11.5a10 10 0 0 1 4.2-2.4M14.8 9.4a10 10 0 0 1 4 2.1M2.5 8.6a14 14 0 0 1 4-2.4M17.6 6.4a14 14 0 0 1 3.9 2.2M12 19h.01" />
    </>
  ),
  download: <path d="M12 3v12m-5-5 5 5 5-5M4 20h16" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3.5 9.5h17M3.5 14.5h17M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
    </>
  ),
  bell: <path d="M18 9a6 6 0 1 0-12 0c0 5-2 5-2 6.5h16C20 14 18 14 18 9zM9.8 19.5a2.5 2.5 0 0 0 4.4 0" />,
  user: (
    <>
      <circle cx="12" cy="8" r="3.8" />
      <path d="M4.5 21c.5-4 3.7-6.4 7.5-6.4s7 2.4 7.5 6.4" />
    </>
  ),
  send: <path d="M3.5 11.5 20.5 4l-4.8 17-4.2-6.4-3.2 3.2-1-4.2-2.8-2.1z" />,
  message: <path d="M20.5 12a8 8 0 0 1-8 8H4.5l1.6-3.7A8 8 0 1 1 20.5 12z" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  map: (
    <>
      <path d="m3 6.5 5.5-2 7 2 5.5-2v13l-5.5 2-7-2-5.5 2z" />
      <path d="M8.5 4.5v13M15.5 6.5v13" />
    </>
  ),
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />,
  headset: (
    <>
      <path d="M4.5 13v-1a7.5 7.5 0 0 1 15 0v1" />
      <rect x="2.8" y="12.5" width="4.4" height="6" rx="1.8" />
      <rect x="16.8" y="12.5" width="4.4" height="6" rx="1.8" />
      <path d="M19 18.5v.7a2.8 2.8 0 0 1-2.8 2.8H13" />
    </>
  ),
  volume: (
    <>
      <path d="M11 5 6.5 9H3v6h3.5L11 19z" />
      <path d="M15 9a4.2 4.2 0 0 1 0 6M17.8 6.2a8 8 0 0 1 0 11.6" />
    </>
  ),
  navigate: <path d="M21 3 3 10.5l7.5 3L14 21z" />,
  flag: <path d="M5 21V3.5c4-2 7 2 11 0v9c-4 2-7-2-11 0" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
      <path d="M8 3v4M16 3v4M3.5 9.5h17M8 13.5h2M14 13.5h2M8 17h2M14 17h2" />
    </>
  ),
  heart: <path d="M12 20.5S3.5 15 3.5 8.7a4.6 4.6 0 0 1 8.5-2.5 4.6 4.6 0 0 1 8.5 2.5c0 6.3-8.5 11.8-8.5 11.8z" />,
  list: <path d="M8.5 6.5h12M8.5 12h12M8.5 17.5h12M3.5 6.5h.01M3.5 12h.01M3.5 17.5h.01" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z" />,
  monitor: (
    <>
      <rect x="3" y="4" width="18" height="12.5" rx="2" />
      <path d="M9 20.5h6M12 16.5v4" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11.5" height="11.5" rx="2" />
      <path d="M15 9V5.5a2 2 0 0 0-2-2H5.5a2 2 0 0 0-2 2V13a2 2 0 0 0 2 2H9" />
    </>
  ),
  undo: <path d="M4 9h10.5a5.5 5.5 0 1 1 0 11H8M4 9l4-4M4 9l4 4" />,
  slashCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m5.6 5.6 12.8 12.8" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15.5" r="4.5" />
      <path d="m11.2 12.3 8.3-8.3M16.5 7l2.5 2.5M14.5 9l2.5 2.5" />
    </>
  ),
}

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName
  size?: number
  label?: string
}

export function Icon({ name, size = 22, label, className, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  )
}

export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="16" fill="#071220" />
      <path
        d="M46.9 14.3A21 21 0 1 0 49.6 41"
        fill="none"
        stroke="#2dd4bf"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="32" cy="32" r="7" fill="#2dd4bf" />
      <circle cx="32" cy="32" r="3" fill="#04211f" />
      <circle cx="43.5" cy="16.5" r="3.2" fill="#eef6fb" />
    </svg>
  )
}
