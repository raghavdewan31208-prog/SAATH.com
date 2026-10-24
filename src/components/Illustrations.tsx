/**
 * Original, hand-built SVG illustrations matched to the Saath palette
 * (deep navy, indigo, teal, with a warm light accent). All are inline SVG so
 * they add no network requests and are optimised by construction.
 *
 * - The welcome hero is meaningful (role="img" + label) because it sets the
 *   scene for the product.
 * - Empty-state art is decorative (aria-hidden) because the heading and body
 *   text beside it already carry the message.
 *
 * They are decorative/illustrative only. None of them imply a route is
 * "verified safe" or that police/emergency services are connected.
 */

export function WelcomeIllustration() {
  return (
    <svg
      className="hero-illustration"
      viewBox="0 0 400 220"
      role="img"
      aria-labelledby="welcome-illo-title"
      focusable="false"
    >
      <title id="welcome-illo-title">
        An illustration of a woman walking through a well-lit city street at
        evening, past glowing streetlights, with a location pin and route line.
      </title>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#17233B" />
          <stop offset="0.6" stopColor="#26305A" />
          <stop offset="1" stopColor="#3A3C7A" />
        </linearGradient>
        <radialGradient id="lamp" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FDE68A" stopOpacity="0.9" />
          <stop offset="1" stopColor="#FDE68A" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="route" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2DD4BF" />
          <stop offset="1" stopColor="#818CF8" />
        </linearGradient>
      </defs>

      <rect width="400" height="220" rx="20" fill="url(#sky)" />

      {/* Distant skyline */}
      <g fill="#1B2748">
        <rect x="18" y="70" width="46" height="90" rx="4" />
        <rect x="70" y="50" width="40" height="110" rx="4" />
        <rect x="118" y="86" width="34" height="74" rx="4" />
        <rect x="250" y="60" width="44" height="100" rx="4" />
        <rect x="300" y="80" width="38" height="80" rx="4" />
        <rect x="344" y="54" width="40" height="106" rx="4" />
      </g>

      {/* Lit windows */}
      <g fill="#FDE68A" opacity="0.85">
        <rect x="28" y="82" width="7" height="7" rx="1.4" />
        <rect x="42" y="98" width="7" height="7" rx="1.4" />
        <rect x="80" y="66" width="7" height="7" rx="1.4" />
        <rect x="94" y="86" width="7" height="7" rx="1.4" />
        <rect x="80" y="106" width="7" height="7" rx="1.4" />
        <rect x="262" y="76" width="7" height="7" rx="1.4" />
        <rect x="278" y="96" width="7" height="7" rx="1.4" />
        <rect x="312" y="96" width="7" height="7" rx="1.4" />
        <rect x="356" y="70" width="7" height="7" rx="1.4" />
        <rect x="356" y="92" width="7" height="7" rx="1.4" />
      </g>

      {/* Ground */}
      <rect x="0" y="160" width="400" height="60" fill="#101A30" />
      <rect x="0" y="160" width="400" height="3" fill="#233156" />

      {/* Streetlight pools of light (the "well-lit" cue) */}
      <ellipse cx="120" cy="196" rx="60" ry="16" fill="url(#lamp)" />
      <ellipse cx="300" cy="196" rx="52" ry="14" fill="url(#lamp)" />

      {/* Streetlight 1 */}
      <g stroke="#0F766E" strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M120 160V104" />
        <path d="M120 104c0-8 6-14 14-14" />
      </g>
      <circle cx="136" cy="90" r="7" fill="#FDE68A" />

      {/* Streetlight 2 */}
      <g stroke="#0F766E" strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M300 160V108" />
        <path d="M300 108c0-8-6-14-14-14" />
      </g>
      <circle cx="284" cy="94" r="7" fill="#FDE68A" />

      {/* Route line along the pavement */}
      <path
        d="M40 200c60 0 60-14 120-14s60 14 120 14 60-10 100-10"
        fill="none"
        stroke="url(#route)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="2 12"
      />

      {/* Location pin hovering */}
      <g transform="translate(196 96)">
        <path
          d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.3 21.7 0 14 0z"
          fill="#2DD4BF"
        />
        <circle cx="14" cy="14" r="5.5" fill="#0B1020" />
      </g>

      {/* Walking woman (stylised, non-stereotyped) */}
      <g>
        {/* head */}
        <circle cx="205" cy="150" r="9" fill="#F4C9A8" />
        {/* hair bun */}
        <circle cx="212" cy="145" r="4" fill="#2A2340" />
        {/* body / coat */}
        <path
          d="M198 160c0-4 6-7 7-7s7 3 7 7l3 26h-20z"
          fill="#4F46E5"
        />
        {/* bag */}
        <rect x="214" y="172" width="11" height="12" rx="2.5" fill="#0F766E" />
        {/* legs mid-stride */}
        <path d="M200 186l-4 14" stroke="#17233B" strokeWidth="5" strokeLinecap="round" />
        <path d="M210 186l5 13" stroke="#17233B" strokeWidth="5" strokeLinecap="round" />
      </g>

      {/* Small compass / map accent */}
      <g transform="translate(54 40)" opacity="0.9">
        <circle cx="0" cy="0" r="14" fill="none" stroke="#818CF8" strokeWidth="2.5" />
        <path d="M-5 5 5-5M-5-5 5 5" stroke="#2DD4BF" strokeWidth="0" />
        <path d="M-4 4 4-4" stroke="#818CF8" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="0" cy="0" r="2.5" fill="#2DD4BF" />
      </g>
    </svg>
  )
}

export function EmptyContactsIllustration() {
  return (
    <svg width="120" height="96" viewBox="0 0 120 96" aria-hidden="true" focusable="false">
      <rect x="18" y="10" width="84" height="70" rx="12" fill="var(--saath-surface-2)" stroke="var(--saath-line)" strokeWidth="2" />
      <circle cx="48" cy="38" r="12" fill="none" stroke="var(--saath-brand)" strokeWidth="3" />
      <path d="M32 62c2-9 8-13 16-13s14 4 16 13" fill="none" stroke="var(--saath-brand)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="80" cy="40" r="10" fill="none" stroke="var(--saath-accent)" strokeWidth="3" />
      <path d="M68 60c1.5-7 6-10 12-10s10.5 3 12 10" fill="none" stroke="var(--saath-accent)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="96" cy="24" r="12" fill="var(--saath-brand)" />
      <path d="M96 19v10M91 24h10" stroke="var(--saath-brand-ink)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function EmptyJourneyIllustration() {
  return (
    <svg width="132" height="92" viewBox="0 0 132 92" aria-hidden="true" focusable="false">
      <path
        d="M18 74c22 0 22-40 44-40s22 40 44 40"
        fill="none"
        stroke="var(--saath-brand)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray="2 12"
      />
      <circle cx="18" cy="74" r="8" fill="var(--saath-surface-2)" stroke="var(--saath-brand)" strokeWidth="3" />
      <g transform="translate(98 20)">
        <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 19 12 19s12-10 12-19C24 5.4 18.6 0 12 0z" fill="var(--saath-accent)" />
        <circle cx="12" cy="12" r="4.6" fill="var(--saath-surface)" />
      </g>
    </svg>
  )
}

export function EmptyReportsIllustration() {
  return (
    <svg width="104" height="92" viewBox="0 0 104 92" aria-hidden="true" focusable="false">
      <rect x="24" y="12" width="56" height="68" rx="10" fill="var(--saath-surface-2)" stroke="var(--saath-line)" strokeWidth="2" />
      <path d="M36 30h32M36 42h32M36 54h20" stroke="var(--saath-muted)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="74" cy="66" r="14" fill="var(--saath-accent)" />
      <path d="M68 66l4 4 8-9" fill="none" stroke="var(--saath-surface)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
