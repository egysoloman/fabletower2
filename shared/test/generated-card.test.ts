import { describe, expect, it } from 'vitest'
import { CARDS, combatFor, combatReduce, newRun, type CardInst } from '../src/index'

describe('generated combat cards', () => {
  it('plays a 0-cost exhaust copy without consuming energy', () => {
    const state = combatFor(newRun(71, 0, 'runner'), 'normal')
    const id = Object.values(CARDS).find((card) => card.type === 'attack' && !card.unplayable)!.id
    const generated: CardInst = { uid: state.uid++, id, up: true, costOverride: 0, exhaustOverride: true }
    state.player.hand = [generated]
    state.player.energy = 0

    const result = combatReduce(state, { t: 'play', hand: 0, target: 0 })

    expect(result.error).toBeUndefined()
    expect(result.state.player.energy).toBe(0)
    expect(result.state.player.hand).toHaveLength(0)
    expect(result.state.player.exhausted.some((card) => card.uid === generated.uid)).toBe(true)
  })
})
