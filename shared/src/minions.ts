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
  /** Client sprite/glyph key. */
  sym: string
  hp: number
  act:
    | { k: 'strike'; n: number } // deal n to a random alive foe
    | { k: 'guard'; n: number } // grant the owner n Block
    | { k: 'infect'; n: number } // apply n Corrupt to ALL foes
}

const M = (def: MinionDef) => def

export const MINIONS: Record<string, MinionDef> = {}
function reg(def: MinionDef) {
  MINIONS[def.id] = def
}

reg(M({ id: 'ferrodrone', name: 'Ferro Drone', sym: '⚙', hp: 6, act: { k: 'strike', n: 4 } }))
reg(M({ id: 'ferroprime', name: 'Ferro Prime', sym: '⚙', hp: 9, act: { k: 'strike', n: 6 } }))
reg(M({ id: 'bulwarkpod', name: 'Bulwark Pod', sym: '⛨', hp: 8, act: { k: 'guard', n: 3 } }))
reg(M({ id: 'bulwarkprime', name: 'Bulwark Prime', sym: '⛨', hp: 11, act: { k: 'guard', n: 5 } }))
reg(M({ id: 'sporemite', name: 'Spore Mite', sym: '☣', hp: 5, act: { k: 'infect', n: 1 } }))
reg(M({ id: 'sporeprime', name: 'Spore Prime', sym: '☣', hp: 7, act: { k: 'infect', n: 2 } }))

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
    }
  }
  switch (def.act.k) {
    case 'strike':
      return `${def.hp} HP: hits a random enemy for ${def.act.n} each turn`
    case 'guard':
      return `${def.hp} HP: grants you ${def.act.n} Block each turn`
    case 'infect':
      return `${def.hp} HP: applies ${def.act.n} Corrupt to ALL enemies each turn`
  }
}
