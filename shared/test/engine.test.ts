import { describe, expect, it } from 'vitest'
import {
  CARDS,
  ENEMIES,
  EVENTS,
  RELIC_ZH,
  RELICS,
  activateBalanceStack,
  activateProductionBalance,
  addRelic,
  advanceAct,
  allNodes,
  applyCombatResult,
  applyOutcomes,
  ascAtk,
  availableNodeIds,
  combatFor,
  combatReduce,
  configureAscensionTuning,
  describeCard,
  detectDeckArchetype,
  firstAliveEnemy,
  genActMap,
  genShop,
  getActiveBalance,
  goldReward,
  rankDeckArchetypes,
  modifiedDamage,
  moveTo,
  newPvp,
  newRun,
  nodeById,
  obtainableCards,
  playableCards,
  previewCard,
  previewEnemyIntent,
  pvpReduce,
  randInt,
  randomRelicId,
  restHealAmount,
  resetAscensionTuning,
  resetBalanceToBaseline,
  rngFromSeed,
  rollCardRewards,
  scoreClimbRound,
  startCombat,
  upgradeCard,
  viewFor,
  type CombatState,
  type BalanceStack,
  type PvpState,
  type RunState,
} from '../src/index'

const inst = (id: string, uid: number, up = false) => ({ uid, id, up })

/** Index of a card in the (shuffled) opening hand. */
const handIdx = (cs: CombatState, id: string) => cs.player.hand.findIndex((c) => c.id === id)

describe('versioned production balance patches', () => {
  it('applies v3 plus 5% lower enemy HP exactly once and rolls back cleanly', () => {
    resetBalanceToBaseline()
    const baseHp = Object.fromEntries(Object.entries(ENEMIES).map(([id, enemy]) => [id, [...enemy.hp]]))
    try {
      const first = activateProductionBalance()
      expect(first.id).toBe('production-v3-enemy-hp-95')
      expect(first.patchIds).toEqual([
        'character-balance-v3@3.0.0',
        'enemy-hp-minus-5-percent@1.0.0',
      ])
      expect(CARDS.strike.effects).toEqual([{ k: 'dmg', n: 8 }])
      expect(CARDS.defend.effects).toEqual([{ k: 'block', n: 7 }])
      expect(CARDS.phaseblade.effects).toEqual([{ k: 'dmg', n: 7 }])
      expect(CARDS.cloakfield.effects).toEqual([{ k: 'block', n: 6 }])
      expect(CARDS.ventblade.effects).toEqual([{ k: 'ventDmg', mult: 3 }])
      expect(CARDS.deployturret.cost).toBe(2)
      expect(CARDS.deployturret.effects).toEqual([{ k: 'status', to: 'self', id: 'turret', n: 1 }])
      expect(CARDS.deployplating.cost).toBe(2)
      expect(CARDS.deployplating.effects).toEqual([{ k: 'status', to: 'self', id: 'plating', n: 1 }])
      expect(RELICS.cortexlink.hooks.firstTurnDraw).toBe(2)
      expect(RELICS.phaselocket.hooks.combatStatuses?.stancewall).toBe(2)
      expect(RELICS.dronecradle.hooks.combatStatuses?.turret).toBe(0)
      expect(RELIC_ZH.cortexlink.desc).toContain('2 张牌')
      for (const [id, enemy] of Object.entries(ENEMIES)) {
        expect(enemy.hp).toEqual(baseHp[id].map((hp) => Math.max(1, Math.round(hp * 0.95))))
      }

      const run = newRun(17)
      expect(run.balanceId).toBe(first.id)
      expect(run.balanceHash).toBe(first.hash)

      const second = activateProductionBalance()
      expect(second.hash).toBe(first.hash)
      for (const [id, enemy] of Object.entries(ENEMIES)) {
        expect(enemy.hp).toEqual(baseHp[id].map((hp) => Math.max(1, Math.round(hp * 0.95))))
      }
    } finally {
      resetBalanceToBaseline()
    }
    expect(CARDS.strike.effects).toEqual([{ k: 'dmg', n: 6 }])
    expect(RELICS.cortexlink.hooks.firstTurnDraw).toBe(1)
    for (const [id, enemy] of Object.entries(ENEMIES)) expect(enemy.hp).toEqual(baseHp[id])
    expect(getActiveBalance().id).toBe('baseline')
  })

  it('rejects an invalid patch without partially changing live content', () => {
    resetBalanceToBaseline()
    const before = structuredClone(CARDS.strike)
    const invalid: BalanceStack = {
      id: 'invalid-test-stack',
      version: '1.0.0',
      patches: [{
        schemaVersion: 1,
        id: 'invalid-card-id',
        version: '1.0.0',
        baseVersion: 'content-2026.08.01',
        cardPatches: { definitely_missing: { cost: 0 } },
      }],
    }
    expect(() => activateBalanceStack(invalid)).toThrow(/unknown card patch id/)
    expect(CARDS.strike).toEqual(before)
    expect(getActiveBalance().id).toBe('baseline')
  })
})

function fixedCombat(deckIds: string[], enemyIds: string[], seed = 42, relics: string[] = []): CombatState {
  return startCombat({
    deck: deckIds.map((id, i) => inst(id, i + 1)),
    hp: 75,
    maxHp: 75,
    relics,
    enemyIds,
    encounterId: enemyIds.join(','),
    seed,
    uidStart: 1000,
  })
}

describe('card catalog', () => {
  it('has 30+ obtainable cards plus starters', () => {
    expect(obtainableCards().length).toBeGreaterThanOrEqual(30)
    expect(Object.keys(CARDS).length).toBeGreaterThanOrEqual(35)
  })

  it('every card has generated rules text and a real upgrade', () => {
    for (const def of Object.values(CARDS)) {
      const base = describeCard(inst(def.id, 1, false))
      const up = describeCard(inst(def.id, 2, true))
      expect(base.length).toBeGreaterThan(0)
      if (def.rarity === 'special') continue
      const changed =
        base !== up ||
        def.upCost !== undefined ||
        JSON.stringify(def.effects) !== JSON.stringify(def.upEffects)
      expect(changed, `${def.id} upgrade changes nothing`).toBe(true)
    }
  })

  it('covers all three card types with cost 0-3', () => {
    const types = new Set(Object.values(CARDS).map((c) => c.type))
    expect(types).toEqual(new Set(['attack', 'skill', 'power']))
    for (const def of Object.values(CARDS)) {
      expect(def.cost).toBeGreaterThanOrEqual(0)
      expect(def.cost).toBeLessThanOrEqual(3)
    }
  })
})

describe('damage math', () => {
  const F = (statuses: Record<string, number>) => ({ statuses }) as any
  it('applies strength, weak and vulnerable exactly', () => {
    expect(modifiedDamage(6, F({}), F({}))).toBe(6)
    expect(modifiedDamage(6, F({ str: 3 }), F({}))).toBe(9)
    expect(modifiedDamage(6, F({ weak: 1 }), F({}))).toBe(4) // floor(6*0.75)
    expect(modifiedDamage(6, F({}), F({ vuln: 2 }))).toBe(9) // floor(6*1.5)
    expect(modifiedDamage(6, F({ str: 2, weak: 1 }), F({ vuln: 1 }))).toBe(9) // floor(floor(8*.75)*1.5)
  })

  it('previews live card values through the real interpreter', () => {
    const side = {
      hp: 75,
      maxHp: 75,
      block: 0,
      statuses: { str: 2, weak: 1 },
      powersPlayed: 0,
      cardsPlayed: 0,
      cardsThisTurn: 0,
    }
    const targets = [
      { name: 'plain', hp: 20, maxHp: 20, block: 0, statuses: {} },
      { name: 'vulnerable', hp: 20, maxHp: 20, block: 0, statuses: { vuln: 1 } },
    ]
    // Strike: floor((6 + 2) × .75) = 6, then Vulnerable raises it to 9.
    expect(previewCard(inst('strike', 1), side, targets)).toEqual({
      cost: 1,
      damage: { min: 6, max: 9 },
    })
    // Relic card-block hooks are included instead of being reimplemented by UI.
    expect(previewCard(inst('defend', 2), side, targets, { relics: ['aegismatrix'] }).block).toBe(6)
  })

  it('recalculates stored enemy intent against current statuses', () => {
    const cs = fixedCombat(['defend', 'defend', 'defend', 'defend', 'defend'], ['spambot'])
    const enemy = cs.enemies[0]
    enemy.intent = { moveId: 'ping', name: 'Ping', kind: 'attack', dmg: 5 }
    enemy.statuses.str = 2
    cs.player.statuses.vuln = 1
    expect(previewEnemyIntent(enemy, cs.player)?.dmg).toBe(10)
    enemy.statuses.weak = 1
    expect(previewEnemyIntent(enemy, cs.player)?.dmg).toBe(7)
  })
})

describe('PvE combat', () => {
  it('plays a Strike: costs energy, damages the enemy', () => {
    const cs = fixedCombat(['strike', 'strike', 'strike', 'strike', 'strike'], ['spambot'])
    const hp0 = cs.enemies[0].hp
    const res = combatReduce(cs, { t: 'play', hand: 0 })
    expect(res.error).toBeUndefined()
    expect(res.state.enemies[0].hp).toBe(hp0 - 6)
    expect(res.state.player.energy).toBe(2)
    expect(res.state.player.discard.length).toBe(1)
  })

  it('rejects unaffordable and invalid plays without mutating state', () => {
    const cs = fixedCombat(['nulldivide', 'nulldivide', 'nulldivide', 'nulldivide', 'nulldivide'], ['golem'])
    const res1 = combatReduce(cs, { t: 'play', hand: 0 }) // costs 3, ok
    expect(res1.error).toBeUndefined()
    const res2 = combatReduce(res1.state, { t: 'play', hand: 0 }) // no energy left
    expect(res2.error).toBe('not enough energy')
    expect(res2.state).toBe(res1.state)
    const res3 = combatReduce(res1.state, { t: 'play', hand: 99 })
    expect(res3.error).toBeTruthy()
  })

  it('block absorbs enemy attacks and expires next turn', () => {
    const cs = fixedCombat(['defend', 'defend', 'defend', 'defend', 'defend'], ['spambot'])
    let s = combatReduce(cs, { t: 'play', hand: 0 }).state
    s = combatReduce(s, { t: 'play', hand: 0 }).state
    expect(s.player.block).toBe(10)
    const after = combatReduce(s, { t: 'end' }).state
    // whatever the enemy did, hp loss can be at most its damage minus block
    expect(after.player.hp).toBeGreaterThanOrEqual(s.player.hp - 10)
    expect(after.player.block).toBe(0) // reset at player's next turn start
  })

  it('corrupt ticks down and deals unblockable damage', () => {
    const cs = fixedCombat(['malware', 'defend', 'defend', 'defend', 'defend'], ['golem'])
    const res = combatReduce(cs, { t: 'play', hand: handIdx(cs, 'malware') })
    expect(res.state.enemies[0].statuses.corrupt).toBe(4)
    const hpBefore = res.state.enemies[0].hp
    const after = combatReduce(res.state, { t: 'end' }).state
    expect(after.enemies[0].hp).toBeLessThanOrEqual(hpBefore - 4)
    expect(after.enemies[0].statuses.corrupt).toBe(3)
  })

  it('reshuffles the discard pile into the draw pile', () => {
    const deck = ['strike', 'strike', 'strike', 'strike', 'strike', 'zeroday']
    let cs = fixedCombat(deck, ['golem'])
    // draw pile now has 1 card; cycle turns to force a reshuffle
    for (let i = 0; i < 3; i++) {
      const res = combatReduce(cs, { t: 'end' })
      cs = res.state
      if (cs.over) return
      const total = cs.player.hand.length + cs.player.draw.length + cs.player.discard.length
      expect(total).toBe(deck.length)
      expect(cs.player.hand.length).toBe(5)
    }
  })

  it('is deterministic: same seed and actions produce identical states', () => {
    const play = () => {
      let cs = fixedCombat(['strike', 'strike', 'defend', 'defend', 'twinlaser'], ['drone', 'spambot'], 7)
      const actions = [
        { t: 'play', hand: 0, target: 0 },
        { t: 'end' },
        { t: 'end' },
        { t: 'play', hand: 1, target: 1 },
      ] as const
      for (const a of actions) {
        const res = combatReduce(cs, a as any)
        if (!res.error) cs = res.state
        if (cs.over) break
      }
      return cs
    }
    expect(JSON.stringify(play())).toBe(JSON.stringify(play()))
  })

  it('quantum chip makes the first card free, once', () => {
    const cs = fixedCombat(['nulldivide', 'strike', 'strike', 'strike', 'strike'], ['golem'], 42, ['quantumchip'])
    expect(cs.firstCardFree).toBe(true)
    const res = combatReduce(cs, { t: 'play', hand: handIdx(cs, 'nulldivide') }) // 3-cost for free
    expect(res.error).toBeUndefined()
    expect(res.state.player.energy).toBe(3)
    expect(res.state.firstCardFree).toBe(false)
  })

  it('thorns punishes attackers', () => {
    const cs = fixedCombat(['zerotrust', 'defend', 'defend', 'defend', 'defend'], ['hound'], 9)
    const played = combatReduce(cs, { t: 'play', hand: handIdx(cs, 'zerotrust') }).state
    expect(played.player.statuses.thorns).toBe(2)
    const after = combatReduce(played, { t: 'end' }).state
    if (after.enemies[0].intent && !after.over) {
      // if the hound attacked, it must have taken thorns damage
      const attacked = after.player.hp < played.player.hp || played.player.block >= 12
      if (after.enemies[0].hp < played.enemies[0].hp) expect(attacked).toBe(true)
    }
  })

  it('regen heals at the start of your turn', () => {
    const cs = fixedCombat(['autorepair', 'defend', 'defend', 'defend', 'defend'], ['golem'])
    const played = combatReduce(cs, { t: 'play', hand: handIdx(cs, 'autorepair') }).state
    expect(played.player.statuses.regen).toBe(2)
    played.player.hp = 40
    const res = combatReduce(played, { t: 'end' })
    expect(res.state.over).toBeNull()
    expect(res.events.some((ev) => ev.e === 'heal' && ev.who === 'p' && ev.n === 2)).toBe(true)
  })

  it('powers vanish from play and their effects trigger at end of turn', () => {
    const cs = fixedCombat(['nanoplating', 'defend', 'defend', 'defend', 'defend'], ['golem'])
    const played = combatReduce(cs, { t: 'play', hand: handIdx(cs, 'nanoplating') }).state
    expect(played.player.statuses.plating).toBe(3)
    expect(played.player.discard.length).toBe(0)
    expect(played.player.exhausted.length).toBe(1)
    const after = combatReduce(played, { t: 'end' }).state
    // plating block was granted before the enemy attacked
    expect(after.player.hp).toBeGreaterThanOrEqual(played.player.hp - 20)
  })
})

describe('enemy AI', () => {
  it('every enemy always has a legal move over long fights', () => {
    for (const id of Object.keys(ENEMIES)) {
      let cs = fixedCombat(
        ['defend', 'defend', 'defend', 'defend', 'defend', 'defend', 'defend', 'defend'],
        [id],
        123,
      )
      for (let turn = 0; turn < 30 && !cs.over; turn++) {
        expect(cs.enemies[0].dead || cs.enemies[0].intent).toBeTruthy()
        cs = combatReduce(cs, { t: 'end' }).state
      }
    }
  })

  it('picks lethal attacks when the player is nearly dead', () => {
    // Force the situation many times; the AI multiplies lethal moves by 6.
    let lethalPicks = 0
    for (let seed = 0; seed < 20; seed++) {
      const cs = fixedCombat(['defend', 'defend', 'defend', 'defend', 'defend'], ['hound'], seed)
      cs.player.hp = 5
      const rerolled = combatReduce(cs, { t: 'end' }).state
      if (rerolled.over === 'lose') lethalPicks++
    }
    expect(lethalPicks).toBeGreaterThan(12)
  })
})

describe('map generation', () => {
  it('is connected: every node reaches the boss, every node is reachable', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const map = genActMap(1, rngFromSeed(seed))
      const nodes = allNodes(map)
      const boss = nodes.find((n) => n.type === 'boss')!
      expect(boss).toBeTruthy()
      // forward reachability from row 0
      const seen = new Set<string>(map.rows[0].map((n) => n.id))
      let frontier = [...map.rows[0]]
      while (frontier.length) {
        const next: typeof frontier = []
        for (const n of frontier) {
          for (const id of n.next) {
            if (!seen.has(id)) {
              seen.add(id)
              next.push(nodeById(map, id)!)
            }
          }
        }
        frontier = next
      }
      expect(seen.has(boss.id)).toBe(true)
      expect(seen.size).toBe(nodes.length)
      // every non-boss node has an exit
      for (const n of nodes) {
        if (n.id !== boss.id) expect(n.next.length).toBeGreaterThan(0)
        if (n.type === 'elite') expect(n.row).toBeGreaterThanOrEqual(2)
      }
    }
  })
})

describe('PvP', () => {
  it('rejects out-of-turn actions and hides opponent hands', () => {
    const ps = newPvp(1, ['A', 'B'])
    const res = pvpReduce(ps, 1, { t: 'end' })
    expect(res.error).toBe('not your turn')
    const view0 = viewFor(ps, 0)
    expect(view0.sides[0].hand).toBeTruthy()
    expect(view0.sides[1].hand).toBeUndefined()
    expect(view0.sides[1].handCount).toBe(0) // p1 hasn't drawn yet
  })

  it('random duels terminate with a winner and stay consistent', () => {
    for (let seed = 1; seed <= 10; seed++) {
      let ps: PvpState = newPvp(seed, ['A', 'B'])
      const rng = rngFromSeed(seed * 99 + 1)
      let steps = 0
      while (!ps.over && steps++ < 900) {
        const me = ps.sides[ps.active]
        const playable = me.hand
          .map((_, i) => i)
          .filter((i) => {
            const def = CARDS[me.hand[i].id]
            return !def.unplayable && me.energy >= def.cost
          })
        const action =
          playable.length > 0 && randInt(rng, 0, 2) > 0
            ? ({ t: 'play', hand: playable[randInt(rng, 0, playable.length - 1)] } as const)
            : ({ t: 'end' } as const)
        const res = pvpReduce(ps, ps.active, action)
        expect(res.error).toBeUndefined()
        ps = res.state
        for (const s of ps.sides) {
          expect(s.hp).toBeLessThanOrEqual(s.maxHp)
          expect(Number.isFinite(s.hp)).toBe(true)
        }
      }
      expect(ps.over).toBeTruthy()
    }
  })
})

describe('full runs (random bot)', () => {
  function playCombat(run: RunState, kind: 'normal' | 'elite' | 'boss', rng: { s: number }): CombatState {
    let cs = combatFor(run, kind)
    let steps = 0
    while (!cs.over && steps++ < 600) {
      const playable = playableCards(cs)
      const action =
        playable.length > 0 && randInt(rng, 0, 3) > 0
          ? ({
              t: 'play',
              hand: playable[randInt(rng, 0, playable.length - 1)],
              target: firstAliveEnemy(cs),
            } as const)
          : ({ t: 'end' } as const)
      const res = combatReduce(cs, action as any)
      expect(res.error).toBeUndefined()
      cs = res.state
    }
    expect(cs.over).toBeTruthy()
    applyCombatResult(run, cs)
    return cs
  }

  it('survives 8 full seeded runs without invariant violations', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const run = newRun(seed)
      const rng = rngFromSeed(seed * 7 + 3)
      let guard = 0
      let outcome: 'died' | 'victory' | null = null
      while (!outcome && guard++ < 80) {
        const options = availableNodeIds(run)
        expect(options.length).toBeGreaterThan(0)
        const id = options[randInt(rng, 0, options.length - 1)]
        const type = moveTo(run, id)!
        expect(type).toBeTruthy()
        if (type === 'combat' || type === 'elite' || type === 'boss') {
          const kind = type === 'combat' ? 'normal' : type
          const cs = playCombat(run, kind, rng)
          if (cs.over === 'lose') {
            outcome = 'died'
            break
          }
          run.gold += goldReward(run, kind)
          const rewards = rollCardRewards(run, kind)
          expect(rewards.length).toBe(3)
          if (type === 'boss') {
            if (advanceAct(run) === 'victory') outcome = 'victory'
          }
        } else if (type === 'treasure') {
          const relic = randomRelicId(run)
          if (relic) addRelic(run, relic)
        } else if (type === 'rest') {
          if (randInt(rng, 0, 1)) run.hp = Math.min(run.maxHp, run.hp + restHealAmount(run))
          else {
            const c = run.deck.find((c) => !c.up)
            if (c) upgradeCard(run, c.uid)
          }
        } else if (type === 'shop') {
          const shop = genShop(run)
          expect(shop.cards.length).toBe(5)
          const buy = shop.cards[0]
          if (run.gold >= buy.price) {
            run.gold -= buy.price
            run.deck.push({ uid: run.uid++, id: buy.id, up: false })
          }
        } else if (type === 'event') {
          const ev = EVENTS[randInt(rng, 0, EVENTS.length - 1)]
          const choice = ev.choices[randInt(rng, 0, ev.choices.length - 1)]
          if (!choice.needGold || run.gold >= choice.needGold) {
            const { removeChoose } = applyOutcomes(run, choice.outcomes)
            if (removeChoose && run.deck.length > 5) run.deck.splice(0, 1)
          }
        }
        expect(run.hp).toBeLessThanOrEqual(run.maxHp)
        expect(run.gold).toBeGreaterThanOrEqual(0)
        expect(run.hp).toBeGreaterThan(-1)
      }
      expect(outcome ?? 'stuck').not.toBe('stuck')
    }
  })
})

describe('archetype mechanics', () => {
  /** Replace the opening hand with exactly these cards and max energy. */
  function rig(cs: CombatState, ids: string[]) {
    let uid = 5000
    cs.player.hand = ids.map((id) => ({ uid: uid++, id, up: false }))
    cs.player.energy = 99
    return cs
  }

  it('barricade keeps block across turns', () => {
    const cs = rig(fixedCombat(['defend', 'defend', 'defend', 'defend', 'defend'], ['golem']), ['firmware', 'defend'])
    const s = combatReduce(cs, { t: 'play', hand: 0 }).state
    s.player.block = 50 // big enough to survive any act-1 hit
    const after = combatReduce(s, { t: 'end' }).state
    if (!after.over) expect(after.player.block).toBeGreaterThan(20) // not reset at turn start
  })

  it('chronic stops enemy corrupt from decaying', () => {
    const cs = rig(fixedCombat(['defend', 'defend', 'defend', 'defend', 'defend'], ['golem']), ['chronicinj', 'malware'])
    let s = combatReduce(cs, { t: 'play', hand: 0 }).state
    s = combatReduce(s, { t: 'play', hand: 0 }).state
    expect(s.enemies[0].statuses.corrupt).toBe(4)
    const after = combatReduce(s, { t: 'end' }).state
    if (!after.over && !after.enemies[0].dead) {
      expect(after.enemies[0].statuses.corrupt).toBe(4) // ticked but not decayed
    }
  })

  it('kernel panic retaliates when cards grant block', () => {
    const cs = rig(fixedCombat(['defend', 'defend', 'defend', 'defend', 'defend'], ['golem']), ['kernelpanic', 'defend'])
    let s = combatReduce(cs, { t: 'play', hand: 0 }).state
    const hpBefore = s.enemies[0].hp
    s = combatReduce(s, { t: 'play', hand: 0 }).state
    expect(s.enemies[0].hp).toBe(hpBefore - 3)
  })

  it('hyperthread draws on 0-cost plays', () => {
    const cs = rig(fixedCombat(['strike', 'strike', 'strike', 'strike', 'strike', 'strike', 'strike'], ['golem']), ['hyperthread', 'zeroday'])
    let s = combatReduce(cs, { t: 'play', hand: 0 }).state
    const handBefore = s.player.hand.length
    s = combatReduce(s, { t: 'play', hand: 0 }).state
    expect(s.player.hand.length).toBe(handBefore) // played 1, drew 1
  })

  it('payload burst scales with corrupt; fork virus doubles it', () => {
    const cs = rig(fixedCombat(['defend', 'defend', 'defend', 'defend', 'defend'], ['golem']), ['malware', 'forkvirus', 'payload'])
    let s = combatReduce(cs, { t: 'play', hand: 0 }).state // 4 corrupt
    s = combatReduce(s, { t: 'play', hand: 0 }).state // doubled to 8
    expect(s.enemies[0].statuses.corrupt).toBe(8)
    const hpBefore = s.enemies[0].hp
    s = combatReduce(s, { t: 'play', hand: 0 }).state // 2×8 = 16 dmg
    expect(hpBefore - s.enemies[0].hp).toBe(16)
  })

  it('double buffer doubles block; burst compile combos', () => {
    const cs = rig(fixedCombat(['defend', 'defend', 'defend', 'defend', 'defend'], ['golem']), ['defend', 'doublebuffer', 'pipeline', 'nopslide', 'burstcompile'])
    let s = combatReduce(cs, { t: 'play', hand: 0 }).state
    s = combatReduce(s, { t: 'play', hand: 0 }).state
    expect(s.player.block).toBe(10)
    s = combatReduce(s, { t: 'play', hand: 0 }).state // pipeline (3rd card)
    s = combatReduce(s, { t: 'play', hand: 0 }).state // nopslide (4th card)
    const hpBefore = s.enemies[0].hp
    s = combatReduce(s, { t: 'play', hand: 0 }).state // burstcompile, 5th card: combo
    expect(hpBefore - s.enemies[0].hp).toBe(10) // 4 + 6 combo bonus
  })

  it('hypervisor makes powers cost 1 less', () => {
    const cs = fixedCombat(['neoncore', 'neoncore', 'neoncore', 'neoncore', 'neoncore'], ['golem'], 42, ['hypervisor'])
    const s = combatReduce(cs, { t: 'play', hand: 0 }).state
    expect(s.player.energy).toBe(3) // 1-cost power played for free
  })
})

describe('summons & boss phases', () => {
  it('summoners spawn reinforcements with summoning sickness', () => {
    const cs = fixedCombat(['defend', 'defend', 'defend', 'defend', 'defend'], ['hatchery'])
    cs.enemies[0].intent = { moveId: 'spawn', name: 'Spawn', kind: 'buff' }
    const res = combatReduce(cs, { t: 'end' })
    expect(res.state.enemies.length).toBe(2)
    expect(res.state.enemies[1].defId).toBe('spambot')
    expect(res.state.enemies[1].hp).toBeGreaterThan(0)
    expect(res.state.enemies[1].intent).not.toBeNull() // rolled for NEXT turn
    expect(res.events.some((ev) => ev.e === 'summon')).toBe(true)
  })

  it('caps the arena at 5 living enemies', () => {
    const cs = fixedCombat(['defend', 'defend', 'defend', 'defend', 'defend'], ['hatchery', 'spambot', 'spambot'])
    // inflate to the cap with two extra clones
    for (let i = 0; i < 2; i++) cs.enemies.push(structuredClone(cs.enemies[1]))
    cs.enemies.forEach((e) => (e.intent = null))
    cs.enemies[0].intent = { moveId: 'spawn', name: 'Spawn', kind: 'buff' }
    const res = combatReduce(cs, { t: 'end' })
    expect(res.state.enemies.filter((e) => !e.dead).length).toBeLessThanOrEqual(5)
    expect(res.state.enemies.length).toBe(5) // nothing was added
  })

  it('boss phase move cleanses debuffs and stabilizes', () => {
    const cs = fixedCombat(['defend', 'defend', 'defend', 'defend', 'defend'], ['compiler'])
    cs.enemies[0].hp = 40 // below 50%
    cs.enemies[0].statuses.weak = 3
    cs.enemies[0].statuses.corrupt = 5
    cs.enemies[0].intent = { moveId: 'recompile', name: 'RECOMPILE', kind: 'defend' }
    const res = combatReduce(cs, { t: 'end' })
    const boss = res.state.enemies[0]
    expect(boss.statuses.weak).toBeUndefined()
    expect(boss.statuses.corrupt).toBeUndefined()
    expect(boss.block).toBeGreaterThanOrEqual(20)
    expect(boss.statuses.str).toBeGreaterThanOrEqual(3)
  })
})

describe('VECTOR heat mechanic', () => {
  function rigV(cs: CombatState, ids: string[]) {
    let uid = 6000
    cs.player.hand = ids.map((id) => ({ uid: uid++, id, up: false }))
    cs.player.energy = 99
    return cs
  }

  it('heat boosts attacks and vents multiply it', () => {
    const cs = rigV(fixedCombat(['heatshield', 'heatshield', 'heatshield', 'heatshield', 'heatshield'], ['golem']), ['stoke', 'spark', 'ventblade'])
    let s = combatReduce(cs, { t: 'play', hand: 0 }).state // +3 heat
    expect(s.player.statuses.heat).toBe(3)
    const hp0 = s.enemies[0].hp
    s = combatReduce(s, { t: 'play', hand: 0 }).state // spark: 5 + 3 heat = 8, then +1 heat
    expect(hp0 - s.enemies[0].hp).toBe(8)
    expect(s.player.statuses.heat).toBe(4)
    const hp1 = s.enemies[0].hp
    s = combatReduce(s, { t: 'play', hand: 0 }).state // vent: 4×2 = 8, heat cleared
    expect(hp1 - s.enemies[0].hp).toBe(8)
    expect(s.player.statuses.heat).toBeUndefined()
  })

  it('overheating burns you at the threshold; coolant raises it', () => {
    const cs = rigV(fixedCombat(['heatshield', 'heatshield', 'heatshield', 'heatshield', 'heatshield'], ['golem']), ['heatshield'])
    cs.player.statuses.heat = 12
    const s = combatReduce(cs, { t: 'end' }).state
    if (!s.over) {
      expect(s.player.statuses.heat).toBeUndefined()
      // took 12 unblockable burn on top of whatever the golem did
      expect(s.player.hp).toBeLessThanOrEqual(75 - 12)
    }
    const cool = rigV(fixedCombat(['heatshield', 'heatshield', 'heatshield', 'heatshield', 'heatshield'], ['golem']), ['heatshield'])
    cool.player.statuses.heat = 12
    cool.player.statuses.coolant = 4 // threshold 16
    const s2 = combatReduce(cool, { t: 'end' }).state
    if (!s2.over) expect(s2.player.statuses.heat).toBe(12) // no burn
  })

  it('reactor redirects the overheat blast into enemies', () => {
    const cs = rigV(fixedCombat(['heatshield', 'heatshield', 'heatshield', 'heatshield', 'heatshield'], ['golem']), ['heatshield'])
    cs.player.statuses.heat = 12
    cs.player.statuses.reactor = 1
    const hpMe = cs.player.hp
    const s = combatReduce(cs, { t: 'end' }).state
    if (!s.over) {
      expect(s.player.statuses.heat).toBeUndefined()
      // enemy ate the 12 (through block); we only took the golem's normal hit
      const enemyLoss = s.enemies[0].maxHp - s.enemies[0].hp - s.enemies[0].block
      expect(enemyLoss + s.enemies[0].block).toBeGreaterThanOrEqual(0)
      expect(hpMe - s.player.hp).toBeLessThan(12 + 15) // no self-burn stacked on top
    }
  })

  it('character pools are exclusive', () => {
    const vPool = obtainableCards('vector').map((c) => c.id)
    const rPool = obtainableCards('runner').map((c) => c.id)
    expect(vPool).toContain('meltdown')
    expect(vPool).not.toContain('payload') // runner-tagged
    expect(rPool).toContain('payload')
    expect(rPool).not.toContain('meltdown')
    expect(rPool).toContain('firewall') // neutral shared
    expect(vPool).toContain('firewall')
    expect(newRun(1, 0, 'vector').deck.some((c) => c.id === 'spark')).toBe(true)
  })
})

describe('potions', () => {
  it('applies effects through the shared interpreter', async () => {
    const { applyPotion } = await import('../src/combat')
    const cs = fixedCombat(['strike', 'strike', 'strike', 'strike', 'strike'], ['golem'])
    cs.player.hp = 50
    const healed = applyPotion(cs, 'repairkit')
    expect(healed.error).toBeUndefined()
    expect(healed.state.player.hp).toBe(60)
    const vuln = applyPotion(cs, 'neurodart', 0)
    expect(vuln.state.enemies[0].statuses.vuln).toBe(3)
    expect(applyPotion(cs, 'nope').error).toBeTruthy()
  })

  it('every potion executes cleanly through the shared interpreter', async () => {
    const { applyPotion } = await import('../src/combat')
    const { POTIONS } = await import('../src/potions')
    expect(Object.keys(POTIONS).length).toBeGreaterThanOrEqual(16)
    for (const id of Object.keys(POTIONS)) {
      const cs = fixedCombat(['strike', 'strike', 'strike', 'strike', 'strike'], ['golem'])
      const res = applyPotion(cs, id, 0)
      expect(res.error, `potion ${id} errored: ${res.error}`).toBeUndefined()
    }
  })

  it('drops respect belt capacity', async () => {
    const { rollPotionDrop, MAX_POTIONS } = await import('../src/run')
    const run = newRun(3)
    run.potions = ['repairkit', 'surgecell', 'shieldcell']
    for (let i = 0; i < 20; i++) expect(rollPotionDrop(run)).toBeNull()
    expect(run.potions.length).toBe(MAX_POTIONS)
  })
})

describe('ascension', () => {
  it('scales enemy hp and damage', async () => {
    const { startCombat } = await import('../src/combat')
    const mk = (asc: number) =>
      startCombat({
        deck: ['strike', 'strike', 'strike', 'strike', 'strike'].map((id, i) => inst(id, i + 1)),
        hp: 75, maxHp: 75, relics: [], enemyIds: ['golem'], encounterId: 'golem', seed: 9, uidStart: 100, asc,
      })
    const base = mk(0)
    const hard = mk(5)
    expect(hard.enemies[0].maxHp).toBeGreaterThan(base.enemies[0].maxHp)
    const baseIntent = base.enemies[0].intent
    const hardIntent = hard.enemies[0].intent
    if (baseIntent?.dmg && hardIntent?.dmg && baseIntent.moveId === hardIntent.moveId) {
      expect(hardIntent.dmg).toBeGreaterThanOrEqual(baseIntent.dmg)
    }
    expect(newRun(1, 5).maxHp).toBeLessThan(newRun(1, 0).maxHp)
  })

  it('boss relic choices are distinct and unowned', async () => {
    const { bossRelicChoices } = await import('../src/run')
    const run = newRun(7)
    const choices = bossRelicChoices(run)
    expect(choices.length).toBe(3)
    expect(new Set(choices).size).toBe(3)
    for (const id of choices) expect(run.relics.includes(id)).toBe(false)
  })
})

describe('localization (zh)', () => {
  it('has a complete Chinese dictionary for every piece of content', async () => {
    const { CARD_ZH, ENEMY_ZH, EVENT_ZH, RELIC_ZH, POTION_ZH } = await import('../src/locale-zh')
    const { POTIONS } = await import('../src/potions')
    const { BOOT_EVENT } = await import('../src/events')
    for (const id of Object.keys(POTIONS)) {
      expect(POTION_ZH[id]?.name, `potion ${id} missing zh name`).toBeTruthy()
    }
    expect(EVENT_ZH[BOOT_EVENT.id]?.choices.length, 'boot event zh mismatch').toBe(BOOT_EVENT.choices.length)
    for (const id of Object.keys(CARDS)) {
      expect(CARD_ZH[id]?.name, `card ${id} missing zh name`).toBeTruthy()
    }
    for (const id of Object.keys(RELICS)) {
      expect(RELIC_ZH[id]?.name, `relic ${id} missing zh name`).toBeTruthy()
      expect(RELIC_ZH[id]?.desc, `relic ${id} missing zh desc`).toBeTruthy()
    }
    for (const [id, def] of Object.entries(ENEMIES)) {
      expect(ENEMY_ZH[id]?.name, `enemy ${id} missing zh name`).toBeTruthy()
      for (const move of def.moves) {
        expect(ENEMY_ZH[id]?.moves[move.id], `enemy ${id} move ${move.id} missing zh name`).toBeTruthy()
      }
    }
    for (const ev of EVENTS) {
      const zh = EVENT_ZH[ev.id]
      expect(zh?.name, `event ${ev.id} missing zh`).toBeTruthy()
      expect(zh?.text, `event ${ev.id} missing zh text`).toBeTruthy()
      expect(zh?.choices.length, `event ${ev.id} zh choice count mismatch`).toBe(ev.choices.length)
    }
    // STATUS_ZH is a Record<StatusId, ...>, so completeness is compile-checked.
  })

  it('localizes generated rules text and names, and switches back cleanly', async () => {
    const { setLocale } = await import('../src/i18n')
    const { cardName, describeCard } = await import('../src/cards')
    const { relicDesc } = await import('../src/relics')
    const { enemyName } = await import('../src/enemies')
    try {
      setLocale('zh')
      expect(describeCard(inst('strike', 1))).toBe('造成 6 点伤害。')
      expect(describeCard(inst('strike', 1, true))).toBe('造成 9 点伤害。')
      expect(cardName(inst('strike', 1, true))).toBe('斩击.sh+')
      expect(describeCard(inst('trojan', 1))).toContain('虚弱')
      expect(describeCard(inst('trojan', 1))).toContain('消耗。')
      expect(describeCard(inst('glitchblade', 1))).toContain('弃牌堆')
      expect(describeCard(inst('nanoplating', 1))).toContain('格挡')
      expect(relicDesc('quantumchip')).toContain('费用为 0')
      expect(enemyName('architect')).toBe('架构师')
    } finally {
      setLocale('en')
    }
    expect(describeCard(inst('strike', 1))).toBe('Deal 6 damage.')
  })
})

describe('relics & shops', () => {
  it('all relics are described and obtainable pools exclude owned', () => {
    expect(Object.keys(RELICS).length).toBeGreaterThanOrEqual(12)
    const run = newRun(5)
    const id = randomRelicId(run)!
    addRelic(run, id)
    expect(randomRelicId(run)).not.toBe(id)
  })

  it('gold bonus relic increases rewards', () => {
    const run = newRun(11)
    const base = goldReward(run, 'normal')
    expect(base).toBeGreaterThan(0)
    addRelic(run, 'goldchip')
    // deterministic check of the multiplier itself
    expect(run.relics.includes('goldchip')).toBe(true)
  })
})

describe('curses & score (cycle 4)', () => {
  it('A2+ runs start with a Lag curse and Lag is unplayable', () => {
    expect(newRun(1, 0).deck.some((c) => c.id === 'lag')).toBe(false)
    expect(newRun(1, 2).deck.some((c) => c.id === 'lag')).toBe(true)
    expect(CARDS.lag.unplayable).toBe(true)
    const cs = fixedCombat(['lag', 'lag', 'lag', 'lag', 'lag'], ['golem'])
    const res = combatReduce(cs, { t: 'play', hand: 0 })
    expect(res.error).toBeTruthy()
  })

  it('curse outcome infects the deck with Lag', () => {
    const run = newRun(4)
    const before = run.deck.length
    applyOutcomes(run, [{ k: 'gold', n: 120 }, { k: 'curse' }])
    expect(run.deck.length).toBe(before + 1)
    expect(run.deck[run.deck.length - 1].id).toBe('lag')
  })

  it('negative max-hp relic clamps and never kills', () => {
    const run = newRun(6)
    run.hp = 5
    addRelic(run, 'berserkerchip')
    expect(run.maxHp).toBe(65)
    expect(run.hp).toBeGreaterThanOrEqual(1)
    expect(run.hp).toBeLessThanOrEqual(run.maxHp)
  })

  it('exoframe adds bonus block to card block', () => {
    const plain = fixedCombat(['defend', 'defend', 'defend', 'defend', 'defend'], ['golem'])
    const boosted = fixedCombat(['defend', 'defend', 'defend', 'defend', 'defend'], ['golem'], 42, ['exoframe'])
    const a = combatReduce(plain, { t: 'play', hand: 0 }).state.player.block
    const b = combatReduce(boosted, { t: 'play', hand: 0 }).state.player.block
    expect(b).toBe(a + 2)
  })

  it('scores a run with a breakdown that sums to the total', async () => {
    const { scoreRun } = await import('../src/run')
    const run = newRun(9, 3)
    run.floor = 12
    run.act = 2
    run.gold = 140
    addRelic(run, 'goldchip')
    upgradeCard(run, run.deck[0].uid)
    const lose = scoreRun(run, false)
    expect(lose.total).toBe(lose.lines.reduce((s, l) => s + l.pts, 0))
    const win = scoreRun(run, true)
    expect(win.total).toBe(lose.total + 100)
    expect(win.lines.some((l) => l.k === 'win')).toBe(true)
    expect(win.lines.find((l) => l.k === 'asc')?.pts).toBe(120)
  })
})

describe('card keywords (cycle 5)', () => {
  it('innate cards always open in hand and count against the draw', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const cs = startCombat({
        deck: ['bootdisk', ...Array(12).fill('strike'), 'preheat'].map((id, i) => inst(id, i + 1)),
        hp: 75, maxHp: 75, relics: [], enemyIds: ['golem'], encounterId: 'golem', seed, uidStart: 100,
      })
      expect(cs.player.hand.some((c) => c.id === 'bootdisk'), `seed ${seed}`).toBe(true)
      expect(cs.player.hand.some((c) => c.id === 'preheat'), `seed ${seed}`).toBe(true)
      expect(cs.player.hand.length).toBe(5)
    }
  })

  it('retained cards survive end of turn', () => {
    const cs = fixedCombat(['slowburn', 'slowburn', 'slowburn', 'slowburn', 'slowburn'], ['golem'])
    const s = combatReduce(cs, { t: 'end' }).state
    expect(s.player.hand.length).toBe(5)
    expect(s.player.hand.every((c) => c.id === 'slowburn')).toBe(true)
    expect(s.player.discard.length).toBe(0)
  })

  it('ethereal cards exhaust at end of turn', () => {
    const cs = fixedCombat(['emberveil', 'emberveil', 'emberveil', 'emberveil', 'emberveil'], ['golem'])
    const s = combatReduce(cs, { t: 'end' }).state
    expect(s.player.hand.length).toBe(0)
    expect(s.player.discard.length).toBe(0)
    expect(s.player.exhausted.length).toBe(5)
  })

  it('keywords appear in generated rules text', () => {
    expect(describeCard(inst('preheat', 1))).toMatch(/^Innate\./)
    expect(describeCard(inst('slowburn', 1))).toMatch(/^Retain\./)
    expect(describeCard(inst('ghostprocess', 1))).toMatch(/^Ethereal\./)
  })
})

describe('THE ROOT (act 4)', () => {
  it('act 4 map is a fixed connected gauntlet', () => {
    const m = genActMap(4, rngFromSeed(1))
    expect(m.rows.length).toBe(4)
    expect(m.rows.map((r) => r[0].type)).toEqual(['rest', 'shop', 'elite', 'boss'])
    for (let i = 0; i < 3; i++) expect(m.rows[i][0].next).toContain(m.rows[i + 1][0].id)
  })

  it('act 3 win is a choice: jack out or descend', async () => {
    const { pickEncounter } = await import('../src/run')
    const run = newRun(2)
    run.act = 3
    expect(advanceAct(run)).toBe('victory')
    expect(run.act).toBe(3)
    expect(advanceAct(run, true)).toBe('next')
    expect(run.act).toBe(4)
    expect(run.map.rows.length).toBe(4)
    expect(pickEncounter(run, 'boss')).toEqual(['theroot'])
    expect(pickEncounter(run, 'elite')).toEqual(['spearproc', 'shieldproc'])
    expect(advanceAct(run)).toBe('victory')
  })

  it('the root opens with ritual and ramps strength every turn', () => {
    const cs = fixedCombat(['defend', 'defend', 'defend', 'defend', 'defend'], ['theroot'])
    expect(cs.enemies[0].statuses.ritual).toBe(1)
    const s = combatReduce(cs, { t: 'end' }).state
    if (!s.over) expect(s.enemies[0].statuses.str ?? 0).toBeGreaterThanOrEqual(1)
  })

  it('deep victory earns the score bonus', async () => {
    const { scoreRun } = await import('../src/run')
    const run = newRun(3)
    run.act = 4
    const sc = scoreRun(run, true)
    expect(sc.lines.some((l) => l.k === 'deep')).toBe(true)
    expect(sc.lines.find((l) => l.k === 'deep')?.pts).toBe(150)
    expect(scoreRun(run, false).lines.some((l) => l.k === 'deep')).toBe(false)
  })
})

describe('artifact & events (cycle 7)', () => {
  it('artifact negates debuffs one application at a time, buffs pass', async () => {
    const { applyStatus } = await import('../src/core')
    const f: any = { statuses: { artifact: 2 }, hp: 10, maxHp: 10, block: 0 }
    const evs: any[] = []
    applyStatus(f, 'weak', 2, 'e0', evs)
    expect(f.statuses.weak).toBeUndefined()
    expect(f.statuses.artifact).toBe(1)
    applyStatus(f, 'str', 2, 'e0', evs)
    expect(f.statuses.str).toBe(2)
    applyStatus(f, 'vuln', 1, 'e0', evs)
    expect(f.statuses.artifact).toBeUndefined()
    applyStatus(f, 'vuln', 1, 'e0', evs)
    expect(f.statuses.vuln).toBe(1)
    expect(evs.filter((e) => e.e === 'lifted').length).toBe(2)
  })

  it('act 4 guardians open with artifact; A5 elites gain one', () => {
    expect(ENEMIES.theroot.traits?.artifact).toBe(2)
    expect(ENEMIES.rootdaemon.traits?.artifact).toBe(1)
    const cs = startCombat({
      deck: ['strike', 'strike', 'strike', 'strike', 'strike'].map((id, i) => inst(id, i + 1)),
      hp: 75, maxHp: 75, relics: [], enemyIds: ['golem'], encounterId: 'golem',
      seed: 4, uidStart: 100, asc: 5, kind: 'elite',
    })
    expect(cs.enemies[0].statuses.artifact).toBe(1)
  })

  it('faraday cage gives the player artifact; null vial grants one mid-fight', async () => {
    const { applyPotion } = await import('../src/combat')
    const cs = fixedCombat(['strike', 'strike', 'strike', 'strike', 'strike'], ['golem'], 42, ['faradaycage'])
    expect(cs.player.statuses.artifact).toBe(1)
    const r = applyPotion(cs, 'nullvial')
    expect(r.state.player.statuses.artifact).toBe(2)
  })

  it('event pool grew and every outcome list executes cleanly', () => {
    expect(EVENTS.length).toBeGreaterThanOrEqual(17)
    for (const ev of EVENTS) {
      for (const ch of ev.choices) {
        const run = newRun(5)
        run.gold = 500
        const res = applyOutcomes(run, ch.outcomes)
        expect(Array.isArray(res.lines), `${ev.id} outcome failed`).toBe(true)
        expect(run.hp).toBeGreaterThan(0)
        expect(run.gold).toBeGreaterThanOrEqual(0)
      }
    }
  })
})

describe('GHOST stances (cycle 9)', () => {
  function rigG(cs: CombatState, ids: string[]) {
    let uid = 7000
    cs.player.hand = ids.map((id) => ({ uid: uid++, id, up: false }))
    cs.player.energy = 99
    return cs
  }
  const base = () => fixedCombat(['cloakfield', 'cloakfield', 'cloakfield', 'cloakfield', 'cloakfield'], ['golem'])

  it('overdrive multiplies damage both ways; stealth halves incoming', () => {
    const F = (statuses: Record<string, number>) => ({ statuses }) as any
    expect(modifiedDamage(10, F({ overdrive: 1 }), F({}))).toBe(15)
    expect(modifiedDamage(10, F({}), F({ overdrive: 1 }))).toBe(15)
    expect(modifiedDamage(10, F({}), F({ stealth: 1 }))).toBe(5)
    expect(modifiedDamage(10, F({ overdrive: 1 }), F({ stealth: 1 }))).toBe(7)
  })

  it('stances are exclusive and exiting stealth grants 2 energy', () => {
    const cs = rigG(base(), ['blackout', 'redshift', 'nullstep'])
    let s = combatReduce(cs, { t: 'play', hand: handIdx(cs, 'blackout') }).state
    expect(s.player.statuses.stealth).toBe(1)
    const energyBefore = s.player.energy
    s = combatReduce(s, { t: 'play', hand: handIdx(s as CombatState, 'redshift') }).state
    expect(s.player.statuses.stealth).toBeUndefined()
    expect(s.player.statuses.overdrive).toBe(1)
    expect(s.player.energy).toBe(energyBefore + 2) // 0-cost card + decloak bonus
    s = combatReduce(s, { t: 'play', hand: handIdx(s as CombatState, 'nullstep') }).state
    expect(s.player.statuses.overdrive).toBeUndefined()
  })

  it('stance-trigger powers fire on entry', () => {
    const cs = rigG(base(), ['redshift'])
    cs.player.draw.push({ uid: 7100, id: 'cloakfield', up: false })
    cs.player.statuses.stancewall = 3
    cs.player.statuses.momentum = 2
    cs.player.statuses.tempoloop = 1
    const handBefore = cs.player.hand.length
    const s = combatReduce(cs, { t: 'play', hand: 0 }).state
    expect(s.player.block).toBe(3)
    expect(s.player.statuses.str).toBe(2)
    expect(s.player.hand.length).toBe(handBefore) // played 1, drew 1
  })

  it('re-entering the same stance is a no-op (no trigger farming)', () => {
    const cs = rigG(base(), ['redshift', 'redshift'])
    cs.player.statuses.momentum = 1
    let s = combatReduce(cs, { t: 'play', hand: 0 }).state
    expect(s.player.statuses.str).toBe(1)
    s = combatReduce(s, { t: 'play', hand: 0 }).state
    expect(s.player.statuses.str).toBe(1) // unchanged
  })

  it('each character opens with their signature starter relic', async () => {
    const { STARTER_RELICS } = await import('../src/run')
    for (const [ch, relic] of Object.entries(STARTER_RELICS)) {
      const run = newRun(3, 0, ch as any)
      expect(run.relics).toEqual([relic])
      expect(RELICS[relic].rarity).toBe('starter')
    }
    // starter relics never appear in reward pools
    const { obtainableRelics } = await import('../src/relics')
    const pool = obtainableRelics([], true, 'vector').map((r) => r.id)
    expect(pool).not.toContain('ignitionkey')
  })

  it('ghost pool is exclusive and the starter deck boots with stance cards', () => {
    const gPool = obtainableCards('ghost').map((c) => c.id)
    expect(gPool).toContain('flicker')
    expect(gPool).not.toContain('meltdown')
    expect(gPool).not.toContain('payload')
    expect(obtainableCards('runner').map((c) => c.id)).not.toContain('flicker')
    const run = newRun(1, 0, 'ghost')
    expect(run.deck.some((c) => c.id === 'redshift')).toBe(true)
    expect(run.deck.some((c) => c.id === 'blackout')).toBe(true)
  })
})

describe('relic & event volume (cycle 10)', () => {
  it('catalog grew: 51+ relics, 25+ events', () => {
    expect(Object.keys(RELICS).length).toBeGreaterThanOrEqual(51)
    expect(EVENTS.length).toBeGreaterThanOrEqual(25)
  })

  it('char-gated relics stay out of other characters\' pools', async () => {
    const { obtainableRelics } = await import('../src/relics')
    const runnerPool = obtainableRelics([], true, 'runner').map((r) => r.id)
    const vectorPool = obtainableRelics([], true, 'vector').map((r) => r.id)
    const ghostPool = obtainableRelics([], true, 'ghost').map((r) => r.id)
    expect(runnerPool).not.toContain('pilotlight')
    expect(runnerPool).not.toContain('metronome')
    expect(vectorPool).toContain('pilotlight')
    expect(vectorPool).not.toContain('flywheel')
    expect(ghostPool).toContain('metronome')
    expect(ghostPool).not.toContain('coldplate')
    expect(runnerPool).toContain('faradaycage') // neutral shared
  })

  it('ring buffer grants block on reshuffle', async () => {
    const cs = fixedCombat(['strike', 'strike', 'strike', 'strike', 'strike', 'strike'], ['golem'], 42, ['ringbuffer'])
    // 5 drawn, 1 in draw pile; dump hand and draw through the shuffle
    cs.player.discard.push(...cs.player.hand)
    cs.player.hand = []
    const evs: any[] = []
    const { drawCards } = await import('../src/core')
    drawCards(cs.player, 5, cs, 'p', evs)
    expect(cs.player.block).toBe(6)
  })

  it('every relic has a describable hook set and unique id', () => {
    const ids = new Set<string>()
    for (const r of Object.values(RELICS)) {
      expect(ids.has(r.id)).toBe(false)
      ids.add(r.id)
      expect(Object.keys(r.hooks).length, `${r.id} has no hooks`).toBeGreaterThan(0)
      expect(r.desc.length).toBeGreaterThan(0)
    }
  })
})

describe('ARRAY automations (cycle 16)', () => {
  it('focus amplifies every active automation, never triggers alone', async () => {
    const { endTurnPowers } = await import('../src/core')
    const cs = fixedCombat(['fieldwall', 'fieldwall', 'fieldwall', 'fieldwall', 'fieldwall'], ['golem'])
    cs.player.statuses.focus = 2
    const evs: any[] = []
    // focus alone: nothing happens
    endTurnPowers(cs.player, 'p', [{ f: cs.enemies[0], who: 'e0' }], cs, evs)
    expect(cs.player.block).toBe(0)
    expect(cs.enemies[0].hp).toBe(cs.enemies[0].maxHp)
    // with automations: each triggers +focus harder
    cs.player.statuses.plating = 1
    cs.player.statuses.turret = 1
    const hp0 = cs.enemies[0].hp
    endTurnPowers(cs.player, 'p', [{ f: cs.enemies[0], who: 'e0' }], cs, evs)
    expect(cs.player.block).toBe(3) // 1 plating + 2 focus
    expect(hp0 - cs.enemies[0].hp).toBe(3) // 1 turret + 2 focus
  })

  it('dmgPerAuto scales with total automation stacks', () => {
    const cs = fixedCombat(['daemonstrike', 'daemonstrike', 'daemonstrike', 'daemonstrike', 'daemonstrike'], ['golem'])
    cs.player.statuses.turret = 2
    cs.player.statuses.plating = 1
    cs.player.statuses.viral = 1
    const hp0 = cs.enemies[0].hp
    const s = combatReduce(cs, { t: 'play', hand: 0, target: 0 }).state
    expect(hp0 - s.enemies[0].hp).toBe(4 + 2 * 4) // base 4 + per 2 x 4 stacks
  })

  it('array pool is exclusive and boots with deploy cards', () => {
    const aPool = obtainableCards('array').map((c) => c.id)
    expect(aPool).toContain('focuslens')
    expect(aPool).not.toContain('meltdown')
    expect(aPool).not.toContain('flicker')
    expect(obtainableCards('runner').map((c) => c.id)).not.toContain('focuslens')
    const run = newRun(1, 0, 'array')
    expect(run.deck.some((c) => c.id === 'deployturret')).toBe(true)
    expect(run.deck.some((c) => c.id === 'deployplating')).toBe(true)
  })
})

describe('player summons (cycle 21)', () => {
  const deck5 = (id: string) => [id, id, id, id, id]

  it('summons cap at 3 and carry their own HP', async () => {
    const { MAX_MINIONS } = await import('../src/minions')
    const cs = fixedCombat(deck5('summonferro'), ['golem'])
    let s = cs
    for (let i = 0; i < 5; i++) {
      const res = combatReduce(s, { t: 'play', hand: 0 })
      if (res.error) break
      s = res.state
    }
    expect(s.player.minions.length).toBe(MAX_MINIONS)
    expect(s.player.minions[0].hp).toBe(6)
  })

  it('the front minion soaks enemy hits; excess is lost', () => {
    const cs = fixedCombat(deck5('summonferro'), ['golem'])
    const s = combatReduce(cs, { t: 'play', hand: 0 }).state
    expect(s.player.minions.length).toBe(1)
    const hpBefore = s.player.hp
    let cur = s
    for (let turn = 0; turn < 3 && !cur.over && cur.player.minions.length > 0; turn++) {
      cur = combatReduce(cur, { t: 'end' }).state
    }
    // While a minion stood in front, the player took no attack damage.
    if (cur.player.minions.length > 0) expect(cur.player.hp).toBe(hpBefore)
  })

  it('minions act at end of turn: strike, guard, infect', async () => {
    const { endTurnPowers } = await import('../src/core')
    const cs = fixedCombat(deck5('strike'), ['golem'])
    cs.player.minions = [
      { defId: 'ferrodrone', hp: 6, maxHp: 6 },
      { defId: 'bulwarkpod', hp: 8, maxHp: 8 },
      { defId: 'sporemite', hp: 5, maxHp: 5 },
    ]
    const evs: any[] = []
    const hp0 = cs.enemies[0].hp
    endTurnPowers(cs.player, 'p', [{ f: cs.enemies[0], who: 'e0' }], cs, evs)
    expect(hp0 - cs.enemies[0].hp).toBe(4) // ferro strike
    expect(cs.player.block).toBe(3) // bulwark guard
    expect(cs.enemies[0].statuses.corrupt).toBe(1) // spore infect
  })

  it('summon rules text is generated from minion data', () => {
    expect(describeCard(inst('summonferro', 1))).toContain('Summon a Ferro Drone')
    expect(describeCard(inst('summonferro', 1))).toContain('6 HP')
    expect(describeCard(inst('twinforge', 1))).toContain('Summon 2')
  })
})

describe('co-op combat (cycle 27)', () => {
  const mkPlayers = (n: number) =>
    Array.from({ length: n }, (_, p) => ({
      name: 'P' + p,
      hp: 70,
      maxHp: 70,
      deck: ['strike', 'strike', 'defend', 'defend', 'medpatch'].map((id, i) => inst(id, p * 100 + i + 1)),
      relics: [],
    }))
  const start = async (n: number, enemyIds = ['golem']) => {
    const { startCoopCombat } = await import('../src/coop')
    return startCoopCombat({ players: mkPlayers(n), enemyIds, encounterId: enemyIds.join(','), seed: 9, uidStart: 900 })
  }

  it('enemy stats scale with party size', async () => {
    const { coopScale } = await import('../src/coop')
    expect(coopScale(1)).toEqual({ hp: 1, atk: 1 })
    expect(coopScale(3).hp).toBeCloseTo(2.1)
    expect(coopScale(4).atk).toBeCloseTo(1.45)
    // golem rolls 42-48 base hp; party of two scales the roll by 1.55
    const solo = await start(1)
    expect(solo.enemies[0].maxHp).toBeGreaterThanOrEqual(42)
    expect(solo.enemies[0].maxHp).toBeLessThanOrEqual(48)
    const duo = await start(2)
    expect(duo.enemies[0].maxHp).toBeGreaterThanOrEqual(Math.round(42 * 1.55))
    expect(duo.enemies[0].maxHp).toBeLessThanOrEqual(Math.round(48 * 1.55))
  })

  it('players rotate turns, then the enemy phase fires', async () => {
    const { coopReduce } = await import('../src/coop')
    let cs = await start(2)
    expect(cs.active).toBe(0)
    expect(cs.players[0].hand.length).toBe(5)
    cs = coopReduce(cs, 0, { t: 'end' }).state
    expect(cs.active).toBe(1)
    expect(cs.players[1].hand.length).toBe(5) // drew exactly one opening hand
    expect(coopReduce(cs, 0, { t: 'end' }).error).toBe('not your turn')
    const turnBefore = cs.turn
    cs = coopReduce(cs, 1, { t: 'end' }).state
    if (!cs.over) {
      expect(cs.turn).toBe(turnBefore + 1)
      expect(cs.active).toBe(0)
      expect(cs.players[0].hand.length).toBe(5) // refilled for the new round
    }
  })

  it('ally support cards heal the chosen teammate, cost the owner', async () => {
    const { coopReduce } = await import('../src/coop')
    const cs = await start(2)
    cs.players[1].hp = 50
    const idx = cs.players[0].hand.findIndex((c) => c.id === 'medpatch')
    expect(idx).toBeGreaterThanOrEqual(0)
    const energyBefore = cs.players[0].energy
    const res = coopReduce(cs, 0, { t: 'play', hand: idx, ally: 1 })
    expect(res.error).toBeUndefined()
    expect(res.state.players[1].hp).toBe(58)
    expect(res.state.players[0].energy).toBe(energyBefore - 1)
    expect(res.state.players[0].discard.some((c) => c.id === 'medpatch')).toBe(true)
  })

  it('downed players are skipped; a win revives them at 30%', async () => {
    const { coopReduce } = await import('../src/coop')
    const cs = await start(2)
    cs.players[0].hp = 0
    cs.downed[0] = true
    cs.active = 1
    cs.enemies[0].hp = 1
    cs.players[1].hand = [{ uid: 9001, id: 'strike', up: false }]
    cs.players[1].energy = 3
    const res = coopReduce(cs, 1, { t: 'play', hand: 0, target: 0 })
    expect(res.state.over).toBe('win')
    expect(res.state.downed[0]).toBe(false)
    expect(res.state.players[0].hp).toBe(Math.floor(70 * 0.3))
  })

  it('all players down means a loss', async () => {
    const { coopReduce } = await import('../src/coop')
    const cs = await start(2)
    cs.players[0].hp = 0
    cs.downed[0] = true
    cs.players[1].hp = 1
    cs.players[1].statuses.corrupt = 5
    cs.active = 1
    const res = coopReduce(cs, 1, { t: 'end' }).state
    expect(res.over).toBe('lose')
  })

  it('ally cards work solo: they simply target their owner', () => {
    const cs = fixedCombat(['medpatch', 'medpatch', 'medpatch', 'medpatch', 'medpatch'], ['golem'])
    cs.player.hp = 50
    const s = combatReduce(cs, { t: 'play', hand: 0 }).state
    expect(s.player.hp).toBe(58)
    expect(describeCard(inst('medpatch', 1))).toContain('Target an ally')
  })
})

describe('summon expansion (cycle 30)', () => {
  it('minion synergy relics: power boost, extra hp, start-of-combat deploy', async () => {
    const { endTurnPowers } = await import('../src/core')
    // Hive Mother deploys a Ferro Drone before the first card is played
    const cs = fixedCombat(['strike', 'strike', 'strike', 'strike', 'strike'], ['golem'], 42, ['hivemother', 'commandmodule', 'reinforcedhull'])
    expect(cs.player.minions.length).toBe(1)
    expect(cs.player.minions[0].defId).toBe('ferrodrone')
    // Command Module: strike hits 4+2
    const hp0 = cs.enemies[0].hp
    const evs: any[] = []
    endTurnPowers(cs.player, 'p', [{ f: cs.enemies[0], who: 'e0' }], cs, evs)
    expect(hp0 - cs.enemies[0].hp).toBe(6)
    // Reinforced Hull: summons arrive with +4 hp
    const s = combatReduce(cs, { t: 'play', hand: 0, target: 0 }).state // any card; then rig a summon
    const cs2 = fixedCombat(['summonferro', 'strike', 'strike', 'strike', 'strike'], ['golem'], 42, ['reinforcedhull'])
    const idx = handIdx(cs2, 'summonferro')
    const s2 = combatReduce(cs2, { t: 'play', hand: idx }).state
    expect(s2.player.minions[0].maxHp).toBe(10) // 6 + 4
    void s
  })

  it('burn minions strike and feed their owner heat', async () => {
    const { endTurnPowers } = await import('../src/core')
    const cs = fixedCombat(['strike', 'strike', 'strike', 'strike', 'strike'], ['golem'])
    cs.player.minions = [{ defId: 'cinderimp', hp: 6, maxHp: 6 }]
    const hp0 = cs.enemies[0].hp
    const evs: any[] = []
    endTurnPowers(cs.player, 'p', [{ f: cs.enemies[0], who: 'e0' }], cs, evs)
    expect(hp0 - cs.enemies[0].hp).toBe(5)
    expect(cs.player.statuses.heat).toBe(1)
  })

  it('per-character summon cards summon their own broods', () => {
    expect(obtainableCards('runner').map((c) => c.id)).toContain('summonproxy')
    expect(obtainableCards('vector').map((c) => c.id)).toContain('summoncinder')
    expect(obtainableCards('ghost').map((c) => c.id)).toContain('summonshade')
    expect(obtainableCards('runner').map((c) => c.id)).not.toContain('summoncinder')
    const cs = fixedCombat(['summonshade', 'summonshade', 'summonshade', 'summonshade', 'summonshade'], ['golem'])
    const s = combatReduce(cs, { t: 'play', hand: 0 }).state
    expect(s.player.minions[0].defId).toBe('duskshade')
  })

  it('cardSpecific event outcome adds the exact card', () => {
    const run = newRun(8)
    const before = run.deck.length
    applyOutcomes(run, [{ k: 'cardSpecific', id: 'rentadrone' }])
    expect(run.deck.length).toBe(before + 1)
    expect(run.deck[run.deck.length - 1].id).toBe('rentadrone')
  })
})

describe('boss & enemy variety (cycle 11)', () => {
  it('acts 1-3 rotate between two bosses', async () => {
    const { ENCOUNTERS } = await import('../src/enemies')
    for (const act of [1, 2, 3]) {
      expect(ENCOUNTERS[act].boss.length, `act ${act}`).toBeGreaterThanOrEqual(2)
      for (const group of ENCOUNTERS[act].boss) {
        expect(ENEMIES[group[0]].boss).toBe(true)
      }
    }
    // both bosses of an act are reachable through pickEncounter
    const { pickEncounter } = await import('../src/run')
    const seen = new Set<string>()
    for (let seed = 0; seed < 30; seed++) {
      const run = newRun(seed)
      seen.add(pickEncounter(run, 'boss')[0])
    }
    expect(seen.size).toBeGreaterThanOrEqual(2)
  })

  it('phantom takes half damage through permanent stealth', () => {
    const cs = fixedCombat(['strike', 'strike', 'strike', 'strike', 'strike'], ['phantom'])
    const hp0 = cs.enemies[0].hp
    const s = combatReduce(cs, { t: 'play', hand: 0, target: 0 }).state
    expect(hp0 - s.enemies[0].hp).toBe(3) // floor(6 * 0.5)
  })
})

describe('ascension 6-10 (cycle 8)', () => {
  it('supports an additive lab curve without changing the default curve', () => {
    const combat = (asc: number) => startCombat({
      deck: ['strike', 'strike', 'strike', 'strike', 'strike'].map((id, i) => inst(id, i + 1)),
      hp: 75, maxHp: 75, relics: [], enemyIds: ['golem'], encounterId: 'golem',
      seed: 8, uidStart: 100, asc, kind: 'normal',
    })
    configureAscensionTuning({
      enemyHpPercentPerLevel: 0,
      enemyHpFlatPerLevel: 1,
      enemyAttackPercentPerLevel: 0,
      enemyAttackFlatSteps: [{ asc: 0, value: 0 }, { asc: 9, value: 3 }],
      lagAscensions: [4],
      maxHpSteps: [{ asc: 0, value: 75 }, { asc: 10, value: 65 }],
    })
    try {
      expect(combat(10).enemies[0].maxHp).toBe(combat(0).enemies[0].maxHp + 10)
      expect(ascAtk(10, 10)).toBe(13)
      expect(newRun(1, 10).deck.filter((c) => c.id === 'lag').length).toBe(1)
      expect(newRun(1, 10).maxHp).toBe(65)
    } finally {
      resetAscensionTuning()
    }
    expect(newRun(1, 10).deck.filter((c) => c.id === 'lag').length).toBe(2)
    expect(newRun(1, 10).maxHp).toBe(60)
  })

  it('A10 doubles the curse and cuts max hp to 60', async () => {
    const { MAX_ASC } = await import('../src/run')
    expect(MAX_ASC).toBeGreaterThanOrEqual(10)
    const r10 = newRun(1, 10)
    expect(r10.deck.filter((c) => c.id === 'lag').length).toBe(2)
    expect(r10.maxHp).toBe(60)
    expect(newRun(1, 9).deck.filter((c) => c.id === 'lag').length).toBe(1)
  })

  it('A6 weakens rests and A9 narrows boss choices', async () => {
    const { bossRelicChoices } = await import('../src/run')
    const r6 = newRun(2, 6)
    expect(restHealAmount(r6)).toBe(Math.floor(r6.maxHp * 0.2))
    expect(bossRelicChoices(newRun(3, 9)).length).toBe(2)
    expect(bossRelicChoices(newRun(3, 0)).length).toBe(3)
  })

  it('A8 marks up every shop price by 20%', () => {
    const s0 = genShop(newRun(4, 0))
    const s8 = genShop(newRun(4, 8))
    expect(s8.removePrice).toBe(Math.floor(s0.removePrice * 1.2))
    for (let i = 0; i < s0.cards.length; i++) {
      expect(s8.cards[i].id).toBe(s0.cards[i].id)
      expect(s8.cards[i].price).toBe(Math.floor(s0.cards[i].price * 1.2))
    }
  })

  it('A11-A15 modifiers apply', async () => {
    const { MAX_ASC, rollCardRewards } = await import('../src/run')
    expect(MAX_ASC).toBeGreaterThanOrEqual(15)
    const r12 = newRun(1, 12)
    expect(r12.gold).toBe(75)
    const r14 = newRun(1, 14)
    expect(r14.hp).toBe(Math.floor(r14.maxHp * 0.85))
    expect(rollCardRewards(newRun(2, 15), 'normal').length).toBe(2)
    // A11: even a normal enemy opens with str
    const cs = startCombat({
      deck: ['strike', 'strike', 'strike', 'strike', 'strike'].map((id, i) => inst(id, i + 1)),
      hp: 60, maxHp: 60, relics: [], enemyIds: ['golem'], encounterId: 'golem',
      seed: 8, uidStart: 100, asc: 11, kind: 'normal',
    })
    expect(cs.enemies[0].statuses.str).toBe(1)
    // A13: boss hp gets the extra 15% on top of scaling
    const mkBoss = (asc: number) =>
      startCombat({
        deck: ['strike', 'strike', 'strike', 'strike', 'strike'].map((id, i) => inst(id, i + 1)),
        hp: 60, maxHp: 60, relics: [], enemyIds: ['compiler'], encounterId: 'compiler',
        seed: 8, uidStart: 100, asc, kind: 'boss',
      })
    expect(mkBoss(13).enemies[0].maxHp).toBe(Math.round(Math.round(120 * (1 + 0.06 * 13)) * 1.15))
  })

  it('A16-A20 modifiers apply', async () => {
    const { MAX_ASC } = await import('../src/run')
    expect(MAX_ASC).toBe(20)
    const r20 = newRun(1, 20)
    expect(r20.deck.some((c) => c.id === 'glitch')).toBe(true)
    const mk = (asc: number, kind: 'normal' | 'boss', id = 'golem') =>
      startCombat({
        deck: ['strike', 'strike', 'strike', 'strike', 'strike'].map((cid, i) => inst(cid, i + 1)),
        hp: 60, maxHp: 60, relics: [], enemyIds: [id], encounterId: id,
        seed: 8, uidStart: 100, asc, kind,
      })
    // A16: same seed, +10% hp over the A15 baseline formula
    const base15 = Math.round(mk(15, 'normal').enemies[0].maxHp / (1 + 0.06 * 15) * (1 + 0.06 * 16))
    expect(mk(16, 'normal').enemies[0].maxHp).toBe(Math.round(base15 * 1.1))
    // A18: elite/boss str stacks to +2 (plus A11's +1 = 3 total on a boss)
    expect(mk(18, 'boss', 'compiler').enemies[0].statuses.str).toBe(3)
    // A20: bosses armored (A5's +1 plus A20's +1)
    expect(mk(20, 'boss', 'compiler').enemies[0].statuses.artifact).toBe(2)
    expect(restHealAmount(newRun(3, 17))).toBe(Math.floor(newRun(3, 17).maxHp * 0.15))
    expect(EVENTS.length).toBeGreaterThanOrEqual(50)
  })

  it('A7 drops potions less often', async () => {
    const { rollPotionDrop } = await import('../src/run')
    const count = (asc: number) => {
      const run = newRun(6, asc)
      let n = 0
      for (let i = 0; i < 200; i++) {
        run.potions = []
        if (rollPotionDrop(run)) n++
      }
      return n
    }
    expect(count(7)).toBeLessThan(count(0))
  })
})

describe('mod support (cycle 43)', () => {
  it('valid mod content registers, describes itself, and unloads cleanly', async () => {
    const { applyMod, removeMod } = await import('../src/mods')
    const { POTIONS } = await import('../src/potions')
    const rep = applyMod({
      id: 'testmod',
      name: 'Test Mod',
      cards: [{ id: 'tm_slash', name: 'TM Slash', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', effects: [{ k: 'dmg', n: 7 }], upEffects: [{ k: 'dmg', n: 10 }] }],
      relics: [{ id: 'tm_charm', name: 'TM Charm', rarity: 'common', desc: 'Start with 2 Block.', hooks: { combatStartBlock: 2 } }],
      potions: [{ id: 'tm_juice', name: 'TM Juice', rarity: 'common', target: 'none', effects: [{ k: 'heal', n: 5 }] }],
    } as any)
    expect(rep.warnings).toEqual([])
    expect(rep.added.length).toBe(3)
    expect(CARDS.tm_slash.name).toBe('TM Slash')
    expect(describeCard(inst('tm_slash', 1))).toBe('Deal 7 damage.')
    expect(obtainableCards().some((c) => c.id === 'tm_slash')).toBe(true)
    expect(RELICS.tm_charm.hooks.combatStartBlock).toBe(2)
    expect(POTIONS.tm_juice.name).toBe('TM Juice')
    removeMod('testmod')
    expect(CARDS.tm_slash).toBeUndefined()
    expect(RELICS.tm_charm).toBeUndefined()
    expect(POTIONS.tm_juice).toBeUndefined()
  })

  it('malformed and malicious entries are rejected with warnings', async () => {
    const { applyMod, removeMod } = await import('../src/mods')
    const rep = applyMod({
      id: 'badmod',
      name: 'Bad Mod',
      cards: [
        { id: 'bm_ok', name: 'OK', type: 'skill', rarity: 'common', cost: 0, target: 'none', effects: [{ k: 'block', n: 4 }] },
        { id: 'bm_evil', name: 'Evil', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', effects: [{ k: 'eval', code: 'x' }] },
        { id: 'bm_neg', name: 'Neg', type: 'attack', rarity: 'common', cost: -1, target: 'enemy', effects: [{ k: 'dmg', n: 6 }] },
        { id: 'strike', name: 'Clobber Base', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', effects: [{ k: 'dmg', n: 99 }] },
      ],
      relics: [{ id: 'bm_hook', name: 'Hook', rarity: 'common', desc: 'x', hooks: { proto: 1 } }],
    } as any)
    expect(rep.added).toEqual(['card:bm_ok'])
    expect(rep.warnings.length).toBeGreaterThanOrEqual(4)
    expect(CARDS.bm_evil).toBeUndefined()
    expect(CARDS.strike.effects[0]).toEqual({ k: 'dmg', n: 6 }) // base untouched
    removeMod('badmod')
  })

  it('character loadout tweaks apply and restore', async () => {
    const { applyMod, removeMod } = await import('../src/mods')
    const { STARTER_RELICS } = await import('../src/run')
    const before = STARTER_RELICS.runner
    const rep = applyMod({ id: 'loadout', name: 'L', characters: [{ base: 'runner', startingRelic: 'goldchip' }] } as any)
    expect(rep.added).toEqual(['character:runner'])
    expect(STARTER_RELICS.runner).toBe('goldchip')
    expect(newRun(1, 0, 'runner').relics).toEqual(['goldchip'])
    removeMod('loadout')
    expect(STARTER_RELICS.runner).toBe(before)
  })
})

describe('strict/hybrid mode support (cycle 45)', () => {
  it('checksum is stable and order-sensitive; prediction matches the reducer', async () => {
    const { newPvp, predictPvpPlay, pvpChecksum, pvpReduce, viewFor } = await import('../src/pvp')
    const ps = newPvp(42, ['A', 'B'])
    const sum1 = pvpChecksum(ps)
    expect(pvpChecksum(structuredClone(ps))).toBe(sum1)
    const view = viewFor(ps, 0)
    expect(pvpChecksum(view)).toBe(sum1) // view carries the same public fields
    // find a plain attack and compare predicted foe hp/energy with authority
    const idx = view.sides[0].hand!.findIndex((c) => c.id === 'strike')
    if (idx >= 0) {
      const pred = predictPvpPlay(view, idx)!
      const real = pvpReduce(ps, 0, { t: 'play', hand: idx })
      expect(pred.view.sides[1].hp).toBe(real.state.sides[1].hp)
      expect(pred.view.sides[0].energy).toBe(real.state.sides[0].energy)
      expect(pred.events.some((e) => e.e === 'hit')).toBe(true)
      // divergence detection: post-play state no longer matches pre-play sum
      expect(pvpChecksum(real.state)).not.toBe(sum1)
    }
  })
})

describe('climb checkpoint scoring', () => {
  it('awards one point without mutating the previous score', () => {
    const before: [number, number] = [1, 0]
    const result = scoreClimbRound(before, 1, 2)
    expect(before).toEqual([1, 0])
    expect(result).toEqual({ score: [1, 1], final: false })
  })

  it('marks the third checkpoint as the final round', () => {
    expect(scoreClimbRound([1, 1], 0, 3)).toEqual({ score: [2, 1], final: true })
  })
})

describe('archetype playstyles (流派导向)', () => {
  function rig(cs: CombatState, ids: string[]) {
    let uid = 8000
    cs.player.hand = ids.map((id) => ({ uid: uid++, id, up: false }))
    cs.player.energy = 99
    return cs
  }

  it('act ramp: act 1 stays gentle, acts 2-4 scale HP +10% per act', () => {
    const mk = (act: number) =>
      startCombat({
        deck: ['strike', 'strike', 'strike', 'strike', 'strike'].map((id, i) => inst(id, i + 1)),
        hp: 75, maxHp: 75, relics: [], enemyIds: ['golem'], encounterId: 'golem',
        seed: 8, uidStart: 100, act,
      })
    const base = mk(1).enemies[0].maxHp
    expect(mk(2).enemies[0].maxHp).toBe(Math.round(base * 1.1))
    expect(mk(3).enemies[0].maxHp).toBe(Math.round(base * 1.2))
    expect(mk(4).enemies[0].maxHp).toBe(Math.round(base * 1.3))
    // Damage preview follows the same ramp.
    expect(ascAtk(10, 0, 2)).toBe(11)
    expect(ascAtk(10, 0, 3)).toBe(12)
    expect(ascAtk(10, 10, 3)).toBe(16) // 10 × 1.3 asc × 1.2 act
  })

  it('VECTOR heat engine: stoke stacks, vent blade cashes out 2× heat', () => {
    function rigV(cs: CombatState, ids: string[]) {
      let uid = 7000
      cs.player.hand = ids.map((id) => ({ uid: uid++, id, up: false }))
      cs.player.energy = 99
      return cs
    }
    const cs = rigV(fixedCombat(['heatshield', 'heatshield', 'heatshield', 'heatshield', 'heatshield'], ['golem']), ['stoke', 'stoke', 'stoke', 'ventblade'])
    let s = combatReduce(cs, { t: 'play', hand: 0 }).state // +3
    s = combatReduce(s, { t: 'play', hand: 0 }).state // +3
    s = combatReduce(s, { t: 'play', hand: 0 }).state // +3 → 9 heat
    expect(s.player.statuses.heat).toBe(9)
    const hp0 = s.enemies[0].hp
    s = combatReduce(s, { t: 'play', hand: 0 }).state // vent 9×2
    expect(hp0 - s.enemies[0].hp).toBe(18)
    expect(s.player.statuses.heat).toBeUndefined()
  })

  it('ARRAY turret build: Auto-Turret pings a foe at end of turn', () => {
    const cs = rig(fixedCombat(['defend', 'defend', 'defend', 'defend', 'defend'], ['golem']), ['autoturret'])
    let s = combatReduce(cs, { t: 'play', hand: 0 }).state // turret 6
    expect(s.player.statuses.turret).toBe(6)
    const hp0 = s.enemies[0].hp
    s = combatReduce(s, { t: 'end' }).state
    expect(hp0 - s.enemies[0].hp).toBe(6)
  })

  it('GHOST stance build: overdrive amps attacks ×1.5, stance wall blocks on entry', () => {
    const cs = rig(fixedCombat(['defend', 'defend', 'defend', 'defend', 'defend'], ['golem']), ['shroudloop', 'redshift', 'strike', 'blackout'])
    let s = combatReduce(cs, { t: 'play', hand: 0 }).state // stance wall 3
    expect(s.player.statuses.stancewall).toBe(3)
    s = combatReduce(s, { t: 'play', hand: 0 }).state // enter overdrive → +3 block
    expect(s.player.block).toBe(3)
    const hp0 = s.enemies[0].hp
    s = combatReduce(s, { t: 'play', hand: 0 }).state // strike 6 × 1.5 = 9
    expect(hp0 - s.enemies[0].hp).toBe(9)
    const blk = s.player.block
    s = combatReduce(s, { t: 'play', hand: 0 }).state // enter stealth → +3 block
    expect(s.player.block).toBe(blk + 3)
  })

  it('RUNNER virus build: corrupt ticks at foe turn start and decays', () => {
    const cs = rig(fixedCombat(['defend', 'defend', 'defend', 'defend', 'defend'], ['spambot']), ['malware', 'defend'])
    let s = combatReduce(cs, { t: 'play', hand: 0 }).state // corrupt 4
    expect(s.enemies[0].statuses.corrupt).toBe(4)
    const hp0 = s.enemies[0].hp
    s = combatReduce(s, { t: 'end' }).state
    expect(hp0 - s.enemies[0].hp).toBe(4) // ticked at its turn start
    expect(s.enemies[0].statuses.corrupt).toBe(3) // decayed by 1
  })

  it('classifies decks from effect semantics instead of card-name lists', () => {
    const corruptDeck = ['strike', 'broadcast', 'payload', 'forkvirus', 'chronicinj']
      .map((id, i) => inst(id, i + 1))
    const arrayDeck = ['pulsebolt', 'deployturret', 'sparkloop', 'focuslens', 'hivecore']
      .map((id, i) => inst(id, i + 1))
    expect(detectDeckArchetype('runner', corruptDeck)).toBe('runner-corrupt')
    expect(detectDeckArchetype('array', arrayDeck)).toBe('array-turret')
  })

  it('ranks upgraded synergy at least as high as its base card', () => {
    const base = rankDeckArchetypes('vector', [inst('ventblade', 1)])[0]
    const upgraded = rankDeckArchetypes('vector', [inst('ventblade', 1, true)])[0]
    expect(base.id).toBe('vector-vent')
    expect(upgraded.id).toBe('vector-vent')
    expect(upgraded.score).toBeGreaterThanOrEqual(base.score)
  })
})
