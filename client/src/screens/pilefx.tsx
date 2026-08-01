import type { CardInst } from '@neonspire/engine'
import { useEffect, useRef } from 'preact/hooks'
import { flyMini } from '../fx'

/** Animate cards newly added to the visible hand from its draw-pile button. */
export function HandDrawFlights(props: { hand: CardInst[]; root: string }) {
  const previous = useRef<Set<number> | null>(null)
  const signature = props.hand.map((card) => card.uid).join(',')

  useEffect(() => {
    const before = previous.current
    previous.current = new Set(props.hand.map((card) => card.uid))
    const added = before ? props.hand.filter((card) => !before.has(card.uid)) : props.hand
    if (added.length === 0) return

    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        const root = document.querySelector(props.root)
        const source = root?.querySelector('.pilebtn.left')?.getBoundingClientRect()
        const slots = root?.querySelectorAll('.hand .cardslot')
        if (!source || !slots) return
        const from = { x: source.left + source.width / 2, y: source.top + source.height / 2 }
        added.forEach((card, order) => {
          const idx = props.hand.findIndex((candidate) => candidate.uid === card.uid)
          const target = slots[idx]?.querySelector('.card')?.getBoundingClientRect()
          if (!target) return
          const to = { x: target.left + target.width / 2, y: target.top + target.height / 2 }
          window.setTimeout(() => flyMini(from, to, '#00e5ff'), order * 55)
        })
      })
    })
    return () => cancelAnimationFrame(raf)
  }, [signature, props.root])

  return null
}

/** Sweep the cards that will leave the hand into the discard-pile button. */
export function sweepHandToDiscard(rootSelector: string, hand: CardInst[], retains?: (card: CardInst) => boolean) {
  const root = document.querySelector(rootSelector)
  const dest = root?.querySelector('.pilebtn.right')?.getBoundingClientRect()
  if (!root || !dest) return
  const to = { x: dest.left + dest.width / 2, y: dest.top + dest.height / 2 }
  root.querySelectorAll('.hand .cardslot').forEach((slot, i) => {
    const card = hand[i]
    if (!card || retains?.(card)) return
    const rect = slot.querySelector('.card')?.getBoundingClientRect()
    if (!rect) return
    window.setTimeout(
      () => flyMini({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, to, '#00e5ff'),
      i * 36,
    )
  })
}
