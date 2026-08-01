/** PvE combat: player vs AI-driven enemies. Thin reducer over core.ts. */
import type {
  CardInst,
  CharId,
  CombatAction,
  CombatState,
  EnemyC,
  GameEvent,
  MoveEffect,
  StepResult,
} from './types'
import { DEBUFFS } from './types'
import { CARDS, cardCost } from './cards'
import { ENEMIES, MAX_ALIVE_ENEMIES, actEnemyScale, ascAtk, chooseMove, intentFor } from './enemies'
import { POTIONS } from './potions'
import { RELICS } from './relics'
import { ascensionEliteBossArtifact, ascensionEliteBossStrength, ascensionEnemyHp } from './ascension'
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
  playCardFromHand,
  refillSide,
  summonMinion,
  tickTurnEnd,
  tickTurnStart,
} from './core'
import { randInt, rngFromSeed } from './rng'

export interface StartCombatOpts {
  deck: CardInst[]
  hp: number
  maxHp: number
  relics: string[]
  enemyIds: string[]
  encounterId: string
  seed: number
  uidStart: number
  /** Ascension level (0-5): scales enemy HP/damage, elites/bosses get str. */
  asc?: number
  kind?: 'normal' | 'elite' | 'boss'
  /** Act (1-4): multiplies enemy HP/damage via actEnemyScale. */
  act?: number
  /** Character is used only for character-specific combat mechanics. */
  char?: CharId
}

export function startCombat(o: StartCombatOpts): CombatState {
  const rng = rngFromSeed(o.seed)
  const player = makeSide('RUNNER', o.hp, o.maxHp, o.deck.map((c) => ({ ...c })), rng, o.char)

  const enemyStart: Record<string, number> = {}
  for (const rid of o.relics) {
    const st = RELICS[rid]?.hooks.combatStartEnemyStatuses
    if (st) for (const [k, v] of Object.entries(st)) enemyStart[k] = (enemyStart[k] ?? 0) + (v ?? 0)
    const own = RELICS[rid]?.hooks.combatStatuses
    if (own) for (const [k, v] of Object.entries(own)) {
      player.statuses[k as keyof typeof player.statuses] =
        (player.statuses[k as keyof typeof player.statuses] ?? 0) + (v ?? 0)
    }
    const blk = RELICS[rid]?.hooks.combatStartBlock
    if (blk) player.block += blk
    const sm = RELICS[rid]?.hooks.startMinion
    if (sm) summonMinion(player, sm)
  }

  const asc = o.asc ?? 0
  const act = o.act ?? 1
  const enemies: EnemyC[] = o.enemyIds.map((id) => {
    const def = ENEMIES[id]
    let hp = ascensionEnemyHp(randInt(rng, def.hp[0], def.hp[1]), asc, actEnemyScale(act))
    if (asc >= 13 && def.boss) hp = Math.round(hp * 1.15)
    if (asc >= 16) hp = Math.round(hp * 1.1)
    const statuses = { ...(def.traits ?? {}) }
    for (const [k, v] of Object.entries(enemyStart)) {
      statuses[k as keyof typeof statuses] = (statuses[k as keyof typeof statuses] ?? 0) + v
    }
    if (def.boss || o.kind === 'elite') {
      const strength = ascensionEliteBossStrength(asc)
      const artifact = ascensionEliteBossArtifact(asc)
      if (strength) statuses.str = (statuses.str ?? 0) + strength
      if (artifact) statuses.artifact = (statuses.artifact ?? 0) + artifact
    }
    if (asc >= 11) statuses.str = (statuses.str ?? 0) + 1
    if (asc >= 18 && (def.boss || o.kind === 'elite')) statuses.str = (statuses.str ?? 0) + 1
    if (asc >= 20 && def.boss) statuses.artifact = (statuses.artifact ?? 0) + 1
    return {
      defId: id,
      name: def.name,
      glyph: def.glyph,
      hp,
      maxHp: hp,
      block: 0,
      statuses,
      intent: null,
      lastMoves: [],
      usedOn: {},
      dead: false,
    }
  })

  const cs: CombatState = {
    rng,
    turn: 1,
    player,
    enemies,
    over: null,
    firstCardFree: o.relics.some((r) => RELICS[r]?.hooks.firstCardFree),
    relics: [...o.relics],
    uid: o.uidStart,
    encounterId: o.encounterId,
    asc,
    act,
  }

  rollIntents(cs)
  const evs: GameEvent[] = []
  refillSide(player, cs, 'p', evs, { firstTurn: true })
  return cs
}

function rollIntents(cs: CombatState) {
  for (const e of cs.enemies) {
    if (e.dead) continue
    const move = chooseMove(e, cs, cs.rng)
    e.intent = intentFor(move, e, cs.player, cs.asc)
  }
}

function foesOf(cs: CombatState) {
  return cs.enemies.map((e, i) => ({ f: e, who: 'e' + i }))
}

function markDeaths(cs: CombatState, evs: GameEvent[]) {
  cs.enemies.forEach((e, i) => {
    if (!e.dead && e.hp <= 0) {
      e.dead = true
      e.hp = 0
      e.intent = null
      evs.push({ e: 'die', who: 'e' + i })
    }
  })
  if (cs.enemies.every((e) => e.dead)) cs.over = 'win'
  if (cs.player.hp <= 0) {
    cs.player.hp = 0
    cs.over = 'lose'
    evs.push({ e: 'die', who: 'p' })
  }
}

function executeMove(cs: CombatState, idx: number, evs: GameEvent[]) {
  const e = cs.enemies[idx]
  const def = ENEMIES[e.defId]
  const move = def.moves.find((m) => m.id === e.intent?.moveId)
  if (!move) return
  const who = 'e' + idx
  evs.push({ e: 'move', who, id: move.id, name: move.name })
  for (const eff of move.effects as MoveEffect[]) {
    switch (eff.k) {
      case 'atk': {
        for (let t = 0; t < (eff.times ?? 1); t++) {
          if (cs.player.hp <= 0) break
          attack(e, cs.player, ascAtk(eff.n, cs.asc, cs.act), who, 'p', evs)
        }
        break
      }
      case 'block':
        gainBlock(e, eff.n, who, evs)
        break
      case 'buff':
        applyStatus(e, eff.id, eff.n, who, evs)
        break
      case 'buffAll': {
        cs.enemies.forEach((ally, ai) => {
          if (!ally.dead) applyStatus(ally, eff.id, eff.n, 'e' + ai, evs)
        })
        break
      }
      case 'debuff':
        applyStatus(cs.player, eff.id, eff.n, 'p', evs)
        break
      case 'heal':
        healHp(e, eff.n, who, evs)
        break
      case 'addCard': {
        for (let i = 0; i < eff.n; i++) {
          cs.player.discard.push({ uid: cs.uid++, id: eff.id, up: false })
        }
        evs.push({ e: 'addcard', who: 'p', n: eff.n, name: CARDS[eff.id].name })
        break
      }
      case 'summon': {
        for (let s = 0; s < (eff.n ?? 1); s++) {
          const alive = cs.enemies.filter((x) => !x.dead).length
          if (alive >= MAX_ALIVE_ENEMIES || cs.enemies.length >= 8) break
          const def2 = ENEMIES[eff.id]
          if (!def2) break
          const hp = Math.round(randInt(cs.rng, def2.hp[0], def2.hp[1]) * (1 + 0.06 * cs.asc) * actEnemyScale(cs.act))
          cs.enemies.push({
            defId: eff.id,
            name: def2.name,
            glyph: def2.glyph,
            hp,
            maxHp: hp,
            block: 0,
            statuses: { ...(def2.traits ?? {}) },
            // Summoning sickness: no intent until the next roll, acts next phase.
            intent: null,
            lastMoves: [],
            usedOn: {},
            summoned: true,
            dead: false,
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
  }
  e.usedOn[move.id] = cs.turn
  e.lastMoves.push(move.id)
  if (e.lastMoves.length > 4) e.lastMoves.shift()
}

export function combatReduce(prev: CombatState, action: CombatAction): StepResult<CombatState> {
  if (prev.over) return { state: prev, events: [], error: 'combat is over' }
  const cs: CombatState = structuredClone(prev)
  const evs: GameEvent[] = []

  if (action.t === 'play') {
    const err = playCardFromHand(cs, cs.player, 'p', foesOf(cs), action.hand, action.target, evs)
    if (err) return { state: prev, events: [], error: err }
    markDeaths(cs, evs)
    return { state: cs, events: evs }
  }

  // --- End turn -------------------------------------------------------------
  const aliveFoes = () => foesOf(cs).filter((x) => !(x.f as EnemyC).dead && x.f.hp > 0)
  endTurnPowers(cs.player, 'p', aliveFoes(), cs, evs)
  markDeaths(cs, evs)
  tickTurnEnd(cs.player, 'p', evs)
  discardHand(cs.player)

  if (!cs.over) {
    for (let i = 0; i < cs.enemies.length; i++) {
      const e = cs.enemies[i]
      if (e.dead) continue
      if (tickTurnStart(e, 'e' + i, evs, !!cs.player.statuses.chronic)) {
        markDeaths(cs, evs)
        continue
      }
      executeMove(cs, i, evs)
      markDeaths(cs, evs)
      if (cs.over) break
      tickTurnEnd(e, 'e' + i, evs)
    }
  }

  if (!cs.over) {
    cs.turn++
    rollIntents(cs)
    if (tickTurnStart(cs.player, 'p', evs)) {
      markDeaths(cs, evs)
    } else {
      const died = applyOverheat(cs.player, 'p', aliveFoes(), evs)
      markDeaths(cs, evs) // reactor redirection can kill; overheat can kill us
      if (!died && !cs.over) refillSide(cs.player, cs, 'p', evs)
    }
  }

  return { state: cs, events: evs }
}

/** Drink a potion: same interpreter as cards, no energy cost, no turn used. */
export function applyPotion(prev: CombatState, potionId: string, target?: number): StepResult<CombatState> {
  const def = POTIONS[potionId]
  if (!def) return { state: prev, events: [], error: 'unknown potion' }
  if (prev.over) return { state: prev, events: [], error: 'combat is over' }
  const cs: CombatState = structuredClone(prev)
  const evs: GameEvent[] = []
  let t = target
  if (def.target === 'enemy') {
    const alive = cs.enemies.map((e, i) => (e.dead ? -1 : i)).filter((i) => i >= 0)
    if (t === undefined && alive.length === 1) t = alive[0]
    if (t === undefined || !cs.enemies[t] || cs.enemies[t].dead) {
      return { state: prev, events: [], error: 'invalid target' }
    }
  }
  applyEffects(cs, cs.player, 'p', foesOf(cs), t ?? 0, def.effects, evs)
  markDeaths(cs, evs)
  return { state: cs, events: evs }
}

/** Convenience for UIs/tests: indices of playable hand cards. */
export function playableCards(cs: CombatState): number[] {
  if (cs.over) return []
  const anyAlive = cs.enemies.some((e) => !e.dead)
  return cs.player.hand
    .map((_, i) => i)
    .filter((i) => {
      const card = cs.player.hand[i]
      const def = CARDS[card.id]
      if (def.unplayable) return false
      const cost = cs.firstCardFree ? 0 : cardCost(card)
      if (cs.player.energy < cost) return false
      if (def.target === 'enemy' && !anyAlive) return false
      return true
    })
}

export function firstAliveEnemy(cs: CombatState): number | undefined {
  const i = cs.enemies.findIndex((e) => !e.dead)
  return i >= 0 ? i : undefined
}
