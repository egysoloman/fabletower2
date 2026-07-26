/**
 * Shared combat primitives + the card-effect interpreter.
 *
 * Everything here is pure data-in/data-out (given the rng inside the state),
 * and is the ONLY implementation of combat math in the project: the PvE
 * reducer (combat.ts), the PvP reducer (pvp.ts), the browser client and the
 * Node server all execute these exact functions.
 */
import { CARDS, cardCost, cardEffects, cardExhausts } from './cards'
import { RELICS } from './relics'
import type { CardInst, DeckSide, Effect, Fighter, GameEvent, StatusId } from './types'
import { DEBUFFS } from './types'
import { randInt, shuffle, type Rng } from './rng'

export const HAND_LIMIT = 10
export const BASE_DRAW = 5

/** Mutable environment a card resolves inside; CombatState/PvpState satisfy it. */
export interface PlayEnv {
  rng: Rng
  uid: number
  firstCardFree?: boolean
  relics?: string[]
}

/** Attack damage after attacker Strength/Weak and defender Vulnerable. */
export function modifiedDamage(
  base: number,
  attacker: { statuses: { str?: number; weak?: number } },
  defender: { statuses: { vuln?: number } },
): number {
  let d = base + (attacker.statuses.str ?? 0)
  if (attacker.statuses.weak) d = Math.floor(d * 0.75)
  if (defender.statuses.vuln) d = Math.floor(d * 1.5)
  return Math.max(0, d)
}

export function applyStatus(f: Fighter, id: StatusId, n: number, who: string, evs: GameEvent[]) {
  f.statuses[id] = (f.statuses[id] ?? 0) + n
  if ((f.statuses[id] ?? 0) <= 0) delete f.statuses[id]
  evs.push({ e: 'status', who, id, n })
}

export function gainBlock(f: Fighter, n: number, who: string, evs: GameEvent[]) {
  if (n <= 0) return
  f.block += n
  evs.push({ e: 'block', who, n })
}

export function healHp(f: Fighter, n: number, who: string, evs: GameEvent[]) {
  const amount = Math.min(n, f.maxHp - f.hp)
  if (amount <= 0) return
  f.hp += amount
  evs.push({ e: 'heal', who, n: amount })
}

/** Direct HP loss that ignores Block (Corrupt ticks, Glitch, Overvolt). */
export function loseHp(f: Fighter, n: number, who: string, evs: GameEvent[]) {
  if (n <= 0) return
  f.hp -= n
  evs.push({ e: 'hit', who, n })
}

/** Unmodified but blockable damage (Thorns, Auto-Turret). */
export function plainDamage(dst: Fighter, n: number, who: string, evs: GameEvent[]) {
  const blocked = Math.min(dst.block, n)
  dst.block -= blocked
  const hpLoss = n - blocked
  if (blocked > 0) evs.push({ e: 'blocked', who, n: blocked })
  if (hpLoss > 0) {
    dst.hp -= hpLoss
    evs.push({ e: 'hit', who, n: hpLoss })
  }
}

/** A full attack: damage modifiers, block absorption, thorns retaliation. */
export function attack(
  src: Fighter,
  dst: Fighter,
  base: number,
  whoSrc: string,
  whoDst: string,
  evs: GameEvent[],
) {
  const d = modifiedDamage(base, src, dst)
  const blocked = Math.min(dst.block, d)
  dst.block -= blocked
  const hpLoss = d - blocked
  if (blocked > 0) evs.push({ e: 'blocked', who: whoDst, n: blocked })
  dst.hp -= hpLoss
  evs.push({ e: 'hit', who: whoDst, n: hpLoss })
  const thorns = dst.statuses.thorns ?? 0
  if (thorns > 0) plainDamage(src, thorns, whoSrc, evs)
}

export function drawCards(side: DeckSide, n: number, env: PlayEnv, who: string, evs: GameEvent[]) {
  for (let i = 0; i < n; i++) {
    if (side.hand.length >= HAND_LIMIT) return
    if (side.draw.length === 0) {
      if (side.discard.length === 0) return
      side.draw = shuffle(env.rng, side.discard)
      side.discard = []
      const bonus = relicHook(env, 'onShuffleEnergy')
      if (bonus) {
        side.energy += bonus
        evs.push({ e: 'status', who, id: 'energyGain', n: bonus })
      }
    }
    side.hand.push(side.draw.pop()!)
  }
}

function relicHook<K extends keyof (typeof RELICS)[string]['hooks']>(
  env: PlayEnv,
  key: K,
): number {
  let total = 0
  for (const id of env.relics ?? []) {
    const v = RELICS[id]?.hooks[key]
    if (typeof v === 'number') total += v
  }
  return total
}

export function discardHand(side: DeckSide) {
  side.discard.push(...side.hand)
  side.hand = []
}

/**
 * Start-of-turn upkeep for any fighter: block expires, Corrupt ticks.
 * Returns true if the fighter died to Corrupt.
 */
export function tickTurnStart(f: Fighter, who: string, evs: GameEvent[]): boolean {
  f.block = 0
  const corrupt = f.statuses.corrupt ?? 0
  if (corrupt > 0) {
    loseHp(f, corrupt, who, evs)
    if (corrupt - 1 <= 0) delete f.statuses.corrupt
    else f.statuses.corrupt = corrupt - 1
  }
  if (f.hp <= 0) return true
  const regen = f.statuses.regen ?? 0
  if (regen > 0) healHp(f, regen, who, evs)
  return false
}

/** End-of-turn upkeep: timed debuffs wind down, Ritual grows Strength. */
export function tickTurnEnd(f: Fighter, who: string, evs: GameEvent[]) {
  for (const id of ['weak', 'vuln'] as StatusId[]) {
    const v = f.statuses[id] ?? 0
    if (v > 0) {
      if (v - 1 <= 0) delete f.statuses[id]
      else f.statuses[id] = v - 1
    }
  }
  const ritual = f.statuses.ritual ?? 0
  if (ritual > 0) applyStatus(f, 'str', ritual, who, evs)
}

/**
 * End-of-turn triggers for a card-playing side: Glitch pain, Plating,
 * Auto-Turret, Viral Load. Foes list must be the *alive* foes.
 */
export function endTurnPowers(
  side: DeckSide,
  whoSelf: string,
  foes: { f: Fighter; who: string }[],
  env: PlayEnv,
  evs: GameEvent[],
) {
  for (const card of side.hand) {
    if (card.id === 'glitch') loseHp(side, 1, whoSelf, evs)
  }
  const plating = side.statuses.plating ?? 0
  if (plating > 0) gainBlock(side, plating, whoSelf, evs)
  const turret = side.statuses.turret ?? 0
  if (turret > 0 && foes.length > 0) {
    const target = foes[Math.floor(randInt(env.rng, 0, foes.length - 1))]
    plainDamage(target.f, turret, target.who, evs)
  }
  const viral = side.statuses.viral ?? 0
  if (viral > 0) {
    for (const foe of foes) applyStatus(foe.f, 'corrupt', viral, foe.who, evs)
  }
}

/** Start-of-turn refill for a card-playing side (after tickTurnStart). */
export function refillSide(
  side: DeckSide,
  env: PlayEnv,
  who: string,
  evs: GameEvent[],
  opts: { firstTurn?: boolean; bonusEnergy?: number; bonusDraw?: number } = {},
) {
  side.energy =
    side.energyMax +
    (side.statuses.energyGain ?? 0) +
    relicHook(env, 'energyPerTurn') +
    (opts.firstTurn ? relicHook(env, 'firstTurnEnergy') : 0) +
    (opts.bonusEnergy ?? 0)
  const n =
    BASE_DRAW +
    (side.statuses.drawGain ?? 0) +
    relicHook(env, 'drawPerTurn') +
    (opts.firstTurn ? relicHook(env, 'firstTurnDraw') : 0) +
    (opts.bonusDraw ?? 0)
  drawCards(side, n, env, who, evs)
}

function resolveEffect(
  eff: Effect,
  env: PlayEnv,
  side: DeckSide,
  whoSelf: string,
  foes: { f: Fighter; who: string }[],
  targetIdx: number,
  evs: GameEvent[],
) {
  const target = foes[targetIdx]
  const aliveFoes = () => foes.filter((x) => x.f.hp > 0)
  switch (eff.k) {
    case 'dmg': {
      for (let t = 0; t < (eff.times ?? 1); t++) {
        if (!target || target.f.hp <= 0) break
        attack(side, target.f, eff.n, whoSelf, target.who, evs)
      }
      break
    }
    case 'dmgAll': {
      for (let t = 0; t < (eff.times ?? 1); t++) {
        for (const foe of aliveFoes()) attack(side, foe.f, eff.n, whoSelf, foe.who, evs)
      }
      break
    }
    case 'dmgVulnBonus': {
      if (target && target.f.hp > 0) {
        const base = eff.n + ((target.f.statuses.vuln ?? 0) > 0 ? eff.bonus : 0)
        attack(side, target.f, base, whoSelf, target.who, evs)
      }
      break
    }
    case 'dmgPerPower': {
      if (target && target.f.hp > 0) {
        attack(side, target.f, eff.base + eff.per * side.powersPlayed, whoSelf, target.who, evs)
      }
      break
    }
    case 'blockAsDmg': {
      if (target && target.f.hp > 0) attack(side, target.f, side.block, whoSelf, target.who, evs)
      break
    }
    case 'block':
      gainBlock(side, eff.n, whoSelf, evs)
      break
    case 'draw':
      drawCards(side, eff.n, env, whoSelf, evs)
      break
    case 'energy':
      side.energy += eff.n
      break
    case 'heal':
      healHp(side, eff.n, whoSelf, evs)
      break
    case 'selfDmg':
      loseHp(side, eff.n, whoSelf, evs)
      break
    case 'cleanse': {
      for (const id of DEBUFFS) delete side.statuses[id]
      evs.push({ e: 'lifted', who: whoSelf })
      break
    }
    case 'status': {
      if (eff.to === 'self') applyStatus(side, eff.id, eff.n, whoSelf, evs)
      else if (eff.to === 'target') {
        if (target && target.f.hp > 0) applyStatus(target.f, eff.id, eff.n, target.who, evs)
      } else {
        for (const foe of aliveFoes()) applyStatus(foe.f, eff.id, eff.n, foe.who, evs)
      }
      break
    }
    case 'addCard': {
      for (let i = 0; i < eff.n; i++) {
        const card: CardInst = { uid: env.uid++, id: eff.id, up: false }
        if (eff.where === 'discard') side.discard.push(card)
        else side.draw.splice(randInt(env.rng, 0, side.draw.length), 0, card)
      }
      break
    }
  }
}

/**
 * Play a card from hand. Returns an error string (state untouched by
 * convention: callers validate on a clone) or null on success.
 */
export function playCardFromHand(
  env: PlayEnv,
  side: DeckSide,
  whoSelf: string,
  foes: { f: Fighter; who: string }[],
  handIdx: number,
  targetIdx: number | undefined,
  evs: GameEvent[],
): string | null {
  const card = side.hand[handIdx]
  if (!card) return 'no such card in hand'
  const def = CARDS[card.id]
  if (!def) return 'unknown card'
  if (def.unplayable) return 'card is unplayable'
  const free = !!env.firstCardFree
  const cost = free ? 0 : cardCost(card)
  if (side.energy < cost) return 'not enough energy'

  let target = targetIdx
  if (def.target === 'enemy') {
    const aliveIdxs = foes.map((x, i) => (x.f.hp > 0 ? i : -1)).filter((i) => i >= 0)
    if (target === undefined && aliveIdxs.length === 1) target = aliveIdxs[0]
    if (target === undefined || !foes[target] || foes[target].f.hp <= 0) return 'invalid target'
  }

  if (free) env.firstCardFree = false
  side.energy -= cost
  side.hand.splice(handIdx, 1)
  evs.push({ e: 'move', who: whoSelf, id: card.id, name: def.name })

  for (const eff of cardEffects(card)) {
    resolveEffect(eff, env, side, whoSelf, foes, target ?? 0, evs)
  }

  side.cardsPlayed++
  if (def.type === 'power') {
    side.powersPlayed++
    const bonus = relicHook(env, 'onPowerBlock')
    if (bonus) gainBlock(side, bonus, whoSelf, evs)
    side.exhausted.push(card)
  } else if (cardExhausts(card)) {
    side.exhausted.push(card)
  } else {
    side.discard.push(card)
  }
  return null
}

/** Build a fresh DeckSide from a deck list. */
export function makeSide(name: string, hp: number, maxHp: number, deck: CardInst[], rng: Rng): DeckSide {
  return {
    name,
    hp,
    maxHp,
    block: 0,
    statuses: {},
    energy: 0,
    energyMax: 3,
    hand: [],
    draw: shuffle(rng, deck),
    discard: [],
    exhausted: [],
    powersPlayed: 0,
    cardsPlayed: 0,
  }
}
