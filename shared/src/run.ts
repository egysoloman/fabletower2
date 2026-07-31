/** Run/meta layer: deck-building, map traversal, rewards, shops, events. */
import type { CardInst, CharId, CombatState, NodeType, RunState, ShopStock } from './types'
import { CARDS, cardBaseName, cardName, cardsByRarity, obtainableCards } from './cards'
import { POTIONS, potionName } from './potions'
import { RELICS, obtainableRelics, relicName } from './relics'
import { ES } from './i18n'
import { ENCOUNTERS } from './enemies'
import { EVENTS, type Outcome } from './events'
import { genActMap, nodeById } from './map'
import { startCombat } from './combat'
import { deriveSeed, pick, randInt, rand, rngFromSeed } from './rng'

export const FINAL_ACT = 3
/** The optional post-game act: THE ROOT. Entered only by choice. */
export const TRUE_FINAL_ACT = 4

export const STARTER_DECKS: Record<CharId, string[]> = {
  runner: [
    'strike', 'strike', 'strike', 'strike', 'strike',
    'defend', 'defend', 'defend', 'defend',
    'spike',
  ],
  vector: [
    'spark', 'spark', 'spark', 'spark',
    'heatshield', 'heatshield', 'heatshield', 'heatshield',
    'ventblade', 'stoke',
  ],
  ghost: [
    'phaseblade', 'phaseblade', 'phaseblade', 'phaseblade',
    'cloakfield', 'cloakfield', 'cloakfield', 'cloakfield',
    'redshift', 'blackout',
  ],
  array: [
    'pulsebolt', 'pulsebolt', 'pulsebolt', 'pulsebolt',
    'fieldwall', 'fieldwall', 'fieldwall', 'fieldwall',
    'deployturret', 'deployplating',
  ],
}

export const MAX_ASC = 20

/** Each character opens the climb with their own signature relic. */
export const STARTER_RELICS: Record<CharId, string> = {
  runner: 'cortexlink',
  vector: 'ignitionkey',
  ghost: 'phaselocket',
  array: 'dronecradle',
}

export function newRun(seed: number, asc = 0, char: CharId = 'runner'): RunState {
  const rng = rngFromSeed(seed)
  let uid = 1
  const deck = STARTER_DECKS[char].map((id): CardInst => ({ uid: uid++, id, up: false }))
  // A2+: the Spire rides along — start cursed. A10 doubles down.
  if (asc >= 2) deck.push({ uid: uid++, id: 'lag', up: false })
  if (asc >= 10) deck.push({ uid: uid++, id: 'lag', up: false })
  if (asc >= 20) deck.push({ uid: uid++, id: 'glitch', up: false })
  const maxHp = asc >= 10 ? 60 : asc >= 5 ? 65 : 75
  // A14+: the climb starts before you're ready.
  const hp = asc >= 14 ? Math.floor(maxHp * 0.85) : maxHp
  return {
    seed,
    rng,
    act: 1,
    map: genActMap(1, rng),
    pos: null,
    path: [],
    hp,
    maxHp,
    gold: asc >= 12 ? 75 : 99,
    deck,
    relics: [STARTER_RELICS[char]],
    uid,
    floor: 0,
    lastEncounter: '',
    removesBought: 0,
    seenEvents: [],
    potions: [],
    asc,
    char,
  }
}

export function availableNodeIds(run: RunState): string[] {
  if (run.pos === null) return run.map.rows[0].map((n) => n.id)
  return nodeById(run.map, run.pos)?.next ?? []
}

export function moveTo(run: RunState, id: string): NodeType | null {
  if (!availableNodeIds(run).includes(id)) return null
  const node = nodeById(run.map, id)
  if (!node) return null
  run.pos = id
  run.path.push(id)
  run.floor++
  return node.type
}

// --- Combat ----------------------------------------------------------------

export function pickEncounter(run: RunState, kind: 'normal' | 'elite' | 'boss'): string[] {
  const pool = ENCOUNTERS[run.act][kind]
  let choice = pick(run.rng, pool)
  if (pool.length > 1 && choice.join(',') === run.lastEncounter) choice = pick(run.rng, pool)
  run.lastEncounter = choice.join(',')
  return choice
}

export function combatFor(run: RunState, kind: 'normal' | 'elite' | 'boss'): CombatState {
  const enemyIds = pickEncounter(run, kind)
  return startCombat({
    deck: run.deck,
    hp: run.hp,
    maxHp: run.maxHp,
    relics: run.relics,
    enemyIds,
    encounterId: enemyIds.join(','),
    seed: deriveSeed(run.rng),
    uidStart: run.uid,
    asc: run.asc,
    kind,
  })
}

/** Sync run state after a combat ends (win or loss). */
export function applyCombatResult(run: RunState, cs: CombatState) {
  run.hp = Math.max(0, cs.player.hp)
  run.uid = Math.max(run.uid, cs.uid)
  if (cs.over === 'win') {
    let heal = 0
    for (const r of run.relics) heal += RELICS[r]?.hooks.afterCombatHeal ?? 0
    if (heal > 0) run.hp = Math.min(run.maxHp, run.hp + heal)
  }
}

// --- Rewards ---------------------------------------------------------------

export function withGoldBonus(run: RunState, base: number): number {
  let pct = 0
  for (const r of run.relics) pct += RELICS[r]?.hooks.goldBonusPct ?? 0
  return Math.floor(base * (1 + pct / 100))
}

export function goldReward(run: RunState, kind: 'normal' | 'elite' | 'boss'): number {
  let base =
    kind === 'boss'
      ? randInt(run.rng, 65, 85)
      : kind === 'elite'
        ? randInt(run.rng, 32, 45)
        : randInt(run.rng, 13, 22) + run.act * 4
  if (run.asc >= 3) base = Math.floor(base * 0.85)
  return withGoldBonus(run, base)
}

function rollRarity(run: RunState, kind: 'normal' | 'elite' | 'boss'): 'common' | 'uncommon' | 'rare' {
  if (kind === 'boss') return 'rare'
  const r = rand(run.rng)
  if (kind === 'elite') return r < 0.15 ? 'rare' : r < 0.6 ? 'uncommon' : 'common'
  return r < 0.05 ? 'rare' : r < 0.35 ? 'uncommon' : 'common'
}

export function rollCardRewards(run: RunState, kind: 'normal' | 'elite' | 'boss'): string[] {
  const out: string[] = []
  const want = run.asc >= 15 ? 2 : 3
  let guard = 0
  while (out.length < want && guard++ < 40) {
    const pool = cardsByRarity(rollRarity(run, kind), run.char)
    const card = pick(run.rng, pool)
    if (!out.includes(card.id)) out.push(card.id)
  }
  return out
}

export function randomRelicId(run: RunState, includeBoss = false): string | null {
  const pool = obtainableRelics(run.relics, includeBoss, run.char)
  if (pool.length === 0) return null
  return pick(run.rng, pool).id
}

export function bossRelicId(run: RunState): string | null {
  const pool = obtainableRelics(run.relics, true, run.char).filter((r) => r.rarity === 'boss')
  if (pool.length === 0) return null
  return pick(run.rng, pool).id
}

/** Up to 3 relics offered after a boss (A9+: only 2): boss-rarity first, rare fills in. */
export function bossRelicChoices(run: RunState): string[] {
  const want = run.asc >= 9 ? 2 : 3
  const pool = obtainableRelics(run.relics, true, run.char)
  const bosses = pool.filter((r) => r.rarity === 'boss')
  const rares = pool.filter((r) => r.rarity === 'rare')
  const out: string[] = []
  for (const group of [bosses, rares]) {
    const bag = [...group]
    while (out.length < want && bag.length > 0) {
      out.push(bag.splice(Math.floor(rand(run.rng) * bag.length), 1)[0].id)
    }
  }
  return out
}

// --- Potions -----------------------------------------------------------------

export const MAX_POTIONS = 3

export function randomPotionId(run: RunState): string {
  const pool = Object.values(POTIONS)
  const rares = pool.filter((p) => p.rarity === 'rare')
  const commons = pool.filter((p) => p.rarity === 'common')
  return rand(run.rng) < 0.22 ? pick(run.rng, rares).id : pick(run.rng, commons).id
}

/** ~35% of combat victories drop a potion (A7+: 25%), if there's belt space. */
export function rollPotionDrop(run: RunState): string | null {
  if (rand(run.rng) >= (run.asc >= 19 ? 0.15 : run.asc >= 7 ? 0.25 : 0.35)) return null
  if (run.potions.length >= MAX_POTIONS) return null
  return randomPotionId(run)
}

export function addCardToDeck(run: RunState, id: string, up = false): CardInst {
  const card: CardInst = { uid: run.uid++, id, up }
  run.deck.push(card)
  return card
}

export function addRelic(run: RunState, id: string) {
  if (run.relics.includes(id)) return
  run.relics.push(id)
  const extraHp = RELICS[id]?.hooks.maxHp ?? 0
  if (extraHp !== 0) {
    run.maxHp = Math.max(10, run.maxHp + extraHp)
    run.hp = Math.max(1, Math.min(run.maxHp, run.hp + extraHp))
  }
}

// --- Shop ------------------------------------------------------------------

const CARD_PRICE: Record<string, [number, number]> = {
  common: [45, 55],
  uncommon: [68, 82],
  rare: [135, 155],
}

export function genShop(run: RunState): ShopStock {
  // A8+: everything on the grey market costs 20% more.
  const mark = (p: number) => (run.asc >= 8 ? Math.floor(p * 1.2) : p)
  const cards: ShopStock['cards'] = []
  let guard = 0
  while (cards.length < 5 && guard++ < 60) {
    const r = rand(run.rng)
    const rarity = r < 0.1 ? 'rare' : r < 0.5 ? 'uncommon' : 'common'
    const def = pick(run.rng, cardsByRarity(rarity, run.char))
    if (cards.some((c) => c.id === def.id)) continue
    const [lo, hi] = CARD_PRICE[rarity]
    cards.push({ id: def.id, price: mark(randInt(run.rng, lo, hi)), sold: false })
  }
  const relicPool = obtainableRelics(run.relics, false, run.char)
  const relics: ShopStock['relics'] = []
  for (let i = 0; i < 2 && relicPool.length > 0; i++) {
    const def = relicPool.splice(Math.floor(rand(run.rng) * relicPool.length), 1)[0]
    relics.push({ id: def.id, price: mark(def.rarity === 'rare' ? randInt(run.rng, 180, 205) : randInt(run.rng, 115, 135)), sold: false })
  }
  const potions: ShopStock['potions'] = []
  for (let i = 0; i < 2; i++) {
    const id = randomPotionId(run)
    if (potions.some((p) => p.id === id)) continue
    potions.push({
      id,
      price: mark(POTIONS[id].rarity === 'rare' ? randInt(run.rng, 70, 90) : randInt(run.rng, 42, 58)),
      sold: false,
    })
  }
  return { cards, relics, potions, removePrice: mark(75 + 25 * run.removesBought) }
}

// --- Rest / deck manipulation ----------------------------------------------

export function restHealAmount(run: RunState): number {
  let bonus = 0
  for (const r of run.relics) bonus += RELICS[r]?.hooks.restBonus ?? 0
  return Math.floor(run.maxHp * (run.asc >= 17 ? 0.15 : run.asc >= 6 ? 0.2 : run.asc >= 3 ? 0.25 : 0.3)) + bonus
}

export function upgradeCard(run: RunState, uid: number): boolean {
  const card = run.deck.find((c) => c.uid === uid)
  if (!card || card.up || CARDS[card.id].rarity === 'special') return false
  card.up = true
  return true
}

export function removeCard(run: RunState, uid: number): boolean {
  const idx = run.deck.findIndex((c) => c.uid === uid)
  if (idx < 0) return false
  run.deck.splice(idx, 1)
  return true
}

// --- Events ----------------------------------------------------------------

export function pickEvent(run: RunState) {
  let pool = EVENTS.filter((e) => !run.seenEvents.includes(e.id))
  if (pool.length === 0) {
    run.seenEvents = []
    pool = EVENTS
  }
  const ev = pick(run.rng, pool)
  run.seenEvents.push(ev.id)
  return ev
}

/**
 * Apply an event choice. Returns human-readable result lines; a
 * 'removeChoose' outcome is signalled back for the UI to open the card picker.
 */
export function applyOutcomes(run: RunState, outcomes: Outcome[]): { lines: string[]; removeChoose: boolean } {
  const lines: string[] = []
  let removeChoose = false
  for (const o of outcomes) {
    switch (o.k) {
      case 'gold':
        run.gold = Math.max(0, run.gold + (o.n > 0 ? withGoldBonus(run, o.n) : o.n))
        lines.push(o.n > 0 ? `+${withGoldBonus(run, o.n)}¤` : `${o.n}¤`)
        break
      case 'damage':
        run.hp = Math.max(1, run.hp - o.n)
        lines.push(ES.hpLoss(o.n))
        break
      case 'heal': {
        const healed = Math.min(o.n, run.maxHp - run.hp)
        run.hp += healed
        lines.push(ES.hpGain(healed))
        break
      }
      case 'cardSpecific': {
        const inst2 = addCardToDeck(run, o.id)
        lines.push(ES.addedCard(cardName(inst2)))
        break
      }
      case 'maxhp':
        run.maxHp += o.n
        run.hp += o.n
        lines.push(ES.maxHpGain(o.n))
        break
      case 'relic': {
        const id = randomRelicId(run)
        if (id) {
          addRelic(run, id)
          lines.push(ES.acquiredRelic(relicName(id)))
        } else {
          run.gold += withGoldBonus(run, 50)
          lines.push(ES.noRelicsLeft(withGoldBonus(run, 50)))
        }
        break
      }
      case 'cardRandom': {
        const def = pick(run.rng, obtainableCards(run.char).filter((c) => c.rarity === o.rarity))
        addCardToDeck(run, def.id)
        lines.push(ES.addedCard(cardBaseName(def.id)))
        break
      }
      case 'potion': {
        if (run.potions.length < MAX_POTIONS) {
          const id = randomPotionId(run)
          run.potions.push(id)
          lines.push(ES.gotPotion(potionName(id)))
        } else {
          lines.push(ES.potionsFull())
        }
        break
      }
      case 'cardGlitch':
        addCardToDeck(run, 'glitch')
        lines.push(ES.glitchInfects())
        break
      case 'upgradeRandom': {
        const candidates = run.deck.filter((c) => !c.up && CARDS[c.id].rarity !== 'special')
        if (candidates.length > 0) {
          const card = pick(run.rng, candidates)
          card.up = true
          lines.push(ES.upgradedCard(cardBaseName(card.id)))
        } else {
          lines.push(ES.nothingToUpgrade())
        }
        break
      }
      case 'curse':
        addCardToDeck(run, 'lag')
        lines.push(ES.cursed())
        break
      case 'removeChoose':
        removeChoose = true
        break
    }
  }
  return { lines, removeChoose }
}

// --- Score ------------------------------------------------------------------

export interface ScoreLine {
  k: 'floors' | 'acts' | 'relics' | 'upgrades' | 'gold' | 'asc' | 'win' | 'deep'
  n: number
  pts: number
}

/**
 * End-of-run score with a per-source breakdown. Lives in the engine so any
 * future leaderboard (e.g. daily runs) scores identically everywhere.
 */
export function scoreRun(run: RunState, win: boolean): { lines: ScoreLine[]; total: number } {
  const lines: ScoreLine[] = []
  const add = (k: ScoreLine['k'], n: number, pts: number) => {
    if (pts > 0) lines.push({ k, n, pts })
  }
  add('floors', run.floor, run.floor * 10)
  add('acts', run.act, run.act * 50)
  add('relics', run.relics.length, run.relics.length * 15)
  const ups = run.deck.filter((c) => c.up).length
  add('upgrades', ups, ups * 5)
  add('gold', run.gold, Math.floor(run.gold / 2))
  add('asc', run.asc, run.asc * 40)
  if (win) add('win', 1, 100)
  if (win && run.act >= TRUE_FINAL_ACT) add('deep', 1, 150)
  return { lines, total: lines.reduce((s, l) => s + l.pts, 0) }
}

// --- Act transitions --------------------------------------------------------

/**
 * Advance to the next act (or report final victory). Beating Act 3 wins the
 * run — unless the player chooses to `descend` into THE ROOT (Act 4), whose
 * boss is the true finale.
 */
export function advanceAct(run: RunState, descend = false): 'next' | 'victory' {
  if (run.act >= TRUE_FINAL_ACT) return 'victory'
  if (run.act >= FINAL_ACT && !descend) return 'victory'
  run.act++
  run.map = genActMap(run.act, run.rng)
  run.pos = null
  run.path = []
  run.hp = Math.min(run.maxHp, run.hp + Math.floor(run.maxHp * 0.25))
  return 'next'
}
