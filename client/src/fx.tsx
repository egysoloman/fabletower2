/**
 * Combat feedback engine: floating numbers, particle bursts, impact rings,
 * card-flight ghosts, fighter recoil/lunge pulses, and graduated screen shake.
 * Everything is driven by the engine's GameEvent stream — the reducers stay
 * pure, and this layer turns their events into juice.
 */
import { signal } from '@preact/signals'
import { qualityFactor, settings } from './settings'
import { useEffect, useRef, useState } from 'preact/hooks'
import { STATUS_INFO, cardBaseName, moveName, statusName, type GameEvent, type StatusId } from '@neonspire/engine'
import { sfx } from './sfx'
import { t } from './i18n'
import { combat } from './store'

// --- Anchors: DOM positions for fighters ('p', 'e0'..., 'p0'/'p1') ----------

const anchors = new Map<string, HTMLElement>()

export function registerAnchor(who: string, el: HTMLElement | null) {
  if (el) anchors.set(who, el)
}

/** Screen-space center of a fighter panel, if mounted. */
export function anchorCenter(who: string): { x: number; y: number } | null {
  const el = anchors.get(who)
  if (!el || !el.isConnected) return null
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

/** Bounding box of a fighter panel (drag-target hit-testing). */
export function anchorBox(who: string): DOMRect | null {
  const el = anchors.get(who)
  if (!el || !el.isConnected) return null
  return el.getBoundingClientRect()
}

/**
 * One-shot animation classes for fighter panels (recoil, lunge, glow pulse),
 * driven through a signal so Preact owns the class attribute — mutating
 * classList directly gets wiped whenever the component re-renders (e.g. drag
 * highlights flipping mid-animation). Screens append `fxPulses.value[who]`
 * to the panel's class. Clearing to '' for one frame restarts the animation.
 */
export const fxPulses = signal<Record<string, string>>({})
const pulseTokens: Record<string, number> = {}

function pulse(who: string, cls: string, dur = 680) {
  const token = (pulseTokens[who] = (pulseTokens[who] ?? 0) + 1)
  fxPulses.value = { ...fxPulses.value, [who]: '' }
  requestAnimationFrame(() => {
    if (pulseTokens[who] !== token) return
    fxPulses.value = { ...fxPulses.value, [who]: cls }
  })
  setTimeout(() => {
    if (pulseTokens[who] !== token) return
    const next = { ...fxPulses.value }
    delete next[who]
    fxPulses.value = next
  }, dur)
}

/**
 * The anchor id of the local player's own panel ('p' in PvE, 'p0'/'p1' in
 * PvP) — set by each combat screen so "you got hit" feedback (big screen
 * shake) only fires for damage the local player actually takes.
 */
export const localWho = signal('p')

/** Panels on the left half recoil left / lunge right, and vice versa. */
function sideOf(who: string): 'l' | 'r' {
  const c = anchorCenter(who)
  return c && c.x < window.innerWidth / 2 ? 'l' : 'r'
}

// --- Floating text -----------------------------------------------------------

interface FloatItem {
  id: number
  x: number
  y: number
  text: string
  cls: string
}

export const floats = signal<FloatItem[]>([])
let fxId = 1

function spawnFloatAt(x: number, y: number, text: string, cls: string, life = 1050) {
  const id = fxId++
  floats.value = [...floats.value, { id, x, y, text, cls }]
  setTimeout(() => {
    floats.value = floats.value.filter((f) => f.id !== id)
  }, life)
}

function spawnFloat(who: string, text: string, cls: string) {
  const p = anchorCenter(who)
  if (!p) return
  const jx = (Math.random() - 0.5) * 46
  const jy = (Math.random() - 0.5) * 20 - 30
  spawnFloatAt(p.x + jx, p.y + jy, text, cls)
}

// --- Emote bubbles (multiplayer quick chat) ----------------------------------

interface EmoteBubble {
  id: number
  x: number
  y: number
  sym: string
  text: string
  name: string
  /** "▸ target" line when the emote was aimed at someone. */
  to?: string
}

export const emoteBubbles = signal<EmoteBubble[]>([])

/** Speech bubble above a fighter panel; targeted emotes also ping the target. */
export function showEmoteAt(who: string, sym: string, text: string, name: string, to?: string) {
  const p = anchorCenter(who)
  if (!p) return
  const id = fxId++
  emoteBubbles.value = [...emoteBubbles.value, { id, x: p.x, y: p.y - 52, sym, text, name, to }]
  setTimeout(() => {
    emoteBubbles.value = emoteBubbles.value.filter((e) => e.id !== id)
  }, 2600)
}

export function pingAnchor(who: string, color = '#00e5ff') {
  const p = anchorCenter(who)
  if (p) {
    spawnRing(p.x, p.y, color, true)
    burst(p.x, p.y, color, 10, 2.6)
  }
}

// --- Terminal-style effects ---------------------------------------------------

/** Stacked console lines ("> strike.sh --exec") typed out near a point. */
export function codeBurstPt(p: { x: number; y: number }, lines: string[]) {
  lines.forEach((line, i) =>
    setTimeout(() => spawnFloatAt(p.x + 26, p.y - 8 + i * 17, line, 'code', 950), i * 110),
  )
}

export function codeBurstAt(who: string, lines: string[]) {
  const p = anchorCenter(who)
  if (p) codeBurstPt(p, lines)
}

const CODE_CHARS = '01<>/{}$#;&*'

/** Spray of glowing code glyphs (digital shrapnel). */
export function glyphSplash(x: number, y: number, color: string, n = 10, glyphSet?: string[]) {
  n = Math.max(1, Math.round(n * qualityFactor()))
  for (let i = 0; i < n; i++) {
    if (parts.length >= MAX_PARTICLES) return
    const a = Math.random() * Math.PI * 2
    const v = (0.5 + Math.random()) * 2.6
    parts.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 1,
      life: 0,
      maxLife: 40 + Math.random() * 26,
      color,
      size: 1.6 + Math.random() * 1.6,
      gravity: 0.05,
      ambient: false,
      char: (glyphSet ?? CODE_CHARS)[Math.floor(Math.random() * (glyphSet ?? CODE_CHARS).length)],
    })
  }
}

// --- Impact rings ------------------------------------------------------------

interface RingItem {
  id: number
  x: number
  y: number
  color: string
  big: boolean
}

export const rings = signal<RingItem[]>([])

function spawnRing(x: number, y: number, color: string, big = false) {
  const id = fxId++
  rings.value = [...rings.value, { id, x, y, color, big }]
  setTimeout(() => {
    rings.value = rings.value.filter((r) => r.id !== id)
  }, 650)
}

function ringAt(who: string, color: string, big = false) {
  const p = anchorCenter(who)
  if (p) spawnRing(p.x, p.y, color, big)
}

// --- Card-flight ghosts ------------------------------------------------------

interface FlightItem {
  id: number
  x: number
  y: number
  cls: string
  label: string
  gone: boolean
  /** Explicit glow color (mini flights); card flights color by class. */
  color?: string
}

export const flights = signal<FlightItem[]>([])

const FLIGHT_COLORS: Record<string, string> = {
  attack: '#ff2d95',
  skill: '#00e5ff',
  power: '#a855f7',
}

/** Send a glowing card ghost from `from` to `to` with a particle trail. */
export function flyCard(from: { x: number; y: number }, to: { x: number; y: number }, cls: string, label = '') {
  const id = fxId++
  flights.value = [...flights.value, { id, x: from.x, y: from.y, cls, label, gone: false }]
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      flights.value = flights.value.map((f) => (f.id === id ? { ...f, x: to.x, y: to.y, gone: true } : f))
    }),
  )
  const color = FLIGHT_COLORS[cls] ?? '#00e5ff'
  for (let i = 1; i <= 4; i++) {
    setTimeout(() => {
      const k = i / 5
      burst(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k, color, 3, 1.6)
    }, i * 45)
  }
  setTimeout(() => {
    flights.value = flights.value.filter((f) => f.id !== id)
  }, 460)
}

/** Small glowing card-back that streaks between two points (discard sweeps,
 * cards swooping into the deck, shop purchases). */
export function flyMini(from: { x: number; y: number }, to: { x: number; y: number }, color = '#00e5ff') {
  const id = fxId++
  flights.value = [...flights.value, { id, x: from.x, y: from.y, cls: 'mini', label: '', gone: false, color }]
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      flights.value = flights.value.map((f) => (f.id === id ? { ...f, x: to.x, y: to.y, gone: true } : f))
    }),
  )
  setTimeout(() => {
    flights.value = flights.value.filter((f) => f.id !== id)
  }, 420)
}

/** Fly a mini card from a screen point into the top-bar deck counter. */
export function flyToDeck(from: { x: number; y: number }, color = '#00e5ff') {
  const d = anchorCenter('deck')
  if (d) flyMini(from, d, color)
  pulse('deck', 'fx-pulse-buff')
}

/** Ripple on the energy orb whenever energy is spent. */
export function energyRipple() {
  const p = anchorCenter('orb')
  if (p) spawnRing(p.x, p.y, '#a855f7')
  pulse('orb', 'fx-pulse-buff')
}

/** Confirm/skip ripple at a pointer position. */
export function uiRipple(x: number, y: number, color = '#00e5ff') {
  spawnRing(x, y, color, true)
  burst(x, y, color, 8, 2.4)
}

// --- Fullscreen vignette flashes ---------------------------------------------

export const vignettes = signal<{ id: number; color: string }[]>([])

export function flashVignette(color: string) {
  const id = fxId++
  vignettes.value = [...vignettes.value, { id, color }]
  setTimeout(() => {
    vignettes.value = vignettes.value.filter((v) => v.id !== id)
  }, 750)
}

// --- Victory / defeat set pieces ---------------------------------------------

const FEST = ['#ffd166', '#ff2d95', '#00e5ff', '#a855f7']

function confettiRain(n = 46) {
  const w = window.innerWidth
  for (let i = 0; i < n; i++) {
    setTimeout(() => {
      if (parts.length >= MAX_PARTICLES) return
      parts.push({
        x: Math.random() * w,
        y: -12,
        vx: (Math.random() - 0.5) * 1.4,
        vy: 1.4 + Math.random() * 2.2,
        life: 0,
        maxLife: 210 + Math.random() * 80,
        color: FEST[i % FEST.length],
        size: 2 + Math.random() * 2.6,
        gravity: 0.016,
        ambient: false,
      })
    }, i * 45)
  }
}

/** Gold pulse + neon bursts; `big` adds the full confetti cascade. */
export function victoryFx(big = false) {
  flashVignette('rgba(255, 209, 102, 0.26)')
  setTimeout(() => flashVignette('rgba(255, 209, 102, 0.18)'), 320)
  const w = window.innerWidth
  for (let i = 0; i < (big ? 6 : 4); i++) {
    setTimeout(() => burst(60 + Math.random() * (w - 120), 70 + Math.random() * 200, FEST[i % FEST.length], 22, 4.6), i * 150)
  }
  if (big) confettiRain()
}

/** Red shatter: heavy shake + stacked crimson vignettes. */
export function defeatFx() {
  flashVignette('rgba(255, 45, 60, 0.42)')
  setTimeout(() => flashVignette('rgba(120, 0, 20, 0.5)'), 300)
  fireShake(true)
  burst(window.innerWidth / 2, window.innerHeight / 2, '#ff3b5b', 40, 5.2)
}

// --- Screen shake ------------------------------------------------------------

export const shakeEvent = signal({ id: 0, big: false })

function fireShake(big: boolean) {
  if (!settings.value.shake) return
  shakeEvent.value = { id: shakeEvent.value.id + 1, big }
}

/** Screen-shake class for a combat root; re-triggers on every shake event. */
export function useShake(): string {
  const [cls, setCls] = useState('')
  const ev = shakeEvent.value
  const last = useRef(ev.id)
  useEffect(() => {
    if (ev.id === last.current) return
    last.current = ev.id
    setCls('')
    // Double rAF: guarantee a styled frame with the class absent, so a
    // same-class shake arriving mid-shake restarts the animation.
    let raf2 = 0
    const raf = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setCls(ev.big ? 'shake' : 'shake-sm'))
    })
    const timer = setTimeout(() => setCls(''), 450)
    return () => {
      cancelAnimationFrame(raf)
      cancelAnimationFrame(raf2)
      clearTimeout(timer)
    }
  }, [ev])
  return cls
}

// --- Particles ---------------------------------------------------------------

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
  gravity: number
  ambient: boolean
  /** Render as a code glyph instead of a dot. */
  char?: string
}

const parts: Particle[] = []

/** Hard cap so stacked bursts can't melt low-end GPUs (shadowBlur is pricey). */
const MAX_PARTICLES = 340

export function burst(x: number, y: number, color: string, n = 14, speed = 3.2) {
  n = Math.max(1, Math.round(n * qualityFactor()))
  for (let i = 0; i < n; i++) {
    if (parts.length >= MAX_PARTICLES) return
    const a = Math.random() * Math.PI * 2
    const v = (0.4 + Math.random()) * speed
    parts.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 0.6,
      life: 0,
      maxLife: 34 + Math.random() * 22,
      color,
      size: 1.6 + Math.random() * 2.4,
      gravity: 0.06,
      ambient: false,
    })
  }
}

/** Upward sparkle cone (heals, buffs). */
function burstUp(x: number, y: number, color: string, n = 10, speed = 2.4) {
  n = Math.max(1, Math.round(n * qualityFactor()))
  for (let i = 0; i < n; i++) {
    if (parts.length >= MAX_PARTICLES) return
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.1
    const v = (0.5 + Math.random()) * speed
    parts.push({
      x: x + (Math.random() - 0.5) * 40,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: 0,
      maxLife: 40 + Math.random() * 26,
      color,
      size: 1.4 + Math.random() * 2,
      gravity: 0.012,
      ambient: false,
    })
  }
}

function burstAt(who: string, color: string, n = 14, speed = 3.2) {
  const p = anchorCenter(who)
  if (p) burst(p.x, p.y, color, n, speed)
}

const AMBIENT_COLORS = ['#ff2d95', '#00e5ff', '#a855f7']

function spawnAmbient(w: number, h: number) {
  parts.push({
    x: Math.random() * w,
    y: h + 10,
    vx: (Math.random() - 0.5) * 0.25,
    vy: -(0.25 + Math.random() * 0.55),
    life: 0,
    maxLife: 400 + Math.random() * 300,
    color: AMBIENT_COLORS[Math.floor(Math.random() * AMBIENT_COLORS.length)],
    size: 0.8 + Math.random() * 1.6,
    gravity: 0,
    ambient: true,
  })
}

function ParticleCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    let raf = 0
    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)
    const tick = () => {
      const { width: w, height: h } = canvas
      ctx.clearRect(0, 0, w, h)
      if (parts.filter((p) => p.ambient).length < 46 && Math.random() < 0.35) spawnAmbient(w, h)
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]
        p.life++
        p.x += p.vx
        p.y += p.vy
        p.vy += p.gravity
        if (p.life >= p.maxLife || p.y < -20) {
          parts.splice(i, 1)
          continue
        }
        const alpha = p.ambient
          ? 0.35 * Math.sin((p.life / p.maxLife) * Math.PI)
          : 1 - p.life / p.maxLife
        ctx.globalAlpha = Math.max(0, alpha)
        ctx.fillStyle = p.color
        ctx.shadowColor = p.color
        ctx.shadowBlur = p.ambient ? 4 : 6
        if (p.char) {
          ctx.font = `${8 + p.size * 3}px monospace`
          ctx.fillText(p.char, p.x, p.y)
        } else {
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      ctx.globalAlpha = 1
      ctx.shadowBlur = 0
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])
  return <canvas id="fx-canvas" ref={ref} />
}

export const wipe = signal<{ label: string; color: string } | null>(null)

/** Float a small text at a registered anchor + pulse it (stat deltas). */
export function statFlash(anchor: string, text: string, cls: 'stat' | 'dmg' = 'stat') {
  const p = anchorCenter(anchor)
  if (!p) return
  spawnFloatAt(p.x, p.y + 14, text, cls)
  pulse(anchor, 'stat-pop')
}

/** Coins stream from a point into the gold counter, then the total flashes. */
export function flyGoldTo(from: { x: number; y: number }, n: number) {
  const to = anchorCenter('gold')
  if (!to) return
  for (let i = 0; i < Math.min(8, 3 + Math.floor(n / 12)); i++) {
    setTimeout(() => flyMini(from, to, '#ffd166'), i * 70)
  }
  setTimeout(() => statFlash('gold', `+${n}¤`), 620)
}

/** Card-removal cinematic: fly out of the deck, hold full-size, shatter. */
export const removalCine = signal<{ card: import('@neonspire/engine').CardInst; stage: 'in' | 'hold' | 'out' } | null>(null)

export function playRemovalCine(card: import('@neonspire/engine').CardInst) {
  const from = anchorCenter('deck') ?? { x: window.innerWidth - 80, y: 30 }
  document.documentElement.style.setProperty('--rc-x', `${from.x}px`)
  document.documentElement.style.setProperty('--rc-y', `${from.y}px`)
  removalCine.value = { card, stage: 'in' }
  setTimeout(() => {
    removalCine.value = { card, stage: 'hold' }
  }, 620)
  setTimeout(() => {
    const c = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    glyphSplash(c.x, c.y, '#ff3b5b', 16)
    burst(c.x, c.y, '#ff3b5b', 22, 3.6)
    removalCine.value = { card, stage: 'out' }
    statFlash('deck', '-1', 'dmg')
  }, 1650)
  setTimeout(() => (removalCine.value = null), 2100)
}
let wipeTimer = 0

/**
 * Soft full-screen transition: a sweep + title card. `mid` fires at the
 * covered moment (switch screens there) so the change never pops.
 */
export function screenWipe(label: string, color: string, mid?: () => void) {
  clearTimeout(wipeTimer)
  wipe.value = { label, color }
  if (mid) setTimeout(mid, 300)
  wipeTimer = window.setTimeout(() => (wipe.value = null), 820)
}

/** Fixed layer: particles, floats, rings, card flights, CRT scanlines. */
export function FxLayer() {
  return (
    <>
      <ParticleCanvas />
      {flights.value.map((f) => (
        <div
          key={f.id}
          class={`fx-flight ${f.cls} ${f.gone ? 'gone' : ''}`}
          style={{
            ...(f.color ? { '--fc': f.color } : {}),
            transform:
              `translate3d(${f.x}px, ${f.y}px, 0) translate(-50%,-50%)` +
              (f.gone ? ' scale(0.38) rotate(9deg)' : ''),
          } as never}
        >
          {f.label}
        </div>
      ))}
      {vignettes.value.map((v) => (
        <div key={v.id} class="vignette-flash" style={{ '--vc': v.color } as never} />
      ))}
      {rings.value.map((r) => (
        <div
          key={r.id}
          class={`fx-ring ${r.big ? 'big' : ''}`}
          style={{ left: r.x + 'px', top: r.y + 'px', '--rc': r.color } as never}
        />
      ))}
      {floats.value.map((f) => (
        <div key={f.id} class={`float ${f.cls}`} style={{ left: f.x + 'px', top: f.y + 'px' }}>
          {f.text}
        </div>
      ))}
      {emoteBubbles.value.map((e) => (
        <div key={e.id} class="emotepop" style={{ left: e.x + 'px', top: e.y + 'px' }}>
          <b>{e.sym}</b>
          {e.text && <span>{e.text}</span>}
          <small>
            {e.name}
            {e.to ? ` ▸ ${e.to}` : ''}
          </small>
        </div>
      ))}
      {wipe.value && (
        <div class="wipe" style={{ '--wc': wipe.value.color }}>
          <div class="wipe-label">{wipe.value.label}</div>
        </div>
      )}
      {settings.value.quality !== 'low' && <div class="scanlines" />}
    </>
  )
}

// --- Event stream → effects --------------------------------------------------

function playOne(ev: GameEvent) {
  switch (ev.e) {
    case 'hit': {
      if (!ev.n) break
      spawnFloat(ev.who, `-${ev.n}`, 'dmg')
      // cyan damage explosions (numbers stay red for readability)
      burstAt(ev.who, '#00e5ff', 10 + Math.min(14, ev.n), 3.4 + Math.min(2.4, ev.n / 8))
      ringAt(ev.who, '#00e5ff')
      pulse(ev.who, `fx-recoil-${sideOf(ev.who)}`)
      // Shield break: block absorbed part of this batch, then gave way.
      if ((ev as any).shatter) {
        ringAt(ev.who, '#ff2d95')
        const pt = anchorCenter(ev.who)
        if (pt) glyphSplash(pt.x, pt.y, '#ff2d95', 10, ['▰', '▱', '◣', '◥'])
        spawnFloat(ev.who, '⛨✕', 'flare')
      }
      sfx.hit()
      // Big "ouch" shake + red vignette only when the LOCAL player takes it.
      if (ev.who === localWho.value) {
        fireShake(ev.n >= 10)
        if (ev.n >= 12) flashVignette('rgba(255, 59, 91, 0.30)')
      } else if (ev.n >= 14) fireShake(false)
      break
    }
    case 'blocked':
      spawnFloat(ev.who, `⛨${ev.n}`, 'blk')
      spawnFloat(ev.who, '⛨', 'flare')
      burstAt(ev.who, '#ff2d95', 12, 4.4)
      ringAt(ev.who, '#ff2d95')
      pulse(ev.who, 'fx-pulse-block')
      sfx.block()
      break
    case 'block':
      spawnFloat(ev.who, `+${ev.n}⛨`, 'blk')
      burstAt(ev.who, '#ff2d95', 5, 1.8)
      pulse(ev.who, 'fx-pulse-block')
      break
    case 'heal': {
      spawnFloat(ev.who, `+${ev.n}`, 'heal')
      const p = anchorCenter(ev.who)
      if (p) burstUp(p.x, p.y + 20, '#3dffa2', 12, 2.6)
      pulse(ev.who, 'fx-pulse-buff')
      sfx.heal()
      break
    }
    case 'status': {
      if (!ev.n) break
      const id = ev.id as StatusId | undefined
      const info = id ? STATUS_INFO[id] : null
      const bad = !!info?.bad
      spawnFloat(ev.who, `${info?.sym ?? '★'}${ev.n} ${id ? statusName(id) : ''}`, bad ? 'statbad' : 'stat')
      pulse(ev.who, bad ? 'fx-pulse-bad' : 'fx-pulse-buff')
      if (!bad) {
        const p = anchorCenter(ev.who)
        if (p) burstUp(p.x, p.y + 10, '#ffd166', 8, 2.1)
      }
      break
    }
    case 'die': {
      burstAt(ev.who, '#ff2d95', 46, 5.4)
      burstAt(ev.who, '#00e5ff', 24, 3.8)
      ringAt(ev.who, '#ff2d95', true)
      ringAt(ev.who, '#ffffff')
      flashVignette('rgba(255, 45, 149, 0.20)')
      fireShake(true)
      sfx.boom()
      break
    }
    case 'move': {
      if (ev.who === 'p') break
      let label = ev.name ?? ''
      if (ev.id) {
        if (ev.who.startsWith('e')) {
          const defId = combat.value?.enemies[Number(ev.who.slice(1))]?.defId
          if (defId) label = moveName(defId, ev.id)
        } else {
          label = cardBaseName(ev.id)
        }
      }
      spawnFloat(ev.who, label, 'name')
      if (ev.id) codeBurstAt(ev.who, [`> ${ev.id}()`])
      pulse(ev.who, `fx-lunge-${sideOf(ev.who) === 'l' ? 'r' : 'l'}`)
      break
    }
    case 'lifted':
      spawnFloat(ev.who, t('cleansed'), 'heal')
      pulse(ev.who, 'fx-pulse-buff')
      break
    case 'addcard':
      spawnFloat(ev.who, `+${ev.n} ${ev.name ?? 'card'}`, 'stat')
      pulse(ev.who, 'fx-pulse-bad')
      break
    case 'summon': {
      // Anchor may not exist until the new enemy renders — place at arena side.
      setTimeout(() => {
        const p = anchorCenter(ev.who)
        if (p) {
          burst(p.x, p.y, '#a855f7', 20, 3.8)
          spawnRing(p.x, p.y, '#a855f7')
          spawnFloatAt(p.x, p.y - 40, ev.name ?? '', 'name')
        }
      }, 80)
      sfx.whoosh()
      break
    }
  }
}

let fxEndAt = 0

/** Milliseconds until the last scheduled event beat finishes playing. */
export function fxRemainingMs(): number {
  return Math.max(0, fxEndAt - Date.now())
}

/** Animate a reducer's event list. `delay` offsets the first beat (e.g. to
 * land impacts when a card-flight ghost arrives); `step` paces the beats. */
export function processEvents(evs: GameEvent[], opts: { delay?: number; step?: number } = {}) {
  // Pre-scan: a 'blocked' followed by a damaging 'hit' on the same fighter
  // means their shield broke mid-swing — tag the hit for a shatter effect.
  {
    const guarded = new Set<string>()
    for (const e of evs) {
      if (e.e === 'blocked') guarded.add(e.who)
      else if (e.e === 'hit' && e.n && guarded.has(e.who)) {
        ;(e as any).shatter = true
        guarded.delete(e.who)
      }
    }
  }
  const delay = opts.delay ?? 60
  const step = opts.step ?? 110
  fxEndAt = Math.max(fxEndAt, Date.now() + delay + evs.length * step)
  evs.forEach((ev, i) => setTimeout(() => playOne(ev), delay + i * step))
}
