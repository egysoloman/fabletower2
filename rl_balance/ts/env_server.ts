/**
 * Binary, vectorized full-run environment for the RL balance lab.
 *
 * It imports the production engine directly. No combat/card rule is copied.
 * stdout is a binary protocol; diagnostics and episode data use stderr/files.
 */
import { appendFileSync, readFileSync } from 'node:fs'
import {
  BOOT_EVENT,
  CARDS,
  ENEMIES,
  MAX_POTIONS,
  POTIONS,
  RELICS,
  addCardToDeck,
  addRelic,
  advanceAct,
  activateBalanceStack,
  activateBalanceOverrides,
  applyCombatResult,
  applyOutcomes,
  applyPotion,
  availableNodeIds,
  bossRelicChoices,
  cardCost,
  combatFor,
  combatReduce,
  genShop,
  goldReward,
  moveTo,
  newRun,
  nodeById,
  pickEvent,
  randomRelicId,
  removeCard,
  restHealAmount,
  rankDeckArchetypes,
  rollCardRewards,
  rollPotionDrop,
  upgradeCard,
  withGoldBonus,
  type CardInst,
  type CharId,
  type BalanceOverrides,
  type CombatState,
  type Effect,
  type EventDef,
  type RunState,
  type ShopStock,
} from '../../shared/src/index.ts'

const ACTION_DIM = 128
const GLOBAL_DIM = 128
const ACTION_FEAT_DIM = 32
const OBS_DIM = GLOBAL_DIM + ACTION_DIM * ACTION_FEAT_DIM
const CHARS: CharId[] = ['runner', 'vector', 'ghost', 'array']
const STATUS_IDS = [
  'str', 'weak', 'vuln', 'corrupt', 'thorns', 'plating', 'turret', 'viral',
  'energyGain', 'drawGain', 'ritual', 'regen', 'barricade', 'kernel', 'hyper',
  'chronic', 'heat', 'coolant', 'ignition', 'reactor', 'artifact', 'overdrive',
  'stealth', 'stancewall', 'momentum', 'tempoloop', 'focus', 'stable',
] as const

const BEHAVIOR_NAMES = [
  'cardsPlayed', 'attacks', 'skills', 'powers', 'zeroCost', 'damage', 'block',
  'draw', 'energy', 'heal', 'corrupt', 'heat', 'vent', 'stance', 'turret',
  'plating', 'viral', 'focus', 'summon', 'potions', 'elites', 'shops', 'rests',
  'upgrades', 'removals', 'cardPicks', 'cardSkips', 'maxCardsTurn', 'turns',
  'combats', 'hpLost',
] as const
type BehaviorName = typeof BEHAVIOR_NAMES[number]
type Behavior = Record<BehaviorName, number>

type Phase =
  | 'event' | 'map' | 'combat' | 'rewardCard' | 'rewardBoss' | 'rest'
  | 'shop' | 'shopRemove' | 'eventRemove' | 'descend' | 'done'

interface RewardState {
  cards: string[]
  bossChoices: string[]
  relic: string | null
  potion: string | null
  afterBoss: boolean
}

interface BalanceConfig extends BalanceOverrides {
  name?: string
  balanceStack?: string
  playerMaxHpMultiplier?: number
  startingGoldMultiplier?: number
}

interface Args {
  envs: number
  ascension: number
  seedBase: number
  character: CharId | 'all'
  style: number
  configPath: string | null
  episodeLog: string | null
  maxEpisodes: number
  maxSteps: number
}

interface ActionSpec {
  kind: string
  feat: number[]
  run: () => number
}

function parseArgs(): Args {
  const raw = process.argv.slice(2)
  const get = (name: string, fallback: string) => {
    const i = raw.indexOf(name)
    return i >= 0 ? (raw[i + 1] ?? fallback) : fallback
  }
  const character = get('--character', 'all') as Args['character']
  if (character !== 'all' && !CHARS.includes(character)) throw new Error(`bad character: ${character}`)
  return {
    envs: Math.max(1, Number(get('--envs', '64'))),
    ascension: Math.max(0, Math.min(20, Number(get('--ascension', '0')))),
    seedBase: Number(get('--seed-base', '1000003')),
    character,
    style: Math.max(0, Math.min(7, Number(get('--style', '0')))),
    configPath: raw.includes('--config') ? get('--config', '') : null,
    episodeLog: raw.includes('--episode-log') ? get('--episode-log', '') : null,
    maxEpisodes: Math.max(0, Number(get('--max-episodes', '0'))),
    maxSteps: Math.max(100, Number(get('--max-steps', '6000'))),
  }
}

function loadBalanceConfig(path: string | null): BalanceConfig {
  const config: BalanceConfig = path ? JSON.parse(readFileSync(path, 'utf8')) : { name: 'baseline' }
  if (config.balanceStack) {
    activateBalanceStack(config.balanceStack)
    return config
  }
  activateBalanceOverrides(config.name ?? 'baseline', {
    enemyHpMultiplier: config.enemyHpMultiplier,
    enemyAttackMultiplier: config.enemyAttackMultiplier,
    cardPatches: config.cardPatches,
    enemyPatches: config.enemyPatches,
    relicPatches: config.relicPatches,
    relicTextPatches: config.relicTextPatches,
    ascensionTuning: config.ascensionTuning,
    mechanicsTuning: config.mechanicsTuning,
  })
  return config
}

function zeroBehavior(): Behavior {
  return Object.fromEntries(BEHAVIOR_NAMES.map((name) => [name, 0])) as Behavior
}

function effectVector(effects: readonly Effect[], def?: CardDef, up = false): number[] {
  const v = Array(24).fill(0) as number[]
  for (const e of effects) {
    const n = 'n' in e ? Number(e.n) : 1
    if (e.k === 'dmg' || e.k === 'dmgAll') v[0] += n * ('times' in e ? (e.times ?? 1) : 1) / 20
    if (e.k === 'dmgAll') v[1] += n / 20
    if (e.k === 'block' || e.k === 'doubleBlock' || e.k === 'ventBlock') v[2] += n / 15
    if (e.k === 'draw') v[3] += n / 5
    if (e.k === 'energy') v[4] += n / 3
    if (e.k === 'heal') v[5] += n / 20
    if (e.k === 'selfDmg') v[6] += n / 10
    if (e.k === 'status' && e.id === 'corrupt' || e.k === 'doubleCorrupt' || e.k === 'dmgPerCorrupt') v[7] += n / 6
    if (e.k === 'status' && ['heat', 'coolant', 'ignition', 'reactor'].includes(e.id) || e.k.startsWith('vent') || e.k === 'heatCool' || e.k === 'dmgHeatBonus') v[8] += n / 6
    if (e.k === 'enterStance' || e.k === 'dmgIfStance') v[9] += 1
    if (e.k === 'status' && e.id === 'turret') v[10] += n / 6
    if (e.k === 'status' && e.id === 'plating') v[11] += n / 6
    if (e.k === 'status' && e.id === 'viral') v[12] += n / 6
    if (e.k === 'status' && e.id === 'focus') v[13] += n / 3
    if (e.k === 'summonAlly') v[14] += n
    if (e.k === 'commandMinions') v[14] += 1
    if (e.k.startsWith('dmgPer') || e.k.startsWith('dmgIf') || e.k === 'blockAsDmg') v[15] += 1
    if (e.k === 'status' && e.to === 'self') v[16] += n / 5
    if (e.k === 'status' && e.to !== 'self') v[17] += n / 5
  }
  if (def) {
    if (def.type === 'attack') v[18] = 1
    if (def.type === 'skill') v[19] = 1
    if (def.type === 'power') v[20] = 1
    if ((up ? (def.upCost ?? def.cost) : def.cost) === 0) v[21] = 1
    if (up) v[22] = 1
    if (up ? (def.upExhaust ?? def.exhaust) : def.exhaust) v[23] = 1
  }
  return v.map((x) => Math.min(4, x))
}

function cardVector(card: CardInst): number[] {
  const def = CARDS[card.id]
  return effectVector(card.up ? def.upEffects : def.effects, def, card.up)
}

function actionFeat(kind: number, values: number[] = [], mechanics: number[] = []): number[] {
  const f = Array(ACTION_FEAT_DIM).fill(0) as number[]
  f[Math.max(0, Math.min(11, kind))] = 1
  for (let i = 0; i < Math.min(4, values.length); i++) f[12 + i] = values[i]
  for (let i = 0; i < Math.min(16, mechanics.length); i++) f[16 + i] = mechanics[i]
  return f
}

function addInto(dst: number[], src: readonly number[], scale = 1) {
  for (let i = 0; i < Math.min(dst.length, src.length); i++) dst[i] += src[i] * scale
}

function statusValues(statuses: Record<string, number | undefined>): number[] {
  return STATUS_IDS.map((id) => Math.min(4, (statuses[id] ?? 0) / 5))
}

function relicVector(ids: readonly string[]): number[] {
  const v = Array(16).fill(0) as number[]
  for (const id of ids) {
    const h = RELICS[id]?.hooks as Record<string, unknown> | undefined
    if (!h) continue
    for (const [key, value] of Object.entries(h)) {
      const n = typeof value === 'number' ? value : value ? 1 : 0
      const slot = [...key].reduce((s, c) => (s * 33 + c.charCodeAt(0)) >>> 0, 5381) % v.length
      v[slot] += Math.min(3, Math.abs(n)) / 5
    }
  }
  return v.map((x) => Math.min(4, x))
}

class SoloRunEnv {
  run!: RunState
  phase: Phase = 'map'
  combat: CombatState | null = null
  combatKind: 'normal' | 'elite' | 'boss' = 'normal'
  shop: ShopStock | null = null
  event: EventDef | null = null
  rewardState: RewardState | null = null
  actions: ActionSpec[] = []
  behavior: Behavior = zeroBehavior()
  cardCounts: Record<string, number> = {}
  draftCounts: Record<string, number> = {}
  totalReward = 0
  steps = 0
  episodeIndex = -1
  seed = 0
  char: CharId = 'runner'
  active = false
  win = false
  deep = false
  configName: string

  constructor(
    private readonly args: Args,
    private readonly config: BalanceConfig,
    private readonly allocateEpisode: () => number | null,
  ) {
    this.configName = config.name ?? 'unnamed'
    this.reset()
  }

  reset() {
    const episodeIndex = this.allocateEpisode()
    if (episodeIndex === null) {
      this.active = false
      this.phase = 'done'
      this.actions = [{ kind: 'inactive', feat: actionFeat(0), run: () => 0 }]
      return
    }
    this.active = true
    this.episodeIndex = episodeIndex
    this.seed = this.args.seedBase + episodeIndex * 7919
    this.char = this.args.character === 'all' ? CHARS[episodeIndex % CHARS.length] : this.args.character
    this.run = newRun(this.seed, this.args.ascension, this.char)
    const hpMul = this.config.playerMaxHpMultiplier ?? 1
    if (hpMul !== 1) {
      this.run.maxHp = Math.max(10, Math.round(this.run.maxHp * hpMul))
      this.run.hp = this.run.maxHp
    }
    this.run.gold = Math.max(0, Math.round(this.run.gold * (this.config.startingGoldMultiplier ?? 1)))
    this.phase = 'event'
    this.event = BOOT_EVENT
    this.combat = null
    this.shop = null
    this.rewardState = null
    this.behavior = zeroBehavior()
    this.cardCounts = {}
    this.draftCounts = {}
    this.totalReward = 0
    this.steps = 0
    this.win = false
    this.deep = false
    this.rebuildActions()
  }

  private terminal(win: boolean, deep = false): number {
    this.win = win
    this.deep = deep
    this.phase = 'done'
    this.actions = []
    return win ? 10 + (deep ? 2 : 0) : -5
  }

  private enterMap() {
    this.phase = 'map'
    this.event = null
    this.shop = null
    this.rewardState = null
  }

  private enterCombat(kind: 'normal' | 'elite' | 'boss') {
    this.combatKind = kind
    this.combat = combatFor(this.run, kind)
    this.phase = 'combat'
    this.behavior.combats++
    if (kind === 'elite') this.behavior.elites++
  }

  private finishCombat(): number {
    const cs = this.combat!
    applyCombatResult(this.run, cs)
    this.combat = null
    if (cs.over !== 'win') return this.terminal(false)
    let reward = this.combatKind === 'boss' ? 2 : this.combatKind === 'elite' ? 1 : 0.5
    this.run.gold += goldReward(this.run, this.combatKind)
    this.rewardState = {
      cards: rollCardRewards(this.run, this.combatKind),
      relic: this.combatKind === 'elite' ? randomRelicId(this.run) : null,
      bossChoices: this.combatKind === 'boss' ? bossRelicChoices(this.run) : [],
      potion: rollPotionDrop(this.run),
      afterBoss: this.combatKind === 'boss',
    }
    this.phase = 'rewardCard'
    return reward
  }

  private afterCardReward() {
    const rs = this.rewardState!
    if (rs.relic) addRelic(this.run, rs.relic)
    if (rs.potion && this.run.potions.length < MAX_POTIONS) this.run.potions.push(rs.potion)
    this.phase = rs.afterBoss ? 'rewardBoss' : 'map'
    if (!rs.afterBoss) this.rewardState = null
  }

  private afterBossReward(): number {
    const act = this.run.act
    this.rewardState = null
    if (act >= 4) return this.terminal(true, true)
    if (act === 3) {
      this.phase = 'descend'
      return 0
    }
    advanceAct(this.run)
    this.enterMap()
    return 0
  }

  private recordCardPlay(card: CardInst, before: CombatState, after: CombatState) {
    const def = CARDS[card.id]
    const effects = card.up ? def.upEffects : def.effects
    const vec = effectVector(effects, def, card.up)
    this.behavior.cardsPlayed++
    this.behavior[def.type === 'attack' ? 'attacks' : def.type === 'skill' ? 'skills' : 'powers']++
    if (cardCost(card) === 0) this.behavior.zeroCost++
    this.behavior.draw += vec[3]
    this.behavior.energy += vec[4]
    this.behavior.heal += vec[5]
    this.behavior.corrupt += vec[7]
    this.behavior.heat += vec[8]
    this.behavior.vent += effects.some((e) => e.k.startsWith('vent') || e.k === 'heatCool') ? 1 : 0
    this.behavior.stance += vec[9]
    this.behavior.turret += vec[10]
    this.behavior.plating += vec[11]
    this.behavior.viral += vec[12]
    this.behavior.focus += vec[13]
    this.behavior.summon += vec[14]
    this.cardCounts[card.id] = (this.cardCounts[card.id] ?? 0) + 1
    this.behavior.maxCardsTurn = Math.max(this.behavior.maxCardsTurn, after.player.cardsThisTurn)
    const enemyBefore = before.enemies.reduce((n, e) => n + Math.max(0, e.hp), 0)
    const enemyAfter = after.enemies.reduce((n, e) => n + Math.max(0, e.hp), 0)
    this.behavior.damage += Math.max(0, enemyBefore - enemyAfter)
    this.behavior.block += Math.max(0, after.player.block - before.player.block)
  }

  private styleReward(kind: string, delta: Partial<Behavior>): number {
    const d = (name: BehaviorName) => delta[name] ?? 0
    switch (this.args.style) {
      case 1: return d('damage') * 0.0015 - (kind === 'end' ? 0.002 : 0)
      case 2: return d('block') * 0.0015 - d('hpLost') * 0.004
      case 3: return d('elites') * 0.08 + (kind.startsWith('shop') ? 0.005 : 0)
      case 4: return d('powers') * 0.012 + (d('turret') + d('plating') + d('viral')) * 0.004
      case 5: return d('zeroCost') * 0.008 + Math.max(0, d('maxCardsTurn')) * 0.003
      case 6: return (d('corrupt') + d('heat') + d('vent') + d('stance') + d('focus')) * 0.004
      case 7: return d('removals') * 0.025 + d('upgrades') * 0.008 + d('cardSkips') * 0.003
      default: return 0
    }
  }

  step(index: number): { reward: number; done: boolean } {
    if (!this.active) return { reward: 0, done: false }
    const action = this.actions[index]
    if (!action) return { reward: -0.05, done: false }
    const beforeBehavior = { ...this.behavior }
    const hpBefore = this.run.hp
    let reward = action.run() - 0.0005
    this.steps++
    this.behavior.hpLost += Math.max(0, hpBefore - this.run.hp)
    const delta = Object.fromEntries(BEHAVIOR_NAMES.map((name) => [name, this.behavior[name] - beforeBehavior[name]])) as Partial<Behavior>
    reward += this.styleReward(action.kind, delta)
    if (this.steps >= this.args.maxSteps && this.phase !== 'done') reward += this.terminal(false)
    const done = this.phase === 'done'
    this.totalReward += reward
    if (done) this.writeEpisode()
    if (!done) this.rebuildActions()
    return { reward, done }
  }

  private writeEpisode() {
    if (!this.args.episodeLog) return
    const archetypeScores = rankDeckArchetypes(this.char, this.run.deck)
    const line = {
      schema: 1,
      config: this.configName,
      style: this.args.style,
      episodeIndex: this.episodeIndex,
      seed: this.seed,
      character: this.char,
      ascension: this.run.asc,
      win: this.win,
      deep: this.deep,
      act: this.run.act,
      floor: this.run.floor,
      hp: this.run.hp,
      maxHp: this.run.maxHp,
      gold: this.run.gold,
      steps: this.steps,
      reward: this.totalReward,
      deck: this.run.deck.map((c) => ({ id: c.id, up: c.up })),
      relics: this.run.relics,
      behavior: this.behavior,
      cardCounts: this.cardCounts,
      draftCounts: this.draftCounts,
      archetypeScores,
    }
    appendFileSync(this.args.episodeLog, JSON.stringify(line) + '\n')
  }

  private rebuildActions() {
    const actions: ActionSpec[] = []
    const add = (kind: string, feat: number[], run: () => number) => {
      if (actions.length < ACTION_DIM) actions.push({ kind, feat, run })
    }
    if (this.phase === 'map') {
      for (const id of availableNodeIds(this.run)) {
        const node = nodeById(this.run.map, id)!
        const types = ['combat', 'elite', 'rest', 'shop', 'treasure', 'event', 'boss']
        const mech = Array(16).fill(0); mech[types.indexOf(node.type)] = 1
        add('map', actionFeat(3, [node.row / 8, node.col / 5], mech), () => {
          const type = moveTo(this.run, id)
          if (!type) return -0.1
          let reward = 0.05
          if (type === 'combat' || type === 'elite' || type === 'boss') this.enterCombat(type === 'combat' ? 'normal' : type)
          else if (type === 'rest') { this.phase = 'rest'; this.behavior.rests++ }
          else if (type === 'shop') { this.shop = genShop(this.run); this.phase = 'shop'; this.behavior.shops++ }
          else if (type === 'event') { this.event = pickEvent(this.run); this.phase = 'event' }
          else if (type === 'treasure') {
            this.run.gold += withGoldBonus(this.run, 25)
            const relic = randomRelicId(this.run)
            if (relic) addRelic(this.run, relic)
            this.enterMap()
          }
          return reward
        })
      }
    } else if (this.phase === 'combat') {
      const cs = this.combat!
      add('end', actionFeat(0, [cs.turn / 20, cs.player.energy / 5]), () => {
        const beforeHp = cs.player.hp
        const result = combatReduce(cs, { t: 'end' })
        this.combat = result.state
        this.behavior.turns++
        this.run.hp = result.state.player.hp
        const survivalReward = -Math.max(0, beforeHp - result.state.player.hp) * 0.01
        return survivalReward + (result.state.over ? this.finishCombat() : 0)
      })
      cs.player.hand.forEach((card, hand) => {
        const def = CARDS[card.id]
        const cost = cs.firstCardFree ? 0 : cardCost(card)
        if (def.unplayable || cost > cs.player.energy) return
        const targets = def.target === 'enemy'
          ? cs.enemies.map((e, i) => e.dead ? -1 : i).filter((i) => i >= 0)
          : [undefined]
        for (const target of targets) {
          const enemy = target === undefined ? null : cs.enemies[target]
          add('play', actionFeat(1, [cost / 4, enemy ? enemy.hp / Math.max(1, enemy.maxHp) : 0, enemy?.block ? enemy.block / 30 : 0, enemy?.intent?.dmg ? enemy.intent.dmg / 30 : 0], cardVector(card)), () => {
            const before = this.combat!
            const result = combatReduce(before, { t: 'play', hand, target })
            if (result.error) return -0.1
            this.combat = result.state
            this.recordCardPlay(card, before, result.state)
            const enemyBefore = before.enemies.reduce((n, e) => n + Math.max(0, e.hp), 0)
            const enemyAfter = result.state.enemies.reduce((n, e) => n + Math.max(0, e.hp), 0)
            const usefulBlock = Math.max(0, result.state.player.block - before.player.block)
            const dense = Math.max(0, enemyBefore - enemyAfter) * 0.002 + usefulBlock * 0.0005
            return dense + (result.state.over ? this.finishCombat() : 0)
          })
        }
      })
      this.run.potions.forEach((id, belt) => {
        const def = POTIONS[id]
        const targets = def.target === 'enemy'
          ? cs.enemies.map((e, i) => e.dead ? -1 : i).filter((i) => i >= 0)
          : [undefined]
        for (const target of targets) add('potion', actionFeat(2, [belt / 3], effectVector(def.effects)), () => {
          const result = applyPotion(this.combat!, id, target)
          if (result.error) return -0.1
          this.combat = result.state
          this.run.potions.splice(belt, 1)
          this.behavior.potions++
          return result.state.over ? this.finishCombat() : 0
        })
      })
    } else if (this.phase === 'rewardCard') {
      add('skipCard', actionFeat(4), () => { this.behavior.cardSkips++; this.afterCardReward(); return 0 })
      this.rewardState!.cards.forEach((id) => {
        const card = { id, uid: 0, up: false }
        add('pickCard', actionFeat(4, [CARDS[id].cost / 4], cardVector(card)), () => {
          addCardToDeck(this.run, id)
          this.draftCounts[id] = (this.draftCounts[id] ?? 0) + 1
          this.behavior.cardPicks++
          this.afterCardReward()
          return 0
        })
      })
    } else if (this.phase === 'rewardBoss') {
      add('skipRelic', actionFeat(5), () => this.afterBossReward())
      this.rewardState!.bossChoices.forEach((id) => add('pickRelic', actionFeat(5, [1], relicVector([id])), () => {
        addRelic(this.run, id)
        return this.afterBossReward()
      }))
    } else if (this.phase === 'rest') {
      add('restHeal', actionFeat(6, [this.run.hp / this.run.maxHp, restHealAmount(this.run) / this.run.maxHp]), () => {
        this.run.hp = Math.min(this.run.maxHp, this.run.hp + restHealAmount(this.run)); this.enterMap(); return 0
      })
      this.run.deck.filter((c) => !c.up && CARDS[c.id].rarity !== 'special').forEach((card) => add('upgrade', actionFeat(6, [0, 0, 1], cardVector(card)), () => {
        if (upgradeCard(this.run, card.uid)) this.behavior.upgrades++
        this.enterMap(); return 0
      }))
    } else if (this.phase === 'shop') {
      const shop = this.shop!
      add('shopLeave', actionFeat(7), () => { this.enterMap(); return 0 })
      shop.cards.forEach((item) => {
        if (item.sold || item.price > this.run.gold) return
        add('shopCard', actionFeat(7, [item.price / 250], cardVector({ id: item.id, uid: 0, up: false })), () => {
          if (item.sold || item.price > this.run.gold) return -0.1
          this.run.gold -= item.price; item.sold = true; addCardToDeck(this.run, item.id)
          this.draftCounts[item.id] = (this.draftCounts[item.id] ?? 0) + 1; this.behavior.cardPicks++
          return 0
        })
      })
      shop.relics.forEach((item) => {
        if (item.sold || item.price > this.run.gold) return
        add('shopRelic', actionFeat(7, [item.price / 250], relicVector([item.id])), () => {
          if (item.sold || item.price > this.run.gold) return -0.1
          this.run.gold -= item.price; item.sold = true; addRelic(this.run, item.id); return 0
        })
      })
      shop.potions.forEach((item) => {
        if (item.sold || item.price > this.run.gold || this.run.potions.length >= MAX_POTIONS) return
        add('shopPotion', actionFeat(7, [item.price / 250], effectVector(POTIONS[item.id].effects)), () => {
          if (item.sold || item.price > this.run.gold || this.run.potions.length >= MAX_POTIONS) return -0.1
          this.run.gold -= item.price; item.sold = true; this.run.potions.push(item.id); return 0
        })
      })
      if (shop.removePrice <= this.run.gold && this.run.deck.length > 1) add('shopRemove', actionFeat(7, [shop.removePrice / 250]), () => { this.phase = 'shopRemove'; return 0 })
    } else if (this.phase === 'shopRemove' || this.phase === 'eventRemove') {
      if (this.phase === 'shopRemove') add('cancelRemove', actionFeat(8), () => { this.phase = 'shop'; return 0 })
      this.run.deck.forEach((card) => add('remove', actionFeat(8, [], cardVector(card)), () => {
        if (!removeCard(this.run, card.uid)) return -0.1
        this.behavior.removals++
        if (this.phase === 'shopRemove') {
          this.run.gold -= this.shop!.removePrice
          this.run.removesBought++
          this.shop!.removePrice += 25
          this.phase = 'shop'
        } else this.enterMap()
        return 0
      }))
    } else if (this.phase === 'event') {
      this.event!.choices.forEach((choice, index) => {
        if (choice.needGold && this.run.gold < choice.needGold) return
        const outcomes = Array(16).fill(0) as number[]
        for (const outcome of choice.outcomes) {
          const slot = ['gold', 'damage', 'heal', 'cardSpecific', 'maxhp', 'relic', 'cardRandom', 'potion', 'cardGlitch', 'upgradeRandom', 'curse', 'removeChoose'].indexOf(outcome.k)
          if (slot >= 0) outcomes[slot] += 'n' in outcome ? Math.sign(outcome.n) * Math.min(3, Math.abs(outcome.n) / 25) : 1
        }
        add('event', actionFeat(9, [index / 4, (choice.needGold ?? 0) / 250], outcomes), () => {
          const result = applyOutcomes(this.run, choice.outcomes)
          if (result.removeChoose) this.phase = 'eventRemove'
          else this.enterMap()
          return 0
        })
      })
    } else if (this.phase === 'descend') {
      add('jackOut', actionFeat(10), () => this.terminal(true, false))
      add('descend', actionFeat(10, [1]), () => { advanceAct(this.run, true); this.enterMap(); return 0 })
    }
    if (actions.length === 0 && this.phase !== 'done') {
      actions.push({ kind: 'fallback', feat: actionFeat(0), run: () => this.terminal(false) })
    }
    this.actions = actions
  }

  encode(obs: Float32Array, mask: Uint8Array, envIndex: number) {
    const oo = envIndex * OBS_DIM
    const mo = envIndex * ACTION_DIM
    if (!this.active) {
      mask[mo] = 1
      return
    }
    const g: number[] = []
    const phases: Phase[] = ['event', 'map', 'combat', 'rewardCard', 'rewardBoss', 'rest', 'shop', 'shopRemove', 'eventRemove', 'descend', 'done']
    for (const p of phases) g.push(this.phase === p ? 1 : 0)
    for (const c of CHARS) g.push(this.char === c ? 1 : 0)
    g.push(this.run.act / 4, this.run.floor / 28, this.run.hp / Math.max(1, this.run.maxHp), this.run.maxHp / 100,
      this.run.gold / 300, this.run.deck.length / 40, this.run.relics.length / 20, this.run.potions.length / 3, this.run.asc / 20,
      this.steps / this.args.maxSteps)
    const deck = Array(24).fill(0) as number[]
    for (const card of this.run.deck) addInto(deck, cardVector(card), 1 / Math.max(1, this.run.deck.length))
    g.push(...deck, ...relicVector(this.run.relics))
    if (this.combat) {
      const cs = this.combat
      g.push(cs.turn / 20, cs.player.energy / 5, cs.player.energyMax / 5, cs.player.block / 50,
        cs.player.hand.length / 10, cs.player.draw.length / 40, cs.player.discard.length / 40, cs.enemies.filter((e) => !e.dead).length / 8,
        ...statusValues(cs.player.statuses))
      const enemyStatus = Array(STATUS_IDS.length).fill(0) as number[]
      for (const e of cs.enemies) if (!e.dead) addInto(enemyStatus, statusValues(e.statuses), 1 / Math.max(1, cs.enemies.length))
      g.push(...enemyStatus)
    }
    while (g.length < GLOBAL_DIM) g.push(0)
    obs.set(g.slice(0, GLOBAL_DIM), oo)
    this.actions.forEach((action, i) => {
      mask[mo + i] = 1
      obs.set(action.feat, oo + GLOBAL_DIM + i * ACTION_FEAT_DIM)
    })
  }
}

const args = parseArgs()
const config = loadBalanceConfig(args.configPath)
let nextEpisode = 0
const allocateEpisode = () => {
  if (args.maxEpisodes > 0 && nextEpisode >= args.maxEpisodes) return null
  return nextEpisode++
}
const envs = Array.from({ length: args.envs }, () => new SoloRunEnv(args, config, allocateEpisode))

function writeFrame(rewards: Float32Array, dones: Uint8Array) {
  const obs = new Float32Array(args.envs * OBS_DIM)
  const masks = new Uint8Array(args.envs * ACTION_DIM)
  envs.forEach((env, i) => env.encode(obs, masks, i))
  process.stdout.write(Buffer.from(obs.buffer))
  process.stdout.write(Buffer.from(masks.buffer))
  process.stdout.write(Buffer.from(rewards.buffer))
  process.stdout.write(Buffer.from(dones.buffer))
}

process.stderr.write(`${JSON.stringify({ ready: true, envs: args.envs, obsDim: OBS_DIM, actionDim: ACTION_DIM, globalDim: GLOBAL_DIM, actionFeatDim: ACTION_FEAT_DIM, behaviorNames: BEHAVIOR_NAMES, config: config.name ?? 'unnamed' })}\n`)
writeFrame(new Float32Array(args.envs), new Uint8Array(args.envs))

let pending = Buffer.alloc(0)
const actionBytes = args.envs * 2
process.stdin.on('data', (chunk: Buffer) => {
  pending = Buffer.concat([pending, chunk])
  while (pending.length >= actionBytes) {
    const frame = pending.subarray(0, actionBytes)
    pending = pending.subarray(actionBytes)
    const rewards = new Float32Array(args.envs)
    const dones = new Uint8Array(args.envs)
    for (let i = 0; i < envs.length; i++) {
      const result = envs[i].step(frame.readInt16LE(i * 2))
      rewards[i] = result.reward
      dones[i] = result.done ? 1 : 0
    }
    for (let i = 0; i < envs.length; i++) if (dones[i]) envs[i].reset()
    writeFrame(rewards, dones)
  }
})
