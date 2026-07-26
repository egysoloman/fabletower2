import type { Statuses } from './types'
import { isZh } from './i18n'
import { RELIC_ZH } from './locale-zh'

export interface RelicDef {
  id: string
  name: string
  desc: string
  rarity: 'starter' | 'common' | 'rare' | 'boss'
  sym: string
  hooks: {
    maxHp?: number
    /** Statuses granted at combat start (str, thorns, ...). */
    combatStatuses?: Statuses
    combatStartBlock?: number
    /** Extra energy on turn 1 only. */
    firstTurnEnergy?: number
    /** Extra cards drawn on turn 1 only. */
    firstTurnDraw?: number
    /** Extra energy every turn. */
    energyPerTurn?: number
    /** Extra cards drawn every turn. */
    drawPerTurn?: number
    /** The first card played each combat costs 0. */
    firstCardFree?: boolean
    /** Heal after every combat victory. */
    afterCombatHeal?: number
    /** Gain block whenever you play a Power. */
    onPowerBlock?: number
    /** Gain energy whenever your draw pile is shuffled. */
    onShuffleEnergy?: number
    /** Apply to ALL enemies at combat start. */
    combatStartEnemyStatuses?: Statuses
    /** Percent bonus to gold rewards. */
    goldBonusPct?: number
    /** Extra healing at rest sites. */
    restBonus?: number
    /** Corrupt you apply lands this much harder. */
    corruptBonus?: number
    /** Gain block whenever you play a 0-cost card. */
    zeroCostBlock?: number
    /** Gain Strength whenever your draw pile is shuffled. */
    onShuffleStr?: number
    /** Power cards cost this much less. */
    powerDiscount?: number
  }
}

const R = (def: RelicDef) => def

export const RELICS: Record<string, RelicDef> = {}
function reg(def: RelicDef) {
  RELICS[def.id] = def
}

reg(R({
  id: 'cortexlink', name: 'Cortex Link', rarity: 'starter', sym: '◉',
  desc: 'Draw 1 additional card on your first turn each combat.',
  hooks: { firstTurnDraw: 1 },
}))
reg(R({
  id: 'neonheart', name: 'Neon Heart', rarity: 'common', sym: '♥',
  desc: 'Raise your Max HP by 12.',
  hooks: { maxHp: 12 },
}))
reg(R({
  id: 'crackedbattery', name: 'Cracked Battery', rarity: 'common', sym: '⚡',
  desc: 'Gain 1 extra Energy on your first turn each combat.',
  hooks: { firstTurnEnergy: 1 },
}))
reg(R({
  id: 'quantumchip', name: 'Quantum Chip', rarity: 'rare', sym: '❒',
  desc: 'The first card you play each combat costs 0.',
  hooks: { firstCardFree: true },
}))
reg(R({
  id: 'aegisdriver', name: 'Aegis Driver', rarity: 'common', sym: '⛨',
  desc: 'Start each combat with 6 Block.',
  hooks: { combatStartBlock: 6 },
}))
reg(R({
  id: 'overdrive', name: 'Overdrive Module', rarity: 'rare', sym: '▲',
  desc: 'Start each combat with 1 Strength.',
  hooks: { combatStatuses: { str: 1 } },
}))
reg(R({
  id: 'medkit', name: 'Nano Medkit', rarity: 'common', sym: '✚',
  desc: 'Heal 7 HP after each combat.',
  hooks: { afterCombatHeal: 7 },
}))
reg(R({
  id: 'holoemitter', name: 'Holo Emitter', rarity: 'common', sym: '◈',
  desc: 'Whenever you play a Power, gain 4 Block.',
  hooks: { onPowerBlock: 4 },
}))
reg(R({
  id: 'surgecoil', name: 'Surge Coil', rarity: 'common', sym: '∿',
  desc: 'Whenever your draw pile is shuffled, gain 1 Energy.',
  hooks: { onShuffleEnergy: 1 },
}))
reg(R({
  id: 'goldchip', name: 'Au Chip', rarity: 'common', sym: '¤',
  desc: 'Gain 25% more credits from all sources.',
  hooks: { goldBonusPct: 25 },
}))
reg(R({
  id: 'thornrouter', name: 'Thorn Router', rarity: 'common', sym: '❖',
  desc: 'Start each combat with 2 Thorns.',
  hooks: { combatStatuses: { thorns: 2 } },
}))
reg(R({
  id: 'viralcore', name: 'Viral Core', rarity: 'rare', sym: '☣',
  desc: 'Enemies start combat with 3 Corrupt.',
  hooks: { combatStartEnemyStatuses: { corrupt: 3 } },
}))
reg(R({
  id: 'mirrorshard', name: 'Mirror Shard', rarity: 'rare', sym: '◇',
  desc: 'Enemies start combat with 1 Weak.',
  hooks: { combatStartEnemyStatuses: { weak: 1 } },
}))
reg(R({
  id: 'cpuheatsink', name: 'CPU Heatsink', rarity: 'boss', sym: '⬢',
  desc: 'Gain 1 additional Energy at the start of each turn.',
  hooks: { energyPerTurn: 1 },
}))
reg(R({
  id: 'ramstick', name: 'Spare RAM', rarity: 'boss', sym: '≡',
  desc: 'Draw 1 additional card at the start of each turn.',
  hooks: { drawPerTurn: 1 },
}))
reg(R({
  id: 'solarcell', name: 'Solar Cell', rarity: 'common', sym: '☀',
  desc: 'Rest sites restore 15 additional HP.',
  hooks: { restBonus: 15 },
}))
reg(R({
  id: 'plaguerouter', name: 'Plague Router', rarity: 'rare', sym: '⌬',
  desc: 'Corrupt you apply to enemies is increased by 1.',
  hooks: { corruptBonus: 1 },
}))
reg(R({
  id: 'staticfield', name: 'Static Field', rarity: 'common', sym: '≋',
  desc: 'Whenever you play a 0-cost card, gain 2 Block.',
  hooks: { zeroCostBlock: 2 },
}))
reg(R({
  id: 'chassis', name: 'Titanium Chassis', rarity: 'common', sym: '▣',
  desc: 'Start each combat with 1 Plating (gain 1 Block at end of turn).',
  hooks: { combatStatuses: { plating: 1 } },
}))
reg(R({
  id: 'momentumdrive', name: 'Momentum Drive', rarity: 'rare', sym: '↻',
  desc: 'Whenever your draw pile is shuffled, gain 1 Strength.',
  hooks: { onShuffleStr: 1 },
}))
reg(R({
  id: 'hypervisor', name: 'Hypervisor', rarity: 'boss', sym: '⌘',
  desc: 'Power cards cost 1 less.',
  hooks: { powerDiscount: 1 },
}))

export function relicName(id: string): string {
  return isZh() ? (RELIC_ZH[id]?.name ?? RELICS[id]?.name ?? id) : (RELICS[id]?.name ?? id)
}

export function relicDesc(id: string): string {
  return isZh() ? (RELIC_ZH[id]?.desc ?? RELICS[id]?.desc ?? '') : (RELICS[id]?.desc ?? '')
}

export function obtainableRelics(owned: string[], includeBoss = false): RelicDef[] {
  return Object.values(RELICS).filter(
    (r) => r.rarity !== 'starter' && (includeBoss || r.rarity !== 'boss') && !owned.includes(r.id),
  )
}
