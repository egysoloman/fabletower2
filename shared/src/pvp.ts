/**
 * PvP duel: two DeckSides trading turns, resolved by the exact same card
 * interpreter as PvE. Runs on the server (authoritative validation) and the
 * client renders the redacted views it gets back.
 */
import type { CardInst, DeckSide, GameEvent, MinionC, PvpAction, PvpState, Statuses, StepResult } from './types'
import {
  applyOverheat,
  discardHand,
  endTurnPowers,
  makeSide,
  playCardFromHand,
  refillSide,
  tickTurnEnd,
  tickTurnStart,
} from './core'
import { rngFromSeed } from './rng'
import { CARDS } from './cards'
import { modifiedDamage } from './core'

export const PVP_HP = 72

/** Both duelists get the same fixed, fair deck. */
export const PVP_DECK: string[] = [
  'strike', 'strike', 'strike', 'strike',
  'defend', 'defend', 'defend', 'defend',
  'zeroday', 'twinlaser', 'spike', 'breaker', 'crash', 'killswitch',
  'firewall', 'encrypt', 'reboot', 'shortcircuit', 'debugprobe', 'malware',
  'holodecoy', 'cachehit', 'overvolt', 'neoncore', 'nanoplating',
  // powers & tech so duels play the full game, not a trimmed one
  'thornsexe', 'autoturret', 'viralload', 'datasiphon', 'riotshield',
]

export interface PvpDuelistOpts {
  /** Custom deck (climb-race duels use the players' real run decks). */
  deck?: { id: string; up: boolean }[]
  hp?: number
}

export function newPvp(seed: number, names: [string, string], custom?: [PvpDuelistOpts, PvpDuelistOpts]): PvpState {
  const rng = rngFromSeed(seed)
  let uid = 1
  const mkDeck = (i: 0 | 1) => {
    const list = custom?.[i]?.deck
    if (list && list.length > 0) return list.map((c): CardInst => ({ uid: uid++, id: c.id, up: !!c.up }))
    return PVP_DECK.map((id): CardInst => ({ uid: uid++, id, up: false }))
  }
  const hpOf = (i: 0 | 1) => Math.max(1, Math.floor(custom?.[i]?.hp ?? PVP_HP))
  const sides: [DeckSide, DeckSide] = [
    makeSide(names[0], hpOf(0), hpOf(0), mkDeck(0), rng),
    makeSide(names[1], hpOf(1), hpOf(1), mkDeck(1), rng),
  ]
  const ps: PvpState = { rng, turn: 1, active: 0, sides, over: null, uid }
  const evs: GameEvent[] = []
  refillSide(sides[0], ps, 'p0', evs, { firstTurn: true })
  return ps
}

function checkDeaths(ps: PvpState, evs: GameEvent[]) {
  for (const i of [0, 1] as const) {
    if (ps.sides[i].hp <= 0 && !ps.over) {
      ps.sides[i].hp = 0
      evs.push({ e: 'die', who: 'p' + i })
      ps.over = { winner: (1 - i) as 0 | 1, reason: `${ps.sides[i].name} flatlined` }
    }
  }
}

export function pvpReduce(prev: PvpState, playerIdx: 0 | 1, action: PvpAction): StepResult<PvpState> {
  if (prev.over) return { state: prev, events: [], error: 'duel is over' }
  if (playerIdx !== prev.active) return { state: prev, events: [], error: 'not your turn' }

  const ps: PvpState = structuredClone(prev)
  const evs: GameEvent[] = []
  const me = ps.sides[ps.active]
  const foe = ps.sides[1 - ps.active]
  const whoMe = 'p' + ps.active
  const foes = [{ f: foe, who: 'p' + (1 - ps.active) }]

  if (action.t === 'play') {
    const err = playCardFromHand(ps, me, whoMe, foes, action.hand, 0, evs)
    if (err) return { state: prev, events: [], error: err }
    checkDeaths(ps, evs)
    return { state: ps, events: evs }
  }

  // --- End turn: my wrap-up, then opponent wakes up -------------------------
  endTurnPowers(me, whoMe, foe.hp > 0 ? foes : [], ps, evs)
  checkDeaths(ps, evs)
  tickTurnEnd(me, whoMe, evs)
  discardHand(me)

  if (!ps.over) {
    ps.active = (1 - ps.active) as 0 | 1
    ps.turn++
    const next = ps.sides[ps.active]
    const whoNext = 'p' + ps.active
    if (tickTurnStart(next, whoNext, evs, !!me.statuses.chronic)) {
      checkDeaths(ps, evs)
    } else {
      const nextFoe = ps.sides[(1 - ps.active) as 0 | 1]
      const died = applyOverheat(
        next,
        whoNext,
        nextFoe.hp > 0 ? [{ f: nextFoe, who: 'p' + (1 - ps.active) }] : [],
        evs,
      )
      checkDeaths(ps, evs)
      // Going second is a tempo loss; the classic +1 energy makes up for it.
      if (!died && !ps.over)
        refillSide(next, ps, whoNext, evs, {
          bonusEnergy: ps.turn === 2 ? 1 : 0,
          // p1's very first refill is turn 2 — Innate applies there too.
          firstTurn: ps.turn === 2,
        })
    }
  }

  return { state: ps, events: evs }
}

// --- Redacted per-player views ---------------------------------------------

export interface PvpSideView {
  name: string
  hp: number
  maxHp: number
  block: number
  statuses: Statuses
  energy: number
  energyMax: number
  handCount: number
  drawCount: number
  discard: CardInst[]
  exhausted: CardInst[]
  powersPlayed: number
  /** Summoned allies are public information. */
  minions: MinionC[]
  /** Present only on your own side. */
  hand?: CardInst[]
}

export interface PvpView {
  you: 0 | 1
  turn: number
  active: 0 | 1
  sides: [PvpSideView, PvpSideView]
  over: PvpState['over']
}

/** What player `idx` is allowed to see: opponent hand and draw order hidden. */
export function viewFor(ps: PvpState, idx: 0 | 1): PvpView {
  const mk = (i: 0 | 1): PvpSideView => {
    const s = ps.sides[i]
    return {
      name: s.name,
      hp: s.hp,
      maxHp: s.maxHp,
      block: s.block,
      statuses: s.statuses,
      energy: s.energy,
      energyMax: s.energyMax,
      handCount: s.hand.length,
      drawCount: s.draw.length,
      discard: s.discard,
      exhausted: s.exhausted,
      powersPlayed: s.powersPlayed,
      minions: s.minions,
      ...(i === idx ? { hand: s.hand } : {}),
    }
  }
  return { you: idx, turn: ps.turn, active: ps.active, sides: [mk(0), mk(1)], over: ps.over }
}

// --- Strict/hybrid support ---------------------------------------------------

export type MpMode = 'strict' | 'hybrid'

/**
 * Cheap divergence checksum over the fields both sides can see. The client
 * sends it with each action; the server compares against the authoritative
 * pre-action state and flags a correction when they disagree (latency ghosts
 * or tampering — either way the full server view snaps the client back).
 */
export function pvpChecksum(v: {
  turn: number
  active: number
  sides: { hp: number; block: number; energy: number }[]
}): number {
  let h = 2166136261
  const mix = (n: number) => {
    h ^= n + 0x9e3779b9
    h = Math.imul(h, 16777619) >>> 0
  }
  mix(v.turn)
  mix(v.active)
  for (const s of v.sides) {
    mix(s.hp)
    mix(s.block)
    mix(s.energy)
  }
  return h >>> 0
}

/**
 * Optimistic local prediction for hybrid mode: applies the deterministic
 * parts of playing a card to a REDACTED view (cost, damage vs the visible
 * foe, own block/statuses). RNG-dependent effects (draws, shuffles,
 * summons) are left to the authoritative reply — the server view snaps in
 * right behind the animation.
 */
export function predictPvpPlay(view: PvpView, handIdx: number): { view: PvpView; events: GameEvent[] } | null {
  const me = view.sides[view.you]
  const card = me.hand?.[handIdx]
  if (!card) return null
  const def = CARDS[card.id]
  if (!def || def.unplayable) return null
  const cost = card.up && def.upCost !== undefined ? def.upCost : def.cost
  if (me.energy < cost) return null
  const v: PvpView = structuredClone(view)
  const m = v.sides[v.you]
  const f = v.sides[1 - v.you]
  const evs: GameEvent[] = []
  const whoMe = 'p' + v.you
  const whoFoe = 'p' + (1 - v.you)
  m.energy -= cost
  m.hand!.splice(handIdx, 1)
  m.handCount--
  const effects = card.up ? def.upEffects : def.effects
  for (const eff of effects) {
    switch (eff.k) {
      case 'dmg':
      case 'dmgAll': {
        for (let t = 0; t < (eff.times ?? 1); t++) {
          const dmg = modifiedDamage(eff.n, m as never, f as never)
          const absorbed = Math.min(f.block, dmg)
          f.block -= absorbed
          const through = dmg - absorbed
          if (absorbed > 0 && through <= 0) evs.push({ e: 'blocked', who: whoFoe, n: absorbed })
          if (through > 0) {
            f.hp = Math.max(0, f.hp - through)
            evs.push({ e: 'hit', who: whoFoe, n: through })
          }
        }
        break
      }
      case 'block':
        m.block += eff.n
        evs.push({ e: 'block', who: whoMe, n: eff.n })
        break
      case 'selfDmg':
        m.hp = Math.max(0, m.hp - eff.n)
        evs.push({ e: 'hit', who: whoMe, n: eff.n })
        break
      case 'status': {
        const target = eff.to === 'self' ? m : f
        const who = eff.to === 'self' ? whoMe : whoFoe
        target.statuses = { ...target.statuses, [eff.id]: (target.statuses[eff.id] ?? 0) + eff.n }
        evs.push({ e: 'status', who, id: eff.id, n: eff.n })
        break
      }
      case 'heal':
        m.hp = Math.min(m.maxHp, m.hp + eff.n)
        evs.push({ e: 'heal', who: whoMe, n: eff.n })
        break
      default:
        // RNG or hidden-info effect — leave for the authoritative reply
        break
    }
  }
  return { view: v, events: evs }
}
