/**
 * Runtime-tunable ascension rules.
 *
 * Production uses DEFAULT_ASCENSION_TUNING.  The headless balance lab may
 * install a process-local override before constructing runs, which lets us
 * test additive curves and move threshold mechanics without mutating content.
 */

export interface AscensionStep {
  asc: number
  value: number
}

export interface AscensionTuning {
  enemyHpPercentPerLevel: number
  enemyHpFlatPerLevel: number
  enemyAttackPercentPerLevel: number
  enemyAttackFlatSteps: AscensionStep[]
  lagAscensions: number[]
  maxHpSteps: AscensionStep[]
  goldRewardMultiplierSteps: AscensionStep[]
  restHealFractionSteps: AscensionStep[]
  potionDropChanceSteps: AscensionStep[]
  shopPriceMultiplierSteps: AscensionStep[]
  bossRelicChoiceSteps: AscensionStep[]
  eliteBossStrengthAsc: number
  eliteBossArtifactAsc: number
}

export type AscensionTuningPatch = Partial<AscensionTuning>

export const DEFAULT_ASCENSION_TUNING: AscensionTuning = {
  enemyHpPercentPerLevel: 0.06,
  enemyHpFlatPerLevel: 0,
  enemyAttackPercentPerLevel: 0.03,
  enemyAttackFlatSteps: [{ asc: 0, value: 0 }],
  lagAscensions: [2, 10],
  maxHpSteps: [
    { asc: 0, value: 75 },
    { asc: 5, value: 65 },
    { asc: 10, value: 60 },
  ],
  goldRewardMultiplierSteps: [
    { asc: 0, value: 1 },
    { asc: 3, value: 0.85 },
  ],
  restHealFractionSteps: [
    { asc: 0, value: 0.3 },
    { asc: 3, value: 0.25 },
    { asc: 6, value: 0.2 },
    { asc: 17, value: 0.15 },
  ],
  potionDropChanceSteps: [
    { asc: 0, value: 0.35 },
    { asc: 7, value: 0.25 },
    { asc: 19, value: 0.15 },
  ],
  shopPriceMultiplierSteps: [
    { asc: 0, value: 1 },
    { asc: 8, value: 1.2 },
  ],
  bossRelicChoiceSteps: [
    { asc: 0, value: 3 },
    { asc: 9, value: 2 },
  ],
  eliteBossStrengthAsc: 4,
  eliteBossArtifactAsc: 5,
}

function cloneTuning(value: AscensionTuning): AscensionTuning {
  return structuredClone(value)
}

let active = cloneTuning(DEFAULT_ASCENSION_TUNING)

export function configureAscensionTuning(patch: AscensionTuningPatch = {}): void {
  active = { ...cloneTuning(DEFAULT_ASCENSION_TUNING), ...structuredClone(patch) }
}

export function resetAscensionTuning(): void {
  active = cloneTuning(DEFAULT_ASCENSION_TUNING)
}

function stepValue(steps: AscensionStep[], asc: number): number {
  if (steps.length === 0) throw new Error('ascension step table cannot be empty')
  const ordered = [...steps].sort((a, b) => a.asc - b.asc)
  let value = ordered[0].value
  for (const step of ordered) {
    if (asc >= step.asc) value = step.value
  }
  return value
}

export function ascensionEnemyHp(base: number, asc: number, actScale: number): number {
  const scaled = Math.round(base * (1 + active.enemyHpPercentPerLevel * asc) * actScale)
  return Math.max(1, scaled + Math.round(active.enemyHpFlatPerLevel * asc))
}

export function ascensionEnemyAttack(base: number, asc: number, actScale: number): number {
  const scaled = Math.round(base * (1 + active.enemyAttackPercentPerLevel * asc) * actScale)
  return Math.max(0, scaled + Math.round(stepValue(active.enemyAttackFlatSteps, asc)))
}

export function ascensionLagCount(asc: number): number {
  return active.lagAscensions.filter((threshold) => asc >= threshold).length
}

export function ascensionMaxHp(asc: number): number {
  return Math.max(1, Math.round(stepValue(active.maxHpSteps, asc)))
}

export function ascensionGoldRewardMultiplier(asc: number): number {
  return Math.max(0, stepValue(active.goldRewardMultiplierSteps, asc))
}

export function ascensionRestHealFraction(asc: number): number {
  return Math.max(0, stepValue(active.restHealFractionSteps, asc))
}

export function ascensionPotionDropChance(asc: number): number {
  return Math.max(0, Math.min(1, stepValue(active.potionDropChanceSteps, asc)))
}

export function ascensionShopPriceMultiplier(asc: number): number {
  return Math.max(0, stepValue(active.shopPriceMultiplierSteps, asc))
}

export function ascensionBossRelicChoices(asc: number): number {
  return Math.max(1, Math.round(stepValue(active.bossRelicChoiceSteps, asc)))
}

export function ascensionEliteBossStrength(asc: number): number {
  return asc >= active.eliteBossStrengthAsc ? 1 : 0
}

export function ascensionEliteBossArtifact(asc: number): number {
  return asc >= active.eliteBossArtifactAsc ? 1 : 0
}
