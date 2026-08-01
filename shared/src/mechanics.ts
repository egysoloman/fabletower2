import type { CharId } from './types'

export type StanceEnergyRule = 'legacy-stealth-exit' | 'stable-exit' | 'every-switch' | 'none'

export interface StanceTuning {
  /** Show Stable as the neutral GHOST stance and return to it on every exit. */
  stableState: boolean
  /** Playing an Attack while already in Stealth breaks Stealth after resolution. */
  stealthExitAfterAttack: boolean
  energyRule: StanceEnergyRule
  energyAmount: number
}

export interface MinionTuning {
  /** Repeated summons of the same role occupy one slot and add a layer. */
  stackSameRole: boolean
  maxStacksPerRole: number
  /** A stacked unit acts once per surviving layer. */
  actionPerStack: boolean
  /** Each lost minion HP bar removes only one layer instead of the whole role. */
  independentBodiesPerStack: boolean
  /** Per-layer action bonus for every other summoned role currently present. */
  synergyPerOtherRole: number
  /** Cap the number of other roles counted by the mixed-formation bonus. */
  maxSynergyOtherRoles: number
}

export interface MechanicsTuning {
  stance: StanceTuning
  minions: MinionTuning
  /** Additive run-start Max HP changes, after the ascension curve. */
  characterMaxHpAdjustments: Partial<Record<CharId, number>>
}

export type MechanicsTuningPatch = {
  stance?: Partial<StanceTuning>
  minions?: Partial<MinionTuning>
  characterMaxHpAdjustments?: Partial<Record<CharId, number>>
}

export const DEFAULT_MECHANICS_TUNING: Readonly<MechanicsTuning> = Object.freeze({
  stance: Object.freeze({
    stableState: false,
    stealthExitAfterAttack: false,
    energyRule: 'legacy-stealth-exit',
    energyAmount: 2,
  }),
  minions: Object.freeze({
    stackSameRole: false,
    maxStacksPerRole: 1,
    actionPerStack: false,
    independentBodiesPerStack: true,
    synergyPerOtherRole: 0,
    maxSynergyOtherRoles: 20,
  }),
  characterMaxHpAdjustments: Object.freeze({}),
})

let active: MechanicsTuning = structuredClone(DEFAULT_MECHANICS_TUNING)

export function configureMechanicsTuning(patch: MechanicsTuningPatch = {}): void {
  active = {
    stance: { ...DEFAULT_MECHANICS_TUNING.stance, ...structuredClone(patch.stance ?? {}) },
    minions: { ...DEFAULT_MECHANICS_TUNING.minions, ...structuredClone(patch.minions ?? {}) },
    characterMaxHpAdjustments: {
      ...DEFAULT_MECHANICS_TUNING.characterMaxHpAdjustments,
      ...structuredClone(patch.characterMaxHpAdjustments ?? {}),
    },
  }
}

export function getMechanicsTuning(): Readonly<MechanicsTuning> {
  return active
}

export function characterStartingMaxHp(base: number, char: CharId): number {
  return Math.max(10, Math.round(base + (active.characterMaxHpAdjustments[char] ?? 0)))
}
