/**
 * Local meta-progression: content discovery (codex), achievements with popup
 * notifications, run statistics, and the daily-run leaderboard. Everything
 * persists in localStorage and survives across runs.
 */
import { signal } from '@preact/signals'
import type { CharId, CombatState, RunState } from '@neonspire/engine'
import { runHistory, type RunRecord } from './game'
import { sfx } from './sfx'
import { schedulePush } from './account'

// --- Codex: discovered content ----------------------------------------------

interface Codex {
  cards: Record<string, 1>
  relics: Record<string, 1>
  enemies: Record<string, 1>
}

function loadCodex(): Codex {
  try {
    const c = JSON.parse(localStorage.getItem('ns-codex') ?? '{}')
    return { cards: c.cards ?? {}, relics: c.relics ?? {}, enemies: c.enemies ?? {} }
  } catch {
    return { cards: {}, relics: {}, enemies: {} }
  }
}

export const codex = signal<Codex>(loadCodex())

function saveCodex() {
  try {
    localStorage.setItem('ns-codex', JSON.stringify(codex.value))
  } catch {
    /* best-effort */
  }
}

/** Idempotent sweep: everything in the current run counts as discovered. */
export function discoverRun(run: RunState) {
  const c = codex.value
  let dirty = false
  for (const card of run.deck) {
    if (!c.cards[card.id]) {
      c.cards[card.id] = 1
      dirty = true
    }
  }
  for (const r of run.relics) {
    if (!c.relics[r]) {
      c.relics[r] = 1
      dirty = true
    }
  }
  if (dirty) {
    codex.value = { ...c }
    saveCodex()
    schedulePush()
  }
}

export function discoverEnemies(cs: CombatState) {
  const c = codex.value
  let dirty = false
  for (const e of cs.enemies) {
    if (!c.enemies[e.defId]) {
      c.enemies[e.defId] = 1
      dirty = true
    }
  }
  if (dirty) {
    codex.value = { ...c }
    saveCodex()
  }
}

// --- Run statistics -----------------------------------------------------------

export interface RunStats {
  wins: number
  losses: number
  favorite: CharId | null
  highestAscWin: number
  bestScore: number
}

export function runStats(): RunStats {
  const hist = runHistory()
  const wins = hist.filter((h) => h.win).length
  const byChar = new Map<CharId, number>()
  for (const h of hist) {
    const ch = (h.ch ?? 'runner') as CharId
    byChar.set(ch, (byChar.get(ch) ?? 0) + 1)
  }
  let favorite: CharId | null = null
  let best = 0
  for (const [ch, n] of byChar) {
    if (n > best) {
      best = n
      favorite = ch
    }
  }
  return {
    wins,
    losses: hist.length - wins,
    favorite,
    highestAscWin: Math.max(0, ...hist.filter((h) => h.win).map((h) => h.asc)),
    bestScore: Math.max(0, ...hist.map((h) => h.sc ?? 0)),
  }
}

// --- Achievements -------------------------------------------------------------

export interface AchDef {
  id: string
  /** i18n keys resolved by the UI: ach_<id> / achd_<id>. */
  check?: never
}

export const ACHIEVEMENTS: string[] = [
  'firstwin',
  'win_runner',
  'win_vector',
  'win_ghost',
  'win_array',
  'asc5',
  'asc10',
  'asc15',
  'asc20',
  'untouchable',
  'stacks10',
  'combo5',
  'hoarder',
  'rootslayer',
  'fullbelt',
  'librarian',
  'daily',
  'coopwin',
]

function loadAch(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem('ns-ach') ?? '{}')
  } catch {
    return {}
  }
}

export const achievements = signal<Record<string, number>>(loadAch())
/** Queue of freshly-unlocked achievement ids for popup toasts. */
export const achToasts = signal<string[]>([])

export function award(id: string) {
  if (!ACHIEVEMENTS.includes(id) || achievements.value[id]) return
  achievements.value = { ...achievements.value, [id]: Date.now() }
  try {
    localStorage.setItem('ns-ach', JSON.stringify(achievements.value))
  } catch {
    /* best-effort */
  }
  achToasts.value = [...achToasts.value, id]
  schedulePush()
  sfx.win()
  setTimeout(() => {
    achToasts.value = achToasts.value.filter((x) => x !== id)
  }, 4200)
}

/** Award checks driven by live combat state (called after each action). */
export function checkCombat(cs: CombatState) {
  if (cs.player.cardsThisTurn >= 5) award('combo5')
  for (const v of Object.values(cs.player.statuses)) {
    if ((v ?? 0) >= 10) award('stacks10')
  }
}

/** Award checks when a run records (win or loss). */
export function checkRun(rec: RunRecord, run: RunState, dailySeed: number | null) {
  if (rec.win) {
    award('firstwin')
    award('win_' + (rec.ch ?? 'runner'))
    if (rec.asc >= 5) award('asc5')
    if (rec.asc >= 10) award('asc10')
    if (rec.asc >= 15) award('asc15')
    if (rec.asc >= 20) award('asc20')
    if (rec.act >= 4) award('rootslayer')
  }
  if (run.relics.length >= 6) award('hoarder')
  if (run.potions.length >= 3) award('fullbelt')
  if (run.deck.length >= 40) award('librarian')
  if (dailySeed !== null && rec.seed === dailySeed && rec.win) award('daily')
}

// --- Daily leaderboard (local) ------------------------------------------------

export interface DailyEntry {
  score: number
  ch: CharId
  win: boolean
  d: number
}

export function dailyKey(date = new Date()): string {
  return 'ns-daily-' + date.toISOString().slice(0, 10)
}

export function dailyBoard(): DailyEntry[] {
  try {
    return JSON.parse(localStorage.getItem(dailyKey()) ?? '[]')
  } catch {
    return []
  }
}

export function recordDaily(entry: DailyEntry) {
  try {
    const list = dailyBoard()
    list.push(entry)
    list.sort((a, b) => b.score - a.score)
    localStorage.setItem(dailyKey(), JSON.stringify(list.slice(0, 10)))
  } catch {
    /* best-effort */
  }
}

export function dailyRank(score: number): number {
  const list = dailyBoard()
  return list.filter((e) => e.score > score).length + 1
}
