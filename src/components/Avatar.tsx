/**
 * Initials-based avatar for trusted contacts. The colour is derived
 * deterministically from the name so the same person always gets the same
 * tint, and it is decorative only — the person's name is always shown as text
 * beside it, so meaning is never conveyed by colour alone.
 */
const TINTS = ['#4F46E5', '#0F766E', '#7C3AED', '#0369A1', '#B45309', '#BE185D', '#047857']

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function tintFor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return TINTS[hash % TINTS.length]
}

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <span
      className="avatar"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        background: tintFor(name),
        fontSize: size * 0.4,
      }}
    >
      {initialsOf(name)}
    </span>
  )
}
