/**
 * Versioned balance patches shared by the client, authoritative server and
 * headless RL lab.
 *
 * Content modules remain the immutable baseline.  Activating a stack first
 * resolves every layer against private baseline snapshots, validates the
 * result, and only then replaces the live catalog entries transactionally.
 */
import type { CardDef, Effect, EnemyDef } from './types'
import { CARDS } from './cards'
import { ENEMIES } from './enemies'
import { RELICS, type RelicDef } from './relics'
import { RELIC_ZH } from './locale-zh'
import {
  configureAscensionTuning,
  type AscensionStep,
  type AscensionTuningPatch,
} from './ascension'
import {
  configureMechanicsTuning,
  type MechanicsTuningPatch,
} from './mechanics'

export const BALANCE_BASE_VERSION = 'content-2026.08.01'

export interface RelicTextPatch {
  desc?: string
  zhDesc?: string
}

/** Arrays are replaced as a unit; nested records are merged recursively. */
export interface BalanceOverrides {
  enemyHpMultiplier?: number
  enemyAttackMultiplier?: number
  cardPatches?: Record<string, Partial<CardDef>>
  enemyPatches?: Record<string, Partial<EnemyDef>>
  relicPatches?: Record<string, Record<string, unknown>>
  relicTextPatches?: Record<string, RelicTextPatch>
  ascensionTuning?: AscensionTuningPatch
  mechanicsTuning?: MechanicsTuningPatch
}

export interface BalancePatch extends BalanceOverrides {
  schemaVersion: 1
  id: string
  version: string
  baseVersion: string
  description?: string
}

export interface BalanceStack {
  id: string
  version: string
  description?: string
  patches: readonly BalancePatch[]
}

export interface ActiveBalanceInfo {
  id: string
  version: string
  hash: string
  patchIds: readonly string[]
}

interface ResolvedBalance {
  cards: Record<string, CardDef>
  enemies: Record<string, EnemyDef>
  relics: Record<string, RelicDef>
  relicZh: Record<string, { name: string; desc: string }>
  ascensionTuning: AscensionTuningPatch
  mechanicsTuning: MechanicsTuningPatch
  info: ActiveBalanceInfo
}

const clone = <T>(value: T): T => structuredClone(value)

// Captured once, before any production patch or player mod is activated.
const BASE_CARDS = clone(CARDS)
const BASE_ENEMIES = clone(ENEMIES)
const BASE_RELICS = clone(RELICS)
const BASE_RELIC_ZH = clone(RELIC_ZH)

function deepAssign(target: Record<string, unknown>, patch: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(patch)) {
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      target[key] !== null &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      deepAssign(target[key] as Record<string, unknown>, value as Record<string, unknown>)
    } else {
      target[key] = clone(value)
    }
  }
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, stableValue(child)]),
    )
  }
  return value
}

/** Small deterministic content fingerprint usable in browsers and Node. */
function fingerprint(value: unknown): string {
  const text = JSON.stringify(stableValue(value))
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return `fnv1a32-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function requireMultiplier(name: string, value: number | undefined): void {
  if (value === undefined) return
  if (!Number.isFinite(value) || value <= 0 || value > 10) {
    throw new Error(`${name} must be finite and within (0, 10]`)
  }
}

function validateSteps(name: string, value: AscensionStep[] | undefined): void {
  if (value === undefined) return
  if (value.length === 0) throw new Error(`${name} cannot be empty`)
  for (const step of value) {
    if (!Number.isInteger(step.asc) || step.asc < 0 || step.asc > 20 || !Number.isFinite(step.value)) {
      throw new Error(`${name} contains an invalid step`)
    }
  }
}

function validateAscension(patch: AscensionTuningPatch | undefined): void {
  if (!patch) return
  validateSteps('enemyAttackFlatSteps', patch.enemyAttackFlatSteps)
  validateSteps('maxHpSteps', patch.maxHpSteps)
  validateSteps('goldRewardMultiplierSteps', patch.goldRewardMultiplierSteps)
  validateSteps('restHealFractionSteps', patch.restHealFractionSteps)
  validateSteps('potionDropChanceSteps', patch.potionDropChanceSteps)
  validateSteps('shopPriceMultiplierSteps', patch.shopPriceMultiplierSteps)
  validateSteps('bossRelicChoiceSteps', patch.bossRelicChoiceSteps)
  if (patch.lagAscensions?.some((asc) => !Number.isInteger(asc) || asc < 0 || asc > 20)) {
    throw new Error('lagAscensions contains an invalid threshold')
  }
}

function validatePatch(patch: BalancePatch): void {
  if (patch.schemaVersion !== 1) throw new Error(`unsupported balance patch schema: ${patch.schemaVersion}`)
  if (!/^[a-z0-9][a-z0-9._-]{2,79}$/i.test(patch.id)) throw new Error(`invalid balance patch id: ${patch.id}`)
  if (patch.baseVersion !== BALANCE_BASE_VERSION) {
    throw new Error(`patch ${patch.id} targets ${patch.baseVersion}, expected ${BALANCE_BASE_VERSION}`)
  }
  requireMultiplier('enemyHpMultiplier', patch.enemyHpMultiplier)
  requireMultiplier('enemyAttackMultiplier', patch.enemyAttackMultiplier)
  validateAscension(patch.ascensionTuning)
  const stance = patch.mechanicsTuning?.stance
  if (stance?.energyRule !== undefined && !['legacy-stealth-exit', 'stable-exit', 'every-switch', 'none'].includes(stance.energyRule)) {
    throw new Error(`invalid stance energyRule: ${stance.energyRule}`)
  }
  if (stance?.energyAmount !== undefined && (!Number.isInteger(stance.energyAmount) || stance.energyAmount < 0 || stance.energyAmount > 10)) {
    throw new Error('stance energyAmount must be an integer within [0, 10]')
  }
  const minions = patch.mechanicsTuning?.minions
  if (minions?.maxStacksPerRole !== undefined && (!Number.isInteger(minions.maxStacksPerRole) || minions.maxStacksPerRole < 1 || minions.maxStacksPerRole > 20)) {
    throw new Error('maxStacksPerRole must be an integer within [1, 20]')
  }
  if (minions?.synergyPerOtherRole !== undefined && (!Number.isFinite(minions.synergyPerOtherRole) || minions.synergyPerOtherRole < 0 || minions.synergyPerOtherRole > 20)) {
    throw new Error('synergyPerOtherRole must be finite and within [0, 20]')
  }
  if (minions?.maxSynergyOtherRoles !== undefined && (!Number.isInteger(minions.maxSynergyOtherRoles) || minions.maxSynergyOtherRoles < 0 || minions.maxSynergyOtherRoles > 20)) {
    throw new Error('maxSynergyOtherRoles must be an integer within [0, 20]')
  }
  if (minions?.independentBodiesPerStack !== undefined && typeof minions.independentBodiesPerStack !== 'boolean') {
    throw new Error('independentBodiesPerStack must be boolean')
  }
  for (const [char, adjustment] of Object.entries(patch.mechanicsTuning?.characterMaxHpAdjustments ?? {})) {
    if (!['runner', 'vector', 'ghost', 'array'].includes(char) || !Number.isInteger(adjustment) || Math.abs(adjustment) > 100) {
      throw new Error(`invalid character Max HP adjustment: ${char}`)
    }
  }
}

function validateResolved(value: ResolvedBalance): void {
  for (const [id, card] of Object.entries(value.cards)) {
    if (card.id !== id || !Array.isArray(card.effects) || !Array.isArray(card.upEffects)) {
      throw new Error(`balance patch produced an invalid card: ${id}`)
    }
  }
  for (const [id, enemy] of Object.entries(value.enemies)) {
    const [lo, hi] = enemy.hp
    if (enemy.id !== id || !Number.isInteger(lo) || !Number.isInteger(hi) || lo < 1 || hi < lo) {
      throw new Error(`balance patch produced invalid enemy HP: ${id}`)
    }
  }
  for (const [id, relic] of Object.entries(value.relics)) {
    if (relic.id !== id || !relic.hooks || typeof relic.hooks !== 'object') {
      throw new Error(`balance patch produced an invalid relic: ${id}`)
    }
  }
}

function patchKnown<T>(
  catalog: Record<string, T>,
  patches: Record<string, unknown> | undefined,
  kind: string,
): void {
  for (const [id, patch] of Object.entries(patches ?? {})) {
    if (!catalog[id]) throw new Error(`unknown ${kind} patch id: ${id}`)
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error(`invalid ${kind} patch: ${id}`)
    deepAssign(catalog[id] as Record<string, unknown>, patch as Record<string, unknown>)
  }
}

function resolveBalanceStack(stack: BalanceStack): ResolvedBalance {
  const cards = clone(BASE_CARDS)
  const enemies = clone(BASE_ENEMIES)
  const relics = clone(BASE_RELICS)
  const relicZh = clone(BASE_RELIC_ZH)
  const ascensionTuning: AscensionTuningPatch = {}
  const mechanicsTuning: MechanicsTuningPatch = {}

  for (const patch of stack.patches) {
    validatePatch(patch)
    if (patch.enemyHpMultiplier !== undefined) {
      for (const enemy of Object.values(enemies)) {
        enemy.hp = enemy.hp.map((hp) => Math.max(1, Math.round(hp * patch.enemyHpMultiplier!))) as [number, number]
      }
    }
    if (patch.enemyAttackMultiplier !== undefined) {
      for (const enemy of Object.values(enemies)) {
        for (const move of enemy.moves) {
          for (const effect of move.effects) {
            if (effect.k === 'atk') effect.n = Math.max(0, Math.round(effect.n * patch.enemyAttackMultiplier!))
          }
        }
      }
    }
    patchKnown(cards, patch.cardPatches, 'card')
    patchKnown(enemies, patch.enemyPatches, 'enemy')
    patchKnown(relics, patch.relicPatches, 'relic')
    for (const [id, text] of Object.entries(patch.relicTextPatches ?? {})) {
      if (!relics[id] || !relicZh[id]) throw new Error(`unknown relic text patch id: ${id}`)
      if (text.desc !== undefined) relics[id].desc = text.desc
      if (text.zhDesc !== undefined) relicZh[id].desc = text.zhDesc
    }
    Object.assign(ascensionTuning, clone(patch.ascensionTuning ?? {}))
    deepAssign(
      mechanicsTuning as Record<string, unknown>,
      clone(patch.mechanicsTuning ?? {}) as Record<string, unknown>,
    )
  }

  const info: ActiveBalanceInfo = {
    id: stack.id,
    version: stack.version,
    hash: '',
    patchIds: stack.patches.map((patch) => `${patch.id}@${patch.version}`),
  }
  const resolved = { cards, enemies, relics, relicZh, ascensionTuning, mechanicsTuning, info }
  validateResolved(resolved)
  info.hash = fingerprint({
    baseVersion: BALANCE_BASE_VERSION,
    stack: { id: stack.id, version: stack.version, patches: stack.patches },
    cards,
    enemies,
    relics,
    relicZh,
    ascensionTuning,
    mechanicsTuning,
  })
  return resolved
}

function commitCatalog<T>(target: Record<string, T>, resolved: Record<string, T>): void {
  // Preserve player-mod ids, but replace every engine-owned entry so a prior
  // balance stack cannot leak fields into the next one.
  for (const [id, value] of Object.entries(resolved)) target[id] = clone(value)
}

export const BASELINE_BALANCE_STACK: BalanceStack = {
  id: 'baseline',
  version: '1.0.0',
  description: 'Unmodified engine content.',
  patches: [],
}

export const CHARACTER_BALANCE_V3: BalancePatch = {
  schemaVersion: 1,
  id: 'character-balance-v3',
  version: '3.0.0',
  baseVersion: BALANCE_BASE_VERSION,
  description: 'RL finalist v3 character tuning.',
  cardPatches: {
    strike: { effects: [{ k: 'dmg', n: 8 }] },
    defend: { effects: [{ k: 'block', n: 7 }] },
    phaseblade: { effects: [{ k: 'dmg', n: 7 }] },
    cloakfield: { effects: [{ k: 'block', n: 6 }] },
    ventblade: { effects: [{ k: 'ventDmg', mult: 3 }] },
    deployturret: {
      cost: 2,
      effects: [{ k: 'status', to: 'self', id: 'turret', n: 1 }],
    },
    deployplating: {
      cost: 2,
      effects: [{ k: 'status', to: 'self', id: 'plating', n: 1 }],
    },
  },
  relicPatches: {
    cortexlink: { hooks: { firstTurnDraw: 2 } },
    phaselocket: { hooks: { combatStatuses: { stancewall: 2 } } },
    dronecradle: { hooks: { combatStatuses: { turret: 0 } } },
  },
  relicTextPatches: {
    cortexlink: {
      desc: 'Draw 2 additional cards on your first turn each combat.',
      zhDesc: '每场战斗的第一个回合额外抽 2 张牌。',
    },
    phaselocket: {
      desc: 'Start each combat with 2 Stance Wall (block on stance entry).',
      zhDesc: '每场战斗开始时获得 2 层姿态壁垒（进入姿态时获得格挡）。',
    },
    dronecradle: {
      desc: 'No longer starts combat with a pre-deployed Turret.',
      zhDesc: '战斗开始时不再预部署炮塔。',
    },
  },
}

export const ENEMY_HP_MINUS_5_PERCENT: BalancePatch = {
  schemaVersion: 1,
  id: 'enemy-hp-minus-5-percent',
  version: '1.0.0',
  baseVersion: BALANCE_BASE_VERSION,
  description: 'Reduce every enemy base HP range by 5%, rounded to integers.',
  enemyHpMultiplier: 0.95,
}

/** Previous live stack, retained verbatim as a one-call rollback target. */
export const PRODUCTION_V3_BALANCE_STACK: BalanceStack = {
  id: 'production-v3-enemy-hp-95',
  version: '1.0.0',
  description: 'Character tuning v3 plus 5% lower enemy base HP.',
  patches: [CHARACTER_BALANCE_V3, ENEMY_HP_MINUS_5_PERCENT],
}

export const GHOST_STABLE_EXIT_ENERGY: BalancePatch = {
  schemaVersion: 1,
  id: 'ghost-stable-exit-energy',
  version: '0.1.0',
  baseVersion: BALANCE_BASE_VERSION,
  description: 'Stable is the neutral stance; leaving Stable grants 1 Energy and Attacks break Stealth.',
  mechanicsTuning: {
    stance: {
      stableState: true,
      stealthExitAfterAttack: true,
      energyRule: 'stable-exit',
      energyAmount: 1,
    },
  },
}

export const GHOST_EVERY_SWITCH_ENERGY: BalancePatch = {
  schemaVersion: 1,
  id: 'ghost-every-switch-energy',
  version: '0.1.0',
  baseVersion: BALANCE_BASE_VERSION,
  description: 'Stable is the neutral stance; every stance switch grants 1 Energy and Attacks break Stealth.',
  mechanicsTuning: {
    stance: {
      stableState: true,
      stealthExitAfterAttack: true,
      energyRule: 'every-switch',
      energyAmount: 1,
    },
  },
}

export const GHOST_RELIC_SWITCH_ENERGY: BalancePatch = {
  schemaVersion: 1,
  id: 'ghost-relic-switch-energy',
  version: '0.1.0',
  baseVersion: BALANCE_BASE_VERSION,
  description: 'Phase Locket, rather than the naked GHOST, grants 1 Energy on every real stance switch.',
  relicPatches: {
    phaselocket: { hooks: { combatStatuses: { stancewall: 0 }, stanceSwitchEnergy: 1 } },
  },
  relicTextPatches: {
    phaselocket: {
      desc: 'Gain 1 Energy after every real stance switch.',
      zhDesc: '每次发生真实姿态切换后，获得 1 点能量。',
    },
  },
  mechanicsTuning: { stance: { energyAmount: 0 } },
}

export const GHOST_RELIC_SWITCH_ENERGY_WALL_ONE: BalancePatch = {
  schemaVersion: 1,
  id: 'ghost-relic-switch-energy-wall-one',
  version: '0.1.0',
  baseVersion: BALANCE_BASE_VERSION,
  description: 'Phase Locket grants 1 Energy on real stance switches and retains one layer of Stance Wall.',
  relicPatches: {
    phaselocket: { hooks: { combatStatuses: { stancewall: 1 }, stanceSwitchEnergy: 1 } },
  },
  relicTextPatches: {
    phaselocket: {
      desc: 'Start with 1 Stance Wall. Gain 1 Energy after every real stance switch.',
      zhDesc: '战斗开始时获得 1 层姿态壁垒；每次发生真实姿态切换后，获得 1 点能量。',
    },
  },
  mechanicsTuning: { stance: { energyAmount: 0 } },
}

export const GHOST_RELIC_SWITCH_ENERGY_WALL_TWO: BalancePatch = {
  schemaVersion: 1,
  id: 'ghost-relic-switch-energy-wall-two',
  version: '0.1.0',
  baseVersion: BALANCE_BASE_VERSION,
  description: 'Phase Locket grants 1 Energy on real stance switches and retains two layers of Stance Wall.',
  relicPatches: {
    phaselocket: { hooks: { combatStatuses: { stancewall: 2 }, stanceSwitchEnergy: 1 } },
  },
  relicTextPatches: {
    phaselocket: {
      desc: 'Start with 2 Stance Wall. Gain 1 Energy after every real stance switch.',
      zhDesc: '战斗开始时获得 2 层姿态壁垒；每次发生真实姿态切换后，获得 1 点能量。',
    },
  },
  mechanicsTuning: { stance: { energyAmount: 0 } },
}

const ACTIVE_DAMAGE_EFFECTS = new Set<Effect['k']>([
  'dmg', 'dmgAll', 'dmgVulnBonus', 'dmgPerPower', 'dmgPerCorrupt',
  'dmgIfCombo', 'blockAsDmg', 'ventDmg', 'ventDmgAll', 'dmgHeatBonus',
  'dmgIfStance', 'dmgPerAuto',
])

function commandInsteadOfDamage(effects: Effect[]): Effect[] {
  const out: Effect[] = []
  let commanded = false
  for (const effect of effects) {
    if (ACTIVE_DAMAGE_EFFECTS.has(effect.k)) {
      if (!commanded) out.push({ k: 'commandMinions' })
      commanded = true
    } else {
      out.push(clone(effect))
    }
  }
  return out
}

const ARRAY_COMMAND_CARD_PATCHES: Record<string, Partial<CardDef>> = Object.fromEntries(
  Object.values(BASE_CARDS)
    .filter((card) => card.char === 'array' && card.type === 'attack')
    .map((card) => [card.id, {
      ...(card.cost === 0 ? { cost: 1, ...(card.upCost === 0 ? { upCost: 1 } : {}) } : {}),
      effects: commandInsteadOfDamage(card.effects),
      upEffects: commandInsteadOfDamage(card.upEffects),
    }]),
)

function commandWithFallbackDamage(card: CardDef, effects: Effect[], upgraded: boolean): Effect[] {
  const commanded = commandInsteadOfDamage(effects)
  const commandIndex = commanded.findIndex((effect) => effect.k === 'commandMinions')
  if (commandIndex < 0) return commanded
  const fallback: Effect = card.target === 'none'
    ? { k: 'dmgAll', n: upgraded ? 2 : 1 }
    : { k: 'dmg', n: upgraded ? 3 : 2 }
  commanded.splice(commandIndex, 0, fallback)
  return commanded
}

const ARRAY_FALLBACK_PULSE_CARD_PATCHES: Record<string, Partial<CardDef>> = Object.fromEntries(
  Object.values(BASE_CARDS)
    .filter((card) => (
      card.char === 'array' &&
      card.type === 'attack' &&
      card.effects.some((effect) => ACTIVE_DAMAGE_EFFECTS.has(effect.k))
    ))
    .map((card) => [card.id, {
      effects: commandWithFallbackDamage(card, card.effects, false),
      upEffects: commandWithFallbackDamage(card, card.upEffects, true),
    }]),
)

export const ARRAY_SUMMON_CORE: BalancePatch = {
  schemaVersion: 1,
  id: 'array-summon-core',
  version: '0.1.0',
  baseVersion: BALANCE_BASE_VERSION,
  description: 'ARRAY has lower body HP, deploys layered minions, and commands them instead of dealing direct Attack damage.',
  cardPatches: {
    ...ARRAY_COMMAND_CARD_PATCHES,
    deployturret: {
      cost: 1,
      effects: [{ k: 'summonAlly', id: 'ferrodrone' }],
      upEffects: [{ k: 'summonAlly', id: 'ferroprime' }],
    },
    deployplating: {
      cost: 1,
      effects: [{ k: 'summonAlly', id: 'bulwarkpod' }],
      upEffects: [{ k: 'summonAlly', id: 'bulwarkprime' }],
    },
  },
  mechanicsTuning: {
    characterMaxHpAdjustments: { array: -8 },
    minions: {
      stackSameRole: true,
      maxStacksPerRole: 5,
      actionPerStack: true,
      independentBodiesPerStack: true,
      synergyPerOtherRole: 0,
      maxSynergyOtherRoles: 20,
    },
  },
}

export const ARRAY_MIXED_SYNERGY: BalancePatch = {
  schemaVersion: 1,
  id: 'array-mixed-synergy',
  version: '0.1.0',
  baseVersion: BALANCE_BASE_VERSION,
  description: 'Each minion layer gains +1 action power for every other role in the formation.',
  mechanicsTuning: { minions: { synergyPerOtherRole: 1 } },
}

export const ARRAY_CAPPED_MIXED_SYNERGY: BalancePatch = {
  schemaVersion: 1,
  id: 'array-capped-mixed-synergy',
  version: '0.1.0',
  baseVersion: BALANCE_BASE_VERSION,
  description: 'A mixed formation grants each minion layer +1 action power, capped at one formation bonus.',
  mechanicsTuning: { minions: { synergyPerOtherRole: 1, maxSynergyOtherRoles: 1 } },
}

export const ARRAY_SMOOTH_FOUR_STACKS: BalancePatch = {
  schemaVersion: 1,
  id: 'array-smooth-four-stacks',
  version: '0.1.0',
  baseVersion: BALANCE_BASE_VERSION,
  description: 'Smooth ARRAY early and late power: -5 Max HP and at most four layers per role.',
  mechanicsTuning: {
    characterMaxHpAdjustments: { array: -5 },
    minions: { maxStacksPerRole: 4 },
  },
}

export const ARRAY_SMOOTH_THREE_STACKS: BalancePatch = {
  schemaVersion: 1,
  id: 'array-smooth-three-stacks',
  version: '0.1.0',
  baseVersion: BALANCE_BASE_VERSION,
  description: 'Stronger smoothing: -3 Max HP and at most three layers per role.',
  mechanicsTuning: {
    characterMaxHpAdjustments: { array: -3 },
    minions: { maxStacksPerRole: 3 },
  },
}

export const ARRAY_SHARED_STACK_BODY: BalancePatch = {
  schemaVersion: 1,
  id: 'array-shared-stack-body',
  version: '0.1.0',
  baseVersion: BALANCE_BASE_VERSION,
  description: 'Layers add actions but share one role HP bar; losing that body removes the whole role stack.',
  mechanicsTuning: { minions: { independentBodiesPerStack: false } },
}

export const ARRAY_STARTER_FERRO: BalancePatch = {
  schemaVersion: 1,
  id: 'array-starter-ferro',
  version: '0.1.0',
  baseVersion: BALANCE_BASE_VERSION,
  description: 'Drone Cradle starts each combat with one base Ferro summon instead of a legacy Turret status.',
  relicPatches: {
    dronecradle: { hooks: { combatStatuses: { turret: 0 }, startMinion: 'ferrodrone' } },
  },
  relicTextPatches: {
    dronecradle: {
      desc: 'Start each combat with one Ferro Drone deployed.',
      zhDesc: '每场战斗开始时预部署 1 层铁卫无人机。',
    },
  },
}

export const ARRAY_STARTER_FERRO_SEED: BalancePatch = {
  schemaVersion: 1,
  id: 'array-starter-ferro-seed',
  version: '0.1.0',
  baseVersion: BALANCE_BASE_VERSION,
  description: 'Drone Cradle deploys a weak Ferro Seed that shares the strike role and upgrades into regular Ferro.',
  relicPatches: {
    dronecradle: { hooks: { combatStatuses: { turret: 0 }, startMinion: 'ferroseed' } },
  },
  relicTextPatches: {
    dronecradle: {
      desc: 'Start each combat with one 2-HP Ferro Seed that acts for 1.',
      zhDesc: '每场战斗开始时预部署 1 层铁卫胚体（2 点生命，行动强度 1）。',
    },
  },
}

export const ARRAY_STARTER_REINFORCED_ROLES: BalancePatch = {
  schemaVersion: 1,
  id: 'array-starter-reinforced-roles',
  version: '0.1.0',
  baseVersion: BALANCE_BASE_VERSION,
  description: 'Drone Cradle grants +2 HP to each summoned role shared body without pre-deploying an active unit.',
  relicPatches: {
    dronecradle: { hooks: { combatStatuses: { turret: 0 }, minionHp: 2 } },
  },
  relicTextPatches: {
    dronecradle: {
      desc: 'Each summoned role shared body has 2 additional HP.',
      zhDesc: '每个召唤职能的共享血条额外获得 2 点生命。',
    },
  },
}

export const ARRAY_STARTER_REINFORCED_ROLES_ONE: BalancePatch = {
  schemaVersion: 1,
  id: 'array-starter-reinforced-roles-one',
  version: '0.1.0',
  baseVersion: BALANCE_BASE_VERSION,
  description: 'Drone Cradle grants +1 HP to each summoned role shared body without pre-deploying an active unit.',
  relicPatches: {
    dronecradle: { hooks: { combatStatuses: { turret: 0 }, minionHp: 1 } },
  },
  relicTextPatches: {
    dronecradle: {
      desc: 'Each summoned role shared body has 1 additional HP.',
      zhDesc: '每个召唤职能的共享血条额外获得 1 点生命。',
    },
  },
}

/**
 * The promoted result of the 2026-08-01 mechanics study. Keep this as one
 * release layer: the smaller candidate layers below remain useful for lab
 * attribution, while production and rollback stay easy to reason about.
 */
export const CHARACTER_MECHANICS_V4: BalancePatch = {
  schemaVersion: 1,
  id: 'character-mechanics-v4',
  version: '4.0.0',
  baseVersion: BALANCE_BASE_VERSION,
  description: 'Promote Stable GHOST and shared-body, four-layer ARRAY summon mechanics.',
  cardPatches: {
    ...ARRAY_COMMAND_CARD_PATCHES,
    deployturret: {
      cost: 1,
      effects: [{ k: 'summonAlly', id: 'ferrodrone' }],
      upEffects: [{ k: 'summonAlly', id: 'ferroprime' }],
    },
    deployplating: {
      cost: 1,
      effects: [{ k: 'summonAlly', id: 'bulwarkpod' }],
      upEffects: [{ k: 'summonAlly', id: 'bulwarkprime' }],
    },
  },
  relicPatches: {
    phaselocket: { hooks: { combatStatuses: { stancewall: 2 }, stanceSwitchEnergy: 1 } },
    dronecradle: { hooks: { combatStatuses: { turret: 0 }, minionHp: 1 } },
  },
  relicTextPatches: {
    phaselocket: {
      desc: 'Start with 2 Stance Wall. Gain 1 Energy after every real stance switch.',
      zhDesc: '战斗开始时获得 2 层姿态壁垒；每次发生真实姿态切换后，获得 1 点能量。',
    },
    dronecradle: {
      desc: 'Each summoned role shared body has 1 additional HP.',
      zhDesc: '每个召唤职能的共享血条额外获得 1 点生命。',
    },
  },
  mechanicsTuning: {
    stance: {
      stableState: true,
      stealthExitAfterAttack: true,
      energyRule: 'every-switch',
      energyAmount: 0,
    },
    characterMaxHpAdjustments: { array: -5 },
    minions: {
      stackSameRole: true,
      maxStacksPerRole: 4,
      actionPerStack: true,
      independentBodiesPerStack: false,
      synergyPerOtherRole: 1,
      maxSynergyOtherRoles: 1,
    },
  },
}

/** Small body damage prevents ARRAY Attacks becoming blank when every summon is down. */
export const ARRAY_FALLBACK_PULSE: BalancePatch = {
  schemaVersion: 1,
  id: 'array-fallback-pulse',
  version: '1.0.0',
  baseVersion: BALANCE_BASE_VERSION,
  description: 'ARRAY Attacks retain a small chassis pulse before commanding living summons.',
  cardPatches: ARRAY_FALLBACK_PULSE_CARD_PATCHES,
}

/** Exact Patch 2.0.0 rollback target. */
export const PRODUCTION_V4_BALANCE_STACK: BalanceStack = {
  id: 'production-v4-mechanics',
  version: '2.0.0',
  description: 'Production v3 numbers plus the promoted GHOST and ARRAY mechanics.',
  patches: [
    ...PRODUCTION_V3_BALANCE_STACK.patches,
    CHARACTER_MECHANICS_V4,
  ],
}

export const PRODUCTION_BALANCE_STACK: BalanceStack = {
  id: 'production-v4.1-array-fallback',
  version: '2.1.0',
  description: 'Patch 2.0.0 plus a small ARRAY fallback pulse that preserves summon-led damage.',
  patches: [
    ...PRODUCTION_V4_BALANCE_STACK.patches,
    ARRAY_FALLBACK_PULSE,
  ],
}

export const GHOST_STABLE_EXIT_STACK: BalanceStack = {
  id: 'candidate-ghost-stable-exit', version: '0.1.0',
  patches: [...PRODUCTION_V3_BALANCE_STACK.patches, GHOST_STABLE_EXIT_ENERGY],
}

export const GHOST_EVERY_SWITCH_STACK: BalanceStack = {
  id: 'candidate-ghost-every-switch', version: '0.1.0',
  patches: [...PRODUCTION_V3_BALANCE_STACK.patches, GHOST_EVERY_SWITCH_ENERGY],
}

export const ARRAY_LINEAR_STACK: BalanceStack = {
  id: 'candidate-array-linear', version: '0.1.0',
  patches: [...PRODUCTION_V3_BALANCE_STACK.patches, ARRAY_SUMMON_CORE],
}

export const ARRAY_SYNERGY_STACK: BalanceStack = {
  id: 'candidate-array-synergy', version: '0.1.0',
  patches: [...PRODUCTION_V3_BALANCE_STACK.patches, ARRAY_SUMMON_CORE, ARRAY_MIXED_SYNERGY],
}

export const MECHANICS_STABLE_LINEAR_STACK: BalanceStack = {
  id: 'candidate-mechanics-stable-linear', version: '0.1.0',
  patches: [...PRODUCTION_V3_BALANCE_STACK.patches, GHOST_STABLE_EXIT_ENERGY, ARRAY_SUMMON_CORE],
}

export const MECHANICS_SWITCH_LINEAR_STACK: BalanceStack = {
  id: 'candidate-mechanics-switch-linear', version: '0.1.0',
  patches: [...PRODUCTION_V3_BALANCE_STACK.patches, GHOST_EVERY_SWITCH_ENERGY, ARRAY_SUMMON_CORE],
}

export const MECHANICS_STABLE_SYNERGY_STACK: BalanceStack = {
  id: 'candidate-mechanics-stable-synergy', version: '0.1.0',
  patches: [...PRODUCTION_V3_BALANCE_STACK.patches, GHOST_STABLE_EXIT_ENERGY, ARRAY_SUMMON_CORE, ARRAY_MIXED_SYNERGY],
}

export const MECHANICS_SWITCH_SYNERGY_STACK: BalanceStack = {
  id: 'candidate-mechanics-switch-synergy', version: '0.1.0',
  patches: [...PRODUCTION_V3_BALANCE_STACK.patches, GHOST_EVERY_SWITCH_ENERGY, ARRAY_SUMMON_CORE, ARRAY_MIXED_SYNERGY],
}

export const MECHANICS_SWITCH_SMOOTH_FOUR_STACK: BalanceStack = {
  id: 'candidate-mechanics-switch-smooth4', version: '0.1.0',
  patches: [
    ...PRODUCTION_V3_BALANCE_STACK.patches,
    GHOST_EVERY_SWITCH_ENERGY,
    ARRAY_SUMMON_CORE,
    ARRAY_SMOOTH_FOUR_STACKS,
    ARRAY_CAPPED_MIXED_SYNERGY,
  ],
}

export const MECHANICS_SWITCH_SMOOTH_THREE_STACK: BalanceStack = {
  id: 'candidate-mechanics-switch-smooth3', version: '0.1.0',
  patches: [
    ...PRODUCTION_V3_BALANCE_STACK.patches,
    GHOST_EVERY_SWITCH_ENERGY,
    ARRAY_SUMMON_CORE,
    ARRAY_SMOOTH_THREE_STACKS,
    ARRAY_CAPPED_MIXED_SYNERGY,
  ],
}

export const MECHANICS_SWITCH_SHARED_FOUR_STACK: BalanceStack = {
  id: 'candidate-mechanics-switch-shared4', version: '0.1.0',
  patches: [
    ...PRODUCTION_V3_BALANCE_STACK.patches,
    GHOST_EVERY_SWITCH_ENERGY,
    ARRAY_SUMMON_CORE,
    ARRAY_SMOOTH_FOUR_STACKS,
    ARRAY_CAPPED_MIXED_SYNERGY,
    ARRAY_SHARED_STACK_BODY,
  ],
}

export const MECHANICS_RELIC_CORE_SHARED_FOUR_STACK: BalanceStack = {
  id: 'candidate-mechanics-relic-core-shared4', version: '0.1.0',
  patches: [
    ...PRODUCTION_V3_BALANCE_STACK.patches,
    GHOST_EVERY_SWITCH_ENERGY,
    GHOST_RELIC_SWITCH_ENERGY,
    ARRAY_SUMMON_CORE,
    ARRAY_SMOOTH_FOUR_STACKS,
    ARRAY_CAPPED_MIXED_SYNERGY,
    ARRAY_SHARED_STACK_BODY,
    ARRAY_STARTER_FERRO,
  ],
}

export const MECHANICS_RELIC_SEED_SHARED_FOUR_STACK: BalanceStack = {
  id: 'candidate-mechanics-relic-seed-shared4', version: '0.1.0',
  patches: [
    ...PRODUCTION_V3_BALANCE_STACK.patches,
    GHOST_EVERY_SWITCH_ENERGY,
    GHOST_RELIC_SWITCH_ENERGY_WALL_TWO,
    ARRAY_SUMMON_CORE,
    ARRAY_SMOOTH_FOUR_STACKS,
    ARRAY_CAPPED_MIXED_SYNERGY,
    ARRAY_SHARED_STACK_BODY,
    ARRAY_STARTER_FERRO_SEED,
  ],
}

export const MECHANICS_RELIC_REINFORCED_SHARED_FOUR_STACK: BalanceStack = {
  id: 'candidate-mechanics-relic-reinforced-shared4', version: '0.1.0',
  patches: [
    ...PRODUCTION_V3_BALANCE_STACK.patches,
    GHOST_EVERY_SWITCH_ENERGY,
    GHOST_RELIC_SWITCH_ENERGY_WALL_TWO,
    ARRAY_SUMMON_CORE,
    ARRAY_SMOOTH_FOUR_STACKS,
    ARRAY_CAPPED_MIXED_SYNERGY,
    ARRAY_SHARED_STACK_BODY,
    ARRAY_STARTER_REINFORCED_ROLES,
  ],
}

export const MECHANICS_RELIC_REINFORCED_ONE_SHARED_FOUR_STACK: BalanceStack = {
  id: 'candidate-mechanics-relic-reinforced-one-shared4', version: '0.1.0',
  patches: [
    ...PRODUCTION_V3_BALANCE_STACK.patches,
    GHOST_EVERY_SWITCH_ENERGY,
    GHOST_RELIC_SWITCH_ENERGY_WALL_TWO,
    ARRAY_SUMMON_CORE,
    ARRAY_SMOOTH_FOUR_STACKS,
    ARRAY_CAPPED_MIXED_SYNERGY,
    ARRAY_SHARED_STACK_BODY,
    ARRAY_STARTER_REINFORCED_ROLES_ONE,
  ],
}

export const BUILTIN_BALANCE_STACKS: Readonly<Record<string, BalanceStack>> = {
  [BASELINE_BALANCE_STACK.id]: BASELINE_BALANCE_STACK,
  [PRODUCTION_V3_BALANCE_STACK.id]: PRODUCTION_V3_BALANCE_STACK,
  [PRODUCTION_V4_BALANCE_STACK.id]: PRODUCTION_V4_BALANCE_STACK,
  [PRODUCTION_BALANCE_STACK.id]: PRODUCTION_BALANCE_STACK,
  [GHOST_STABLE_EXIT_STACK.id]: GHOST_STABLE_EXIT_STACK,
  [GHOST_EVERY_SWITCH_STACK.id]: GHOST_EVERY_SWITCH_STACK,
  [ARRAY_LINEAR_STACK.id]: ARRAY_LINEAR_STACK,
  [ARRAY_SYNERGY_STACK.id]: ARRAY_SYNERGY_STACK,
  [MECHANICS_STABLE_LINEAR_STACK.id]: MECHANICS_STABLE_LINEAR_STACK,
  [MECHANICS_SWITCH_LINEAR_STACK.id]: MECHANICS_SWITCH_LINEAR_STACK,
  [MECHANICS_STABLE_SYNERGY_STACK.id]: MECHANICS_STABLE_SYNERGY_STACK,
  [MECHANICS_SWITCH_SYNERGY_STACK.id]: MECHANICS_SWITCH_SYNERGY_STACK,
  [MECHANICS_SWITCH_SMOOTH_FOUR_STACK.id]: MECHANICS_SWITCH_SMOOTH_FOUR_STACK,
  [MECHANICS_SWITCH_SMOOTH_THREE_STACK.id]: MECHANICS_SWITCH_SMOOTH_THREE_STACK,
  [MECHANICS_SWITCH_SHARED_FOUR_STACK.id]: MECHANICS_SWITCH_SHARED_FOUR_STACK,
  [MECHANICS_RELIC_CORE_SHARED_FOUR_STACK.id]: MECHANICS_RELIC_CORE_SHARED_FOUR_STACK,
  [MECHANICS_RELIC_SEED_SHARED_FOUR_STACK.id]: MECHANICS_RELIC_SEED_SHARED_FOUR_STACK,
  [MECHANICS_RELIC_REINFORCED_SHARED_FOUR_STACK.id]: MECHANICS_RELIC_REINFORCED_SHARED_FOUR_STACK,
  [MECHANICS_RELIC_REINFORCED_ONE_SHARED_FOUR_STACK.id]: MECHANICS_RELIC_REINFORCED_ONE_SHARED_FOUR_STACK,
}

let activeInfo: ActiveBalanceInfo = {
  id: BASELINE_BALANCE_STACK.id,
  version: BASELINE_BALANCE_STACK.version,
  hash: fingerprint({ baseVersion: BALANCE_BASE_VERSION, stack: BASELINE_BALANCE_STACK }),
  patchIds: [],
}

export function getActiveBalance(): Readonly<ActiveBalanceInfo> {
  return activeInfo
}

export function activateBalanceStack(stackOrId: BalanceStack | string): Readonly<ActiveBalanceInfo> {
  const stack = typeof stackOrId === 'string' ? BUILTIN_BALANCE_STACKS[stackOrId] : stackOrId
  if (!stack) throw new Error(`unknown balance stack: ${stackOrId}`)
  const resolved = resolveBalanceStack(stack)
  commitCatalog(CARDS, resolved.cards)
  commitCatalog(ENEMIES, resolved.enemies)
  commitCatalog(RELICS, resolved.relics)
  commitCatalog(RELIC_ZH, resolved.relicZh)
  configureAscensionTuning(resolved.ascensionTuning)
  configureMechanicsTuning(resolved.mechanicsTuning)
  activeInfo = Object.freeze({ ...resolved.info, patchIds: Object.freeze([...resolved.info.patchIds]) })
  return activeInfo
}

export function activateProductionBalance(): Readonly<ActiveBalanceInfo> {
  return activateBalanceStack(PRODUCTION_BALANCE_STACK)
}

export function resetBalanceToBaseline(): Readonly<ActiveBalanceInfo> {
  return activateBalanceStack(BASELINE_BALANCE_STACK)
}

/** Apply an ephemeral candidate through the exact same resolver as production. */
export function activateBalanceOverrides(id: string, overrides: BalanceOverrides): Readonly<ActiveBalanceInfo> {
  const patch: BalancePatch = {
    ...clone(overrides),
    schemaVersion: 1,
    id: `candidate-${id}`.replace(/[^a-z0-9._-]/gi, '-').slice(0, 80),
    version: '0.0.0',
    baseVersion: BALANCE_BASE_VERSION,
  }
  return activateBalanceStack({
    id: `candidate-stack-${id}`.replace(/[^a-z0-9._-]/gi, '-').slice(0, 80),
    version: '0.0.0',
    patches: [patch],
  })
}
