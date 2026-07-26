/**
 * PvP duel: two DeckSides trading turns, resolved by the exact same card
 * interpreter as PvE. Runs on the server (authoritative validation) and the
 * client renders the redacted views it gets back.
 */
import type { CardInst, DeckSide, GameEvent, PvpAction, PvpState, Statuses, StepResult } from './types'
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

export const PVP_HP = 72

/** Both duelists get the same fixed, fair deck. */
export const PVP_DECK: string[] = [
  'strike', 'strike', 'strike', 'strike',
  'defend', 'defend', 'defend', 'defend',
  'zeroday', 'twinlaser', 'spike', 'breaker', 'crash', 'killswitch',
  'firewall', 'encrypt', 'reboot', 'shortcircuit', 'debugprobe', 'malware',
  'holodecoy', 'cachehit', 'overvolt', 'neoncore', 'nanoplating',
]

export function newPvp(seed: number, names: [string, string]): PvpState {
  const rng = rngFromSeed(seed)
  let uid = 1
  const mkDeck = () => PVP_DECK.map((id): CardInst => ({ uid: uid++, id, up: false }))
  const sides: [DeckSide, DeckSide] = [
    makeSide(names[0], PVP_HP, PVP_HP, mkDeck(), rng),
    makeSide(names[1], PVP_HP, PVP_HP, mkDeck(), rng),
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
      ...(i === idx ? { hand: s.hand } : {}),
    }
  }
  return { you: idx, turn: ps.turn, active: ps.active, sides: [mk(0), mk(1)], over: ps.over }
}
