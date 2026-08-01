import { CARDS } from './cards'
import type { CardDef, CardInst, CharId, Effect, StatusId } from './types'

/** Stable ids are persisted in run history and balance snapshots. */
export type ArchetypeId =
  | 'runner-corrupt'
  | 'runner-fortress'
  | 'runner-tempo'
  | 'vector-furnace'
  | 'vector-vent'
  | 'vector-reactor'
  | 'ghost-overdrive'
  | 'ghost-stealth'
  | 'ghost-dance'
  | 'array-turret'
  | 'array-plating'
  | 'array-viral'

export interface ArchetypeDef {
  id: ArchetypeId
  char: CharId
  name: string
  nameZh: string
  /** One-line description used by generated balance reports. */
  goal: string
}

export const ARCHETYPES: readonly ArchetypeDef[] = [
  { id: 'runner-corrupt', char: 'runner', name: 'Corrupt', nameZh: '病毒腐蚀', goal: 'stack and multiply Corrupt, then cash it out' },
  { id: 'runner-fortress', char: 'runner', name: 'Fortress', nameZh: '格挡堡垒', goal: 'retain/double Block and turn defense into damage' },
  { id: 'runner-tempo', char: 'runner', name: '0-cost Tempo', nameZh: '零费节奏', goal: 'chain free cards, draw and combo payoffs' },
  { id: 'vector-furnace', char: 'vector', name: 'Furnace', nameZh: '熔炉高热', goal: 'build Heat and exploit Heat-scaled attacks' },
  { id: 'vector-vent', char: 'vector', name: 'Vent', nameZh: '排气兑现', goal: 'convert Heat into burst damage or Block' },
  { id: 'vector-reactor', char: 'vector', name: 'Reactor', nameZh: '反应堆', goal: 'weaponize overheating and area damage' },
  { id: 'ghost-overdrive', char: 'ghost', name: 'Overdrive', nameZh: '超载爆发', goal: 'enter Overdrive and end fights before the risk compounds' },
  { id: 'ghost-stealth', char: 'ghost', name: 'Stealth', nameZh: '潜行防守', goal: 'mitigate incoming damage and leave Stealth for energy' },
  { id: 'ghost-dance', char: 'ghost', name: 'Stance Dance', nameZh: '姿态舞步', goal: 'switch stances repeatedly to trigger Block, draw and Strength' },
  { id: 'array-turret', char: 'array', name: 'Turret', nameZh: '炮塔阵列', goal: 'scale end-of-turn Turret damage with Focus' },
  { id: 'array-plating', char: 'array', name: 'Plating', nameZh: '装甲阵列', goal: 'compound passive Block and defensive payoffs' },
  { id: 'array-viral', char: 'array', name: 'Viral', nameZh: '病毒阵列', goal: 'spread Corrupt through Viral automation' },
]

export function archetypesFor(char: CharId): readonly ArchetypeDef[] {
  return ARCHETYPES.filter((a) => a.char === char)
}

function statusIs(effect: Effect, ...ids: StatusId[]): boolean {
  return effect.k === 'status' && ids.includes(effect.id)
}

function statusN(effect: Effect): number {
  return effect.k === 'status' ? effect.n : 0
}

function effectScore(id: ArchetypeId, effect: Effect): number {
  switch (id) {
    case 'runner-corrupt':
      if (effect.k === 'doubleCorrupt') return 10
      if (effect.k === 'dmgPerCorrupt') return 9
      if (statusIs(effect, 'chronic')) return 10
      if (statusIs(effect, 'corrupt', 'viral')) return 4 + Math.min(5, statusN(effect))
      return 0
    case 'runner-fortress':
      if (effect.k === 'doubleBlock') return 10
      if (effect.k === 'blockAsDmg') return 8
      if (statusIs(effect, 'barricade', 'kernel')) return 10
      if (statusIs(effect, 'plating')) return 4 + Math.min(4, statusN(effect))
      if (effect.k === 'block') return Math.min(4, effect.n / 3)
      return 0
    case 'runner-tempo':
      if (effect.k === 'dmgIfCombo') return 9
      if (statusIs(effect, 'hyper')) return 10
      if (effect.k === 'draw') return Math.min(5, effect.n * 1.5)
      if (effect.k === 'energy') return Math.min(5, effect.n * 2)
      return 0
    case 'vector-furnace':
      if (effect.k === 'dmgHeatBonus') return 9
      if (statusIs(effect, 'heat')) return 2 + Math.min(5, statusN(effect))
      if (statusIs(effect, 'ignition')) return 5 + Math.min(3, statusN(effect))
      return 0
    case 'vector-vent':
      if (effect.k === 'ventDmg' || effect.k === 'ventDmgAll' || effect.k === 'ventBlock') return 10
      if (effect.k === 'heatCool') return 5
      if (statusIs(effect, 'coolant')) return 5 + Math.min(3, statusN(effect))
      if (statusIs(effect, 'heat')) return 1 + Math.min(3, statusN(effect))
      return 0
    case 'vector-reactor':
      if (statusIs(effect, 'reactor')) return 12
      if (statusIs(effect, 'heat', 'ignition')) return 3 + Math.min(4, statusN(effect))
      if (effect.k === 'ventDmgAll' || effect.k === 'dmgAll') return 6
      return 0
    case 'ghost-overdrive':
      if (effect.k === 'enterStance' && effect.id === 'overdrive') return 9
      if (effect.k === 'dmgIfStance') return 8
      if (statusIs(effect, 'momentum')) return 9
      return 0
    case 'ghost-stealth':
      if (effect.k === 'enterStance' && effect.id === 'stealth') return 9
      if (statusIs(effect, 'stancewall', 'tempoloop')) return 5
      if (effect.k === 'block') return Math.min(3, effect.n / 4)
      return 0
    case 'ghost-dance':
      if (effect.k === 'enterStance') return effect.id === 'none' ? 5 : 7
      if (statusIs(effect, 'stancewall', 'momentum', 'tempoloop')) return 10
      return 0
    case 'array-turret':
      if (statusIs(effect, 'turret')) return 6 + Math.min(5, statusN(effect))
      if (statusIs(effect, 'focus')) return 6
      if (effect.k === 'dmgPerAuto') return 7
      return 0
    case 'array-plating':
      if (statusIs(effect, 'plating')) return 6 + Math.min(5, statusN(effect))
      if (statusIs(effect, 'focus')) return 5
      if (effect.k === 'blockAsDmg' || effect.k === 'doubleBlock') return 8
      if (effect.k === 'block') return Math.min(3, effect.n / 4)
      return 0
    case 'array-viral':
      if (statusIs(effect, 'viral')) return 8 + Math.min(4, statusN(effect))
      if (statusIs(effect, 'corrupt')) return 6 + Math.min(4, statusN(effect))
      if (statusIs(effect, 'focus')) return 4
      if (effect.k === 'dmgPerCorrupt' || effect.k === 'doubleCorrupt') return 8
      return 0
  }
}

/**
 * Scores one card's mechanical fit. This is intentionally effect-driven, so
 * newly-added cards join an archetype without maintaining a card-id allowlist.
 */
export function cardArchetypeScore(card: CardDef | string, id: ArchetypeId, upgraded = false): number {
  const def = typeof card === 'string' ? CARDS[card] : card
  if (!def) return 0
  const archetype = ARCHETYPES.find((a) => a.id === id)
  if (!archetype || (def.char && def.char !== archetype.char)) return 0
  const effects = upgraded ? def.upEffects : def.effects
  let score = effects.reduce((sum, effect) => sum + effectScore(id, effect), 0)
  if (id === 'runner-tempo' && (upgraded ? (def.upCost ?? def.cost) : def.cost) === 0) score += 7
  if (id === 'ghost-dance' && (upgraded ? (def.upCost ?? def.cost) : def.cost) === 0) score += 2
  return Math.round(score * 10) / 10
}

export interface ArchetypeRank {
  id: ArchetypeId
  score: number
}

/** Rank the three character archetypes represented by a deck. */
export function rankDeckArchetypes(char: CharId, deck: readonly CardInst[]): ArchetypeRank[] {
  return archetypesFor(char)
    .map((a) => ({
      id: a.id,
      score: Math.round(deck.reduce((sum, card) => {
        // Starter cards provide context, but drafted cards should determine identity.
        const rarityWeight = CARDS[card.id]?.rarity === 'starter' ? 0.35 : 1
        return sum + cardArchetypeScore(card.id, a.id, card.up) * rarityWeight
      }, 0) * 10) / 10,
    }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
}

/** Returns null for decks that have not committed enough to any archetype. */
export function detectDeckArchetype(char: CharId, deck: readonly CardInst[]): ArchetypeId | null {
  const top = rankDeckArchetypes(char, deck)[0]
  return top && top.score >= 8 ? top.id : null
}
