/**
 * Versioned balance patches shared by the client, authoritative server and
 * headless RL lab.
 *
 * Content modules remain the immutable baseline.  Activating a stack first
 * resolves every layer against private baseline snapshots, validates the
 * result, and only then replaces the live catalog entries transactionally.
 */
import type { CardDef, EnemyDef } from './types'
import { CARDS } from './cards'
import { ENEMIES } from './enemies'
import { RELICS, type RelicDef } from './relics'
import { RELIC_ZH } from './locale-zh'
import {
  configureAscensionTuning,
  type AscensionStep,
  type AscensionTuningPatch,
} from './ascension'

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
  }

  const info: ActiveBalanceInfo = {
    id: stack.id,
    version: stack.version,
    hash: '',
    patchIds: stack.patches.map((patch) => `${patch.id}@${patch.version}`),
  }
  const resolved = { cards, enemies, relics, relicZh, ascensionTuning, info }
  validateResolved(resolved)
  info.hash = fingerprint({
    baseVersion: BALANCE_BASE_VERSION,
    stack: { id: stack.id, version: stack.version, patches: stack.patches },
    cards,
    enemies,
    relics,
    relicZh,
    ascensionTuning,
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

export const PRODUCTION_BALANCE_STACK: BalanceStack = {
  id: 'production-v3-enemy-hp-95',
  version: '1.0.0',
  description: 'Character tuning v3 plus 5% lower enemy base HP.',
  patches: [CHARACTER_BALANCE_V3, ENEMY_HP_MINUS_5_PERCENT],
}

export const BUILTIN_BALANCE_STACKS: Readonly<Record<string, BalanceStack>> = {
  [BASELINE_BALANCE_STACK.id]: BASELINE_BALANCE_STACK,
  [PRODUCTION_BALANCE_STACK.id]: PRODUCTION_BALANCE_STACK,
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
