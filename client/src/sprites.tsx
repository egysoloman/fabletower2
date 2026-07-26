/**
 * Hand-drawn neon line-art sprites (inline SVG — no emoji, no assets, works
 * offline). All art shares one language: 2.6px strokes, round joins, glow via
 * CSS drop-shadow on currentColor, occasional filled accent dots.
 */
import type { JSX } from 'preact'

const dot = (cx: number, cy: number, r = 2) => <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />

const ART: Record<string, JSX.Element> = {
  // --- player -----------------------------------------------------------
  runner: (
    <>
      <circle cx="32" cy="19" r="10" />
      <path d="M23 17 L41 15" />
      <path d="M14 52 C14 36 50 36 50 52" />
      <path d="M26 40 L32 46 L38 40" />
      <path d="M41 11 L48 5" />
      {dot(49, 4)}
    </>
  ),

  vector: (
    <>
      <circle cx="32" cy="20" r="10" />
      <path d="M24 22 L40 18" />
      <path d="M14 52 C14 36 50 36 50 52" />
      <path d="M28 40 L32 46 L36 40" />
      <path d="M26 8 C28 4 30 6 29 10 M32 6 C34 1 37 4 35 9 M38 8 C40 4 42 6 41 10" stroke-width="1.8" />
    </>
  ),

  // --- act 1 ------------------------------------------------------------
  spambot: (
    <>
      <rect x="20" y="9" width="24" height="16" rx="3" />
      {dot(27, 17)} {dot(37, 17)}
      <path d="M32 9 L32 4" />
      {dot(32, 3)}
      <rect x="14" y="31" width="36" height="24" rx="2" />
      <path d="M14 33 L32 45 L50 33" />
    </>
  ),
  drone: (
    <>
      <path d="M22 26 A12 10 0 0 1 42 26" />
      <ellipse cx="32" cy="30" rx="20" ry="7" />
      {dot(20, 30)} {dot(32, 32)} {dot(44, 30)}
      <path d="M25 37 L21 52 M39 37 L43 52" />
    </>
  ),
  kiddie: (
    <>
      <path d="M17 52 C15 20 49 20 47 52" />
      <path d="M24 34 A8 8 0 0 1 40 34" />
      {dot(28, 34)} {dot(36, 34)}
      <rect x="21" y="46" width="22" height="9" rx="1.5" />
      <path d="M24 50 H40" stroke-width="1.4" />
    </>
  ),
  golem: (
    <>
      <rect x="24" y="8" width="16" height="11" rx="1.5" />
      {dot(29, 13)} {dot(35, 13)}
      <rect x="15" y="23" width="34" height="32" rx="2" />
      <path d="M15 34 H49 M15 45 H49 M26 23 V34 M38 34 V45 M30 45 V55" stroke-width="1.6" />
    </>
  ),
  hound: (
    <>
      <path d="M10 44 L22 28 L34 23 L52 28 L45 33 L52 39 L34 45 L26 54 L22 42 Z" />
      <path d="M22 28 L18 14 L29 24" />
      {dot(38, 31)}
      <path d="M45 33 L52 33" stroke-width="1.6" />
    </>
  ),
  hatchery: (
    <>
      <path d="M12 44 A20 22 0 0 1 52 44 Z" />
      <path d="M24 24 L28 30 L32 22 L36 30 L40 24" stroke-width="1.8" />
      <path d="M20 50 H44" stroke-width="1.6" />
      {dot(26, 40)} {dot(32, 44)} {dot(38, 40)}
      <path d="M12 44 H52" />
    </>
  ),
  subproc: (
    <>
      <circle cx="32" cy="32" r="9" />
      <path d="M18 22 L14 26 L14 38 L18 42 M46 22 L50 26 L50 38 L46 42" stroke-width="1.8" />
      {dot(32, 32, 2.4)}
    </>
  ),
  loadbalancer: (
    <>
      <rect x="14" y="22" width="36" height="20" rx="3" />
      {dot(21, 32)} {dot(28, 32)} {dot(35, 32)}
      <path d="M20 22 V10 M32 22 V10 M44 22 V10" stroke-width="1.6" />
      <path d="M20 42 L14 54 M32 42 V54 M44 42 L50 54" stroke-width="1.6" />
      <path d="M42 30 L46 34 M46 30 L42 34" stroke-width="1.4" />
    </>
  ),
  hivemind: (
    <>
      <path d="M32 10 L44 17 V31 L32 38 L20 31 V17 Z" />
      <path d="M44 24 L54 30 V42 L44 48 L34 42" stroke-width="1.8" />
      <path d="M20 24 L10 30 V42 L20 48 L30 42" stroke-width="1.8" />
      <path d="M32 38 V54" stroke-width="1.6" />
      {dot(32, 24, 2.6)} {dot(47, 36, 2)} {dot(17, 36, 2)} {dot(32, 56, 2)}
    </>
  ),
  compiler: (
    <>
      <rect x="14" y="14" width="36" height="36" rx="3" />
      <path d="M8 22 H14 M8 32 H14 M8 42 H14 M50 22 H56 M50 32 H56 M50 42 H56" />
      <rect x="23" y="23" width="18" height="18" rx="2" />
      {dot(32, 32, 3)}
    </>
  ),

  // --- act 2 ------------------------------------------------------------
  ice: (
    <>
      <path d="M32 6 L41 30 L32 54 L23 30 Z" />
      <path d="M17 24 L23 40 L12 42 Z" />
      <path d="M47 24 L52 40 L41 40 Z" />
      <path d="M32 14 L32 46" stroke-width="1.4" />
    </>
  ),
  netrunner: (
    <>
      <circle cx="30" cy="18" r="9" />
      <path d="M22 17 H38" />
      <path d="M16 52 C16 36 44 36 44 52" />
      <path d="M44 42 C54 44 56 50 50 56" />
      {dot(50, 57)}
      <path d="M25 42 L30 47 L35 42" stroke-width="1.6" />
    </>
  ),
  daemon: (
    <>
      <circle cx="32" cy="30" r="13" />
      <path d="M23 20 C17 10 27 9 27 18" />
      <path d="M41 20 C47 10 37 9 37 18" />
      <path d="M26 29 L31 31 M38 29 L33 31" />
      <path d="M32 43 C42 52 52 44 55 53" />
      <path d="M55 53 L50 52 M55 53 L54 47" stroke-width="1.6" />
    </>
  ),
  sentry: (
    <>
      <path d="M18 18 A16 14 0 0 1 46 18" />
      <rect x="30" y="6" width="4" height="12" rx="1" />
      <rect x="21" y="24" width="22" height="13" rx="2" />
      {dot(32, 30)}
      <path d="M25 37 L17 54 M39 37 L47 54 M32 37 V50" />
    </>
  ),
  blackice: (
    <>
      <path d="M32 7 L52 19 L52 45 L32 57 L12 45 L12 19 Z" />
      <path d="M32 19 L42 25 L42 39 L32 45 L22 39 L22 25 Z" stroke-width="1.6" />
      <path d="M32 7 V19 M52 19 L42 25 M52 45 L42 39 M32 57 V45 M12 45 L22 39 M12 19 L22 25" stroke-width="1.2" />
      {dot(32, 32, 2.4)}
    </>
  ),
  mainframe: (
    <>
      <rect x="18" y="7" width="28" height="50" rx="2" />
      <path d="M18 17 H46 M18 27 H46 M18 37 H46 M18 47 H46" stroke-width="1.6" />
      {dot(24, 12)} {dot(24, 22)} {dot(24, 32)} {dot(24, 42)} {dot(24, 52)}
      <path d="M36 11 H42 M36 21 H42 M36 41 H42" stroke-width="1.4" />
    </>
  ),

  // --- act 3 ------------------------------------------------------------
  nullptr: (
    <>
      <circle cx="34" cy="26" r="14" />
      <path d="M26 38 L26 48 H42 L42 38" />
      <circle cx="29" cy="24" r="3.5" fill="currentColor" stroke="none" />
      <circle cx="40" cy="24" r="3.5" fill="currentColor" stroke="none" />
      <path d="M34 29 L32 33 H36 Z" stroke-width="1.6" />
      <path d="M8 56 L24 42 M24 42 L18 44 M24 42 L23 48" />
    </>
  ),
  wraith: (
    <>
      <path d="M16 52 C10 18 54 18 48 52 L43 46 L39 53 L34 46 L29 53 L24 46 L20 53 Z" />
      <ellipse cx="26" cy="30" rx="3" ry="4.5" fill="currentColor" stroke="none" />
      <ellipse cx="39" cy="30" rx="3" ry="4.5" fill="currentColor" stroke="none" />
    </>
  ),
  botnode: (
    <>
      <circle cx="32" cy="32" r="10" />
      <path d="M24 25 L12 14 M40 25 L52 14 M22 32 L8 32 M42 32 L56 32 M24 39 L12 50 M40 39 L52 50" />
      {dot(32, 32, 3)}
    </>
  ),
  rootdaemon: (
    <>
      <path d="M9 37 L25 24 L40 21 L55 30 L45 34 L51 43 L36 44 L29 55 L24 42 Z" />
      <path d="M40 21 L45 8 M34 22 L36 12" />
      {dot(41, 30)}
      <path d="M45 34 L51 36 M36 44 L40 49" stroke-width="1.6" />
    </>
  ),
  architect: (
    <>
      <path d="M32 8 L55 51 H9 Z" />
      <circle cx="32" cy="38" r="8" />
      {dot(32, 38, 3)}
      <path d="M12 38 C20 32 44 32 52 38" stroke-width="1.4" />
    </>
  ),

  // --- act 4: the root --------------------------------------------------
  spearproc: (
    <>
      <path d="M14 50 L44 20" />
      <path d="M40 12 L52 12 L52 24 L38 26 Z" />
      <path d="M14 50 L20 50 M14 50 L14 44" stroke-width="1.6" />
      <path d="M24 34 L18 28 M34 24 L28 18" stroke-width="1.4" />
    </>
  ),
  shieldproc: (
    <>
      <path d="M32 6 L52 14 V32 C52 46 43 54 32 58 C21 54 12 46 12 32 V14 Z" />
      <path d="M32 14 V50 M18 30 H46" stroke-width="1.4" />
      {dot(32, 30, 2.6)}
    </>
  ),
  theroot: (
    <>
      <path d="M32 8 L46 16 V32 L32 40 L18 32 V16 Z" />
      {dot(32, 24, 3)}
      <path d="M32 40 V48 M32 48 L20 58 M32 48 L44 58 M32 48 V60" stroke-width="1.6" />
      <path d="M18 32 L8 40 M46 32 L56 40" stroke-width="1.4" />
    </>
  ),

  // --- map events -------------------------------------------------------
  'ev-server': (
    <>
      <rect x="16" y="8" width="32" height="48" rx="2" />
      <path d="M16 20 H48 M16 32 H48 M16 44 H48" stroke-width="1.6" />
      {dot(22, 14)} {dot(22, 26)} {dot(22, 50)}
      <path d="M10 58 L54 6" stroke-width="1.6" />
    </>
  ),
  'ev-courier': (
    <>
      <rect x="18" y="18" width="26" height="22" rx="2" />
      <path d="M18 26 H44 M31 18 V26" stroke-width="1.6" />
      <circle cx="24" cy="48" r="6" />
      <circle cx="42" cy="48" r="6" />
      <path d="M6 24 H13 M4 32 H11 M6 40 H13" />
    </>
  ),
  'ev-shrine': (
    <>
      <path d="M10 18 C24 12 40 12 54 18" />
      <path d="M14 26 H50" />
      <path d="M20 26 V54 M44 26 V54" />
      <path d="M32 26 V38" stroke-width="1.6" />
    </>
  ),
  'ev-cache': (
    <>
      <rect x="12" y="20" width="40" height="34" rx="2" />
      <path d="M12 32 H52 M32 20 V54" stroke-width="1.6" />
      <path d="M22 8 L28 16 M42 8 L36 16" />
      <path d="M32 38 V46" />
      {dot(32, 50)}
    </>
  ),
  'ev-ghost': (
    <>
      <path d="M18 52 C12 20 52 20 46 52 L41 46 L37 53 L32 46 L27 53 L23 46 Z" />
      <ellipse cx="27" cy="31" rx="2.6" ry="4" fill="currentColor" stroke="none" />
      <ellipse cx="38" cy="31" rx="2.6" ry="4" fill="currentColor" stroke="none" />
      <path d="M50 14 L58 6 M54 20 L60 18" stroke-width="1.4" />
    </>
  ),

  'ev-terminal': (
    <>
      <rect x="10" y="12" width="44" height="30" rx="3" />
      <path d="M16 20 L24 26 L16 32" />
      <path d="M28 32 H40" stroke-width="1.8" />
      <path d="M26 48 H38 M22 54 H42" />
      <path d="M32 42 V48" stroke-width="1.6" />
    </>
  ),
  'ev-broker': (
    <>
      <circle cx="32" cy="15" r="7" />
      <path d="M18 46 C18 30 46 30 46 46" />
      <rect x="22" y="42" width="20" height="14" rx="2" />
      <path d="M32 42 V48" stroke-width="1.6" />
      {dot(32, 50)}
    </>
  ),
  'ev-quarantine': (
    <>
      <path d="M32 8 L56 52 H8 Z" />
      <path d="M32 24 V38" stroke-width="3" />
      {dot(32, 45, 2.6)}
    </>
  ),
  'ev-backup': (
    <>
      <ellipse cx="32" cy="14" rx="18" ry="6" />
      <path d="M14 14 V46 A18 6 0 0 0 50 46 V14" />
      <path d="M14 30 A18 6 0 0 0 50 30" stroke-width="1.8" />
      {dot(42, 22)} {dot(42, 38)}
    </>
  ),
  'ev-dispenser': (
    <>
      <rect x="14" y="10" width="36" height="44" rx="3" />
      <path d="M32 20 V32 M26 26 H38" stroke-width="3.2" />
      <rect x="24" y="42" width="16" height="7" rx="1.5" />
    </>
  ),
  'ev-boot': (
    <>
      <path d="M32 8 V28" stroke-width="3" />
      <path d="M20 16 A17 17 0 1 0 44 16" />
      {dot(32, 52, 2.2)}
    </>
  ),
  'ev-descend': (
    <>
      <path d="M10 14 H24 V26 H36 V38 H48 V50 H56" />
      <path d="M32 18 V44 M32 44 L26 37 M32 44 L38 37" stroke-width="1.8" />
      {dot(52, 56, 2.2)}
    </>
  ),
  glitch: (
    <>
      <rect x="16" y="16" width="32" height="32" rx="3" />
      <path d="M16 28 H48 M28 16 V48" stroke-width="1.4" />
      <path d="M10 38 H20 M44 24 H56" />
    </>
  ),
}

export function Sprite(props: { id: string; size?: number; cls?: string }) {
  const size = props.size ?? 56
  return (
    <svg
      class={`sprite ${props.cls ?? ''}`}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      stroke-width="2.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {ART[props.id] ?? ART.glitch}
    </svg>
  )
}

/** Speaker with sound waves; a slash when muted. */
export function SoundIcon(props: { muted: boolean; size?: number }) {
  const size = props.size ?? 18
  return (
    <svg
      class="sprite"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M4 9 H8 L13 4 V20 L8 15 H4 Z" />
      {props.muted ? (
        <path d="M17 9 L22 15 M22 9 L17 15" />
      ) : (
        <>
          <path d="M16.5 9 A4 4 0 0 1 16.5 15" />
          <path d="M19 6.5 A8 8 0 0 1 19 17.5" />
        </>
      )}
    </svg>
  )
}
