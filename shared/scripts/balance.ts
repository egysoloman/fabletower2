/**
 * Reproducible balance lab.
 *
 * - greedy policy: deliberately shallow play and drafting; character floor
 * - archetype policy: synergy-aware drafting + board evaluation; practical ceiling proxy
 *
 * Usage:
 *   npm run balance -w shared -- [seeds] [ascension] [--record]
 *
 * `--record` updates docs/balance/{history.json,latest.md,latest.svg} and the
 * client-facing public snapshot used by the Codex and admin dashboard.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ARCHETYPES,
  CARDS,
  addCardToDeck,
  addRelic,
  advanceAct,
  applyCombatResult,
  applyOutcomes,
  archetypesFor,
  availableNodeIds,
  cardArchetypeScore,
  cardCost,
  combatFor,
  combatReduce,
  genShop,
  goldReward,
  moveTo,
  newRun,
  nodeById,
  obtainableCards,
  pickEvent,
  randomRelicId,
  removeCard,
  restHealAmount,
  rollCardRewards,
  upgradeCard,
  type ArchetypeId,
  type CardDef,
  type CharId,
  type CombatState,
  type Effect,
  type RunState,
} from '../src/index'

const CHARS: CharId[] = ['runner', 'vector', 'ghost', 'array']
const args = process.argv.slice(2)
const positional = args.filter((x) => !x.startsWith('--'))
const SEEDS = Math.max(1, Number(positional[0] ?? 40))
const ASC = Math.max(0, Math.min(20, Number(positional[1] ?? 0)))
const RECORD = args.includes('--record')
const REACH_FLOORS = [4, 8, 12, 16, 20, 24]

type Policy = 'greedy' | 'archetype' | 'ceiling'

interface RunMetrics {
  combats: number
  elites: number
  bosses: number
  turns: number
  damageTaken: number
  deathEncounter: string | null
}

interface RunResult extends RunMetrics {
  win: boolean
  act: number
  floor: number
  hp: number
  maxHp: number
  deckSize: number
  upgrades: number
  relics: number
  archetypeScore: number
}

interface Distribution {
  mean: number
  min: number
  p25: number
  median: number
  p75: number
  p90: number
  max: number
}

export interface BalanceRow {
  char: CharId
  policy: Policy
  archetype: ArchetypeId | null
  label: string
  runs: number
  wins: number
  winRate: number
  floor: Distribution
  deathByAct: Record<string, number>
  reach: Record<string, number>
  floorHistogram: Record<string, number>
  topDeathEncounters: { id: string; deaths: number }[]
  averages: {
    damageTaken: number
    turnsPerCombat: number
    deckSize: number
    upgrades: number
    relics: number
    archetypeScore: number
  }
}

export interface BalanceReport {
  schema: 1
  generatedAt: string
  commit: string
  seeds: number
  ascension: number
  methodology: {
    lower: string
    upper: string
    caveat: string
  }
  rows: BalanceRow[]
  comparison: {
    char: CharId
    lowerMean: number
    upperMean: number
    gap: number
    bestArchetype: ArchetypeId
    lowerWinRate: number
    upperWinRate: number
  }[]
}

function incomingDamage(cs: CombatState): number {
  return cs.enemies.reduce((total, e) =>
    total + (!e.dead && e.intent?.dmg ? e.intent.dmg * (e.intent.times ?? 1) : 0), 0)
}

function effectAmount(effect: Effect, kind: Effect['k']): number {
  return effect.k === kind && 'n' in effect ? Number(effect.n) : 0
}

function directDamage(def: CardDef, upgraded: boolean): number {
  return (upgraded ? def.upEffects : def.effects).reduce((sum, effect) => {
    if (effect.k === 'dmg' || effect.k === 'dmgAll') return sum + effect.n * (effect.times ?? 1)
    if (effect.k === 'dmgIfCombo') return sum + effect.n + effect.bonus * 0.6
    if (effect.k === 'dmgIfStance') return sum + effect.n + effect.bonus * 0.7
    if (effect.k === 'dmgHeatBonus') return sum + effect.n + effect.bonus * 0.6
    if (effect.k === 'dmgPerPower' || effect.k === 'dmgPerAuto') return sum + effect.base + effect.per * 2
    return sum
  }, 0)
}

function directBlock(def: CardDef, upgraded: boolean): number {
  return (upgraded ? def.upEffects : def.effects).reduce((sum, effect) =>
    sum + effectAmount(effect, 'block'), 0)
}

/** Existing intentionally-simple policy kept stable as the lower-bound ruler. */
function greedyStep(cs: CombatState): CombatState {
  const p = cs.player
  const alive = cs.enemies.map((e, i) => ({ e, i })).filter((x) => !x.e.dead)
  const playable = p.hand
    .map((c, i) => ({ c, i, def: CARDS[c.id] }))
    .filter((x) => !x.def.unplayable && cardCost(x.c) <= p.energy)
  const end = () => combatReduce(cs, { t: 'end' }).state
  if (playable.length === 0 || alive.length === 0) return end()

  const weakest = alive.reduce((a, b) => (a.e.hp <= b.e.hp ? a : b))
  const lethal = playable.find((x) => directDamage(x.def, x.c.up) + (p.statuses.str ?? 0) >= weakest.e.hp + weakest.e.block)
  const blocker = [...playable].sort((a, b) => directBlock(b.def, b.c.up) - directBlock(a.def, a.c.up))[0]
  const power = playable.find((x) => x.def.type === 'power')
  const attacker = [...playable].sort((a, b) => directDamage(b.def, b.c.up) - directDamage(a.def, a.c.up))[0]

  let choice = lethal
  if (!choice && incomingDamage(cs) > p.block + 4 && blocker && directBlock(blocker.def, blocker.c.up) > 0) choice = blocker
  if (!choice) choice = power ?? (directDamage(attacker.def, attacker.c.up) > 0 ? attacker : playable[0])
  const target = choice.def.target === 'enemy' ? weakest.i : undefined
  const res = combatReduce(cs, { t: 'play', hand: choice.i, target })
  return res.error ? end() : res.state
}

const GOOD_STATUS_WEIGHT: Record<string, number> = {
  str: 5, thorns: 2, plating: 3, turret: 3, viral: 3, energyGain: 7,
  drawGain: 5, regen: 4, barricade: 12, kernel: 5, hyper: 7, chronic: 8,
  heat: 1.5, coolant: 2, ignition: 2, reactor: 10, artifact: 6,
  overdrive: 2, stealth: 5, stancewall: 4, momentum: 5, tempoloop: 5, focus: 6,
}
const BAD_STATUS_WEIGHT: Record<string, number> = { weak: 3, vuln: 4, corrupt: 3 }

function statusValue(statuses: Record<string, number | undefined>, weights: Record<string, number>): number {
  return Object.entries(statuses).reduce((sum, [id, n]) => sum + (n ?? 0) * (weights[id] ?? 0), 0)
}

/** Value one action after the reducer resolves it; no rules are reimplemented. */
function transitionValue(before: CombatState, after: CombatState, profile: ArchetypeId): number {
  if (after.over === 'win') return 1_000_000
  const enemyBefore = before.enemies.reduce((s, e) => s + (e.dead ? 0 : e.hp + e.block * 0.35), 0)
  const enemyAfter = after.enemies.reduce((s, e) => s + (e.dead ? 0 : e.hp + e.block * 0.35), 0)
  const threat = incomingDamage(before)
  const usefulBeforeBlock = Math.min(before.player.block, threat)
  const usefulAfterBlock = Math.min(after.player.block, threat)
  let value = (enemyBefore - enemyAfter) * 5
  value += (usefulAfterBlock - usefulBeforeBlock) * 2.6
  value += Math.max(0, after.player.block - threat) * 0.15
  value += statusValue(after.player.statuses, GOOD_STATUS_WEIGHT) - statusValue(before.player.statuses, GOOD_STATUS_WEIGHT)
  value -= statusValue(after.player.statuses, BAD_STATUS_WEIGHT) - statusValue(before.player.statuses, BAD_STATUS_WEIGHT)
  for (let i = 0; i < before.enemies.length; i++) {
    value += statusValue(after.enemies[i]?.statuses ?? {}, BAD_STATUS_WEIGHT)
      - statusValue(before.enemies[i]?.statuses ?? {}, BAD_STATUS_WEIGHT)
  }
  value += (after.player.energy - before.player.energy) * 0.5
  value += (after.player.hand.length - before.player.hand.length) * 0.35
  const played = before.player.hand.find((c) => !after.player.hand.some((n) => n.uid === c.uid))
  if (played) value += cardArchetypeScore(played.id, profile, played.up) * 0.45
  return value
}

function archetypeStep(cs: CombatState, profile: ArchetypeId): CombatState {
  const playable = cs.player.hand
    .map((card, hand) => ({ card, hand, def: CARDS[card.id] }))
    .filter((x) => !x.def.unplayable && cardCost(x.card) <= cs.player.energy)
  if (playable.length === 0) return combatReduce(cs, { t: 'end' }).state

  let best: { state: CombatState; value: number } | null = null
  for (const choice of playable) {
    const targets = choice.def.target === 'enemy'
      ? cs.enemies.map((e, i) => (!e.dead ? i : -1)).filter((i) => i >= 0)
      : [undefined]
    for (const target of targets) {
      const res = combatReduce(cs, { t: 'play', hand: choice.hand, target })
      if (res.error) continue
      const value = transitionValue(cs, res.state, profile)
      if (!best || value > best.value) best = { state: res.state, value }
    }
  }
  // Do not spend cards for negligible value once the turn is already safe.
  if (!best || (best.value < 0.6 && cs.player.block >= incomingDamage(cs))) {
    return combatReduce(cs, { t: 'end' }).state
  }
  return best.state
}

function baseCardQuality(def: CardDef, upgraded = false): number {
  const effects = upgraded ? def.upEffects : def.effects
  let score = directDamage(def, upgraded) * 0.28 + directBlock(def, upgraded) * 0.24
  for (const effect of effects) {
    if (effect.k === 'draw') score += effect.n * 1.5
    else if (effect.k === 'energy') score += effect.n * 2
    else if (effect.k === 'heal') score += effect.n * 0.35
    else if (effect.k === 'status') score += effect.to === 'self' ? 2 : 1.5
    else if (effect.k === 'summonAlly') score += 5
  }
  if (def.rarity === 'rare') score += 2
  else if (def.rarity === 'uncommon') score += 1
  return score
}

function draftScore(id: string, profile: ArchetypeId, upgraded = false): number {
  return baseCardQuality(CARDS[id], upgraded) + cardArchetypeScore(id, profile, upgraded) * 1.7
}

function chooseDraft(run: RunState, offered: string[], policy: Policy, profile: ArchetypeId | null): string | undefined {
  if (policy === 'greedy') {
    return offered.find((id) => CARDS[id].rarity !== 'common') ?? (run.deck.length < 14 ? offered[0] : undefined)
  }
  // Ceiling mode is a rarity-preserving draft oracle: it may select the best
  // card of any rarity that actually appeared among the three rewards. This
  // deliberately answers "what if this archetype gets its pieces?".
  const rarities = new Set(offered.map((id) => CARDS[id].rarity))
  const pool = obtainableCards(run.char).filter((def) => def.rarity !== 'starter' && rarities.has(def.rarity))
  const ranked = pool.map((def) => ({ id: def.id, score: draftScore(def.id, profile!) })).sort((a, b) => b.score - a.score)
  if (run.deck.length >= 18 && CARDS[ranked[0]?.id]?.rarity !== 'rare') return undefined
  const threshold = run.deck.length < 13 ? 4 : run.deck.length < 18 ? 8 : 14
  return ranked[0]?.score >= threshold ? ranked[0].id : undefined
}

function playCombat(run: RunState, kind: 'normal' | 'elite' | 'boss', policy: Policy, profile: ArchetypeId | null, metrics: RunMetrics): boolean {
  let cs = combatFor(run, kind)
  const hpBefore = run.hp
  let guard = 0
  while (!cs.over && guard++ < 500) cs = policy === 'greedy' ? greedyStep(cs) : archetypeStep(cs, profile!)
  metrics.combats++
  if (kind === 'elite') metrics.elites++
  if (kind === 'boss') metrics.bosses++
  metrics.turns += Math.max(1, cs.turn)
  applyCombatResult(run, cs)
  metrics.damageTaken += Math.max(0, hpBefore - run.hp)
  if (cs.over !== 'win') {
    metrics.deathEncounter = cs.encounterId
    return false
  }

  run.gold += goldReward(run, kind)
  const pickId = chooseDraft(run, rollCardRewards(run, kind), policy, profile)
  if (pickId) addCardToDeck(run, pickId)
  if (kind !== 'normal') {
    const relic = randomRelicId(run, kind === 'boss')
    if (relic) addRelic(run, relic)
  }
  return true
}

function removeWorst(run: RunState, profile: ArchetypeId) {
  const removable = run.deck.filter((c) => CARDS[c.id]?.rarity !== 'special')
  const target = [...removable].sort((a, b) => draftScore(a.id, profile, a.up) - draftScore(b.id, profile, b.up))[0]
  if (target) removeCard(run, target.uid)
}

function playEvent(run: RunState, policy: Policy, profile: ArchetypeId | null) {
  const event = pickEvent(run)
  if (policy === 'greedy') return
  const value = (outcomes: typeof event.choices[number]['outcomes']) => outcomes.reduce((sum, o) => {
    if (o.k === 'gold') return sum + o.n * 0.04
    if (o.k === 'damage') return sum - o.n * (run.hp < run.maxHp * 0.55 ? 2 : 1)
    if (o.k === 'heal') return sum + Math.min(o.n, run.maxHp - run.hp)
    if (o.k === 'maxhp') return sum + o.n * 1.8
    if (o.k === 'relic') return sum + 14
    if (o.k === 'cardRandom') return sum + (o.rarity === 'rare' ? 10 : o.rarity === 'uncommon' ? 6 : 3)
    if (o.k === 'upgradeRandom' || o.k === 'removeChoose') return sum + 7
    if (o.k === 'potion') return sum + 3
    if (o.k === 'cardGlitch' || o.k === 'curse') return sum - 9
    if (o.k === 'cardSpecific') return sum + draftScore(o.id, profile!)
    return sum
  }, 0)
  const choice = event.choices
    .filter((c) => !c.needGold || run.gold >= c.needGold)
    .sort((a, b) => value(b.outcomes) - value(a.outcomes))[0]
  if (!choice) return
  const result = applyOutcomes(run, choice.outcomes)
  if (result.removeChoose) removeWorst(run, profile!)
}

function playShop(run: RunState, policy: Policy, profile: ArchetypeId | null) {
  if (policy === 'greedy') return
  const stock = genShop(run)
  const curse = run.deck.find((c) => CARDS[c.id]?.rarity === 'special')
  if (curse && run.gold >= stock.removePrice) {
    run.gold -= stock.removePrice
    removeCard(run, curse.uid)
    run.removesBought++
  }
  const card = stock.cards
    .filter((c) => c.price <= run.gold)
    .map((c) => ({ ...c, score: draftScore(c.id, profile!) }))
    .sort((a, b) => b.score - a.score)[0]
  if (card && card.score >= 10) {
    run.gold -= card.price
    addCardToDeck(run, card.id)
  }
  const relic = stock.relics.filter((r) => r.price <= run.gold).sort((a, b) => b.price - a.price)[0]
  if (relic) {
    run.gold -= relic.price
    addRelic(run, relic.id)
  }
}

function chooseNode(run: RunState, policy: Policy) {
  const nodes = availableNodeIds(run).map((id) => nodeById(run.map, id)!)
  if (policy === 'greedy') {
    const rest = nodes.find((n) => n.type === 'rest')
    if (run.hp < run.maxHp * 0.5 && rest) return rest
    const pool = run.hp < run.maxHp * 0.65 ? nodes.filter((n) => n.type !== 'elite') : nodes
    const order = ['treasure', 'combat', 'event', 'shop', 'rest', 'elite', 'boss']
    return [...(pool.length ? pool : nodes)].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type))
      .find((n) => n.type !== 'elite' || (run.floor >= 5 && run.hp >= run.maxHp * 0.75)) ?? nodes[0]
  }
  const score = (type: typeof nodes[number]['type']) => {
    if (type === 'boss') return 100
    if (type === 'rest') return run.hp < run.maxHp * 0.7 ? 25 : 7
    // A ceiling proxy optimizes survival first: take an elite only from a
    // healthy, already-developed position instead of farming every offer.
    if (type === 'elite') return run.floor >= 5 && run.hp > run.maxHp * 0.85 ? 12 : -10
    if (type === 'treasure') return 16
    if (type === 'shop') return run.gold >= 100 ? 14 : 2
    if (type === 'event') return 10
    return 8
  }
  return [...nodes].sort((a, b) => score(b.type) - score(a.type))[0]
}

function playRun(seed: number, char: CharId, policy: Policy, profile: ArchetypeId | null): RunResult {
  const run = newRun(seed, ASC, char)
  const metrics: RunMetrics = { combats: 0, elites: 0, bosses: 0, turns: 0, damageTaken: 0, deathEncounter: null }
  const result = (win: boolean): RunResult => ({
    ...metrics,
    win,
    act: run.act,
    floor: run.floor,
    hp: run.hp,
    maxHp: run.maxHp,
    deckSize: run.deck.length,
    upgrades: run.deck.filter((c) => c.up).length,
    relics: run.relics.length,
    archetypeScore: profile ? run.deck.reduce((sum, c) => sum + cardArchetypeScore(c.id, profile, c.up), 0) : 0,
  })

  let guard = 0
  while (guard++ < 200) {
    const target = chooseNode(run, policy)
    if (!target) break
    const type = moveTo(run, target.id)
    if (!type) break
    if (type === 'combat' || type === 'elite') {
      if (!playCombat(run, type === 'elite' ? 'elite' : 'normal', policy, profile, metrics)) return result(false)
    } else if (type === 'boss') {
      if (!playCombat(run, 'boss', policy, profile, metrics)) return result(false)
      if (advanceAct(run) === 'victory') return result(true)
    } else if (type === 'rest') {
      if (run.hp < run.maxHp * (policy === 'greedy' ? 0.6 : 0.68)) {
        run.hp = Math.min(run.maxHp, run.hp + restHealAmount(run))
      } else {
        const candidates = run.deck.filter((c) => !c.up && CARDS[c.id].rarity !== 'special')
        const card = policy === 'greedy'
          ? candidates.find((c) => CARDS[c.id].type === 'attack')
          : [...candidates].sort((a, b) => draftScore(b.id, profile!, true) - draftScore(a.id, profile!, true))[0]
        if (card) upgradeCard(run, card.uid)
      }
    } else if (type === 'event') playEvent(run, policy, profile)
    else if (type === 'treasure') run.gold += 25
    else if (type === 'shop') playShop(run, policy, profile)
  }
  return result(false)
}

function rounded(n: number, digits = 1): number {
  return Number(n.toFixed(digits))
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = (sorted.length - 1) * p
  const lo = Math.floor(index)
  const hi = Math.ceil(index)
  return rounded(sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo))
}

function summarize(char: CharId, policy: Policy, archetype: ArchetypeId | null, results: RunResult[]): BalanceRow {
  const floors = results.map((r) => r.floor)
  const wins = results.filter((r) => r.win).length
  const combats = results.reduce((sum, r) => sum + r.combats, 0)
  const mean = (pick: (r: RunResult) => number) => rounded(results.reduce((sum, r) => sum + pick(r), 0) / results.length)
  const deathByAct = Object.fromEntries([1, 2, 3, 4].map((act) => [String(act), results.filter((r) => !r.win && r.act === act).length]))
  const floorHistogram: Record<string, number> = {}
  for (const floor of floors) floorHistogram[String(floor)] = (floorHistogram[String(floor)] ?? 0) + 1
  const encounterCounts = new Map<string, number>()
  for (const r of results) if (r.deathEncounter) encounterCounts.set(r.deathEncounter, (encounterCounts.get(r.deathEncounter) ?? 0) + 1)
  const def = archetype ? ARCHETYPES.find((a) => a.id === archetype)! : null
  return {
    char, policy, archetype,
    label: def
      ? `${def.nameZh} / ${def.name}`
      : policy === 'ceiling' ? '流派上限包络 / Ceiling envelope' : '贪心下限 / Greedy floor',
    runs: results.length,
    wins,
    winRate: rounded((wins / results.length) * 100),
    floor: {
      mean: rounded(floors.reduce((a, b) => a + b, 0) / floors.length),
      min: Math.min(...floors), p25: percentile(floors, 0.25), median: percentile(floors, 0.5),
      p75: percentile(floors, 0.75), p90: percentile(floors, 0.9), max: Math.max(...floors),
    },
    deathByAct,
    reach: Object.fromEntries(REACH_FLOORS.map((floor) => [String(floor), rounded(results.filter((r) => r.floor >= floor).length / results.length * 100)])),
    floorHistogram,
    topDeathEncounters: [...encounterCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, deaths]) => ({ id, deaths })),
    averages: {
      damageTaken: mean((r) => r.damageTaken),
      turnsPerCombat: rounded(results.reduce((sum, r) => sum + r.turns, 0) / Math.max(1, combats), 2),
      deckSize: mean((r) => r.deckSize), upgrades: mean((r) => r.upgrades), relics: mean((r) => r.relics),
      archetypeScore: mean((r) => r.archetypeScore),
    },
  }
}

function gitCommit(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO }).toString().trim()
  } catch {
    return 'unknown'
  }
}

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const rows: BalanceRow[] = []
console.log(`balance lab: ${SEEDS} seeds per policy/profile @ A${ASC}`)
console.log('greedy = floor proxy; archetype drafting + board evaluation = practical ceiling proxy\n')

for (const char of CHARS) {
  const greedy = Array.from({ length: SEEDS }, (_, i) => playRun((i + 1) * 7919, char, 'greedy', null))
  rows.push(summarize(char, 'greedy', null, greedy))
  const profileResults: RunResult[][] = []
  for (const profile of archetypesFor(char)) {
    const results = Array.from({ length: SEEDS }, (_, i) => playRun((i + 1) * 7919, char, 'archetype', profile.id))
    profileResults.push(results)
    rows.push(summarize(char, 'archetype', profile.id, results))
  }
  // Same-seed best-of-three envelope: useful as an upper ruler while each
  // individual profile remains visible for diagnosis.
  const envelope = Array.from({ length: SEEDS }, (_, i) => [...profileResults]
    .map((results) => results[i])
    .sort((a, b) => Number(b.win) - Number(a.win) || b.floor - a.floor || b.hp - a.hp)[0])
  rows.push(summarize(char, 'ceiling', null, envelope))
}

const comparison: BalanceReport['comparison'] = CHARS.map((char) => {
  const lower = rows.find((r) => r.char === char && r.policy === 'greedy')!
  const bestProfile = rows.filter((r) => r.char === char && r.policy === 'archetype')
    .sort((a, b) => b.floor.mean - a.floor.mean || b.winRate - a.winRate)[0]
  const upper = rows.find((r) => r.char === char && r.policy === 'ceiling')!
  return {
    char, lowerMean: lower.floor.mean, upperMean: upper.floor.mean,
    gap: rounded(upper.floor.mean - lower.floor.mean), bestArchetype: bestProfile.archetype!,
    lowerWinRate: lower.winRate, upperWinRate: upper.winRate,
  }
})

const report: BalanceReport = {
  schema: 1,
  generatedAt: new Date().toISOString(),
  commit: gitCommit(),
  seeds: SEEDS,
  ascension: ASC,
  methodology: {
    lower: 'Greedy bot: lethal > required Block > power > largest printed attack; conservative drafting and routing.',
    upper: 'Archetype bot: rarity-preserving oracle drafting, effect-driven synergy scoring, one-action board evaluation, risk-aware routing, shops and events. The ceiling is the same-seed best-of-three archetype envelope; every profile remains visible.',
    caveat: 'These are deterministic bot bounds, not human percentiles. Use the gap and relative character/profile movement; validate balance changes with real-player telemetry.',
  },
  rows,
  comparison,
}

function rowLine(row: BalanceRow): string {
  return `${row.char.padEnd(7)} ${row.label.padEnd(27)} win ${String(row.winRate.toFixed(1)).padStart(5)}%  floor μ/p25/p50/p75/p90 ${[row.floor.mean, row.floor.p25, row.floor.median, row.floor.p75, row.floor.p90].map((n) => n.toFixed(1)).join('/')}  act deaths ${Object.values(row.deathByAct).join('/')}`
}
console.log(rows.map(rowLine).join('\n'))
console.log('\ncharacter bounds')
for (const c of comparison) console.log(`${c.char.padEnd(7)} ${c.lowerMean.toFixed(1)} → ${c.upperMean.toFixed(1)}  gap +${c.gap.toFixed(1)}  best ${c.bestArchetype}`)

function reportMarkdown(r: BalanceReport): string {
  const table = r.rows.map((x) => `| ${x.char} | ${x.label} | ${x.winRate}% | ${x.floor.mean} | ${x.floor.p25}/${x.floor.median}/${x.floor.p75}/${x.floor.p90} | ${Object.values(x.deathByAct).join('/')} | ${REACH_FLOORS.map((f) => x.reach[String(f)] + '%').join('/')} | ${x.averages.turnsPerCombat} | ${x.averages.deckSize} |`).join('\n')
  const bounds = r.comparison.map((x) => `| ${x.char} | ${x.lowerMean} | ${x.upperMean} | +${x.gap} | ${x.bestArchetype} | ${x.lowerWinRate}% → ${x.upperWinRate}% |`).join('\n')
  const deaths = r.rows.map((x) => `| ${x.char} · ${x.archetype ?? x.policy} | ${x.topDeathEncounters.map((e) => `${e.id} (${e.deaths})`).join(' · ') || '—'} |`).join('\n')
  return `# NEONSPIRE 平衡实验室\n\n> ${r.generatedAt.slice(0, 10)} · commit \`${r.commit}\` · ${r.seeds} seeds/profile · A${r.ascension}\n\n![上下限与生存曲线](latest.svg)\n\n## 角色上下限\n\n| 角色 | 贪心下限均层 | 最佳流派均层 | 可控空间 | 最佳流派 | 胜率变化 |\n|---|---:|---:|---:|---|---:|\n${bounds}\n\n“上限”是流派策略 bot 的可复现实战近似值，不是理论无限 combo；“下限”是保留旧逻辑的贪心 bot。二者使用完全相同的 seeds。\n\n## 全量分布\n\n| 角色 | 策略 / 流派 | 胜率 | 均层 | P25/P50/P75/P90 | 死亡幕 1/2/3/4 | 到达层 4/8/12/16/20/24 | 回合/战 | 牌组 |\n|---|---|---:|---:|---:|---:|---:|---:|---:|\n${table}\n\n## 高频死亡遭遇\n\n| 策略 | 遭遇（死亡数） |\n|---|---|\n${deaths}\n\n## 方法与边界\n\n- 下限：${r.methodology.lower}\n- 上限：${r.methodology.upper}\n- 注意：${r.methodology.caveat}\n\n机器可读历史见 [history.json](history.json)，玩家图鉴与管理后台读取同一份公开快照。\n`
}

function escapeXml(v: string): string {
  return v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!)
}

function reportSvg(r: BalanceReport): string {
  const width = 980
  const boundRows = r.comparison.map((x, i) => {
    const y = 90 + i * 66
    const start = 150 + x.lowerMean / 24 * 330
    const end = 150 + x.upperMean / 24 * 330
    return `<text x="30" y="${y + 6}" class="label">${x.char.toUpperCase()}</text><line x1="150" y1="${y}" x2="480" y2="${y}" class="axis"/><line x1="${start}" y1="${y}" x2="${end}" y2="${y}" class="range"/><circle cx="${start}" cy="${y}" r="6" class="low"/><circle cx="${end}" cy="${y}" r="6" class="high"/><text x="500" y="${y + 6}" class="num">${x.lowerMean} → ${x.upperMean} (+${x.gap})</text>`
  }).join('')
  const survivalRows = r.comparison.map((c, ci) => {
    const low = r.rows.find((x) => x.char === c.char && x.policy === 'greedy')!
    const high = r.rows.find((x) => x.char === c.char && x.policy === 'ceiling')!
    return REACH_FLOORS.map((floor, fi) => {
      const x = 640 + fi * 48
      const baseY = 355 + ci * 72
      const lv = low.reach[String(floor)]
      const hv = high.reach[String(floor)]
      return `<rect x="${x}" y="${baseY - lv * .45}" width="16" height="${lv * .45}" class="lowbar"/><rect x="${x + 17}" y="${baseY - hv * .45}" width="16" height="${hv * .45}" class="highbar"/>`
    }).join('') + `<text x="555" y="${355 + ci * 72 + 5}" class="label">${c.char.toUpperCase()}</text>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="680" viewBox="0 0 ${width} 680"><style>.bg{fill:#080414}.title{fill:#00e5ff;font:700 19px monospace;letter-spacing:3px}.sub{fill:#8f86b8;font:12px monospace}.label{fill:#e8e4ff;font:700 13px monospace}.num{fill:#ffd166;font:13px monospace}.axis{stroke:#302650;stroke-width:5}.range{stroke:#ffd166;stroke-width:5}.low{fill:#ff3b5b}.high{fill:#3dffa2}.lowbar{fill:#ff3b5b;opacity:.8}.highbar{fill:#3dffa2;opacity:.8}.grid{stroke:#281e43;stroke-width:1}</style><rect class="bg" width="100%" height="100%"/><text x="30" y="35" class="title">BOT BOUNDS · A${r.ascension}</text><text x="30" y="56" class="sub">${r.seeds} identical seeds/profile · red greedy floor · green best archetype proxy</text><text x="30" y="325" class="title">SURVIVAL CURVE</text><text x="555" y="325" class="sub">floors ${REACH_FLOORS.join(' · ')}</text>${boundRows}${survivalRows}<text x="30" y="650" class="sub">Generated ${escapeXml(r.generatedAt)} · ${escapeXml(r.commit)} · deterministic bot proxies, validate with player telemetry</text></svg>`
}

function recordReport(r: BalanceReport) {
  const docsDir = resolve(REPO, 'docs/balance')
  const publicDir = resolve(REPO, 'client/public/balance')
  mkdirSync(docsDir, { recursive: true })
  mkdirSync(publicDir, { recursive: true })
  const historyPath = resolve(docsDir, 'history.json')
  let history: BalanceReport[] = []
  try { history = JSON.parse(readFileSync(historyPath, 'utf8')) } catch { /* first snapshot */ }
  history.push(r)
  writeFileSync(historyPath, JSON.stringify(history.slice(-30), null, 2) + '\n')
  writeFileSync(resolve(docsDir, 'latest.md'), reportMarkdown(r))
  writeFileSync(resolve(docsDir, 'latest.svg'), reportSvg(r))
  writeFileSync(resolve(publicDir, 'latest.json'), JSON.stringify(r, null, 2) + '\n')
  console.log(`\nrecorded ${historyPath} and client/public/balance/latest.json`)
}

if (RECORD) recordReport(report)
