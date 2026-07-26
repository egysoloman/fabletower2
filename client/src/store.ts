/** Global app state (Preact signals) + save-game persistence. */
import { signal } from '@preact/signals'
import type { CardInst, CombatState, EventDef, RunState, ShopStock } from '@neonspire/engine'

export type Screen =
  | 'menu'
  | 'map'
  | 'combat'
  | 'reward'
  | 'shop'
  | 'rest'
  | 'event'
  | 'descend'
  | 'gameover'
  | 'victory'
  | 'pvp'
  | 'climb'

export interface RewardBundle {
  gold: number
  cards: string[] | null
  cardTaken: boolean
  relic: string | null
  relicTaken: boolean
  /** Boss reward: pick ONE of these relics. */
  bossChoices: string[]
  bossChoiceTaken: boolean
  potion: string | null
  potionTaken: boolean
  afterBoss: boolean
}

export interface PickerRequest {
  title: string
  cancellable: boolean
  /** Show only matching deck cards. */
  filter?: (c: CardInst) => boolean
  onPick: (uid: number) => void
}

export const screen = signal<Screen>('menu')
export const run = signal<RunState | null>(null)
export const combat = signal<CombatState | null>(null)
export const combatKind = signal<'normal' | 'elite' | 'boss'>('normal')
export const reward = signal<RewardBundle | null>(null)
export const shop = signal<ShopStock | null>(null)
export const currentEvent = signal<EventDef | null>(null)
export const eventLines = signal<string[] | null>(null)
export const restUsed = signal(false)
export const picker = signal<PickerRequest | null>(null)
export const pileView = signal<{ title: string; cards: CardInst[] } | null>(null)
/** Solo-mode cheat console visibility (never persisted). */
export const cheatOpen = signal(false)
/** Node id to celebrate (particle burst) next time the map shows. */
export const completedNode = signal<string | null>(null)

/** Re-emit a signal whose inner object was mutated in place. */
export function touch() {
  if (run.value) run.value = { ...run.value }
}

// --- Persistence -------------------------------------------------------------

const SAVE_KEY = 'neonspire-save-v1'

export function saveGame() {
  try {
    // Never persist a finished run — a save pointing at the game-over screen
    // would turn CONTINUE RUN into a dead end.
    if (!run.value || screen.value === 'gameover' || screen.value === 'victory') {
      localStorage.removeItem(SAVE_KEY)
      return
    }
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        // Multiplayer screens can't be resurrected from a save — a restored
        // climb continues as an ordinary solo run from the map.
        screen: screen.value === 'pvp' ? 'menu' : screen.value === 'climb' ? 'map' : screen.value,
        run: run.value,
        combat: combat.value,
        combatKind: combatKind.value,
        reward: reward.value,
        shop: shop.value,
        currentEvent: currentEvent.value,
        eventLines: eventLines.value,
        restUsed: restUsed.value,
      }),
    )
  } catch {
    /* storage unavailable (private mode) — the game still runs */
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY)
  } catch {
    /* ignore */
  }
}

export function hasSave(): boolean {
  try {
    return localStorage.getItem(SAVE_KEY) !== null
  } catch {
    return false
  }
}

export function loadGame(): boolean {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return false
    const s = JSON.parse(raw)
    if (!s?.run) return false
    // Back-compat with saves from before potions/ascension/boss-choice.
    s.run.potions ??= []
    s.run.asc ??= 0
    s.run.char ??= 'runner'
    if (s.reward) {
      s.reward.bossChoices ??= s.reward.bossRelic ? [s.reward.bossRelic] : []
      s.reward.bossChoiceTaken ??= !!s.reward.bossRelicTaken
      s.reward.potion ??= null
      s.reward.potionTaken ??= false
    }
    if (s.shop) s.shop.potions ??= []
    if (s.combat?.player) s.combat.player.minions ??= []
    run.value = s.run
    combat.value = s.combat ?? null
    combatKind.value = s.combatKind ?? 'normal'
    reward.value = s.reward ?? null
    shop.value = s.shop ?? null
    currentEvent.value = s.currentEvent ?? null
    eventLines.value = s.eventLines ?? null
    restUsed.value = !!s.restUsed
    screen.value = s.screen ?? 'map'
    return true
  } catch {
    return false
  }
}
