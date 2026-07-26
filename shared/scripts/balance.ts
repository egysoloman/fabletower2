/**
 * Balance harness: a greedy-heuristic bot plays full solo runs for every
 * character across a seed sweep and reports win rates, death floors and
 * act distribution. Run with:  npm run balance -w shared  [-- seeds asc]
 *
 * The bot is deliberately simple (lethal > survive > damage) — it measures
 * the FLOOR of each character's power, so big gaps between characters are
 * balance signals even if absolute win rates are modest.
 */
import {
  CARDS,
  addRelic,
  advanceAct,
  applyCombatResult,
  applyOutcomes,
  availableNodeIds,
  cardCost,
  combatFor,
  combatReduce,
  goldReward,
  moveTo,
  newRun,
  nodeById,
  randomRelicId,
  restHealAmount,
  rollCardRewards,
  upgradeCard,
  type CharId,
  type CombatState,
  type RunState,
} from '../src/index'

const CHARS: CharId[] = ['runner', 'vector', 'ghost', 'array']
const SEEDS = Number(process.argv[2] ?? 40)
const ASC = Number(process.argv[3] ?? 0)

interface RunResult {
  win: boolean
  act: number
  floor: number
}

function incomingDamage(cs: CombatState): number {
  let total = 0
  for (const e of cs.enemies) {
    if (!e.dead && e.intent?.dmg) total += e.intent.dmg * (e.intent.times ?? 1)
  }
  return total
}

/** One bot decision inside combat. Returns false when it ended the turn. */
function combatStep(cs: CombatState): CombatState {
  const p = cs.player
  const alive = cs.enemies.map((e, i) => ({ e, i })).filter((x) => !x.e.dead)
  const playable = p.hand
    .map((c, i) => ({ c, i, def: CARDS[c.id] }))
    .filter((x) => !x.def.unplayable && cardCost(x.c) <= p.energy)
  const end = () => combatReduce(cs, { t: 'end' }).state

  if (playable.length === 0 || alive.length === 0) return end()

  const dmgOf = (x: (typeof playable)[0]): number => {
    const eff = (x.c.up ? x.def.upEffects : x.def.effects).find((e) => 'n' in e && (e.k === 'dmg' || e.k === 'dmgAll'))
    return eff && 'n' in eff ? (eff.n as number) * ((eff as any).times ?? 1) : 0
  }
  const blockOf = (x: (typeof playable)[0]): number => {
    const eff = (x.c.up ? x.def.upEffects : x.def.effects).find((e) => e.k === 'block')
    return eff && 'n' in eff ? (eff.n as number) : 0
  }

  const weakest = alive.reduce((a, b) => (a.e.hp <= b.e.hp ? a : b))
  // 1) lethal on the weakest enemy
  const lethal = playable.find((x) => dmgOf(x) + (p.statuses.str ?? 0) >= weakest.e.hp + weakest.e.block)
  // 2) survival: block when the incoming hit is meaningful
  const threat = incomingDamage(cs)
  const blocker = [...playable].sort((a, b) => blockOf(b) - blockOf(a))[0]
  // 3) otherwise: powers first, then biggest attack, then anything
  const power = playable.find((x) => x.def.type === 'power')
  const attacker = [...playable].sort((a, b) => dmgOf(b) - dmgOf(a))[0]

  let choice = lethal
  if (!choice && threat > p.block + 4 && blocker && blockOf(blocker) > 0) choice = blocker
  if (!choice) choice = power ?? (dmgOf(attacker) > 0 ? attacker : playable[0])

  const target = choice.def.target === 'enemy' ? weakest.i : undefined
  const res = combatReduce(cs, { t: 'play', hand: choice.i, target })
  return res.error ? end() : res.state
}

function playCombat(run: RunState, kind: 'normal' | 'elite' | 'boss'): boolean {
  let cs = combatFor(run, kind)
  let guard = 0
  while (!cs.over && guard++ < 400) cs = combatStep(cs)
  applyCombatResult(run, cs)
  if (cs.over === 'win') {
    run.gold += goldReward(run, kind)
    // draft selectively: rares/uncommons always, commons only while thin
    const cards = rollCardRewards(run, kind)
    const pickId =
      cards.find((id) => CARDS[id].rarity !== 'common') ?? (run.deck.length < 14 ? cards[0] : undefined)
    if (pickId) run.deck.push({ uid: run.uid++, id: pickId, up: false })
    if (kind !== 'normal') {
      const relic = randomRelicId(run, kind === 'boss')
      if (relic) addRelic(run, relic)
    }
  }
  return cs.over === 'win'
}

function playRun(seed: number, char: CharId): RunResult {
  const run = newRun(seed, ASC, char)
  let guard = 0
  while (guard++ < 200) {
    const openIds = availableNodeIds(run)
    if (openIds.length === 0) break
    // path policy: rest when hurt, dodge elites when weak, farm combats
    const nodes = openIds.map((id) => nodeById(run.map, id)!)
    const restNode = nodes.find((n) => n.type === 'rest')
    let target = nodes[0]
    if (run.hp < run.maxHp * 0.5 && restNode) {
      target = restNode
    } else {
      const pool = run.hp < run.maxHp * 0.65 ? nodes.filter((n) => n.type !== 'elite') : nodes
      const order = ['treasure', 'combat', 'event', 'shop', 'rest', 'elite', 'boss']
      const ranked = [...(pool.length ? pool : nodes)].sort(
        (a, b) => order.indexOf(a.type) - order.indexOf(b.type),
      )
      // elites only once the deck has grown a little
      target = ranked.find((n) => n.type !== 'elite' || (run.floor >= 5 && run.hp >= run.maxHp * 0.75)) ?? ranked[0]
    }
    const type = moveTo(run, target.id)
    if (!type) break
    switch (type) {
      case 'combat':
        if (!playCombat(run, 'normal')) return { win: false, act: run.act, floor: run.floor }
        break
      case 'elite':
        if (!playCombat(run, 'elite')) return { win: false, act: run.act, floor: run.floor }
        break
      case 'boss': {
        if (!playCombat(run, 'boss')) return { win: false, act: run.act, floor: run.floor }
        if (advanceAct(run) === 'victory') return { win: true, act: run.act, floor: run.floor }
        break
      }
      case 'rest': {
        if (run.hp < run.maxHp * 0.6) run.hp = Math.min(run.maxHp, run.hp + restHealAmount(run))
        else {
          const target2 = run.deck.find((c) => !c.up && CARDS[c.id].rarity !== 'special' && CARDS[c.id].type === 'attack')
          if (target2) upgradeCard(run, target2.uid)
        }
        break
      }
      case 'event': {
        // conservative: always walk away when possible (last choice is usually safe)
        break
      }
      case 'treasure':
        run.gold += 25
        break
      case 'shop':
        break
    }
  }
  return { win: false, act: run.act, floor: run.floor }
}

console.log(`balance sweep: ${SEEDS} seeds x ${CHARS.length} chars @ A${ASC}\n`)
const rows: string[] = []
for (const char of CHARS) {
  const results: RunResult[] = []
  for (let seed = 1; seed <= SEEDS; seed++) results.push(playRun(seed * 7919, char))
  const wins = results.filter((r) => r.win).length
  const avgFloor = results.reduce((s, r) => s + r.floor, 0) / results.length
  const actDeaths = [1, 2, 3].map((a) => results.filter((r) => !r.win && r.act === a).length)
  rows.push(
    `${char.padEnd(7)}  win ${String(Math.round((100 * wins) / SEEDS)).padStart(3)}%   avg floor ${avgFloor.toFixed(1).padStart(5)}   deaths by act ${actDeaths.join('/')}`,
  )
}
console.log(rows.join('\n'))
