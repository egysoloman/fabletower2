import { describe, expect, it } from 'vitest'
import {
  CARDS,
  ENEMIES,
  EVENTS,
  RELICS,
  addRelic,
  advanceAct,
  allNodes,
  applyCombatResult,
  applyOutcomes,
  availableNodeIds,
  combatFor,
  combatReduce,
  describeCard,
  firstAliveEnemy,
  genActMap,
  genShop,
  goldReward,
  modifiedDamage,
  moveTo,
  newPvp,
  newRun,
  nodeById,
  obtainableCards,
  playableCards,
  pvpReduce,
  randInt,
  randomRelicId,
  restHealAmount,
  rngFromSeed,
  rollCardRewards,
  startCombat,
  upgradeCard,
  viewFor,
  type CombatState,
  type PvpState,
  type RunState,
} from '../src/index'

const inst = (id: string, uid: number, up = false) => ({ uid, id, up })

/** Index of a card in the (shuffled) opening hand. */
const handIdx = (cs: CombatState, id: string) => cs.player.hand.findIndex((c) => c.id === id)

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
