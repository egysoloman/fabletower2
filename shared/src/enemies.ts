import type { CombatState, EnemyC, EnemyDef, Intent, IntentKind, MoveDef } from './types'
import { weightedPick, type Rng } from './rng'
import { modifiedDamage } from './core'
import { isZh } from './i18n'
import { ENEMY_ZH } from './locale-zh'

const E = (def: EnemyDef) => def

export const ENEMIES: Record<string, EnemyDef> = {}
function reg(def: EnemyDef) {
  ENEMIES[def.id] = def
}

// --- Act 1 ------------------------------------------------------------------

reg(E({
  id: 'spambot', name: 'Spam Bot', glyph: '🤖', hp: [20, 25],
  moves: [
    { id: 'ping', name: 'Ping', weight: 3, effects: [{ k: 'atk', n: 5 }] },
    { id: 'flood', name: 'Flood', weight: 3, effects: [{ k: 'atk', n: 2, times: 3 }] },
    { id: 'popup', name: 'Pop-Up', weight: 2, maxRepeat: 1, effects: [{ k: 'debuff', id: 'weak', n: 1 }] },
  ],
}))
reg(E({
  id: 'drone', name: 'Patrol Drone', glyph: '🛸', hp: [28, 34],
  moves: [
    { id: 'laser', name: 'Laser', weight: 3, effects: [{ k: 'atk', n: 7 }] },
    { id: 'shield', name: 'Shield Up', weight: 2, maxRepeat: 1, effects: [{ k: 'block', n: 8 }] },
    { id: 'ram', name: 'Ram', weight: 2, cooldown: 2, effects: [{ k: 'atk', n: 11 }] },
  ],
}))
reg(E({
  id: 'kiddie', name: 'Script Kiddie', glyph: '👾', hp: [24, 30],
  moves: [
    { id: 'inject', name: 'Inject', weight: 3, effects: [{ k: 'atk', n: 5 }, { k: 'debuff', id: 'corrupt', n: 2 }] },
    { id: 'brag', name: 'Brag', weight: 1, maxRepeat: 1, effects: [{ k: 'buff', id: 'str', n: 2 }] },
    { id: 'smash', name: 'Keyboard Smash', weight: 2, effects: [{ k: 'atk', n: 8 }] },
  ],
}))
reg(E({
  id: 'golem', name: 'Firewall Golem', glyph: '🗿', hp: [42, 48],
  moves: [
    { id: 'fortify', name: 'Fortify', weight: 2, maxRepeat: 1, effects: [{ k: 'block', n: 9 }, { k: 'buff', id: 'str', n: 1 }] },
    { id: 'slam', name: 'Slam', weight: 3, effects: [{ k: 'atk', n: 9 }] },
    { id: 'bash', name: 'Bash', weight: 2, effects: [{ k: 'atk', n: 6 }, { k: 'debuff', id: 'weak', n: 1 }] },
  ],
}))
reg(E({
  id: 'hound', name: 'Cyber Hound', glyph: '🐺', hp: [64, 70],
  moves: [
    { id: 'maul', name: 'Maul', weight: 3, effects: [{ k: 'atk', n: 12 }] },
    { id: 'rend', name: 'Rend', weight: 2, effects: [{ k: 'atk', n: 7 }, { k: 'debuff', id: 'vuln', n: 2 }] },
    { id: 'howl', name: 'Howl', weight: 2, maxRepeat: 1, effects: [{ k: 'buff', id: 'str', n: 2 }] },
  ],
}))
reg(E({
  id: 'compiler', name: 'THE COMPILER', glyph: '💽', hp: [120, 120], boss: true,
  moves: [
    { id: 'compile', name: 'Compile', weight: 2, maxRepeat: 1, effects: [{ k: 'block', n: 12 }, { k: 'buff', id: 'str', n: 2 }] },
    { id: 'execute', name: 'Execute', weight: 3, cooldown: 1, effects: [{ k: 'atk', n: 16 }] },
    { id: 'forloop', name: 'For Loop', weight: 2, effects: [{ k: 'atk', n: 5, times: 3 }] },
    { id: 'segfault', name: 'Segfault', weight: 2, cooldown: 2, effects: [{ k: 'atk', n: 8 }, { k: 'debuff', id: 'vuln', n: 2 }] },
  ],
}))

// --- Act 2 ------------------------------------------------------------------

reg(E({
  id: 'ice', name: 'ICE Shard', glyph: '🧊', hp: [36, 42],
  moves: [
    { id: 'freeze', name: 'Freeze Ray', weight: 3, effects: [{ k: 'atk', n: 9 }] },
    { id: 'harden', name: 'Harden', weight: 2, maxRepeat: 1, effects: [{ k: 'block', n: 11 }] },
    { id: 'shatter', name: 'Shatter', weight: 2, cooldown: 2, effects: [{ k: 'atk', n: 14 }] },
  ],
}))
reg(E({
  id: 'netrunner', name: 'Netrunner', glyph: '🥷', hp: [44, 50],
  moves: [
    { id: 'jackin', name: 'Jack In', weight: 3, effects: [{ k: 'atk', n: 8 }, { k: 'debuff', id: 'weak', n: 1 }] },
    { id: 'ddos', name: 'DDoS', weight: 2, effects: [{ k: 'atk', n: 4, times: 3 }] },
    { id: 'siphon', name: 'Siphon', weight: 2, cooldown: 1, effects: [{ k: 'atk', n: 6 }, { k: 'heal', n: 6 }] },
  ],
}))
reg(E({
  id: 'daemon', name: 'Proxy Daemon', glyph: '😈', hp: [48, 56],
  moves: [
    { id: 'curse', name: 'Corrupt Data', weight: 2, maxRepeat: 1, effects: [{ k: 'debuff', id: 'corrupt', n: 3 }] },
    { id: 'blast', name: 'Hex Blast', weight: 3, effects: [{ k: 'atk', n: 11 }] },
    { id: 'rally', name: 'Rally', weight: 2, maxRepeat: 1, effects: [{ k: 'buffAll', id: 'str', n: 2 }] },
  ],
}))
reg(E({
  id: 'sentry', name: 'Turret Sentry', glyph: '📡', hp: [34, 40],
  traits: { thorns: 2 },
  moves: [
    { id: 'snipe', name: 'Snipe', weight: 3, effects: [{ k: 'atk', n: 12 }] },
    { id: 'lockon', name: 'Lock On', weight: 2, maxRepeat: 1, effects: [{ k: 'debuff', id: 'vuln', n: 2 }] },
    { id: 'reinforce', name: 'Reinforce', weight: 2, maxRepeat: 1, effects: [{ k: 'block', n: 8 }, { k: 'buff', id: 'thorns', n: 1 }] },
  ],
}))
reg(E({
  id: 'blackice', name: 'BLACK ICE', glyph: '🕸', hp: [96, 104],
  traits: { thorns: 3 },
  moves: [
    { id: 'crush', name: 'Crush', weight: 3, effects: [{ k: 'atk', n: 16 }] },
    { id: 'freezewall', name: 'Freeze Wall', weight: 2, maxRepeat: 1, effects: [{ k: 'block', n: 14 }, { k: 'buff', id: 'str', n: 1 }] },
    { id: 'lockdown', name: 'Lockdown', weight: 2, cooldown: 1, effects: [{ k: 'debuff', id: 'weak', n: 2 }, { k: 'debuff', id: 'vuln', n: 1 }] },
  ],
}))
reg(E({
  id: 'mainframe', name: 'MAINFRAME', glyph: '🖥', hp: [190, 190], boss: true,
  moves: [
    { id: 'firewall', name: 'Firewall', weight: 2, maxRepeat: 1, effects: [{ k: 'block', n: 18 }, { k: 'buff', id: 'str', n: 2 }] },
    { id: 'purgebeam', name: 'Purge Beam', weight: 2, cooldown: 2, effects: [{ k: 'atk', n: 22 }] },
    { id: 'forkproc', name: 'Fork Process', weight: 3, effects: [{ k: 'atk', n: 8, times: 2 }, { k: 'debuff', id: 'weak', n: 1 }] },
    { id: 'corruptdata', name: 'Corrupt Data', weight: 2, cooldown: 2, effects: [{ k: 'addCard', id: 'glitch', n: 2 }, { k: 'debuff', id: 'corrupt', n: 3 }] },
  ],
}))

// --- Act 3 ------------------------------------------------------------------

reg(E({
  id: 'nullptr', name: 'Null Pointer', glyph: '💀', hp: [52, 60],
  moves: [
    { id: 'deref', name: 'Dereference', weight: 3, effects: [{ k: 'atk', n: 14 }] },
    { id: 'void', name: 'Void Guard', weight: 2, maxRepeat: 1, effects: [{ k: 'block', n: 12 }] },
    { id: 'leak', name: 'Memory Leak', weight: 2, maxRepeat: 1, effects: [{ k: 'debuff', id: 'corrupt', n: 4 }] },
  ],
}))
reg(E({
  id: 'wraith', name: 'Quantum Wraith', glyph: '👻', hp: [56, 64],
  moves: [
    { id: 'phase', name: 'Phase Strike', weight: 3, effects: [{ k: 'atk', n: 9, times: 2 }] },
    { id: 'blur', name: 'Blur', weight: 2, maxRepeat: 1, effects: [{ k: 'block', n: 10 }, { k: 'debuff', id: 'weak', n: 1 }] },
    { id: 'collapse', name: 'Collapse', weight: 2, cooldown: 2, effects: [{ k: 'atk', n: 19 }] },
  ],
}))
reg(E({
  id: 'botnode', name: 'Botnet Node', glyph: '🕷', hp: [26, 30],
  moves: [
    { id: 'pester', name: 'Pester', weight: 3, effects: [{ k: 'atk', n: 6 }] },
    { id: 'sync', name: 'Sync', weight: 2, maxRepeat: 1, effects: [{ k: 'buffAll', id: 'str', n: 1 }] },
    { id: 'guard', name: 'Guard', weight: 1, effects: [{ k: 'block', n: 6 }] },
  ],
}))
reg(E({
  id: 'rootdaemon', name: 'ROOT DAEMON', glyph: '🐲', hp: [130, 140],
  traits: { str: 2 },
  moves: [
    { id: 'sudo', name: 'Sudo', weight: 1, maxRepeat: 1, effects: [{ k: 'buff', id: 'str', n: 3 }] },
    { id: 'smite', name: 'Smite', weight: 3, effects: [{ k: 'atk', n: 20 }] },
    { id: 'chainatk', name: 'Chain Attack', weight: 2, effects: [{ k: 'atk', n: 7, times: 3 }] },
  ],
}))
reg(E({
  id: 'architect', name: 'THE ARCHITECT', glyph: '🌐', hp: [280, 280], boss: true,
  moves: [
    { id: 'genesis', name: 'Genesis Build', weight: 2, maxRepeat: 1, effects: [{ k: 'block', n: 20 }, { k: 'buff', id: 'str', n: 3 }] },
    { id: 'deleterow', name: 'DELETE ROW', weight: 2, cooldown: 2, effects: [{ k: 'atk', n: 26 }] },
    { id: 'rewrite', name: 'Rewrite', weight: 2, cooldown: 2, effects: [{ k: 'addCard', id: 'glitch', n: 2 }, { k: 'debuff', id: 'weak', n: 2 }] },
    { id: 'cascade', name: 'Cascade', weight: 3, effects: [{ k: 'atk', n: 9, times: 3 }] },
    { id: 'awaken', name: 'AWAKEN', weight: 12, cond: { hpBelow: 0.5, once: true }, effects: [{ k: 'buff', id: 'str', n: 4 }, { k: 'buff', id: 'ritual', n: 1 }] },
  ],
}))

/** Localized enemy display name. */
export function enemyName(defId: string): string {
  return isZh() ? (ENEMY_ZH[defId]?.name ?? ENEMIES[defId]?.name ?? defId) : (ENEMIES[defId]?.name ?? defId)
}

/** Localized move display name (for intent tooltips). */
export function moveName(defId: string, moveId: string): string {
  const en = ENEMIES[defId]?.moves.find((m) => m.id === moveId)?.name ?? moveId
  return isZh() ? (ENEMY_ZH[defId]?.moves[moveId] ?? en) : en
}

// --- Encounters -------------------------------------------------------------

export interface EncounterTable {
  normal: string[][]
  elite: string[][]
  boss: string[][]
}

export const ENCOUNTERS: Record<number, EncounterTable> = {
  1: {
    normal: [
      ['spambot', 'spambot'],
      ['drone'],
      ['kiddie'],
      ['golem'],
      ['drone', 'spambot'],
      ['kiddie', 'spambot'],
    ],
    elite: [['hound']],
    boss: [['compiler']],
  },
  2: {
    normal: [
      ['ice', 'ice'],
      ['netrunner'],
      ['daemon'],
      ['sentry', 'ice'],
      ['daemon', 'spambot'],
      ['netrunner', 'sentry'],
    ],
    elite: [['blackice']],
    boss: [['mainframe']],
  },
  3: {
    normal: [
      ['nullptr'],
      ['wraith'],
      ['botnode', 'botnode', 'botnode'],
      ['nullptr', 'wraith'],
      ['wraith', 'botnode'],
    ],
    elite: [['rootdaemon']],
    boss: [['architect']],
  },
}

// --- Smart intent selection -------------------------------------------------

function moveTags(m: MoveDef): IntentKind[] {
  const tags = new Set<IntentKind>()
  for (const e of m.effects) {
    if (e.k === 'atk') tags.add('attack')
    if (e.k === 'block' || e.k === 'heal') tags.add('defend')
    if (e.k === 'buff' || e.k === 'buffAll') tags.add('buff')
    if (e.k === 'debuff' || e.k === 'addCard') tags.add('debuff')
  }
  return [...tags]
}

export function moveIntentKind(m: MoveDef): IntentKind {
  const tags = moveTags(m)
  if (tags.length === 0) return 'buff'
  if (tags.length === 1) return tags[0]
  if (tags.includes('attack')) return 'mixed'
  return tags[0]
}

function movePlannedDamage(m: MoveDef, e: EnemyC, player: { statuses: { vuln?: number } }): number {
  let total = 0
  for (const eff of m.effects) {
    if (eff.k === 'atk') total += modifiedDamage(eff.n, e, player) * (eff.times ?? 1)
  }
  return total
}

function isLegal(m: MoveDef, e: EnemyC, turn: number): boolean {
  if (m.cond?.hpBelow !== undefined && e.hp / e.maxHp >= m.cond.hpBelow) return false
  if (m.cond?.afterTurn !== undefined && turn < m.cond.afterTurn) return false
  if (m.cond?.once && m.id in e.usedOn) return false
  if (m.cooldown && m.id in e.usedOn && turn - e.usedOn[m.id] <= m.cooldown) return false
  const maxRep = m.maxRepeat ?? 2
  const recent = e.lastMoves.slice(-maxRep)
  if (recent.length >= maxRep && recent.every((id) => id === m.id)) return false
  return true
}

/**
 * Heuristic enemy AI. Enemies react to the board instead of rolling a fixed
 * script: they go for lethal, turtle when hurt, punish Vulnerability, and
 * shut down Strength stacking with Weak.
 */
export function chooseMove(e: EnemyC, cs: CombatState, rng: Rng): MoveDef {
  const def = ENEMIES[e.defId]
  let legal = def.moves.filter((m) => isLegal(m, e, cs.turn))
  if (legal.length === 0) legal = def.moves
  const player = cs.player
  const hpFrac = e.hp / e.maxHp

  const score = (m: MoveDef): number => {
    let s = m.weight
    const tags = moveTags(m)
    const dmg = movePlannedDamage(m, e, player)
    // Go for the kill: enough damage to end it outranks everything.
    if (dmg > 0 && dmg >= player.hp + player.block) s *= 6
    // Wounded: prefer to turtle or stabilize.
    if (hpFrac < 0.35) {
      if (tags.includes('defend')) s *= 2.2
      if (tags.includes('buff')) s *= 1.3
    }
    // Player snowballing Strength: try to Weaken them.
    if ((player.statuses.str ?? 0) >= 3 && m.effects.some((x) => x.k === 'debuff' && x.id === 'weak')) s *= 2
    // Player is Vulnerable: capitalize with attacks.
    if ((player.statuses.vuln ?? 0) > 0 && tags.includes('attack')) s *= 1.5
    // Player already Weak: don't stack more, hit them instead.
    if ((player.statuses.weak ?? 0) > 1 && m.effects.some((x) => x.k === 'debuff' && x.id === 'weak')) s *= 0.4
    return s
  }

  return weightedPick(rng, legal, score)
}

/** Ascension damage scaling for enemy attacks (+4% per level, rounded). */
export function ascAtk(n: number, asc: number): number {
  return asc > 0 ? Math.round(n * (1 + 0.04 * asc)) : n
}

export function intentFor(m: MoveDef, e: EnemyC, player: { statuses: { vuln?: number } }, asc = 0): Intent {
  const kind = moveIntentKind(m)
  const atk = m.effects.find((x) => x.k === 'atk')
  const intent: Intent = { moveId: m.id, name: m.name, kind }
  if (atk && atk.k === 'atk') {
    intent.dmg = modifiedDamage(ascAtk(atk.n, asc), e, player)
    if (atk.times && atk.times > 1) intent.times = atk.times
  }
  return intent
}
