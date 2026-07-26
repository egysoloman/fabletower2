/**
 * Combat feedback engine: floating numbers, particle bursts, impact rings,
 * card-flight ghosts, fighter recoil/lunge pulses, and graduated screen shake.
 * Everything is driven by the engine's GameEvent stream — the reducers stay
 * pure, and this layer turns their events into juice.
 */
import { signal } from '@preact/signals'
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
 * One-shot CSS animation on a fighter panel (recoil, lunge, glow pulse).
 * Re-adding mid-flight restarts the animation via a reflow.
 */
function pulse(who: string, cls: string, dur = 520) {
  const el = anchors.get(who)
  if (!el || !el.isConnected) return
  el.classList.remove(cls)
  void el.offsetWidth
  el.classList.add(cls)
  setTimeout(() => el.classList.remove(cls), dur)
}

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

function spawnFloat(who: string, text: string, cls: string) {
  const p = anchorCenter(who)
  if (!p) return
  const id = fxId++
  const jx = (Math.random() - 0.5) * 46
  const jy = (Math.random() - 0.5) * 20 - 30
  floats.value = [...floats.value, { id, x: p.x + jx, y: p.y + jy, text, cls }]
  setTimeout(() => {
    floats.value = floats.value.filter((f) => f.id !== id)
  }, 1050)
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

// --- Screen shake ------------------------------------------------------------

export const shakeEvent = signal({ id: 0, big: false })

function fireShake(big: boolean) {
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
    const raf = requestAnimationFrame(() => setCls(ev.big ? 'shake' : 'shake-sm'))
    const timer = setTimeout(() => setCls(''), 430)
    return () => {
      cancelAnimationFrame(raf)
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
}

const parts: Particle[] = []

export function burst(x: number, y: number, color: string, n = 14, speed = 3.2) {
  for (let i = 0; i < n; i++) {
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
  for (let i = 0; i < n; i++) {
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
        ctx.shadowBlur = p.ambient ? 4 : 8
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
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

/** Fixed layer: particles, floats, rings, card flights, CRT scanlines. */
export function FxLayer() {
  return (
    <>
      <ParticleCanvas />
      {flights.value.map((f) => (
        <div
          key={f.id}
          class={`fx-flight ${f.cls} ${f.gone ? 'gone' : ''}`}
          style={{ left: f.x + 'px', top: f.y + 'px' }}
        >
          {f.label}
        </div>
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
      <div class="scanlines" />
    </>
  )
}

// --- Event stream → effects --------------------------------------------------

function playOne(ev: GameEvent) {
  switch (ev.e) {
    case 'hit': {
      if (!ev.n) break
      spawnFloat(ev.who, `-${ev.n}`, 'dmg')
      burstAt(ev.who, '#ff3b5b', 10 + Math.min(14, ev.n), 3.4 + Math.min(2.4, ev.n / 8))
      ringAt(ev.who, '#ff3b5b')
      pulse(ev.who, `fx-recoil-${sideOf(ev.who)}`)
      sfx.hit()
      if (ev.who === 'p' || ev.who === 'p0' || ev.who === 'p1') fireShake(ev.n >= 10)
      else if (ev.n >= 14) fireShake(false)
      break
    }
    case 'blocked':
      spawnFloat(ev.who, `⛨${ev.n}`, 'blk')
      burstAt(ev.who, '#00e5ff', 12, 4.4)
      ringAt(ev.who, '#00e5ff')
      pulse(ev.who, 'fx-pulse-block')
      sfx.block()
      break
    case 'block':
      spawnFloat(ev.who, `+${ev.n}⛨`, 'blk')
      burstAt(ev.who, '#00e5ff', 5, 1.8)
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
      spawnFloat(ev.who, `${info?.sym ?? '★'}${ev.n} ${id ? statusName(id) : ''}`, 'stat')
      pulse(ev.who, info?.bad ? 'fx-pulse-bad' : 'fx-pulse-buff')
      if (!info?.bad) {
        const p = anchorCenter(ev.who)
        if (p) burstUp(p.x, p.y + 10, '#a855f7', 7, 2)
      }
      break
    }
    case 'die': {
      burstAt(ev.who, '#ff2d95', 46, 5.4)
      burstAt(ev.who, '#00e5ff', 24, 3.8)
      ringAt(ev.who, '#ff2d95', true)
      ringAt(ev.who, '#ffffff')
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
  }
}

/** Animate a reducer's event list. `delay` offsets the first beat (e.g. to
 * land impacts when a card-flight ghost arrives); `step` paces the beats. */
export function processEvents(evs: GameEvent[], opts: { delay?: number; step?: number } = {}) {
  const delay = opts.delay ?? 60
  const step = opts.step ?? 110
  evs.forEach((ev, i) => setTimeout(() => playOne(ev), delay + i * step))
}
