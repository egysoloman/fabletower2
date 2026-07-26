/** One-shot combat consumables. Effects run through the same interpreter as
 * cards, so potion rules text is generated and can never drift either. */
import type { Effect } from './types'
import { isZh } from './i18n'
import { describeEffects } from './cards'
import { POTION_ZH } from './locale-zh'

export interface PotionDef {
  id: string
  name: string
  sym: string
  target: 'enemy' | 'none'
  rarity: 'common' | 'rare'
  effects: Effect[]
}

const P = (def: PotionDef) => def

export const POTIONS: Record<string, PotionDef> = {}
function reg(def: PotionDef) {
  POTIONS[def.id] = def
}

reg(P({ id: 'repairkit', name: 'Repair Kit', sym: '✚', target: 'none', rarity: 'common', effects: [{ k: 'heal', n: 10 }] }))
reg(P({ id: 'surgecell', name: 'Surge Cell', sym: '⚡', target: 'none', rarity: 'common', effects: [{ k: 'energy', n: 2 }] }))
reg(P({ id: 'shieldcell', name: 'Shield Cell', sym: '⛨', target: 'none', rarity: 'common', effects: [{ k: 'block', n: 12 }] }))
reg(P({ id: 'drawcache', name: 'Draw Cache', sym: '≡', target: 'none', rarity: 'common', effects: [{ k: 'draw', n: 3 }] }))
reg(P({ id: 'neurodart', name: 'Neuro Dart', sym: '◎', target: 'enemy', rarity: 'common', effects: [{ k: 'status', to: 'target', id: 'vuln', n: 3 }] }))
reg(P({ id: 'acidflask', name: 'Acid Flask', sym: '☣', target: 'enemy', rarity: 'common', effects: [{ k: 'status', to: 'target', id: 'corrupt', n: 5 }] }))
reg(P({ id: 'overloadcell', name: 'Overload Cell', sym: '✹', target: 'enemy', rarity: 'rare', effects: [{ k: 'dmg', n: 15 }] }))
reg(P({ id: 'strserum', name: 'Strength Serum', sym: '▲', target: 'none', rarity: 'rare', effects: [{ k: 'status', to: 'self', id: 'str', n: 2 }] }))
reg(P({ id: 'nullvial', name: 'Null Vial', sym: '◈', target: 'none', rarity: 'rare', effects: [{ k: 'status', to: 'self', id: 'artifact', n: 1 }] }))
reg(P({ id: 'ghostvial', name: 'Ghost Vial', sym: '⌀', target: 'none', rarity: 'rare', effects: [{ k: 'block', n: 8 }, { k: 'draw', n: 2 }] }))
reg(P({ id: 'clusterbomb', name: 'Cluster Bomb', sym: '✸', target: 'none', rarity: 'rare', effects: [{ k: 'dmgAll', n: 10 }] }))
reg(P({ id: 'regentonic', name: 'Regen Tonic', sym: '❉', target: 'none', rarity: 'rare', effects: [{ k: 'status', to: 'self', id: 'regen', n: 3 }] }))
reg(P({ id: 'focusvial', name: 'Focus Vial', sym: '◬', target: 'none', rarity: 'common', effects: [{ k: 'draw', n: 2 }, { k: 'energy', n: 1 }] }))
reg(P({ id: 'thornextract', name: 'Thorn Extract', sym: '❖', target: 'none', rarity: 'common', effects: [{ k: 'status', to: 'self', id: 'thorns', n: 3 }] }))
reg(P({ id: 'dampener', name: 'Dampener Spray', sym: '↯', target: 'enemy', rarity: 'common', effects: [{ k: 'status', to: 'target', id: 'weak', n: 3 }] }))
reg(P({ id: 'platedraught', name: 'Plating Draught', sym: '▣', target: 'none', rarity: 'rare', effects: [{ k: 'status', to: 'self', id: 'plating', n: 2 }] }))

export function potionName(id: string): string {
  return isZh() ? (POTION_ZH[id]?.name ?? POTIONS[id]?.name ?? id) : (POTIONS[id]?.name ?? id)
}

export function potionDesc(id: string): string {
  const def = POTIONS[id]
  return def ? describeEffects(def.effects) : ''
}
