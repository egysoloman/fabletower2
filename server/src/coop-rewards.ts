import {
  RELICS,
  ascensionBossRelicChoices,
  ascensionGoldRewardMultiplier,
  cardsByRarity,
  obtainableRelics,
  pick,
  rand,
  randInt,
  type CharId,
  type Rng,
} from '@neonspire/engine'

export interface CoopReward {
  cards: string[]
  /** Elite rewards contain one entry; bosses offer a real 2/3-way choice. */
  relics: string[]
  gold: number
}

function rewardRarity(rng: Rng, kind: 'normal' | 'elite' | 'boss'): 'common' | 'uncommon' | 'rare' {
  if (kind === 'boss') return 'rare'
  const roll = rand(rng)
  if (kind === 'elite') return roll < 0.15 ? 'rare' : roll < 0.6 ? 'uncommon' : 'common'
  return roll < 0.05 ? 'rare' : roll < 0.35 ? 'uncommon' : 'common'
}

function relicChoices(
  rng: Rng,
  char: CharId,
  owned: string[],
  kind: 'normal' | 'elite' | 'boss',
  asc: number,
): string[] {
  if (kind === 'normal') return []
  const pool = obtainableRelics(owned, kind === 'boss', char)
  if (kind === 'elite') return pool.length > 0 ? [pick(rng, pool).id] : []

  const want = ascensionBossRelicChoices(asc)
  const out: string[] = []
  for (const group of [pool.filter((r) => r.rarity === 'boss'), pool.filter((r) => r.rarity === 'rare')]) {
    const bag = [...group]
    while (out.length < want && bag.length > 0) {
      out.push(bag.splice(randInt(rng, 0, bag.length - 1), 1)[0].id)
    }
  }
  return out
}

export function rollCoopReward(opts: {
  rng: Rng
  char: CharId
  relics: string[]
  kind: 'normal' | 'elite' | 'boss'
  asc: number
  act: number
}): CoopReward {
  const { rng, char, relics, kind, asc, act } = opts
  const baseGold = kind === 'boss'
    ? randInt(rng, 65, 85)
    : kind === 'elite'
      ? randInt(rng, 32, 45)
      : randInt(rng, 13, 22) + act * 4
  const goldBonus = relics.reduce((sum, id) => sum + (RELICS[id]?.hooks.goldBonusPct ?? 0), 0)
  const gold = Math.floor(baseGold * ascensionGoldRewardMultiplier(asc) * (1 + goldBonus / 100))

  const cards: string[] = []
  const wantCards = asc >= 15 ? 2 : 3
  let guard = 0
  while (cards.length < wantCards && guard++ < 40) {
    const def = pick(rng, cardsByRarity(rewardRarity(rng, kind), char))
    if (!cards.includes(def.id)) cards.push(def.id)
  }

  return { cards, relics: relicChoices(rng, char, relics, kind, asc), gold }
}
