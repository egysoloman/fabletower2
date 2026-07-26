/**
 * Drag-to-play hand, shared by PvE and PvP combat.
 *
 * Pointer-driven (mouse + touch): grab a card and a glowing ghost follows the
 * cursor with velocity tilt. Targeted cards draw a bezier aiming arrow that
 * snaps to enemies (padded hit-boxes); untargeted cards use a drop zone above
 * the hand. Invalid releases spring the card back. A quick tap falls through
 * to the classic click-to-play path.
 */
import { signal } from '@preact/signals'
import { useEffect, useRef, useState } from 'preact/hooks'
import { CARDS, type CardInst } from '@neonspire/engine'
import { CardView } from '../components'
import { anchorBox, anchorCenter } from '../fx'
import { t } from '../i18n'

/** 'target' while dragging an enemy-targeted card, 'zone' otherwise. */
export const dragMode = signal<null | 'target' | 'zone'>(null)
/** Anchor id ('e0', 'p1', …) the drag is currently snapped to. */
export const dragHoverWho = signal<string | null>(null)

const DRAG_THRESHOLD = 9
const TARGET_PAD = 26
const ZONE_MARGIN = 46

interface DragState {
  idx: number
  pointerId: number
  startX: number
  startY: number
  x: number
  y: number
  grabDX: number
  grabDY: number
  w: number
  h: number
  /** Aiming-arrow origin (card's slot center at grab time). */
  sx: number
  sy: number
  /** Release above this screen Y = inside the play drop-zone. */
  zoneY: number
  active: boolean
  tilt: number
}

interface Returning {
  idx: number
  x: number
  y: number
  toX: number
  toY: number
  started: boolean
}

export interface DraggableHandProps {
  cards: CardInst[]
  playable: Set<number>
  /** Anchor ids of valid drop targets for enemy-targeted cards. */
  targets: string[]
  /** targetWho is set when dropped on (or resolved to) a specific target. */
  onPlay: (idx: number, targetWho: string | undefined, from: { x: number; y: number }) => void
  /** Quick tap fallback (classic click-to-play / select). */
  onCardClick?: (idx: number) => void
  disabled?: boolean
  selected?: number | null
}

export function DraggableHand(props: DraggableHandProps) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const [ret, setRet] = useState<Returning | null>(null)
  const handRef = useRef<HTMLDivElement>(null)
  const slotEls = useRef<Map<number, HTMLDivElement>>(new Map())
  const dragRef = useRef<DragState | null>(null)
  dragRef.current = drag
  const propsRef = useRef(props)
  propsRef.current = props

  const endDrag = () => {
    dragMode.value = null
    dragHoverWho.value = null
    setDrag(null)
  }

  const springBack = (d: DragState) => {
    const cardEl = slotEls.current.get(d.idx)?.querySelector('.card')
    const rect = cardEl?.getBoundingClientRect()
    if (rect) {
      setRet({
        idx: d.idx,
        x: d.x - d.grabDX + d.w / 2,
        y: d.y - d.grabDY + d.h / 2,
        toX: rect.left + rect.width / 2,
        toY: rect.top + rect.height / 2,
        started: false,
      })
      requestAnimationFrame(() =>
        requestAnimationFrame(() => setRet((r) => (r ? { ...r, started: true } : r))),
      )
      setTimeout(() => setRet(null), 300)
    }
    endDrag()
  }

  const onDown = (i: number) => (e: PointerEvent) => {
    const p = propsRef.current
    if (p.disabled || dragRef.current || !p.playable.has(i)) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const cardEl = slotEls.current.get(i)?.querySelector('.card')
    const rect = cardEl?.getBoundingClientRect()
    if (!rect) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const handTop = handRef.current?.getBoundingClientRect().top ?? window.innerHeight * 0.72
    setDrag({
      idx: i,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      grabDX: e.clientX - rect.left,
      grabDY: e.clientY - rect.top,
      w: rect.width,
      h: rect.height,
      sx: rect.left + rect.width / 2,
      sy: rect.top + rect.height / 2,
      zoneY: handTop - ZONE_MARGIN,
      active: false,
      tilt: 0,
    })
    e.preventDefault()
  }

  const onMove = (e: PointerEvent) => {
    setDrag((d) => {
      if (!d || e.pointerId !== d.pointerId) return d
      const p = propsRef.current
      let active = d.active
      if (!active && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > DRAG_THRESHOLD) {
        active = true
        const card = p.cards[d.idx]
        dragMode.value = card && CARDS[card.id].target === 'enemy' ? 'target' : 'zone'
      }
      if (active && dragMode.value === 'target') {
        let hover: string | null = null
        for (const who of p.targets) {
          const b = anchorBox(who)
          if (
            b &&
            e.clientX >= b.left - TARGET_PAD &&
            e.clientX <= b.right + TARGET_PAD &&
            e.clientY >= b.top - TARGET_PAD &&
            e.clientY <= b.bottom + TARGET_PAD
          ) {
            hover = who
            break
          }
        }
        if (dragHoverWho.value !== hover) dragHoverWho.value = hover
      }
      const tilt = Math.max(-13, Math.min(13, d.tilt * 0.72 + (e.clientX - d.x) * 0.9))
      return { ...d, x: e.clientX, y: e.clientY, active, tilt }
    })
  }

  const onUp = (e: PointerEvent) => {
    const d = dragRef.current
    if (!d || e.pointerId !== d.pointerId) return
    const p = propsRef.current
    const hover = dragHoverWho.value
    const mode = dragMode.value
    if (!d.active) {
      endDrag()
      p.onCardClick?.(d.idx)
      return
    }
    const cx = d.x - d.grabDX + d.w / 2
    const cy = d.y - d.grabDY + d.h / 2
    if (mode === 'target' && hover) {
      endDrag()
      p.onPlay(d.idx, hover, { x: cx, y: cy })
    } else if (mode === 'zone' && d.y < d.zoneY) {
      endDrag()
      p.onPlay(d.idx, undefined, { x: cx, y: cy })
    } else {
      springBack(d)
    }
  }

  const onCancel = () => {
    const d = dragRef.current
    if (d) springBack(d)
  }

  // Escape aborts an in-flight drag.
  const active = !!drag?.active
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const d = dragRef.current
        if (d) springBack(d)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])

  const n = props.cards.length
  const dragCard = drag?.active ? props.cards[drag.idx] : null
  const hoverWho = dragHoverWho.value
  const snapTip = hoverWho ? anchorCenter(hoverWho) : null
  const arrowColor = dragCard && CARDS[dragCard.id].type === 'attack' ? '#ff2d95' : '#00e5ff'
  const inZone = !!drag?.active && dragMode.value === 'zone' && drag.y < drag.zoneY

  return (
    <>
      <div class="hand" ref={handRef}>
        {props.cards.map((c, i) => {
          const mid = (n - 1) / 2
          const hidden = (drag?.active && drag.idx === i) || ret?.idx === i
          const cls = [
            'cardslot',
            props.playable.has(i) ? '' : 'unplayable',
            props.selected === i ? 'selected' : '',
            hidden ? 'drag-src' : '',
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <div
              key={c.uid}
              class={cls}
              style={{ '--rot': `${(i - mid) * 3.5}deg`, '--lift': `${Math.abs(i - mid) * 6}px`, zIndex: i } as never}
              ref={(el) => {
                if (el) slotEls.current.set(i, el)
                else slotEls.current.delete(i)
              }}
              onPointerDown={onDown(i)}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onCancel}
              onContextMenu={(e) => {
                if (dragRef.current?.active) {
                  e.preventDefault()
                  e.stopPropagation()
                  onCancel()
                }
              }}
            >
              <CardView card={c} />
            </div>
          )
        })}
      </div>

      {drag?.active && dragCard && (
        <div
          class="drag-ghost"
          style={{
            left: drag.x - drag.grabDX + drag.w / 2 + 'px',
            top: drag.y - drag.grabDY + drag.h / 2 + 'px',
            transform: `translate(-50%,-50%) rotate(${drag.tilt.toFixed(1)}deg)`,
          }}
        >
          <CardView card={dragCard} />
        </div>
      )}

      {ret && props.cards[ret.idx] && (
        <div
          class="drag-ghost returning"
          style={{
            left: (ret.started ? ret.toX : ret.x) + 'px',
            top: (ret.started ? ret.toY : ret.y) + 'px',
            transform: 'translate(-50%,-50%) scale(0.92)',
          }}
        >
          <CardView card={props.cards[ret.idx]} />
        </div>
      )}

      {drag?.active && dragMode.value === 'target' && (
        <AimArrow
          sx={drag.sx}
          sy={drag.sy}
          tx={snapTip?.x ?? drag.x}
          ty={snapTip?.y ?? drag.y}
          color={arrowColor}
          snapped={!!snapTip}
        />
      )}

      {drag?.active && dragMode.value === 'zone' && (
        <div class={`dropzone ${inZone ? 'hot' : ''}`} style={{ height: drag.zoneY + 'px' }}>
          <div class="dz-label">{t('releaseToPlay')}</div>
        </div>
      )}
    </>
  )
}

function AimArrow(props: { sx: number; sy: number; tx: number; ty: number; color: string; snapped: boolean }) {
  const { sx, sy, tx, ty, color } = props
  const cx = (sx + tx) / 2
  const cy = Math.min(sy, ty) - 90
  const ang = (Math.atan2(ty - cy, tx - cx) * 180) / Math.PI
  return (
    <svg class="aim-svg">
      <path class="aim-path" style={{ color }} d={`M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`} />
      <g transform={`translate(${tx} ${ty}) rotate(${ang})`}>
        <path d="M 2 0 L -16 -8 L -11 0 L -16 8 Z" fill={color} style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
      </g>
      {props.snapped && <circle class="aim-lock" cx={tx} cy={ty} r="34" style={{ color }} />}
    </svg>
  )
}
