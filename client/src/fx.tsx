/** Combat feedback: floating numbers, particle bursts, screen shake. */
import { signal } from '@preact/signals'
import { useEffect, useRef } from 'preact/hooks'
import { STATUS_INFO, cardBaseName, moveName, statusName, type GameEvent, type StatusId } from '@neonspire/engine'
import { sfx } from './sfx'
import { t } from './i18n'
import { combat } from './store'

// --- Anchors: DOM positions for fighters ('p', 'e0'..., 'p0'/'p1') ----------

const anchors = new Map<string, HTMLElement>()

export function registerAnchor(who: string, el: HTMLElement | null) {
  if (el) anchors.set(who, el)
}

function anchorPos(who: string): { x: number; y: number } | null {
  const el = anchors.get(who)
  if (!el || !el.isConnected) return null
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
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
let floatId = 1

function spawnFloat(who: string, text: string, cls: string) {
  const p = anchorPos(who)
  if (!p) return
  const id = floatId++
  const jx = (Math.random() - 0.5) * 46
  const jy = (Math.random() - 0.5) * 20 - 30
  floats.value = [...floats.value, { id, x: p.x + jx, y: p.y + jy, text, cls }]
  setTimeout(() => {
    floats.value = floats.value.filter((f) => f.id !== id)
  }, 1050)
}

// --- Screen shake ------------------------------------------------------------

export const shakeTick = signal(0)

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
      ambient: false,
    })
  }
}

function burstAt(who: string, color: string, n = 14, speed = 3.2) {
  const p = anchorPos(who)
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
        if (!p.ambient) p.vy += 0.06
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

/** Fixed layer: particle canvas + floating text + CRT scanlines. */
export function FxLayer() {
  return (
    <>
      <ParticleCanvas />
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
      burstAt(ev.who, '#ff3b5b', 12)
      sfx.hit()
      if (ev.n >= 12) shakeTick.value++
      break
    }
    case 'blocked':
      spawnFloat(ev.who, `⛨${ev.n}`, 'blk')
      sfx.block()
      break
    case 'block':
      spawnFloat(ev.who, `+${ev.n}⛨`, 'blk')
      burstAt(ev.who, '#00e5ff', 5, 1.8)
      break
    case 'heal':
      spawnFloat(ev.who, `+${ev.n}`, 'heal')
      burstAt(ev.who, '#3dffa2', 8, 2)
      sfx.heal()
      break
    case 'status': {
      if (!ev.n) break
      const id = ev.id as StatusId | undefined
      const info = id ? STATUS_INFO[id] : null
      spawnFloat(ev.who, `${info?.sym ?? '★'}${ev.n} ${id ? statusName(id) : ''}`, 'stat')
      break
    }
    case 'die':
      burstAt(ev.who, '#ff2d95', 42, 5.2)
      burstAt(ev.who, '#00e5ff', 22, 3.6)
      shakeTick.value++
      break
    case 'move': {
      if (ev.who === 'p') break
      let label = ev.name ?? ''
      if (ev.id) {
        if (ev.who.startsWith('e')) {
          // PvE enemy move: localize via the enemy's def id
          const defId = combat.value?.enemies[Number(ev.who.slice(1))]?.defId
          if (defId) label = moveName(defId, ev.id)
        } else {
          // PvP opponent card play: the id is a card id
          label = cardBaseName(ev.id)
        }
      }
      spawnFloat(ev.who, label, 'name')
      break
    }
    case 'lifted':
      spawnFloat(ev.who, t('cleansed'), 'heal')
      break
    case 'addcard':
      spawnFloat(ev.who, `+${ev.n} ${ev.name ?? 'card'}`, 'stat')
      break
  }
}

/** Animate a reducer's event list with a small stagger. */
export function processEvents(evs: GameEvent[]) {
  evs.forEach((ev, i) => setTimeout(() => playOne(ev), 60 + i * 110))
}
