/**
 * Co-op combat: 2-4 players fight the SAME enemies with independent decks,
 * energy, relics and HP. Players take turns in party order, then the enemy
 * phase hits random living party members. Enemy stats scale with party
 * size. Runs on the server (authoritative) and solo-tested in the engine
 * suite; there is no hidden information in co-op, so views are the state.
 */
import type { CardInst, CombatState, DeckSide, EnemyC, GameEvent, MoveEffect, StepResult } from './types'
import { DEBUFFS } from './types'
import { CARDS } from './cards'
import { POTIONS } from './potions'
import { ENEMIES, ascAtk, chooseMove, intentFor } from './enemies'
import { RELICS } from './relics'
import {
  applyEffects,
  applyOverheat,
  applyStatus,
  attack,
  discardHand,
  endTurnPowers,
  gainBlock,
  healHp,
  makeSide,
  modifiedDamage,
  playCardFromHand,
  refillSide,
  tickTurnEnd,
  tickTurnStart,
} from './core'
import { randInt, rngFromSeed, type Rng } from './rng'
import { MAX_MINIONS, MINIONS } from './minions'

export const MAX_PARTY = 4

/** Party-size scaling for shared enemies (n=1 → 1.0/1.0). */
export function coopScale(n: number): { hp: number; atk: number } {
  return { hp: 1 + 0.55 * (n - 1), atk: 1 + 0.15 * (n - 1) }
}

export interface CoopPlayerOpts {
  name: string
  hp: number
  maxHp: number
  deck: CardInst[]
  relics: string[]
}

export interface CoopState {
  rng: Rng
  turn: number
  uid: number
  encounterId: string
  partySize: number
  asc: number
  players: DeckSide[]
  /** Per-player relic lists; `relics` mirrors the acting player's for hooks. */
  playerRelics: string[][]
  relics: string[]
  downed: boolean[]
  enemies: EnemyC[]
  active: number
  over: 'win' | 'lose' | null
  firstCardFree?: boolean
}

export type CoopAction = { t: 'play'; hand: number; target?: number; ally?: number } | { t: 'end' }

const whoP = (i: number) => 'c' + i

function aliveIdxs(cs: CoopState): number[] {
  return cs.players.map((_, i) => i).filter((i) => !cs.downed[i])
}

function foesOf(cs: CoopState) {
  return cs.enemies.map((e, i) => ({ f: e, who: 'e' + i }))
}

/** Shim so the solo enemy AI can aim at one representative party member. */
function aiView(cs: CoopState, playerIdx: number): CombatState {
  return { ...cs, player: cs.players[playerIdx] } as unknown as CombatState
}

export function startCoopCombat(opts: {
  players: CoopPlayerOpts[]
  enemyIds: string[]
  encounterId: string
  seed: number
  uidStart: number
  asc?: number
  kind?: 'normal' | 'elite' | 'boss'
}): CoopState {
  const rng = rngFromSeed(opts.seed)
  const n = Math.max(1, Math.min(MAX_PARTY, opts.players.length))
  const scale = coopScale(n)
  const asc = opts.asc ?? 0

  const players = opts.players.map((p) => makeSide(p.name, p.hp, p.maxHp, p.deck.map((c) => ({ ...c })), rng))
  const playerRelics = opts.players.map((p) => [...p.relics])
  // Per-player relic starts (block/statuses); enemy starts sum over the party.
  const enemyStart: Record<string, number> = {}
  players.forEach((side, i) => {
    for (const rid of playerRelics[i]) {
      const own = RELICS[rid]?.hooks.combatStatuses
      if (own) {
        for (const [k, v] of Object.entries(own)) {
          side.statuses[k as keyof typeof side.statuses] =
            (side.statuses[k as keyof typeof side.statuses] ?? 0) + (v ?? 0)
        }
      }
      const blk = RELICS[rid]?.hooks.combatStartBlock
      if (blk) side.block += blk
      const sm = RELICS[rid]?.hooks.startMinion
      if (sm) {
        const mdef = MINIONS[sm]
        if (mdef && side.minions.length < MAX_MINIONS) {
          side.minions.push({ defId: mdef.id, hp: mdef.hp, maxHp: mdef.hp })
        }
      }
      const st = RELICS[rid]?.hooks.combatStartEnemyStatuses
      if (st) for (const [k, v] of Object.entries(st)) enemyStart[k] = (enemyStart[k] ?? 0) + (v ?? 0)
    }
  })

  const enemies: EnemyC[] = opts.enemyIds.map((id) => {
    const def = ENEMIES[id]
    let hp = Math.round(randInt(rng, def.hp[0], def.hp[1]) * (1 + 0.08 * asc) * scale.hp)
    if (asc >= 13 && def.boss) hp = Math.round(hp * 1.15)
    const statuses = { ...(def.traits ?? {}) }
    for (const [k, v] of Object.entries(enemyStart)) {
      statuses[k as keyof typeof statuses] = (statuses[k as keyof typeof statuses] ?? 0) + v
    }
    return {
      defId: id, name: def.name, glyph: def.glyph, hp, maxHp: hp, block: 0,
      statuses, intent: null, lastMoves: [], usedOn: {}, dead: false,
    }
  })

  const cs: CoopState = {
    rng, turn: 1, uid: opts.uidStart, encounterId: opts.encounterId,
    partySize: n, asc, players, playerRelics, relics: playerRelics[0],
    downed: players.map(() => false), enemies, active: 0, over: null,
  }
  rollIntents(cs)
  const evs: GameEvent[] = []
  // Turns are sequential: only the opening player draws now — everyone else
  // draws when their own turn arrives (startPlayerTurn), never both.
  cs.relics = playerRelics[0]
  refillSide(players[0], cs, whoP(0), evs, { firstTurn: true })
  return cs
}

function rollIntents(cs: CoopState) {
  const alive = aliveIdxs(cs)
  if (alive.length === 0) return
  for (const e of cs.enemies) {
    if (e.dead) continue
    // Each enemy sizes up one random living party member.
    const focus = alive[randInt(cs.rng, 0, alive.length - 1)]
    const move = chooseMove(e, aiView(cs, focus), cs.rng)
    e.intent = intentFor(move, e, cs.players[focus], cs.asc)
    ;(e as any).focus = focus
  }
}

function coopMarkDeaths(cs: CoopState, evs: GameEvent[]) {
  cs.enemies.forEach((e, i) => {
    if (!e.dead && e.hp <= 0) {
      e.dead = true
      e.hp = 0
      e.intent = null
      evs.push({ e: 'die', who: 'e' + i })
    }
  })
  cs.players.forEach((p, i) => {
    if (!cs.downed[i] && p.hp <= 0) {
      p.hp = 0
      cs.downed[i] = true
      evs.push({ e: 'die', who: whoP(i) })
    }
  })
  if (cs.enemies.every((e) => e.dead)) {
    cs.over = 'win'
    // Fallen party members are revived by the survivors after the fight.
    cs.players.forEach((p, i) => {
      if (cs.downed[i]) {
        cs.downed[i] = false
        p.hp = Math.max(1, Math.floor(p.maxHp * 0.3))
        evs.push({ e: 'heal', who: whoP(i), n: p.hp })
      }
    })
  } else if (cs.players.every((_, i) => cs.downed[i])) {
    cs.over = 'lose'
  }
}

function enemyPhase(cs: CoopState, evs: GameEvent[]) {
  for (let i = 0; i < cs.enemies.length; i++) {
    const e = cs.enemies[i]
    if (e.dead || cs.over) continue
    const def = ENEMIES[e.defId]
    const move = def.moves.find((m) => m.id === e.intent?.moveId)
    if (!move) continue
    const alive = aliveIdxs(cs)
    if (alive.length === 0) break
    const focus = alive.includes((e as any).focus) ? ((e as any).focus as number) : alive[randInt(cs.rng, 0, alive.length - 1)]
    const target = cs.players[focus]
    const whoT = whoP(focus)
    const who = 'e' + i
    evs.push({ e: 'move', who, id: move.id, name: move.name })
    for (const eff of move.effects as MoveEffect[]) {
      switch (eff.k) {
        case 'atk': {
          for (let t = 0; t < (eff.times ?? 1); t++) {
            if (target.hp <= 0) break
            attack(e, target, Math.round(ascAtk(eff.n, cs.asc) * coopScale(cs.partySize).atk), who, whoT, evs)
          }
          break
        }
        case 'block':
          gainBlock(e, eff.n, who, evs)
          break
        case 'buff':
          applyStatus(e, eff.id, eff.n, who, evs)
          break
        case 'buffAll':
          cs.enemies.forEach((ally, ai) => {
            if (!ally.dead) applyStatus(ally, eff.id, eff.n, 'e' + ai, evs)
          })
          break
        case 'debuff':
          applyStatus(target, eff.id, eff.n, whoT, evs)
          break
        case 'heal':
          healHp(e, eff.n, who, evs)
          break
        case 'addCard': {
          for (let k = 0; k < eff.n; k++) target.discard.push({ uid: cs.uid++, id: eff.id, up: false })
          evs.push({ e: 'addcard', who: whoT, n: eff.n, name: CARDS[eff.id].name })
          break
        }
        case 'summon': {
          for (let s = 0; s < (eff.n ?? 1); s++) {
            const aliveE = cs.enemies.filter((x) => !x.dead).length
            if (aliveE >= 5 || cs.enemies.length >= 8) break
            const def2 = ENEMIES[eff.id]
            if (!def2) break
            const hp = Math.round(randInt(cs.rng, def2.hp[0], def2.hp[1]) * (1 + 0.08 * cs.asc) * coopScale(cs.partySize).hp)
            cs.enemies.push({
              defId: eff.id, name: def2.name, glyph: def2.glyph, hp, maxHp: hp, block: 0,
              statuses: { ...(def2.traits ?? {}) }, intent: null, lastMoves: [], usedOn: {}, dead: false,
            })
            evs.push({ e: 'summon', who: 'e' + (cs.enemies.length - 1), name: def2.name })
          }
          break
        }
        case 'cleanseSelf': {
          for (const d of DEBUFFS) delete e.statuses[d]
          evs.push({ e: 'lifted', who })
          break
        }
      }
      coopMarkDeaths(cs, evs)
      if (cs.over) return
    }
    e.usedOn[move.id] = cs.turn
    e.lastMoves.push(move.id)
    if (e.lastMoves.length > 4) e.lastMoves.shift()
  }
}

export function coopReduce(prev: CoopState, playerIdx: number, action: CoopAction): StepResult<CoopState> {
  if (prev.over) return { state: prev, events: [], error: 'combat is over' }
  if (playerIdx !== prev.active) return { state: prev, events: [], error: 'not your turn' }
  if (prev.downed[playerIdx]) return { state: prev, events: [], error: 'you are down' }

  const cs: CoopState = structuredClone(prev)
  const evs: GameEvent[] = []
  const me = cs.players[playerIdx]
  const who = whoP(playerIdx)
  cs.relics = cs.playerRelics[playerIdx]

  if (action.t === 'play') {
    const card = me.hand[action.hand]
    const def = card ? CARDS[card.id] : undefined
    const ally =
      def?.target === 'ally' && action.ally !== undefined && cs.players[action.ally] && !cs.downed[action.ally]
        ? { side: cs.players[action.ally], who: whoP(action.ally) }
        : undefined
    const err = playCardFromHand(cs, me, who, foesOf(cs), action.hand, action.target, evs, ally)
    if (err) return { state: prev, events: [], error: err }
    coopMarkDeaths(cs, evs)
    return { state: cs, events: evs }
  }

  // --- End of this player's turn --------------------------------------------
  const aliveFoes = () => foesOf(cs).filter((x) => !(x.f as EnemyC).dead && x.f.hp > 0)
  endTurnPowers(me, who, aliveFoes(), cs, evs)
  coopMarkDeaths(cs, evs)
  tickTurnEnd(me, who, evs)
  discardHand(me)

  if (!cs.over) {
    // Pass to the next living player, or run the enemy phase.
    const order = aliveIdxs(cs)
    const later = order.filter((i) => i > playerIdx)
    if (later.length > 0) {
      cs.active = later[0]
      startPlayerTurn(cs, cs.active, evs)
    } else {
      enemyPhase(cs, evs)
      if (!cs.over) {
        rollIntents(cs)
        cs.turn++
        const first = aliveIdxs(cs)[0]
        cs.active = first
        startPlayerTurn(cs, first, evs)
      }
    }
  }
  return { state: cs, events: evs }
}

function startPlayerTurn(cs: CoopState, idx: number, evs: GameEvent[]) {
  const side = cs.players[idx]
  const who = whoP(idx)
  cs.relics = cs.playerRelics[idx]
  if (tickTurnStart(side, who, evs, false)) {
    coopMarkDeaths(cs, evs)
    if (cs.over || cs.downed[idx]) {
      const next = aliveIdxs(cs).find((i) => i > idx)
      if (next !== undefined && !cs.over) {
        cs.active = next
        startPlayerTurn(cs, next, evs)
      }
      return
    }
  }
  const died = applyOverheat(side, who, foesOf(cs).filter((x) => x.f.hp > 0), evs)
  coopMarkDeaths(cs, evs)
  // A player's first-ever turn still counts as "first turn" for relic hooks.
  if (!died && !cs.over) refillSide(side, cs, who, evs, { firstTurn: cs.turn === 1 })
}

// --- Strict/hybrid support ---------------------------------------------------

/**
 * Divergence checksum over the shared combat fields (co-op twin of
 * pvpChecksum). The client sends it with each action in hybrid mode; the
 * server compares against the authoritative pre-action state and flags a
 * correction on mismatch.
 */
export function coopChecksum(v: {
  turn: number
  active: number
  players: { hp: number; block: number; energy: number }[]
  enemies: { hp: number; block: number; dead?: boolean }[]
}): number {
  let h = 2166136261
  const mix = (n: number) => {
    h ^= n + 0x9e3779b9
    h = Math.imul(h, 16777619) >>> 0
  }
  mix(v.turn)
  mix(v.active)
  for (const p of v.players) {
    mix(p.hp)
    mix(p.block)
    mix(p.energy)
  }
  for (const e of v.enemies) {
    mix(e.hp)
    mix(e.block)
    mix(e.dead ? 1 : 0)
  }
  return h >>> 0
}

/**
 * Optimistic local prediction for hybrid co-op: applies the deterministic
 * parts of playing your own card to the shared view (cost, damage vs the
 * chosen enemy, own block/heal/statuses). RNG effects, ally-targeted cards
 * and enemy deaths are left to the authoritative reply.
 */
export function predictCoopPlay(
  view: Omit<CoopState, 'rng'>,
  you: number,
  handIdx: number,
  target?: number,
): { view: Omit<CoopState, 'rng'>; events: GameEvent[] } | null {
  if (view.over || view.active !== you || view.downed[you]) return null
  const me = view.players[you]
  const card = me?.hand[handIdx]
  if (!card) return null
  const def = CARDS[card.id]
  if (!def || def.unplayable || def.target === 'ally') return null
  const cost = card.up && def.upCost !== undefined ? def.upCost : def.cost
  if (me.energy < cost) return null
  const alive = view.enemies.map((e, i) => (e.dead ? -1 : i)).filter((i) => i >= 0)
  let t = target
  if (def.target === 'enemy') {
    if (t === undefined && alive.length === 1) t = alive[0]
    if (t === undefined || !view.enemies[t] || view.enemies[t].dead) return null
  }
  const v = structuredClone(view)
  const m = v.players[you]
  const whoMe = 'c' + you
  const evs: GameEvent[] = []
  m.energy -= cost
  m.hand.splice(handIdx, 1)
  const effects = card.up ? def.upEffects : def.effects
  for (const eff of effects) {
    switch (eff.k) {
      case 'dmg': {
        const foe = v.enemies[t!]
        for (let i = 0; i < (eff.times ?? 1); i++) {
          const dmg = modifiedDamage(eff.n, m as never, foe as never)
          const absorbed = Math.min(foe.block, dmg)
          foe.block -= absorbed
          const through = dmg - absorbed
          if (absorbed > 0 && through <= 0) evs.push({ e: 'blocked', who: 'e' + t, n: absorbed })
          if (through > 0) {
            // never predict a kill — the server owns deaths and rewards
            foe.hp = Math.max(1, foe.hp - through)
            evs.push({ e: 'hit', who: 'e' + t, n: through })
          }
        }
        break
      }
      case 'block':
        m.block += eff.n
        evs.push({ e: 'block', who: whoMe, n: eff.n })
        break
      case 'selfDmg':
        m.hp = Math.max(1, m.hp - eff.n)
        evs.push({ e: 'hit', who: whoMe, n: eff.n })
        break
      case 'heal':
        m.hp = Math.min(m.maxHp, m.hp + eff.n)
        evs.push({ e: 'heal', who: whoMe, n: eff.n })
        break
      case 'status': {
        if (eff.to === 'self') {
          m.statuses = { ...m.statuses, [eff.id]: (m.statuses[eff.id] ?? 0) + eff.n }
          evs.push({ e: 'status', who: whoMe, id: eff.id, n: eff.n })
        } else if (t !== undefined && v.enemies[t]) {
          const foe = v.enemies[t]
          foe.statuses = { ...foe.statuses, [eff.id]: (foe.statuses[eff.id] ?? 0) + eff.n }
          evs.push({ e: 'status', who: 'e' + t, id: eff.id, n: eff.n })
        }
        break
      }
      default:
        // RNG or hidden-info effect — the authoritative reply fills it in
        break
    }
  }
  return { view: v, events: evs }
}

/** Everyone sees everything in co-op; the view is the state minus the RNG guts. */
export function coopViewFor(cs: CoopState): Omit<CoopState, 'rng'> & { rng?: undefined } {
  const { rng: _rng, ...rest } = cs
  return rest as Omit<CoopState, 'rng'> & { rng?: undefined }
}


/** Drink a potion mid-fight: same interpreter as cards and solo potions. */
export function coopUsePotion(
  prev: CoopState,
  playerIdx: number,
  potionId: string,
  target?: number,
): StepResult<CoopState> {
  const def = POTIONS[potionId]
  if (!def) return { state: prev, events: [], error: 'unknown potion' }
  if (prev.over) return { state: prev, events: [], error: 'combat is over' }
  if (prev.downed[playerIdx]) return { state: prev, events: [], error: 'you are down' }
  const cs: CoopState = structuredClone(prev)
  const evs: GameEvent[] = []
  cs.relics = cs.playerRelics[playerIdx]
  let t = target
  if (def.target === 'enemy') {
    const alive = cs.enemies.map((e, i) => (e.dead ? -1 : i)).filter((i) => i >= 0)
    if (t === undefined && alive.length === 1) t = alive[0]
    if (t === undefined || !cs.enemies[t] || cs.enemies[t].dead) {
      return { state: prev, events: [], error: 'invalid target' }
    }
  }
  applyEffects(cs, cs.players[playerIdx], 'c' + playerIdx, foesOf(cs), t ?? 0, def.effects, evs)
  coopMarkDeaths(cs, evs)
  return { state: cs, events: evs }
}
