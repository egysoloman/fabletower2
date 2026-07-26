/**
 * Shared combat primitives + the card-effect interpreter.
 *
 * Everything here is pure data-in/data-out (given the rng inside the state),
 * and is the ONLY implementation of combat math in the project: the PvE
 * reducer (combat.ts), the PvP reducer (pvp.ts), the browser client and the
 * Node server all execute these exact functions.
 */
import { CARDS, cardCost, cardEffects, cardEthereal, cardExhausts, cardInnate, cardRetains } from './cards'
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
  attacker: { statuses: { str?: number; weak?: number; heat?: number; overdrive?: number } },
  defender: { statuses: { vuln?: number; overdrive?: number; stealth?: number } },
): number {
  let d = base + (attacker.statuses.str ?? 0) + (attacker.statuses.heat ?? 0)
  if (attacker.statuses.weak) d = Math.floor(d * 0.75)
  if (attacker.statuses.overdrive) d = Math.floor(d * 1.5)
  if (defender.statuses.vuln) d = Math.floor(d * 1.5)
  if (defender.statuses.overdrive) d = Math.floor(d * 1.5)
  if (defender.statuses.stealth) d = Math.floor(d * 0.5)
  return Math.max(0, d)
}

export const OVERHEAT_BASE = 8

export function overheatThreshold(f: Fighter): number {
  return OVERHEAT_BASE + (f.statuses.coolant ?? 0)
}

/**
 * VECTOR's risk mechanic: at the start of your turn, Heat at or past the
 * threshold burns you for its full value and resets — unless a Reactor
 * redirects the blast into every enemy. Returns true if the side died.
 */
export function applyOverheat(
  side: DeckSide,
  whoSelf: string,
  foes: { f: Fighter; who: string }[],
  evs: GameEvent[],
): boolean {
  const heat = side.statuses.heat ?? 0
  if (heat < overheatThreshold(side)) return false
  delete side.statuses.heat
  evs.push({ e: 'status', who: whoSelf, id: 'heat', n: -heat })
  if (side.statuses.reactor) {
    for (const foe of foes) {
      if (foe.f.hp > 0) plainDamage(foe.f, heat, foe.who, evs)
    }
  } else {
    loseHp(side, heat, whoSelf, evs)
  }
  return side.hp <= 0
}

export function applyStatus(f: Fighter, id: StatusId, n: number, who: string, evs: GameEvent[]) {
  // Artifact eats incoming debuffs, one application per charge.
  if (n > 0 && DEBUFFS.includes(id) && (f.statuses.artifact ?? 0) > 0) {
    const left = (f.statuses.artifact ?? 0) - 1
    if (left <= 0) delete f.statuses.artifact
    else f.statuses.artifact = left
    evs.push({ e: 'lifted', who })
    return
  }
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
      const str = relicHook(env, 'onShuffleStr')
      if (str) applyStatus(side, 'str', str, who, evs)
      const blk = relicHook(env, 'onShuffleBlock')
      if (blk) gainBlock(side, blk, who, evs)
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
  const kept: CardInst[] = []
  for (const card of side.hand) {
    if (cardRetains(card)) kept.push(card)
    else if (cardEthereal(card)) side.exhausted.push(card)
    else side.discard.push(card)
  }
  side.hand = kept
}

/**
 * Start-of-turn upkeep for any fighter: block expires, Corrupt ticks.
 * Returns true if the fighter died to Corrupt.
 */
export function tickTurnStart(f: Fighter, who: string, evs: GameEvent[], foeChronic = false): boolean {
  if (!f.statuses.barricade) f.block = 0
  const corrupt = f.statuses.corrupt ?? 0
  if (corrupt > 0) {
    loseHp(f, corrupt, who, evs)
    // Chronic (on the opposing side) stops Corrupt from wearing off.
    if (!foeChronic) {
      if (corrupt - 1 <= 0) delete f.statuses.corrupt
      else f.statuses.corrupt = corrupt - 1
    }
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
  const ignition = f.statuses.ignition ?? 0
  if (ignition > 0) applyStatus(f, 'heat', ignition, who, evs)
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
  // Focus amplifies each ACTIVE automation — it never triggers on its own.
  const focus = side.statuses.focus ?? 0
  const plating = side.statuses.plating ?? 0
  if (plating > 0) gainBlock(side, plating + focus, whoSelf, evs)
  const turret = side.statuses.turret ?? 0
  if (turret > 0 && foes.length > 0) {
    const target = foes[Math.floor(randInt(env.rng, 0, foes.length - 1))]
    plainDamage(target.f, turret + focus, target.who, evs)
  }
  const viral = side.statuses.viral ?? 0
  if (viral > 0) {
    for (const foe of foes) applyStatus(foe.f, 'corrupt', viral + focus, foe.who, evs)
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
  side.cardsThisTurn = 0
  side.energy =
    side.energyMax +
    (side.statuses.energyGain ?? 0) +
    relicHook(env, 'energyPerTurn') +
    (opts.firstTurn ? relicHook(env, 'firstTurnEnergy') : 0) +
    (opts.bonusEnergy ?? 0)
  let n =
    BASE_DRAW +
    (side.statuses.drawGain ?? 0) +
    relicHook(env, 'drawPerTurn') +
    (opts.firstTurn ? relicHook(env, 'firstTurnDraw') : 0) +
    (opts.bonusDraw ?? 0)
  if (opts.firstTurn) {
    // Innate cards jump the queue: pulled straight into the opening hand,
    // counting against (but never below zero of) the normal draw.
    const innate = side.draw.filter(cardInnate).slice(0, Math.max(0, HAND_LIMIT - side.hand.length))
    if (innate.length > 0) {
      side.draw = side.draw.filter((c) => !innate.includes(c))
      side.hand.push(...innate)
      n = Math.max(0, n - innate.length)
    }
  }
  drawCards(side, n, env, who, evs)
}

/** Block granted by a card effect: applies Kernel retaliation on top. */
function cardBlock(
  side: DeckSide,
  n: number,
  whoSelf: string,
  foes: { f: Fighter; who: string }[],
  env: PlayEnv,
  evs: GameEvent[],
) {
  if (n <= 0) return
  gainBlock(side, n + relicHook(env, 'cardBlockBonus'), whoSelf, evs)
  const kernel = side.statuses.kernel ?? 0
  const alive = foes.filter((x) => x.f.hp > 0)
  if (kernel > 0 && alive.length > 0) {
    const target = alive[randInt(env.rng, 0, alive.length - 1)]
    plainDamage(target.f, kernel, target.who, evs)
  }
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
    case 'dmgPerCorrupt': {
      if (target && target.f.hp > 0) {
        const base = eff.mult * (target.f.statuses.corrupt ?? 0)
        if (base > 0) attack(side, target.f, base, whoSelf, target.who, evs)
      }
      break
    }
    case 'dmgIfCombo': {
      if (target && target.f.hp > 0) {
        // cardsThisTurn was incremented for THIS card before effects resolve,
        // so "played 3+ cards this turn" means a count of at least threshold+1.
        const combo = side.cardsThisTurn > eff.threshold
        attack(side, target.f, combo ? eff.n + eff.bonus : eff.n, whoSelf, target.who, evs)
      }
      break
    }
    case 'block':
      cardBlock(side, eff.n, whoSelf, foes, env, evs)
      break
    case 'doubleBlock':
      cardBlock(side, side.block, whoSelf, foes, env, evs)
      break
    case 'doubleCorrupt': {
      if (target && target.f.hp > 0) {
        const cur = target.f.statuses.corrupt ?? 0
        if (cur > 0) applyStatus(target.f, 'corrupt', cur, target.who, evs)
      }
      break
    }
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
      // Plague Router: your Corrupt applications land harder.
      const n = eff.id === 'corrupt' && eff.to !== 'self' ? eff.n + relicHook(env, 'corruptBonus') : eff.n
      if (eff.to === 'self') applyStatus(side, eff.id, n, whoSelf, evs)
      else if (eff.to === 'target') {
        if (target && target.f.hp > 0) applyStatus(target.f, eff.id, n, target.who, evs)
      } else {
        for (const foe of aliveFoes()) applyStatus(foe.f, eff.id, n, foe.who, evs)
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
    case 'heatCool': {
      const cur = side.statuses.heat ?? 0
      const cooled = Math.min(cur, eff.n)
      if (cooled > 0) applyStatus(side, 'heat', -cooled, whoSelf, evs)
      break
    }
    case 'ventDmg': {
      const heat = side.statuses.heat ?? 0
      if (target && target.f.hp > 0 && heat > 0) {
        delete side.statuses.heat // vent BEFORE the hit so heat isn't double-counted
        attack(side, target.f, heat * eff.mult, whoSelf, target.who, evs)
        evs.push({ e: 'status', who: whoSelf, id: 'heat', n: -heat })
      }
      break
    }
    case 'ventDmgAll': {
      const heat = side.statuses.heat ?? 0
      if (heat > 0) {
        delete side.statuses.heat
        for (const foe of aliveFoes()) attack(side, foe.f, heat * eff.mult, whoSelf, foe.who, evs)
        evs.push({ e: 'status', who: whoSelf, id: 'heat', n: -heat })
      }
      break
    }
    case 'ventBlock': {
      const heat = side.statuses.heat ?? 0
      if (heat > 0) {
        delete side.statuses.heat
        cardBlock(side, heat * eff.mult, whoSelf, foes, env, evs)
        evs.push({ e: 'status', who: whoSelf, id: 'heat', n: -heat })
      }
      break
    }
    case 'dmgHeatBonus': {
      if (target && target.f.hp > 0) {
        const hot = (side.statuses.heat ?? 0) >= eff.threshold
        attack(side, target.f, hot ? eff.n + eff.bonus : eff.n, whoSelf, target.who, evs)
      }
      break
    }
    case 'enterStance': {
      const from: 'overdrive' | 'stealth' | 'none' = side.statuses.overdrive
        ? 'overdrive'
        : side.statuses.stealth
          ? 'stealth'
          : 'none'
      if (from === eff.id) break // already there: no triggers, no exit bonus
      delete side.statuses.overdrive
      delete side.statuses.stealth
      if (from === 'stealth') {
        // Decloaking releases stored charge.
        side.energy += 2
        evs.push({ e: 'status', who: whoSelf, id: 'energyGain', n: 2 })
      }
      if (from !== 'none') evs.push({ e: 'status', who: whoSelf, id: from, n: -1 })
      if (eff.id !== 'none') {
        applyStatus(side, eff.id, 1, whoSelf, evs)
        // Entering a stance fires stance-trigger powers.
        const wall = side.statuses.stancewall ?? 0
        if (wall > 0) cardBlock(side, wall, whoSelf, foes, env, evs)
        const tempo = side.statuses.tempoloop ?? 0
        if (tempo > 0) drawCards(side, tempo, env, whoSelf, evs)
        const mom = side.statuses.momentum ?? 0
        if (mom > 0 && eff.id === 'overdrive') applyStatus(side, 'str', mom, whoSelf, evs)
      }
      break
    }
    case 'dmgIfStance': {
      if (target && target.f.hp > 0) {
        const inStance = !!(side.statuses.overdrive || side.statuses.stealth)
        attack(side, target.f, inStance ? eff.n + eff.bonus : eff.n, whoSelf, target.who, evs)
      }
      break
    }
    case 'dmgPerAuto': {
      if (target && target.f.hp > 0) {
        const autos =
          (side.statuses.turret ?? 0) + (side.statuses.plating ?? 0) + (side.statuses.viral ?? 0)
        attack(side, target.f, eff.base + eff.per * autos, whoSelf, target.who, evs)
      }
      break
    }
  }
}

/** Run a bare effect list (potions, scripted rewards) through the interpreter. */
export function applyEffects(
  env: PlayEnv,
  side: DeckSide,
  whoSelf: string,
  foes: { f: Fighter; who: string }[],
  targetIdx: number,
  effects: Effect[],
  evs: GameEvent[],
) {
  for (const eff of effects) resolveEffect(eff, env, side, whoSelf, foes, targetIdx, evs)
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
  const baseCost = Math.max(
    0,
    cardCost(card) - (def.type === 'power' ? relicHook(env, 'powerDiscount') : 0),
  )
  const cost = free ? 0 : baseCost
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
  side.cardsPlayed++
  side.cardsThisTurn++
  evs.push({ e: 'move', who: whoSelf, id: card.id, name: def.name })

  for (const eff of cardEffects(card)) {
    resolveEffect(eff, env, side, whoSelf, foes, target ?? 0, evs)
  }

  // Tempo payoffs for genuinely-0-cost cards (their printed cost, not Quantum
  // Chip freebies): Hyperthread draws, Static Field shields.
  if (cardCost(card) === 0) {
    const hyper = side.statuses.hyper ?? 0
    if (hyper > 0) drawCards(side, hyper, env, whoSelf, evs)
    const shield = relicHook(env, 'zeroCostBlock')
    if (shield > 0) cardBlock(side, shield, whoSelf, foes, env, evs)
  }
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
    cardsThisTurn: 0,
  }
}
