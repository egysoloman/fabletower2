/**
 * Read-only combat previews.
 *
 * Card numbers are produced by running the real card interpreter against
 * disposable fighters. This keeps the UI in lockstep with combat rules as
 * statuses, stances, relic hooks, and conditional effects change.
 */
import { cardEffects } from './cards'
import { playCardFromHand, type PlayEnv } from './core'
import { ENEMIES, intentFor } from './enemies'
import { rngFromSeed } from './rng'
import type { CardInst, DeckSide, EnemyC, Fighter, GameEvent, Intent, Statuses } from './types'

export interface CardPreviewSide {
  name?: string
  hp: number
  maxHp: number
  block: number
  statuses: Statuses
  powersPlayed?: number
  cardsPlayed?: number
  cardsThisTurn?: number
  minions?: DeckSide['minions']
}

export type CardPreviewDefender = Fighter & { minions?: DeckSide['minions'] }

export interface PreviewAmount {
  min: number
  max: number
  /** Repeated equal-sized hits; omitted when the chip is a combined total. */
  times?: number
  total?: boolean
}

export interface CardCombatPreview {
  cost: number
  damage?: PreviewAmount
  block?: number
}

export interface CardPreviewOptions {
  relics?: string[]
  firstCardFree?: boolean
}

const DAMAGE_EFFECTS = new Set([
  'dmg',
  'dmgAll',
  'dmgVulnBonus',
  'dmgPerPower',
  'dmgPerCorrupt',
  'dmgIfCombo',
  'blockAsDmg',
  'ventDmg',
  'ventDmgAll',
  'dmgHeatBonus',
  'dmgIfStance',
  'dmgPerAuto',
])

function previewSide(src: CardPreviewSide, card: CardInst): DeckSide {
  return {
    name: src.name ?? 'PREVIEW',
    hp: Math.max(1, src.hp),
    maxHp: Math.max(1, src.maxHp),
    block: src.block,
    statuses: { ...src.statuses },
    energy: 999,
    energyMax: 999,
    hand: [{ ...card }],
    draw: [],
    discard: [],
    exhausted: [],
    powersPlayed: src.powersPlayed ?? 0,
    cardsPlayed: src.cardsPlayed ?? 0,
    cardsThisTurn: src.cardsThisTurn ?? 0,
    minions: (src.minions ?? []).map((m) => ({ ...m })),
  }
}

function previewTarget(src: CardPreviewDefender): CardPreviewDefender {
  return {
    name: src.name,
    // A preview target must survive every hit so multi-hit cards report their
    // complete sequence. Block is deliberately zero: printed attack damage is
    // the pre-Block amount, matching the actual intent display.
    hp: 1_000_000_000,
    maxHp: 1_000_000_000,
    block: 0,
    statuses: { ...src.statuses },
    ...(src.minions ? { minions: src.minions.map((m) => ({ ...m })) } : {}),
  }
}

function sameHitSize(runs: number[][]): boolean {
  const times = runs[0]?.length ?? 0
  return times > 0 && runs.every((run) => run.length === times && run.every((n) => n === run[0]))
}

/**
 * Preview the outcome of playing `card` now. Defenders may contain every
 * living target; differing target statuses are represented as a min-max range.
 */
export function previewCard(
  card: CardInst,
  source: CardPreviewSide,
  defenders: CardPreviewDefender[],
  opts: CardPreviewOptions = {},
): CardCombatPreview {
  const targets = defenders.length > 0 ? defenders : [{ name: 'TARGET', hp: 1, maxHp: 1, block: 0, statuses: {} }]
  const damageRuns: number[][] = []
  let cost = 0
  let block = 0

  for (const defender of targets) {
    const side = previewSide(source, card)
    const foe = previewTarget(defender)
    const evs: GameEvent[] = []
    const env: PlayEnv = {
      rng: rngFromSeed(0x51de),
      uid: 1_000_000,
      relics: [...(opts.relics ?? [])],
      firstCardFree: opts.firstCardFree,
    }
    const energyBefore = side.energy
    const blockBefore = side.block
    const error = playCardFromHand(env, side, 'preview-self', [{ f: foe, who: 'preview-target' }], 0, 0, evs)
    if (error) continue

    cost = energyBefore - side.energy
    block = Math.max(block, side.block - blockBefore)
    const hits = evs
      .filter((e) => e.e === 'hit' && e.who === 'preview-target')
      .map((e) => Math.max(0, e.n ?? 0))
    if (hits.length > 0) damageRuns.push(hits)
    else if (cardEffects(card).some((e) => DAMAGE_EFFECTS.has(e.k))) damageRuns.push([0])
  }

  const result: CardCombatPreview = { cost }
  if (block > 0) result.block = block
  if (damageRuns.length > 0) {
    if (sameHitSize(damageRuns)) {
      const values = damageRuns.map((run) => run[0])
      const times = damageRuns[0].length
      result.damage = {
        min: Math.min(...values),
        max: Math.max(...values),
        ...(times > 1 ? { times } : {}),
      }
    } else {
      const totals = damageRuns.map((run) => run.reduce((sum, n) => sum + n, 0))
      result.damage = {
        min: Math.min(...totals),
        max: Math.max(...totals),
        total: true,
      }
    }
  }
  return result
}

/**
 * Recalculate an enemy's shown intent against the defender's current state.
 * The stored intent selects the move; its damage is intentionally not trusted
 * because Weak/Vulnerable/stances can change during the player's turn.
 */
export function previewEnemyIntent(e: EnemyC, defender: Pick<Fighter, 'statuses'>, asc = 0, act = 1): Intent | null {
  if (!e.intent) return null
  const move = ENEMIES[e.defId]?.moves.find((m) => m.id === e.intent?.moveId)
  return move ? intentFor(move, e, defender, asc, act) : e.intent
}
