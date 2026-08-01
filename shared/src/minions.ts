/**
 * Player-summoned allies. Minions stand in front of their owner: enemy
 * attacks strike the front minion first (no block interaction, excess is
 * lost), and each minion acts at the end of its owner's turn. Capped at
 * MAX_MINIONS per side. One registry serves PvE and PvP alike.
 */
import { isZh } from './i18n'
import { MINION_ZH } from './locale-zh'

export const MAX_MINIONS = 3

export interface MinionDef {
  id: string
  name: string
  /** Variants with the same role (for example Ferro and Ferro Prime) stack. */
  role: 'strike' | 'guard' | 'infect' | 'burn'
  /** Client sprite/glyph key. */
  sym: string
  hp: number
  act:
    | { k: 'strike'; n: number } // deal n to a random alive foe
    | { k: 'guard'; n: number } // grant the owner n Block
    | { k: 'infect'; n: number } // apply n Corrupt to ALL foes
    | { k: 'burn'; n: number } // deal n to a random foe; the owner gains 1 Heat
}

const M = (def: MinionDef) => def

export const MINIONS: Record<string, MinionDef> = {}
function reg(def: MinionDef) {
  MINIONS[def.id] = def
}

reg(M({ id: 'ferroseed', name: 'Ferro Seed', role: 'strike', sym: '·', hp: 2, act: { k: 'strike', n: 1 } }))
reg(M({ id: 'ferrodrone', name: 'Ferro Drone', role: 'strike', sym: '⚙', hp: 6, act: { k: 'strike', n: 4 } }))
reg(M({ id: 'ferroprime', name: 'Ferro Prime', role: 'strike', sym: '⚙', hp: 9, act: { k: 'strike', n: 6 } }))
reg(M({ id: 'bulwarkpod', name: 'Bulwark Pod', role: 'guard', sym: '⛨', hp: 8, act: { k: 'guard', n: 3 } }))
reg(M({ id: 'bulwarkprime', name: 'Bulwark Prime', role: 'guard', sym: '⛨', hp: 11, act: { k: 'guard', n: 5 } }))
reg(M({ id: 'sporemite', name: 'Spore Mite', role: 'infect', sym: '☣', hp: 5, act: { k: 'infect', n: 1 } }))
reg(M({ id: 'sporeprime', name: 'Spore Prime', role: 'infect', sym: '☣', hp: 7, act: { k: 'infect', n: 2 } }))
reg(M({ id: 'proxyworm', name: 'Proxy Worm', role: 'infect', sym: '∿', hp: 5, act: { k: 'infect', n: 1 } }))
reg(M({ id: 'proxyhydra', name: 'Proxy Hydra', role: 'infect', sym: '∿', hp: 8, act: { k: 'infect', n: 2 } }))
reg(M({ id: 'cinderimp', name: 'Cinder Imp', role: 'burn', sym: '♨', hp: 6, act: { k: 'burn', n: 5 } }))
reg(M({ id: 'cinderfiend', name: 'Cinder Fiend', role: 'burn', sym: '♨', hp: 9, act: { k: 'burn', n: 7 } }))
reg(M({ id: 'duskshade', name: 'Dusk Shade', role: 'strike', sym: '⌇', hp: 3, act: { k: 'strike', n: 7 } }))
reg(M({ id: 'duskwraith', name: 'Dusk Wraith', role: 'strike', sym: '⌇', hp: 5, act: { k: 'strike', n: 10 } }))

export function minionName(id: string): string {
  return isZh() ? (MINION_ZH[id]?.name ?? MINIONS[id]?.name ?? id) : (MINIONS[id]?.name ?? id)
}

/** One-line behaviour text, used inside generated card rules text. */
export function minionDesc(id: string): string {
  const def = MINIONS[id]
  if (!def) return ''
  if (isZh()) {
    switch (def.act.k) {
      case 'strike':
        return `${def.hp} 生命：每回合对随机敌人造成 ${def.act.n} 点伤害`
      case 'guard':
        return `${def.hp} 生命：每回合为你提供 ${def.act.n} 点格挡`
      case 'infect':
        return `${def.hp} 生命：每回合对所有敌人施加 ${def.act.n} 层侵蚀`
      case 'burn':
        return `${def.hp} 生命：每回合对随机敌人造成 ${def.act.n} 点伤害，并使你获得 1 点高热`
    }
  }
  switch (def.act.k) {
    case 'strike':
      return `${def.hp} HP: hits a random enemy for ${def.act.n} each turn`
    case 'guard':
      return `${def.hp} HP: grants you ${def.act.n} Block each turn`
    case 'infect':
      return `${def.hp} HP: applies ${def.act.n} Corrupt to ALL enemies each turn`
    case 'burn':
      return `${def.hp} HP: hits a random enemy for ${def.act.n} each turn and feeds you 1 Heat`
  }
}
