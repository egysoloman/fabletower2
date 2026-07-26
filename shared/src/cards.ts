import type { CardDef, CardInst, CardType, Effect, Rarity } from './types'
import { ES, isZh, statusName, statusPowerText } from './i18n'
import { CARD_ZH } from './locale-zh'

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

reg(c({
  id: 'leechquery', name: 'Leech Query', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
  effects: [{ k: 'dmg', n: 6 }, { k: 'heal', n: 3 }],
  upEffects: [{ k: 'dmg', n: 9 }, { k: 'heal', n: 5 }],
  flavor: 'SELECT hp FROM target',
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
  id: 'checkpoint', name: 'Checkpoint', type: 'skill', rarity: 'uncommon', cost: 1, target: 'none',
  effects: [{ k: 'heal', n: 8 }], upEffects: [{ k: 'heal', n: 11 }],
  exhaust: true, upExhaust: true,
  flavor: 'progress saved',
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
  id: 'backuprestore', name: 'Backup Restore', type: 'skill', rarity: 'rare', cost: 2, target: 'none',
  effects: [{ k: 'heal', n: 14 }], upEffects: [{ k: 'heal', n: 20 }],
  exhaust: true, upExhaust: true,
  flavor: 'last known good configuration',
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
  id: 'autorepair', name: 'Auto-Repair', type: 'power', rarity: 'uncommon', cost: 1, target: 'none',
  effects: [{ k: 'status', to: 'self', id: 'regen', n: 2 }],
  upEffects: [{ k: 'status', to: 'self', id: 'regen', n: 3 }],
  flavor: 'self-healing infrastructure',
}))
reg(c({
  id: 'compilerloop', name: 'Compiler Loop', type: 'power', rarity: 'rare', cost: 2, target: 'none',
  effects: [{ k: 'status', to: 'self', id: 'ritual', n: 1 }],
  upEffects: [{ k: 'status', to: 'self', id: 'ritual', n: 2 }],
  flavor: 'while(true) grow()',
}))

// --- Corrupt archetype ------------------------------------------------------

reg(c({
  id: 'broadcast', name: 'Broadcast Malware', type: 'skill', rarity: 'common', cost: 1, target: 'none',
  effects: [{ k: 'status', to: 'all', id: 'corrupt', n: 3 }],
  upEffects: [{ k: 'status', to: 'all', id: 'corrupt', n: 4 }],
}))
reg(c({
  id: 'payload', name: 'Payload Burst', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
  effects: [{ k: 'dmgPerCorrupt', mult: 2 }], upEffects: [{ k: 'dmgPerCorrupt', mult: 3 }],
  flavor: 'detonate the infection',
}))
reg(c({
  id: 'forkvirus', name: 'Fork Virus', type: 'skill', rarity: 'uncommon', cost: 1, upCost: 0, target: 'enemy',
  effects: [{ k: 'doubleCorrupt' }], upEffects: [{ k: 'doubleCorrupt' }],
  flavor: 'replicates on contact',
}))
reg(c({
  id: 'chronicinj', name: 'Chronic Injector', type: 'power', rarity: 'rare', cost: 2, upCost: 1, target: 'none',
  effects: [{ k: 'status', to: 'self', id: 'chronic', n: 1 }],
  upEffects: [{ k: 'status', to: 'self', id: 'chronic', n: 1 }],
  flavor: 'no patch is coming',
}))

// --- Fortress archetype -----------------------------------------------------

reg(c({
  id: 'hullpatch', name: 'Hull Patch', type: 'skill', rarity: 'common', cost: 1, target: 'none',
  effects: [{ k: 'block', n: 6 }, { k: 'draw', n: 1 }],
  upEffects: [{ k: 'block', n: 9 }, { k: 'draw', n: 1 }],
}))
reg(c({
  id: 'doublebuffer', name: 'Double Buffer', type: 'skill', rarity: 'uncommon', cost: 2, upCost: 1, target: 'none',
  effects: [{ k: 'doubleBlock' }], upEffects: [{ k: 'doubleBlock' }],
}))
reg(c({
  id: 'firmware', name: 'Firmware Lock', type: 'power', rarity: 'rare', cost: 2, upCost: 1, target: 'none',
  effects: [{ k: 'status', to: 'self', id: 'barricade', n: 1 }],
  upEffects: [{ k: 'status', to: 'self', id: 'barricade', n: 1 }],
  flavor: 'write-protected',
}))
reg(c({
  id: 'kernelpanic', name: 'Kernel Panic', type: 'power', rarity: 'rare', cost: 2, target: 'none',
  effects: [{ k: 'status', to: 'self', id: 'kernel', n: 3 }],
  upEffects: [{ k: 'status', to: 'self', id: 'kernel', n: 5 }],
  flavor: 'the wall fights back',
}))

// --- Tempo (0-cost) archetype -----------------------------------------------

reg(c({
  id: 'pipeline', name: 'Pipeline', type: 'skill', rarity: 'common', cost: 0, target: 'none',
  effects: [{ k: 'block', n: 3 }, { k: 'draw', n: 1 }],
  upEffects: [{ k: 'block', n: 5 }, { k: 'draw', n: 1 }],
}))
reg(c({
  id: 'nopslide', name: 'NOP Slide', type: 'attack', rarity: 'common', cost: 0, target: 'enemy',
  effects: [{ k: 'dmg', n: 2, times: 2 }], upEffects: [{ k: 'dmg', n: 3, times: 2 }],
  flavor: '0x90 0x90 0x90',
}))
reg(c({
  id: 'quickpatch', name: 'Quick Patch', type: 'skill', rarity: 'uncommon', cost: 0, target: 'none',
  effects: [{ k: 'heal', n: 3 }], upEffects: [{ k: 'heal', n: 5 }],
  exhaust: true, upExhaust: true,
}))
reg(c({
  id: 'burstcompile', name: 'Burst Compile', type: 'attack', rarity: 'uncommon', cost: 0, target: 'enemy',
  effects: [{ k: 'dmgIfCombo', n: 4, bonus: 6, threshold: 3 }],
  upEffects: [{ k: 'dmgIfCombo', n: 6, bonus: 8, threshold: 3 }],
}))
reg(c({
  id: 'hyperthread', name: 'Hyperthread', type: 'power', rarity: 'rare', cost: 1, target: 'none',
  effects: [{ k: 'status', to: 'self', id: 'hyper', n: 1 }],
  upEffects: [{ k: 'status', to: 'self', id: 'hyper', n: 2 }],
  flavor: 'more lanes, same silicon',
}))

// --- Extra spice ------------------------------------------------------------

reg(c({
  id: 'overwrite', name: 'Overwrite', type: 'attack', rarity: 'rare', cost: 2, target: 'enemy',
  effects: [{ k: 'dmg', n: 12 }, { k: 'draw', n: 1 }],
  upEffects: [{ k: 'dmg', n: 16 }, { k: 'draw', n: 1 }],
}))
reg(c({
  id: 'daemonize', name: 'Daemonize', type: 'power', rarity: 'uncommon', cost: 2, target: 'none',
  effects: [
    { k: 'status', to: 'self', id: 'turret', n: 4 },
    { k: 'status', to: 'self', id: 'plating', n: 2 },
  ],
  upEffects: [
    { k: 'status', to: 'self', id: 'turret', n: 6 },
    { k: 'status', to: 'self', id: 'plating', n: 3 },
  ],
  flavor: 'runs in the background',
}))
reg(c({
  id: 'glitchstorm', name: 'Glitch Storm', type: 'attack', rarity: 'rare', cost: 1, target: 'none',
  effects: [{ k: 'dmgAll', n: 4 }, { k: 'addCard', id: 'glitch', where: 'discard', n: 1 }],
  upEffects: [{ k: 'dmgAll', n: 7 }, { k: 'addCard', id: 'glitch', where: 'discard', n: 1 }],
  flavor: 'collateral corruption',
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

/** Localized display name of a card id (without the upgrade '+'). */
export function cardBaseName(id: string): string {
  return isZh() ? (CARD_ZH[id]?.name ?? CARDS[id].name) : CARDS[id].name
}

export function cardName(card: CardInst): string {
  return cardBaseName(card.id) + (card.up ? '+' : '')
}

/** Localized flavor line (code-joke flavor intentionally stays as-is). */
export function cardFlavor(card: CardInst): string | undefined {
  const def = CARDS[card.id]
  return isZh() ? (CARD_ZH[card.id]?.flavor ?? def.flavor) : def.flavor
}

function effTextEn(e: Effect): string {
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
    case 'dmgPerCorrupt':
      return `Deal damage equal to ${e.mult}× the target's Corrupt.`
    case 'dmgIfCombo':
      return `Deal ${e.n} damage. If you've played ${e.threshold}+ other cards this turn, deal ${e.n + e.bonus} instead.`
    case 'blockAsDmg':
      return 'Deal damage equal to your Block.'
    case 'block':
      return `Gain ${e.n} Block.`
    case 'doubleBlock':
      return 'Double your Block.'
    case 'doubleCorrupt':
      return "Double the target's Corrupt."
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
      if (e.to === 'self') {
        const power = statusPowerText(e.id)
        if (power) return power.replaceAll('{n}', String(e.n))
        return `Gain ${e.n} ${statusName(e.id)}.`
      }
      const what = `${e.n} ${statusName(e.id)}`
      return e.to === 'all' ? `Apply ${what} to ALL enemies.` : `Apply ${what}.`
    }
  }
}

function effTextZh(e: Effect): string {
  switch (e.k) {
    case 'dmg':
      return e.times && e.times > 1 ? `造成 ${e.n} 点伤害，共 ${e.times} 次。` : `造成 ${e.n} 点伤害。`
    case 'dmgAll':
      return e.times && e.times > 1
        ? `对所有敌人造成 ${e.n} 点伤害，共 ${e.times} 次。`
        : `对所有敌人造成 ${e.n} 点伤害。`
    case 'dmgVulnBonus':
      return `造成 ${e.n} 点伤害。对易伤敌人额外造成 ${e.bonus} 点。`
    case 'dmgPerPower':
      return `造成 ${e.base} 点伤害，本场战斗中每打出过一张能力牌，额外 +${e.per}。`
    case 'dmgPerCorrupt':
      return `造成等同于目标侵蚀 ${e.mult} 倍的伤害。`
    case 'dmgIfCombo':
      return `造成 ${e.n} 点伤害。若本回合已打出 ${e.threshold}+ 张其他牌，则改为造成 ${e.n + e.bonus} 点。`
    case 'blockAsDmg':
      return '造成等同于你格挡值的伤害。'
    case 'block':
      return `获得 ${e.n} 点格挡。`
    case 'doubleBlock':
      return '使你的格挡翻倍。'
    case 'doubleCorrupt':
      return '使目标的侵蚀翻倍。'
    case 'draw':
      return `抽 ${e.n} 张牌。`
    case 'energy':
      return `获得 ${e.n} 点能量。`
    case 'heal':
      return `回复 ${e.n} 点生命。`
    case 'selfDmg':
      return `受到 ${e.n} 点伤害。`
    case 'cleanse':
      return '移除你的所有负面状态。'
    case 'addCard': {
      const pile = e.where === 'discard' ? '弃牌堆' : '抽牌堆'
      const count = e.n > 1 ? `${e.n} 张` : '一张'
      return `将${count}「${cardBaseName(e.id)}」洗入你的${pile}。`
    }
    case 'status': {
      if (e.to === 'self') {
        const power = statusPowerText(e.id)
        if (power) return power.replaceAll('{n}', String(e.n))
        return `获得 ${e.n} 点${statusName(e.id)}。`
      }
      const what = `${e.n} 层${statusName(e.id)}`
      return e.to === 'all' ? `对所有敌人施加${what}。` : `施加${what}。`
    }
  }
}

function effText(e: Effect): string {
  return isZh() ? effTextZh(e) : effTextEn(e)
}

/** Localized rules text for a bare effect list (potions, previews). */
export function describeEffects(effects: Effect[]): string {
  return effects.map(effText).join(' ')
}

/** Generate rules text for a card (matches interpreter behaviour exactly). */
export function describeCard(card: CardInst): string {
  const def = CARDS[card.id]
  const parts: string[] = []
  if (def.unplayable) parts.push(ES.unplayable())
  if (card.id === 'glitch') parts.push(ES.glitchPain())
  for (const e of cardEffects(card)) parts.push(effText(e))
  if (cardExhausts(card)) parts.push(ES.exhaust())
  return parts.join(' ')
}

export function cardsByRarity(rarity: Rarity, type?: CardType): CardDef[] {
  return Object.values(CARDS).filter((c) => c.rarity === rarity && (!type || c.type === type))
}

/** All cards that can appear as rewards/shop stock. */
export function obtainableCards(): CardDef[] {
  return Object.values(CARDS).filter((c) => c.rarity !== 'special' && c.rarity !== 'starter')
}
