/** Run/meta layer: deck-building, map traversal, rewards, shops, events. */
import type { CardInst, CombatState, NodeType, RunState, ShopStock } from './types'
import { CARDS, cardBaseName, cardsByRarity, obtainableCards } from './cards'
import { RELICS, obtainableRelics, relicName } from './relics'
import { ES } from './i18n'
import { ENCOUNTERS } from './enemies'
import { EVENTS, type Outcome } from './events'
import { genActMap, nodeById } from './map'
import { startCombat } from './combat'
import { deriveSeed, pick, randInt, rand, rngFromSeed } from './rng'

export const FINAL_ACT = 3
export const STARTER_DECK: string[] = [
  'strike', 'strike', 'strike', 'strike', 'strike',
  'defend', 'defend', 'defend', 'defend',
  'spike',
]

export function newRun(seed: number): RunState {
  const rng = rngFromSeed(seed)
  let uid = 1
  const deck = STARTER_DECK.map((id): CardInst => ({ uid: uid++, id, up: false }))
  return {
    seed,
    rng,
    act: 1,
    map: genActMap(1, rng),
    pos: null,
    path: [],
    hp: 75,
    maxHp: 75,
    gold: 99,
    deck,
    relics: ['cortexlink'],
    uid,
    floor: 0,
    lastEncounter: '',
    removesBought: 0,
    seenEvents: [],
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
  const base =
    kind === 'boss'
      ? randInt(run.rng, 65, 85)
      : kind === 'elite'
        ? randInt(run.rng, 32, 45)
        : randInt(run.rng, 13, 22) + run.act * 4
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
  let guard = 0
  while (out.length < 3 && guard++ < 40) {
    const pool = cardsByRarity(rollRarity(run, kind))
    const card = pick(run.rng, pool)
    if (!out.includes(card.id)) out.push(card.id)
  }
  return out
}

export function randomRelicId(run: RunState, includeBoss = false): string | null {
  const pool = obtainableRelics(run.relics, includeBoss)
  if (pool.length === 0) return null
  return pick(run.rng, pool).id
}

export function bossRelicId(run: RunState): string | null {
  const pool = obtainableRelics(run.relics, true).filter((r) => r.rarity === 'boss')
  if (pool.length === 0) return null
  return pick(run.rng, pool).id
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
  if (extraHp > 0) {
    run.maxHp += extraHp
    run.hp += extraHp
  }
}

// --- Shop ------------------------------------------------------------------

const CARD_PRICE: Record<string, [number, number]> = {
  common: [45, 55],
  uncommon: [68, 82],
  rare: [135, 155],
}

export function genShop(run: RunState): ShopStock {
  const cards: ShopStock['cards'] = []
  let guard = 0
  while (cards.length < 5 && guard++ < 60) {
    const r = rand(run.rng)
    const rarity = r < 0.1 ? 'rare' : r < 0.5 ? 'uncommon' : 'common'
    const def = pick(run.rng, cardsByRarity(rarity))
    if (cards.some((c) => c.id === def.id)) continue
    const [lo, hi] = CARD_PRICE[rarity]
    cards.push({ id: def.id, price: randInt(run.rng, lo, hi), sold: false })
  }
  const relicPool = obtainableRelics(run.relics)
  const relics: ShopStock['relics'] = []
  for (let i = 0; i < 2 && relicPool.length > 0; i++) {
    const def = relicPool.splice(Math.floor(rand(run.rng) * relicPool.length), 1)[0]
    relics.push({ id: def.id, price: def.rarity === 'rare' ? randInt(run.rng, 220, 250) : randInt(run.rng, 140, 165), sold: false })
  }
  return { cards, relics, removePrice: 75 + 25 * run.removesBought }
}

// --- Rest / deck manipulation ----------------------------------------------

export function restHealAmount(run: RunState): number {
  let bonus = 0
  for (const r of run.relics) bonus += RELICS[r]?.hooks.restBonus ?? 0
  return Math.floor(run.maxHp * 0.3) + bonus
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
      case 'cardRandomRare': {
        const def = pick(run.rng, obtainableCards().filter((c) => c.rarity === 'rare'))
        addCardToDeck(run, def.id)
        lines.push(ES.addedCard(cardBaseName(def.id)))
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
      case 'removeChoose':
        removeChoose = true
        break
    }
  }
  return { lines, removeChoose }
}

// --- Act transitions --------------------------------------------------------

/** Advance to the next act (or report final victory). Returns 'victory' after the last act. */
export function advanceAct(run: RunState): 'next' | 'victory' {
  if (run.act >= FINAL_ACT) return 'victory'
  run.act++
  run.map = genActMap(run.act, run.rng)
  run.pos = null
  run.path = []
  run.hp = Math.min(run.maxHp, run.hp + Math.floor(run.maxHp * 0.25))
  return 'next'
}
