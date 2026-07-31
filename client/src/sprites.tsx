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

  ghost: (
    <>
      <circle cx="32" cy="20" r="10" />
      <path d="M25 18 L31 20 M37 17 L41 19" stroke-width="1.6" />
      <path d="M16 54 C14 34 50 34 48 54 L44 48 L40 55 L36 48 L32 55 L28 48 L24 55 L20 48 Z" />
      <path d="M50 24 C54 20 56 24 53 27 M53 14 C57 12 58 16 55 18" stroke-width="1.4" />
    </>
  ),

  array: (
    <>
      <circle cx="32" cy="20" r="10" />
      <path d="M26 19 H30 M34 19 H38" stroke-width="1.8" />
      <path d="M14 52 C14 36 50 36 50 52" />
      <path d="M28 40 L32 46 L36 40" />
      <circle cx="12" cy="26" r="4" stroke-width="1.6" />
      <circle cx="52" cy="26" r="4" stroke-width="1.6" />
      <path d="M15 29 L24 36 M49 29 L40 36" stroke-width="1.2" />
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

  leech: (
    <>
      <path d="M12 40 C18 30 26 46 32 36 C38 26 46 42 52 32" stroke-width="2.6" />
      <path d="M50 30 L56 28 M50 34 L56 36" stroke-width="1.6" />
      {dot(14, 38, 1.8)}
    </>
  ),
  watchdog: (
    <>
      <path d="M14 52 V30 L24 20 H40 L50 30 V52" />
      <path d="M18 20 L24 28 M46 20 L40 28" stroke-width="1.8" />
      <ellipse cx="26" cy="36" rx="2.4" ry="3" fill="currentColor" stroke="none" />
      <ellipse cx="38" cy="36" rx="2.4" ry="3" fill="currentColor" stroke="none" />
      <path d="M26 46 L30 43 L34 46 L38 43" stroke-width="1.8" />
    </>
  ),
  minelayer: (
    <>
      <circle cx="32" cy="36" r="13" />
      <path d="M32 23 V15 M22 27 L16 21 M42 27 L48 21 M32 49 V55 M22 45 L16 51 M42 45 L48 51" stroke-width="1.8" />
      {dot(32, 36, 2.6)}
    </>
  ),
  overseer: (
    <>
      <path d="M8 32 C18 18 46 18 56 32 C46 46 18 46 8 32 Z" />
      <circle cx="32" cy="32" r="7" />
      {dot(32, 32, 2.6)}
      <path d="M32 12 V6 M20 15 L17 9 M44 15 L47 9" stroke-width="1.6" />
    </>
  ),
  botnetlord: (
    <>
      <rect x="20" y="20" width="24" height="24" rx="3" />
      <path d="M20 28 H44 M28 20 V16 M36 20 V16" stroke-width="1.6" />
      <ellipse cx="27" cy="36" rx="2.2" ry="2.6" fill="currentColor" stroke="none" />
      <ellipse cx="37" cy="36" rx="2.2" ry="2.6" fill="currentColor" stroke="none" />
      <path d="M14 52 L20 44 M50 52 L44 44 M24 52 H40" stroke-width="1.8" />
      <path d="M22 12 L27 8 M32 12 V6 M42 12 L37 8" stroke-width="1.6" />
    </>
  ),
  phantom: (
    <>
      <path d="M18 54 C12 22 52 22 46 54 L41 48 L37 55 L32 48 L27 55 L23 48 Z" stroke-dasharray="4 3" />
      <ellipse cx="27" cy="33" rx="2.4" ry="3.6" fill="currentColor" stroke="none" />
      <ellipse cx="38" cy="33" rx="2.4" ry="3.6" fill="currentColor" stroke="none" />
    </>
  ),
  nullmonarch: (
    <>
      <path d="M16 24 L22 32 L32 20 L42 32 L48 24 V44 H16 Z" />
      {dot(32, 14, 2.2)}
      <path d="M20 50 H44 M24 56 H40" stroke-width="1.8" />
      <path d="M26 38 H30 M34 38 H38" stroke-width="1.6" />
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

  // --- cycle 39 enemies (compact geometric line art) ---------------------
  bitrat: (<><path d="M14 44 Q20 30 34 32 Q48 34 50 44 Z" />{dot(42, 38, 1.8)}<path d="M50 40 L58 34" stroke-width="1.4" /><path d="M20 44 V50 M40 44 V50" stroke-width="1.6" /></>),
  adfly: (<><circle cx="32" cy="34" r="8" /><path d="M24 30 L10 20 M40 30 L54 20 M24 36 L12 42 M40 36 L52 42" stroke-width="1.4" />{dot(32, 34, 2)}</>),
  cursorghoul: (<><path d="M24 10 L24 46 L33 38 L39 52 L45 48 L38 35 L48 34 Z" /></>),
  staticjelly: (<><path d="M16 34 A16 16 0 0 1 48 34 Z" /><path d="M20 34 Q22 46 18 54 M32 34 Q34 48 30 56 M44 34 Q46 46 42 54" stroke-width="1.4" /></>),
  packmule: (<><rect x="12" y="26" width="40" height="18" rx="3" /><rect x="20" y="16" width="14" height="10" rx="2" /><path d="M18 44 V52 M46 44 V52" stroke-width="2" /></>),
  popupspawner: (<><rect x="12" y="14" width="28" height="20" rx="2" /><rect x="24" y="28" width="28" height="20" rx="2" /><path d="M44 32 L48 36 M48 32 L44 36" stroke-width="1.6" /></>),
  lintbeast: (<><circle cx="32" cy="36" r="16" /><path d="M20 24 L14 16 M44 24 L50 16 M26 52 L22 58 M38 52 L42 58" stroke-width="1.4" />{dot(26, 34, 2)}{dot(38, 34, 2)}</>),
  firewallwarden: (<><path d="M32 8 L52 18 V38 C52 48 43 54 32 58 C21 54 12 48 12 38 V18 Z" /><path d="M22 30 H42 M32 22 V40" stroke-width="1.8" /></>),
  proxyshark: (<><path d="M10 38 Q28 22 54 32 Q46 40 34 42 Q20 44 10 38 Z" /><path d="M34 28 L38 18 L44 28" /><path d="M46 34 L54 32" stroke-width="1.4" /></>),
  tokenthief: (<><circle cx="32" cy="30" r="12" /><path d="M28 28 H36 M32 24 V36" stroke-width="1.8" /><path d="M20 46 Q32 54 44 46" stroke-width="1.6" /></>),
  voltmoth: (<><path d="M32 26 L18 14 Q10 26 22 34 Z M32 26 L46 14 Q54 26 42 34 Z" /><path d="M32 26 V44" stroke-width="2" />{dot(32, 48, 1.8)}</>),
  coldstorage: (<><rect x="14" y="12" width="36" height="40" rx="3" /><path d="M32 20 V44 M22 26 L42 38 M42 26 L22 38" stroke-width="1.4" /></>),
  quicksort: (<><path d="M18 46 V22 M30 46 V14 M42 46 V30 M54 46 V20" stroke-width="2.4" /><path d="M14 50 H58" stroke-width="1.4" /></>),
  stackghast: (<><rect x="18" y="38" width="28" height="8" rx="1" /><rect x="20" y="28" width="24" height="8" rx="1" /><rect x="22" y="18" width="20" height="8" rx="1" />{dot(28, 12, 1.6)}{dot(36, 12, 1.6)}</>),
  loadmaster: (<><path d="M14 52 H50 M20 52 V30 H44 V52" /><path d="M32 30 V16 H52 M52 16 V24" stroke-width="1.8" />{dot(52, 28, 2.2)}</>),
  nullhound: (<><path d="M12 46 Q18 30 34 32 L44 24 L48 32 Q54 36 52 46 Z" /><path d="M24 34 L30 40" stroke-width="1.4" /><circle cx="42" cy="34" r="2.4" /></>),
  panicdaemon: (<><circle cx="32" cy="32" r="16" /><path d="M28 26 Q32 22 36 26 M26 40 Q32 46 38 40" stroke-width="1.6" /><path d="M32 6 V12 M32 52 V58" stroke-width="2" /></>),
  memleech: (<><path d="M14 40 Q20 26 32 28 Q46 30 50 40 Q42 50 30 48 Q18 46 14 40 Z" /><path d="M50 40 L58 44" stroke-width="1.6" />{dot(24, 38, 1.8)}</>),
  forkbomblet: (<><path d="M32 18 V34 M32 26 L22 36 M32 26 L42 36" stroke-width="2" />{dot(32, 14, 2.2)}</>),
  forkbomb: (<><path d="M32 10 V26 M32 18 L18 32 M32 18 L46 32 M18 32 L12 44 M18 32 L26 44 M46 32 L38 44 M46 32 L52 44" stroke-width="1.8" />{dot(32, 8, 2.4)}</>),
  ossifier: (<><path d="M20 52 V26 Q20 14 32 14 Q44 14 44 26 V52 Z" /><path d="M26 28 H38 M26 38 H38" stroke-width="1.6" /></>),
  gatekeeper: (<><rect x="14" y="14" width="36" height="40" rx="3" /><path d="M32 14 V54 M14 30 H50" stroke-width="1.6" /><circle cx="32" cy="30" r="5" /></>),
  rootling: (<><path d="M32 14 V34 M32 34 L22 48 M32 34 L42 48 M32 24 L24 30 M32 24 L40 30" stroke-width="1.8" />{dot(32, 12, 2)}</>),
  sporewall: (<><rect x="12" y="16" width="40" height="36" rx="2" />{dot(24, 28, 2.4)}{dot(38, 24, 2)}{dot(30, 40, 2.6)}{dot(44, 42, 1.8)}</>),
  daemoncore: (<><circle cx="32" cy="32" r="17" /><circle cx="32" cy="32" r="8" />{dot(32, 32, 3)}<path d="M32 8 V15 M32 49 V56 M8 32 H15 M49 32 H56" stroke-width="1.8" /></>),
  garbagecollector: (<><path d="M18 24 H46 L42 52 H22 Z" /><path d="M26 18 H38 M32 12 V18 M26 30 V46 M32 30 V46 M38 30 V46" stroke-width="1.6" /></>),
  archivewarden: (<><rect x="12" y="14" width="40" height="40" rx="2" /><path d="M20 22 H44 M20 30 H44 M20 38 H44 M20 46 H36" stroke-width="1.4" /><circle cx="44" cy="46" r="4" /></>),
  singularityshard: (<><path d="M32 8 L40 26 L56 32 L40 38 L32 56 L24 38 L8 32 L24 26 Z" />{dot(32, 32, 3)}</>),
  rootkernel: (<><path d="M32 8 L48 18 V36 L32 46 L16 36 V18 Z" /><circle cx="32" cy="27" r="6" /><path d="M32 46 V54 M32 54 L20 62 M32 54 L44 62 M16 30 L6 38 M48 30 L58 38" stroke-width="1.6" /></>),
  glitchmite: (<><rect x="26" y="26" width="12" height="12" rx="2" /><path d="M20 32 H10 M54 32 H44 M32 20 V12 M32 52 V44" stroke-width="1.4" /></>),
  wiremouse: (<><ellipse cx="30" cy="38" rx="14" ry="9" /><circle cx="44" cy="32" r="5" /><path d="M16 38 Q6 40 8 48" stroke-width="1.4" /></>),
  phishfin: (<><path d="M12 38 Q26 24 50 30 L44 38 L50 46 Q26 52 12 38 Z" /><path d="M50 30 Q56 24 54 16" stroke-width="1.4" /></>),
  spamwhale: (<><path d="M10 40 Q16 24 36 24 Q54 24 54 36 Q54 46 36 46 Q18 46 10 40 Z" /><path d="M46 20 Q46 12 52 10 M46 20 Q52 18 54 12" stroke-width="1.4" />{dot(20, 34, 1.8)}</>),
  boltcrab: (<><ellipse cx="32" cy="38" rx="15" ry="10" /><path d="M18 32 Q10 26 12 18 M46 32 Q54 26 52 18" stroke-width="1.8" /><path d="M22 48 L18 54 M42 48 L46 54" stroke-width="1.4" /></>),
  tapeworm: (<><path d="M10 40 Q18 30 26 38 Q34 46 42 38 Q50 30 56 36" stroke-width="2.4" />{dot(10, 40, 2.2)}</>),
  keylogger: (<><rect x="12" y="22" width="40" height="22" rx="3" /><path d="M18 28 H22 M26 28 H30 M34 28 H38 M42 28 H46 M18 36 H46" stroke-width="1.4" /></>),
  cryptomite: (<><circle cx="32" cy="34" r="14" /><path d="M28 26 V42 M36 26 V42 M24 30 H42 M24 38 H42" stroke-width="1.4" /></>),
  hashrig: (<><rect x="12" y="28" width="28" height="20" rx="2" /><rect x="42" y="20" width="10" height="26" rx="1" /><path d="M47 20 V14 M47 46 V52" stroke-width="1.6" /><path d="M22 24 Q28 10 44 12" stroke-width="1.4" />{dot(44, 12, 1.8)}</>),
  autosave: (<><rect x="16" y="16" width="32" height="32" rx="4" /><circle cx="32" cy="32" r="8" /><path d="M32 28 V32 L36 35" stroke-width="1.6" /><path d="M10 22 H16 M10 42 H16 M54 22 H48 M54 42 H48" stroke-width="1.4" /></>),
  pixelmoth: (<><path d="M32 34 L20 18 Q8 22 18 34 Z M32 34 L44 18 Q56 22 46 34 Z" /><path d="M32 34 V46" stroke-width="2" />{dot(32, 50, 1.8)}{dot(24, 12, 1.4)}{dot(40, 12, 1.4)}</>),
  junkgolem: (<><rect x="18" y="28" width="28" height="24" rx="2" /><rect x="24" y="14" width="16" height="12" rx="2" /><path d="M18 36 L8 30 M46 36 L56 30" stroke-width="2" /></>),
  sirenode: (<><circle cx="32" cy="30" r="10" /><path d="M32 40 V52 M24 46 Q32 54 40 46" stroke-width="1.6" /><path d="M18 22 Q14 30 18 38 M46 22 Q50 30 46 38" stroke-width="1.2" /></>),
  hexbat: (<><path d="M32 30 L14 18 Q8 30 20 36 Z M32 30 L50 18 Q56 30 44 36 Z" /><circle cx="32" cy="34" r="5" /></>),
  ratking: (<><path d="M14 48 Q20 32 32 34 Q46 36 50 48 Z" /><path d="M22 30 L26 22 L30 30 L34 22 L38 30 L42 22 L44 32" stroke-width="1.6" /></>),
  coilviper: (<><path d="M14 46 Q10 34 22 32 Q34 30 34 38 Q34 46 44 44 Q54 42 50 30" stroke-width="2.4" />{dot(50, 26, 2.2)}</>),
  brokerimp: (<><circle cx="32" cy="30" r="11" /><path d="M24 22 L18 12 M40 22 L46 12" stroke-width="1.6" /><path d="M28 34 Q32 38 36 34" stroke-width="1.4" /><path d="M26 46 H38" stroke-width="1.8" /></>),
  chainhound: (<><path d="M12 44 Q18 30 34 32 L46 26 L50 34 Q54 38 52 44 Z" /><circle cx="18" cy="52" r="3" /><circle cx="28" cy="52" r="3" /><circle cx="38" cy="52" r="3" /></>),
  vaultmimic: (<><rect x="14" y="24" width="36" height="26" rx="3" /><path d="M14 34 H50" stroke-width="1.6" /><path d="M22 34 L26 42 M32 34 L36 42 M42 34 L46 42" stroke-width="1.6" /><circle cx="32" cy="29" r="2.6" /></>),
  echoshade: (<><path d="M22 50 C16 22 48 22 44 50 L38 44 L32 50 L26 44 Z" opacity="0.9" /><path d="M28 50 C24 30 46 28 44 46" stroke-width="1" opacity="0.5" /></>),
  plagueherald: (<><path d="M32 10 V44 M22 20 H42" stroke-width="2.2" /><path d="M20 52 Q32 44 44 52" stroke-width="1.8" />{dot(32, 48, 2)}</>),
  ironbarnacle: (<><path d="M16 46 Q16 28 32 24 Q48 28 48 46 Z" /><path d="M24 38 L20 30 M32 34 L32 26 M40 38 L44 30" stroke-width="1.6" /></>),
  nullnun: (<><path d="M24 52 V30 Q24 18 32 18 Q40 18 40 30 V52 Z" /><circle cx="32" cy="28" r="4" /><path d="M32 36 V46 M28 40 H36" stroke-width="1.6" /></>),

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
  'ev-auction': (
    <>
      <rect x="30" y="8" width="16" height="12" rx="2" transform="rotate(45 38 14)" />
      <path d="M34 24 L18 40" stroke-width="3" />
      <path d="M12 52 H40 M16 52 V46 H36 V52" stroke-width="1.8" />
    </>
  ),
  'ev-stimlab': (
    <>
      <path d="M28 8 H36 M32 8 V24 L18 48 A6 6 0 0 0 24 56 H40 A6 6 0 0 0 46 48 L32 24" />
      <path d="M24 42 H40" stroke-width="1.6" />
      {dot(29, 48, 1.8)}
      {dot(36, 50, 1.4)}
    </>
  ),
  'ev-archivist': (
    <>
      <rect x="14" y="40" width="36" height="10" rx="1" />
      <rect x="18" y="28" width="28" height="10" rx="1" />
      <rect x="22" y="16" width="20" height="10" rx="1" />
      {dot(44, 45, 1.6)}
      {dot(40, 33, 1.6)}
      {dot(36, 21, 1.6)}
    </>
  ),
  'ev-junkyard': (
    <>
      <path d="M14 50 L36 28" stroke-width="2.4" />
      <path d="M34 18 A10 10 0 0 1 46 30 L52 24 M46 30 L40 36" />
      <path d="M12 56 H30" stroke-width="1.6" />
      <path d="M46 46 L54 54 M54 46 L46 54" stroke-width="1.8" />
    </>
  ),
  'ev-chapel': (
    <>
      <rect x="22" y="24" width="20" height="32" rx="2" />
      <path d="M26 32 H38 M26 38 H38 M26 44 H38" stroke-width="1.4" />
      <path d="M32 20 C28 14 32 10 32 8 C32 10 36 14 32 20" />
    </>
  ),
  'ev-glitchpool': (
    <>
      <path d="M32 12 A20 20 0 1 1 12 32 A14 14 0 1 0 32 18 A9 9 0 1 1 26 32" />
      {dot(32, 32, 2)}
    </>
  ),
  'ev-vending': (
    <>
      <rect x="16" y="8" width="32" height="48" rx="2" />
      <rect x="21" y="14" width="14" height="26" rx="1" stroke-width="1.6" />
      <path d="M40 16 V22 M40 28 V34" stroke-width="2.2" />
      <path d="M21 48 H43" stroke-width="1.6" />
    </>
  ),
  'ev-streetdoc': (
    <>
      <path d="M20 44 L44 20" stroke-width="2.4" />
      <path d="M40 12 L52 24 L44 32 L32 20 Z" />
      <path d="M14 50 L20 44 M12 56 L18 50" stroke-width="1.8" />
      <path d="M36 24 L40 28" stroke-width="1.4" />
    </>
  ),
  'ev-signaltower': (
    <>
      <path d="M26 56 L32 20 L38 56 M28 44 H36" />
      {dot(32, 14, 2.4)}
      <path d="M22 12 C18 16 18 22 22 26 M42 12 C46 16 46 22 42 26" stroke-width="1.6" />
    </>
  ),
  'ev-memoryleak': (
    <>
      <rect x="14" y="10" width="36" height="22" rx="2" />
      <path d="M20 16 H34 M20 21 H42 M20 26 H30" stroke-width="1.4" />
      <path d="M32 38 C28 44 26 47 26 50 A6 6 0 0 0 38 50 C38 47 36 44 32 38" />
    </>
  ),
  'ev-straydrone': (
    <>
      <rect x="24" y="26" width="16" height="12" rx="2" />
      <path d="M24 30 L12 24 M40 30 L52 24" />
      <path d="M8 22 H16 M48 22 H56" stroke-width="1.8" />
      <path d="M28 38 L26 46 M36 38 L38 46" stroke-width="1.6" />
      {dot(32, 32, 1.8)}
    </>
  ),
  'ev-forcedupdate': (
    <>
      <path d="M18 24 A16 16 0 0 1 46 24 L46 16 M46 24 H38" />
      <path d="M46 40 A16 16 0 0 1 18 40 L18 48 M18 40 H26" />
    </>
  ),
  'ev-blackice': (
    <>
      <path d="M32 6 L52 18 V40 L32 58 L12 40 V18 Z" />
      <path d="M32 6 V58 M12 18 L52 40 M52 18 L12 40" stroke-width="1.2" />
    </>
  ),
  'ev-timecapsule': (
    <>
      <rect x="14" y="22" width="36" height="24" rx="4" />
      <path d="M14 34 H50" stroke-width="1.4" />
      <circle cx="32" cy="34" r="5" />
      <path d="M32 31 V34 L35 36" stroke-width="1.6" />
    </>
  ),
  'ev-tollgate': (
    <>
      <path d="M14 56 V20 M50 56 V20 M10 20 H54" />
      <path d="M14 28 L50 44" stroke-width="2.2" />
      <path d="M20 31 L24 33 M30 35 L34 37 M40 40 L44 42" stroke="var(--bg, #000)" stroke-width="1.4" />
    </>
  ),
  'ev-ratking': (
    <>
      <path d="M20 44 C14 34 22 24 32 26 C42 24 50 34 44 44 Z" />
      <path d="M24 26 C22 20 26 18 28 22 M40 26 C42 20 38 18 36 22" stroke-width="1.6" />
      <path d="M44 42 C52 44 54 50 48 52" stroke-width="1.6" />
      {dot(27, 34, 1.6)}
      {dot(37, 34, 1.6)}
      <path d="M18 50 H46" stroke-width="1.4" />
    </>
  ),
  'ev-coolantspill': (
    <>
      <path d="M12 44 C18 38 26 50 32 44 C38 38 46 50 52 44" stroke-width="2.2" />
      <path d="M22 20 L26 28 M32 14 L34 24 M42 18 L40 26" stroke-width="1.6" />
      {dot(28, 34, 1.6)}
      {dot(40, 32, 1.4)}
    </>
  ),
  'ev-debtcollector': (
    <>
      <rect x="18" y="12" width="28" height="36" rx="2" />
      <path d="M24 20 H40 M24 26 H40 M24 32 H34" stroke-width="1.4" />
      <path d="M24 40 H30" stroke-width="2.2" />
      <path d="M18 48 L14 56 M46 48 L50 56" stroke-width="1.6" />
    </>
  ),
  'ev-datavault': (<><rect x="14" y="18" width="36" height="32" rx="3" /><circle cx="46" cy="34" r="6" /><path d="M46 29 V31 M46 37 V39" stroke-width="1.4" /><path d="M20 42 H40" stroke-width="1.2" /></>),
  'ev-recyclebin': (<><rect x="18" y="26" width="28" height="24" rx="2" /><path d="M14 26 H50 M22 26 L24 18 H40 L42 26" stroke-width="1.6" /><path d="M28 32 V44 M36 32 V44" stroke-width="1.4" /></>),
  'ev-arcade': (
    <>
      <path d="M18 56 V24 A14 14 0 0 1 46 24 V56 Z" />
      <rect x="24" y="22" width="16" height="12" rx="1" stroke-width="1.6" />
      {dot(26, 44, 2)}
      <path d="M38 40 V48 M34 44 H42" stroke-width="1.8" />
    </>
  ),
  'ev-ghostsignal': (
    <>
      <path d="M10 32 C16 22 22 42 28 32 C34 22 40 42 46 32 C50 26 52 28 54 32" stroke-width="2" />
      {dot(54, 32, 2)}
      <path d="M46 20 L54 12 M50 22 L56 16" stroke-width="1.2" />
    </>
  ),
  'ev-antivirus': (
    <>
      <path d="M32 6 L52 14 V32 C52 46 43 54 32 58 C21 54 12 46 12 32 V14 Z" />
      <path d="M22 32 L29 39 L43 24" stroke-width="2.4" />
    </>
  ),
  'ev-foundry': (
    <>
      <circle cx="32" cy="32" r="10" />
      <path d="M32 18 V12 M32 46 V52 M18 32 H12 M46 32 H52 M22 22 L18 18 M42 22 L46 18 M22 42 L18 46 M42 42 L46 46" stroke-width="1.8" />
      {dot(32, 32, 2.6)}
    </>
  ),
  'ev-lottery': (
    <>
      <path d="M32 10 L37 24 L52 24 L40 33 L45 48 L32 39 L19 48 L24 33 L12 24 L27 24 Z" />
      {dot(32, 30, 1.8)}
    </>
  ),
  'ev-coldstorage': (
    <>
      <rect x="20" y="8" width="24" height="48" rx="8" />
      <path d="M32 18 V34 M26 24 L38 30 M38 24 L26 30" stroke-width="1.6" />
      <path d="M26 44 H38" stroke-width="1.8" />
    </>
  ),
  'ev-adbot': (
    <>
      <rect x="14" y="16" width="36" height="26" rx="3" />
      <path d="M27 22 L39 29 L27 36 Z" />
      <path d="M24 50 L20 56 M40 50 L44 56 M32 42 V50" stroke-width="1.6" />
    </>
  ),
  'ev-mirrormaze': (
    <>
      <rect x="12" y="14" width="12" height="36" rx="1" />
      <rect x="27" y="14" width="12" height="36" rx="1" />
      <rect x="42" y="14" width="12" height="36" rx="1" />
      <path d="M16 20 L20 44 M31 20 L35 44 M46 20 L50 44" stroke-width="1.1" />
    </>
  ),
  'ev-quine': (
    <>
      <path d="M20 32 C20 24 30 24 32 32 C34 40 44 40 44 32 C44 24 34 24 32 32 C30 40 20 40 20 32 Z" stroke-width="2.2" />
      {dot(32, 32, 1.8)}
    </>
  ),
  'ev-karaoke': (
    <>
      <circle cx="30" cy="18" r="7" />
      <path d="M30 25 V44 M30 44 C30 50 22 50 22 46 M36 14 C42 10 48 14 46 20" stroke-width="1.8" />
      <path d="M42 26 L46 22 M44 32 L50 28" stroke-width="1.2" />
    </>
  ),
  'ev-proxywar': (
    <>
      <path d="M16 54 V14 L34 20 L16 26" />
      <path d="M48 54 V22 L32 28 L48 34" stroke-width="1.6" />
      <path d="M12 54 H52" stroke-width="1.8" />
    </>
  ),
  'ev-blackbox': (
    <>
      <rect x="14" y="22" width="36" height="22" rx="3" />
      <path d="M20 28 H30 M20 33 H26 M20 38 H34" stroke-width="1.4" />
      {dot(43, 33, 2.4)}
      <path d="M14 48 L10 54 M50 48 L54 54" stroke-width="1.4" />
    </>
  ),
  'ev-servergarden': (
    <>
      <rect x="14" y="34" width="36" height="20" rx="2" />
      <path d="M20 40 H28 M20 46 H26" stroke-width="1.3" />
      <path d="M40 34 V20 M40 26 C34 26 32 20 32 16 M40 22 C46 22 48 16 48 12" stroke-width="1.8" />
    </>
  ),
  'ev-tribunal': (
    <>
      <path d="M32 10 V50 M18 18 H46" stroke-width="1.8" />
      <path d="M18 18 L12 32 A6 6 0 0 0 24 32 Z M46 18 L40 32 A6 6 0 0 0 52 32 Z" stroke-width="1.4" />
      <path d="M22 54 H42" stroke-width="1.8" />
    </>
  ),
  'ev-blackoutzone': (
    <>
      <path d="M38 8 A20 20 0 1 0 38 56 A16 16 0 0 1 38 8 Z" />
      {dot(18, 20, 1.4)}
      {dot(14, 34, 1.2)}
    </>
  ),
  'ev-punchcard': (
    <>
      <rect x="14" y="16" width="36" height="32" rx="2" />
      <path d="M50 16 L42 24 V16 Z" stroke-width="1.4" />
      <rect x="20" y="24" width="5" height="3" stroke-width="1.1" />
      <rect x="30" y="24" width="5" height="3" stroke-width="1.1" />
      <rect x="24" y="32" width="5" height="3" stroke-width="1.1" />
      <rect x="36" y="38" width="5" height="3" stroke-width="1.1" />
    </>
  ),
  'ev-scrapdog': (
    <>
      <rect x="16" y="30" width="24" height="14" rx="2" />
      <rect x="38" y="22" width="12" height="10" rx="2" />
      <path d="M40 22 L38 16 M48 22 L50 16 M20 44 V52 M34 44 V52" stroke-width="1.6" />
      <path d="M16 34 C10 32 10 26 14 26" stroke-width="1.4" />
      {dot(45, 27, 1.4)}
    </>
  ),
  'ev-datawell': (
    <>
      <path d="M16 20 C16 14 48 14 48 20 C48 26 16 26 16 20 Z" />
      <path d="M16 20 V44 C16 50 48 50 48 44 V20" stroke-width="1.6" />
      <path d="M24 32 H40 M28 40 H36" stroke-width="1.2" />
    </>
  ),
  'ev-ransomnote': (
    <>
      <rect x="16" y="12" width="32" height="40" rx="2" />
      <path d="M22 20 H42 M22 26 H42 M22 32 H36" stroke-width="1.3" />
      <circle cx="32" cy="42" r="4" />
      <path d="M32 42 V46" stroke-width="1.6" />
    </>
  ),
  'ev-glitchfest': (
    <>
      <path d="M32 8 L36 20 L48 20 L38 28 L42 40 L32 32 L22 40 L26 28 L16 20 L28 20 Z" stroke-dasharray="5 3" />
      <path d="M10 48 H22 M28 52 H36 M42 48 H54" stroke-width="1.6" />
    </>
  ),
  'ev-lasttrain': (
    <>
      <rect x="14" y="18" width="36" height="26" rx="6" />
      <rect x="20" y="24" width="10" height="8" rx="1" stroke-width="1.4" />
      <rect x="34" y="24" width="10" height="8" rx="1" stroke-width="1.4" />
      {dot(22, 39, 1.8)}
      {dot(42, 39, 1.8)}
      <path d="M10 50 H54" stroke-width="1.6" />
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
