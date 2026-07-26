import type { CardDef, CardInst, CardType, Effect, Rarity } from './types'
import { STATUS_INFO } from './types'

const c = (def: CardDef) => def

/**
 * The full card catalog. Rules text is generated from `effects` by
 * `describeCard`, so the description can never drift from what the shared
 * interpreter actually executes.
 */
export const CARDS: Record<string, CardDef> = {}

function reg(def: CardDef) {
  CARDS[def.id] = def
}

// --- Starters ---------------------------------------------------------------

reg(c({
  id: 'strike', name: 'Strike.sh', type: 'attack', rarity: 'starter', cost: 1, target: 'enemy',
  effects: [{ k: 'dmg', n: 6 }], upEffects: [{ k: 'dmg', n: 9 }],
  flavor: 'chmod +x pain',
}))
reg(c({
  id: 'defend', name: 'Null Shield', type: 'skill', rarity: 'starter', cost: 1, target: 'none',
  effects: [{ k: 'block', n: 5 }], upEffects: [{ k: 'block', n: 8 }],
  flavor: 'segfault deflected',
}))

// --- Common attacks ---------------------------------------------------------

reg(c({
  id: 'zeroday', name: 'Zero-Day', type: 'attack', rarity: 'common', cost: 0, target: 'enemy',
  effects: [{ k: 'dmg', n: 3 }], upEffects: [{ k: 'dmg', n: 5 }],
  flavor: 'unpatched. unforgiving.',
}))
reg(c({
  id: 'twinlaser', name: 'Twin Lasers', type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
  effects: [{ k: 'dmg', n: 4, times: 2 }], upEffects: [{ k: 'dmg', n: 6, times: 2 }],
}))
reg(c({
  id: 'spike', name: 'Data Spike', type: 'attack', rarity: 'starter', cost: 2, target: 'enemy',
  effects: [{ k: 'dmg', n: 8 }, { k: 'status', to: 'target', id: 'vuln', n: 2 }],
  upEffects: [{ k: 'dmg', n: 10 }, { k: 'status', to: 'target', id: 'vuln', n: 3 }],
  flavor: 'sudo suffer',
}))
reg(c({
  id: 'backdoor', name: 'Backdoor', type: 'attack', rarity: 'common', cost: 0, target: 'enemy',
  effects: [{ k: 'dmg', n: 4 }, { k: 'draw', n: 1 }],
  upEffects: [{ k: 'dmg', n: 6 }, { k: 'draw', n: 1 }],
}))
reg(c({
  id: 'breaker', name: 'Circuit Breaker', type: 'attack', rarity: 'common', cost: 2, target: 'enemy',
  effects: [{ k: 'dmg', n: 10 }, { k: 'block', n: 5 }],
  upEffects: [{ k: 'dmg', n: 13 }, { k: 'block', n: 7 }],
}))
reg(c({
  id: 'chain', name: 'Chain Lightning', type: 'attack', rarity: 'common', cost: 1, target: 'none',
  effects: [{ k: 'dmgAll', n: 5 }], upEffects: [{ k: 'dmgAll', n: 8 }],
  flavor: 'for e in enemies: fry(e)',
}))
reg(c({
  id: 'glitchblade', name: 'Glitch Blade', type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
  effects: [{ k: 'dmg', n: 9 }, { k: 'addCard', id: 'glitch', where: 'discard', n: 1 }],
  upEffects: [{ k: 'dmg', n: 13 }, { k: 'addCard', id: 'glitch', where: 'discard', n: 1 }],
  flavor: 'undefined behaviour, defined damage',
}))
reg(c({
  id: 'purge', name: 'Purge.exe', type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
  effects: [{ k: 'dmg', n: 9 }], upEffects: [{ k: 'dmg', n: 13 }],
  exhaust: true, upExhaust: true,
}))

// --- Uncommon attacks -------------------------------------------------------

reg(c({
  id: 'overclock', name: 'Overclock Slash', type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy',
  effects: [{ k: 'dmg', n: 14 }], upEffects: [{ k: 'dmg', n: 18 }],
}))
reg(c({
  id: 'barrage', name: 'Neon Barrage', type: 'attack', rarity: 'uncommon', cost: 3, target: 'enemy',
  effects: [{ k: 'dmg', n: 4, times: 4 }], upEffects: [{ k: 'dmg', n: 4, times: 6 }],
  flavor: 'pink tracer rounds',
}))
reg(c({
  id: 'crash', name: 'Neural Crash', type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy',
  effects: [{ k: 'dmg', n: 9 }, { k: 'status', to: 'target', id: 'weak', n: 2 }],
  upEffects: [{ k: 'dmg', n: 12 }, { k: 'status', to: 'target', id: 'weak', n: 2 }],
}))
reg(c({
  id: 'ramslam', name: 'RAM Slam', type: 'attack', rarity: 'uncommon', cost: 1, upCost: 0, target: 'enemy',
  effects: [{ k: 'blockAsDmg' }], upEffects: [{ k: 'blockAsDmg' }],
  flavor: 'download this',
}))
reg(c({
  id: 'surge', name: 'Voltage Surge', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
  effects: [{ k: 'dmgPerPower', base: 5, per: 3 }], upEffects: [{ k: 'dmgPerPower', base: 7, per: 4 }],
}))
reg(c({
  id: 'killswitch', name: 'Killswitch', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
  effects: [{ k: 'dmgVulnBonus', n: 6, bonus: 6 }], upEffects: [{ k: 'dmgVulnBonus', n: 8, bonus: 8 }],
}))

// --- Rare attacks -----------------------------------------------------------

reg(c({
  id: 'nulldivide', name: 'Null Divide', type: 'attack', rarity: 'rare', cost: 3, target: 'enemy',
  effects: [{ k: 'dmg', n: 24 }], upEffects: [{ k: 'dmg', n: 32 }],
  flavor: 'x / 0',
}))
reg(c({
  id: 'forkbomb', name: 'Fork Bomb', type: 'attack', rarity: 'rare', cost: 2, target: 'none',
  effects: [{ k: 'dmgAll', n: 7 }, { k: 'status', to: 'all', id: 'vuln', n: 1 }],
  upEffects: [{ k: 'dmgAll', n: 10 }, { k: 'status', to: 'all', id: 'vuln', n: 2 }],
  flavor: ':(){ :|:& };:',
}))

// --- Common skills ----------------------------------------------------------

reg(c({
  id: 'firewall', name: 'Firewall', type: 'skill', rarity: 'common', cost: 1, target: 'none',
  effects: [{ k: 'block', n: 8 }], upEffects: [{ k: 'block', n: 11 }],
}))
reg(c({
  id: 'hotfix', name: 'Hotfix', type: 'skill', rarity: 'common', cost: 1, target: 'none',
  effects: [{ k: 'heal', n: 4 }], upEffects: [{ k: 'heal', n: 6 }],
  exhaust: true, upExhaust: true,
}))
reg(c({
  id: 'shortcircuit', name: 'Short-Circuit', type: 'skill', rarity: 'common', cost: 1, target: 'enemy',
  effects: [{ k: 'status', to: 'target', id: 'weak', n: 2 }],
  upEffects: [{ k: 'status', to: 'target', id: 'weak', n: 3 }],
}))
reg(c({
  id: 'debugprobe', name: 'Debug Probe', type: 'skill', rarity: 'common', cost: 1, target: 'enemy',
  effects: [{ k: 'status', to: 'target', id: 'vuln', n: 2 }],
  upEffects: [{ k: 'status', to: 'target', id: 'vuln', n: 3 }],
}))
reg(c({
  id: 'cachehit', name: 'Cache Hit', type: 'skill', rarity: 'common', cost: 0, target: 'none',
  effects: [{ k: 'draw', n: 2 }], upEffects: [{ k: 'draw', n: 3 }],
  exhaust: true, upExhaust: true,
}))
reg(c({
  id: 'holodecoy', name: 'Holo-Decoy', type: 'skill', rarity: 'common', cost: 0, target: 'none',
  effects: [{ k: 'block', n: 4 }], upEffects: [{ k: 'block', n: 7 }],
}))

// --- Uncommon skills --------------------------------------------------------

reg(c({
  id: 'encrypt', name: 'Encrypt', type: 'skill', rarity: 'uncommon', cost: 2, target: 'none',
  effects: [{ k: 'block', n: 14 }], upEffects: [{ k: 'block', n: 18 }],
}))
reg(c({
  id: 'reboot', name: 'Reboot', type: 'skill', rarity: 'uncommon', cost: 1, target: 'none',
  effects: [{ k: 'draw', n: 3 }], upEffects: [{ k: 'draw', n: 4 }],
}))
reg(c({
  id: 'overvolt', name: 'Overvolt', type: 'skill', rarity: 'uncommon', cost: 0, target: 'none',
  effects: [{ k: 'energy', n: 2 }, { k: 'selfDmg', n: 4 }],
  upEffects: [{ k: 'energy', n: 2 }, { k: 'selfDmg', n: 2 }],
  exhaust: true, upExhaust: true,
}))
reg(c({
  id: 'restore', name: 'System Restore', type: 'skill', rarity: 'uncommon', cost: 1, target: 'none',
  effects: [{ k: 'cleanse' }, { k: 'block', n: 6 }],
  upEffects: [{ k: 'cleanse' }, { k: 'block', n: 9 }],
}))
reg(c({
  id: 'trojan', name: 'Trojan Payload', type: 'skill', rarity: 'uncommon', cost: 1, target: 'enemy',
  effects: [
    { k: 'status', to: 'target', id: 'weak', n: 2 },
    { k: 'status', to: 'target', id: 'vuln', n: 2 },
  ],
  upEffects: [
    { k: 'status', to: 'target', id: 'weak', n: 3 },
    { k: 'status', to: 'target', id: 'vuln', n: 3 },
  ],
  exhaust: true, upExhaust: true,
}))
reg(c({
  id: 'stimchip', name: 'Stim Chip', type: 'skill', rarity: 'uncommon', cost: 0, target: 'none',
  effects: [{ k: 'energy', n: 1 }, { k: 'draw', n: 1 }],
  upEffects: [{ k: 'energy', n: 1 }, { k: 'draw', n: 2 }],
  exhaust: true, upExhaust: true,
}))
reg(c({
  id: 'malware', name: 'Malware Drip', type: 'skill', rarity: 'uncommon', cost: 1, target: 'enemy',
  effects: [{ k: 'status', to: 'target', id: 'corrupt', n: 4 }],
  upEffects: [{ k: 'status', to: 'target', id: 'corrupt', n: 6 }],
  flavor: 'ransomware, but personal',
}))

// --- Rare skills ------------------------------------------------------------

reg(c({
  id: 'zerotrust', name: 'Zero Trust', type: 'skill', rarity: 'rare', cost: 2, target: 'none',
  effects: [{ k: 'block', n: 12 }, { k: 'status', to: 'self', id: 'thorns', n: 2 }],
  upEffects: [{ k: 'block', n: 15 }, { k: 'status', to: 'self', id: 'thorns', n: 3 }],
}))
reg(c({
  id: 'rootaccess', name: 'Root Access', type: 'skill', rarity: 'rare', cost: 0, target: 'none',
  effects: [{ k: 'energy', n: 2 }, { k: 'draw', n: 2 }],
  upEffects: [{ k: 'energy', n: 3 }, { k: 'draw', n: 3 }],
  exhaust: true, upExhaust: true,
  flavor: '# whoami → god',
}))

// --- Powers -----------------------------------------------------------------

reg(c({
  id: 'neoncore', name: 'Neon Core', type: 'power', rarity: 'uncommon', cost: 1, target: 'none',
  effects: [{ k: 'status', to: 'self', id: 'str', n: 2 }],
  upEffects: [{ k: 'status', to: 'self', id: 'str', n: 3 }],
}))
reg(c({
  id: 'autoturret', name: 'Auto-Turret', type: 'power', rarity: 'uncommon', cost: 2, target: 'none',
  effects: [{ k: 'status', to: 'self', id: 'turret', n: 6 }],
  upEffects: [{ k: 'status', to: 'self', id: 'turret', n: 9 }],
}))
reg(c({
  id: 'nanoplating', name: 'Nano Plating', type: 'power', rarity: 'uncommon', cost: 1, target: 'none',
  effects: [{ k: 'status', to: 'self', id: 'plating', n: 3 }],
  upEffects: [{ k: 'status', to: 'self', id: 'plating', n: 5 }],
}))
reg(c({
  id: 'cpucore', name: 'Overclocked CPU', type: 'power', rarity: 'rare', cost: 3, upCost: 2, target: 'none',
  effects: [{ k: 'status', to: 'self', id: 'energyGain', n: 1 }],
  upEffects: [{ k: 'status', to: 'self', id: 'energyGain', n: 1 }],
}))
reg(c({
  id: 'datasiphon', name: 'Data Siphon', type: 'power', rarity: 'uncommon', cost: 1, upCost: 0, target: 'none',
  effects: [{ k: 'status', to: 'self', id: 'drawGain', n: 1 }],
  upEffects: [{ k: 'status', to: 'self', id: 'drawGain', n: 1 }],
}))
reg(c({
  id: 'thornsexe', name: 'Thorns.exe', type: 'power', rarity: 'uncommon', cost: 1, target: 'none',
  effects: [{ k: 'status', to: 'self', id: 'thorns', n: 3 }],
  upEffects: [{ k: 'status', to: 'self', id: 'thorns', n: 5 }],
}))
reg(c({
  id: 'viralload', name: 'Viral Load', type: 'power', rarity: 'rare', cost: 2, target: 'none',
  effects: [{ k: 'status', to: 'self', id: 'viral', n: 2 }],
  upEffects: [{ k: 'status', to: 'self', id: 'viral', n: 3 }],
}))
reg(c({
  id: 'compilerloop', name: 'Compiler Loop', type: 'power', rarity: 'rare', cost: 2, target: 'none',
  effects: [{ k: 'status', to: 'self', id: 'ritual', n: 1 }],
  upEffects: [{ k: 'status', to: 'self', id: 'ritual', n: 2 }],
  flavor: 'while(true) grow()',
}))

// --- Status/junk cards ------------------------------------------------------

reg(c({
  id: 'glitch', name: 'Glitch', type: 'skill', rarity: 'special', cost: 0, target: 'none',
  effects: [], upEffects: [], unplayable: true,
  flavor: '�����',
}))

// ---------------------------------------------------------------------------

let uidCounter = 1
/** Mint a card instance with a caller-managed uid counter, or a global one. */
export function inst(id: string, up = false, uid?: number): CardInst {
  return { uid: uid ?? uidCounter++, id, up }
}

export function cardCost(card: CardInst): number {
  const def = CARDS[card.id]
  return card.up && def.upCost !== undefined ? def.upCost : def.cost
}

export function cardEffects(card: CardInst): Effect[] {
  const def = CARDS[card.id]
  return card.up ? def.upEffects : def.effects
}

export function cardExhausts(card: CardInst): boolean {
  const def = CARDS[card.id]
  return !!(card.up ? (def.upExhaust ?? def.exhaust) : def.exhaust)
}

export function cardName(card: CardInst): string {
  return CARDS[card.id].name + (card.up ? '+' : '')
}

function effText(e: Effect): string {
  switch (e.k) {
    case 'dmg':
      return e.times && e.times > 1 ? `Deal ${e.n} damage ${e.times} times.` : `Deal ${e.n} damage.`
    case 'dmgAll':
      return e.times && e.times > 1
        ? `Deal ${e.n} damage to ALL enemies ${e.times} times.`
        : `Deal ${e.n} damage to ALL enemies.`
    case 'dmgVulnBonus':
      return `Deal ${e.n} damage. Deals ${e.bonus} more to Vulnerable enemies.`
    case 'dmgPerPower':
      return `Deal ${e.base} damage, plus ${e.per} for each Power you've played this combat.`
    case 'blockAsDmg':
      return 'Deal damage equal to your Block.'
    case 'block':
      return `Gain ${e.n} Block.`
    case 'draw':
      return `Draw ${e.n} card${e.n > 1 ? 's' : ''}.`
    case 'energy':
      return `Gain ${e.n} Energy.`
    case 'heal':
      return `Restore ${e.n} HP.`
    case 'selfDmg':
      return `Take ${e.n} damage.`
    case 'cleanse':
      return 'Remove your debuffs.'
    case 'addCard':
      return `Shuffle ${e.n > 1 ? e.n + ' ' + CARDS[e.id].name + 's' : 'a ' + CARDS[e.id].name} into your ${e.where} pile.`
    case 'status': {
      const info = STATUS_INFO[e.id]
      if (e.to === 'self') {
        if (info.powerText) return info.powerText.replaceAll('{n}', String(e.n))
        return `Gain ${e.n} ${info.name}.`
      }
      const what = `${e.n} ${info.name}`
      return e.to === 'all' ? `Apply ${what} to ALL enemies.` : `Apply ${what}.`
    }
  }
}

/** Generate rules text for a card (matches interpreter behaviour exactly). */
export function describeCard(card: CardInst): string {
  const def = CARDS[card.id]
  const parts: string[] = []
  if (def.unplayable) parts.push('Unplayable.')
  if (card.id === 'glitch') parts.push('If this is in your hand at the end of your turn, lose 1 HP.')
  for (const e of cardEffects(card)) parts.push(effText(e))
  if (cardExhausts(card)) parts.push('Exhaust.')
  return parts.join(' ')
}

export function cardsByRarity(rarity: Rarity, type?: CardType): CardDef[] {
  return Object.values(CARDS).filter((c) => c.rarity === rarity && (!type || c.type === type))
}

/** All cards that can appear as rewards/shop stock. */
export function obtainableCards(): CardDef[] {
  return Object.values(CARDS).filter((c) => c.rarity !== 'special' && c.rarity !== 'starter')
}
