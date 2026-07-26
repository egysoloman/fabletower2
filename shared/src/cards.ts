import type { CardDef, CardInst, CharId, Effect, Rarity } from './types'
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
  id: 'payload', name: 'Payload Burst', type: 'attack', rarity: 'uncommon', char: 'runner', cost: 1, target: 'enemy',
  effects: [{ k: 'dmgPerCorrupt', mult: 2 }], upEffects: [{ k: 'dmgPerCorrupt', mult: 3 }],
  flavor: 'detonate the infection',
}))
reg(c({
  id: 'forkvirus', name: 'Fork Virus', type: 'skill', rarity: 'uncommon', char: 'runner', cost: 1, upCost: 0, target: 'enemy',
  effects: [{ k: 'doubleCorrupt' }], upEffects: [{ k: 'doubleCorrupt' }],
  flavor: 'replicates on contact',
}))
reg(c({
  id: 'chronicinj', name: 'Chronic Injector', type: 'power', rarity: 'rare', char: 'runner', cost: 2, upCost: 1, target: 'none',
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
  id: 'doublebuffer', name: 'Double Buffer', type: 'skill', rarity: 'uncommon', char: 'runner', cost: 2, upCost: 1, target: 'none',
  effects: [{ k: 'doubleBlock' }], upEffects: [{ k: 'doubleBlock' }],
}))
reg(c({
  id: 'firmware', name: 'Firmware Lock', type: 'power', rarity: 'rare', char: 'runner', cost: 2, upCost: 1, target: 'none',
  effects: [{ k: 'status', to: 'self', id: 'barricade', n: 1 }],
  upEffects: [{ k: 'status', to: 'self', id: 'barricade', n: 1 }],
  flavor: 'write-protected',
}))
reg(c({
  id: 'kernelpanic', name: 'Kernel Panic', type: 'power', rarity: 'rare', char: 'runner', cost: 2, target: 'none',
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
  id: 'burstcompile', name: 'Burst Compile', type: 'attack', rarity: 'uncommon', char: 'runner', cost: 0, target: 'enemy',
  effects: [{ k: 'dmgIfCombo', n: 4, bonus: 6, threshold: 3 }],
  upEffects: [{ k: 'dmgIfCombo', n: 6, bonus: 8, threshold: 3 }],
}))
reg(c({
  id: 'hyperthread', name: 'Hyperthread', type: 'power', rarity: 'rare', char: 'runner', cost: 1, target: 'none',
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

// --- VECTOR: the Heat character ---------------------------------------------

reg(c({
  id: 'spark', name: 'Spark.sh', type: 'attack', rarity: 'starter', char: 'vector', cost: 1, target: 'enemy',
  effects: [{ k: 'dmg', n: 5 }, { k: 'status', to: 'self', id: 'heat', n: 1 }],
  upEffects: [{ k: 'dmg', n: 8 }, { k: 'status', to: 'self', id: 'heat', n: 1 }],
  flavor: 'ignition sequence',
}))
reg(c({
  id: 'heatshield', name: 'Heat Shield', type: 'skill', rarity: 'starter', char: 'vector', cost: 1, target: 'none',
  effects: [{ k: 'block', n: 5 }], upEffects: [{ k: 'block', n: 8 }],
}))
reg(c({
  id: 'emberjab', name: 'Ember Jab', type: 'attack', rarity: 'common', char: 'vector', cost: 0, target: 'enemy',
  effects: [{ k: 'dmg', n: 3 }, { k: 'status', to: 'self', id: 'heat', n: 1 }],
  upEffects: [{ k: 'dmg', n: 5 }, { k: 'status', to: 'self', id: 'heat', n: 1 }],
}))
reg(c({
  id: 'stoke', name: 'Stoke', type: 'skill', rarity: 'common', char: 'vector', cost: 0, target: 'none',
  effects: [{ k: 'status', to: 'self', id: 'heat', n: 3 }, { k: 'draw', n: 1 }],
  upEffects: [{ k: 'status', to: 'self', id: 'heat', n: 4 }, { k: 'draw', n: 1 }],
  flavor: 'feed the furnace',
}))
reg(c({
  id: 'ventblade', name: 'Vent', type: 'attack', rarity: 'common', char: 'vector', cost: 1, target: 'enemy',
  effects: [{ k: 'ventDmg', mult: 2 }], upEffects: [{ k: 'ventDmg', mult: 3 }],
  flavor: 'pressure release',
}))
reg(c({
  id: 'heatsinkfins', name: 'Sink Fins', type: 'skill', rarity: 'common', char: 'vector', cost: 1, target: 'none',
  effects: [{ k: 'ventBlock', mult: 2 }], upEffects: [{ k: 'ventBlock', mult: 3 }],
}))
reg(c({
  id: 'flarewhip', name: 'Flare Whip', type: 'attack', rarity: 'common', char: 'vector', cost: 1, target: 'enemy',
  effects: [{ k: 'dmg', n: 7 }, { k: 'status', to: 'self', id: 'heat', n: 2 }],
  upEffects: [{ k: 'dmg', n: 10 }, { k: 'status', to: 'self', id: 'heat', n: 2 }],
}))
reg(c({
  id: 'insulate', name: 'Insulate', type: 'skill', rarity: 'common', char: 'vector', cost: 1, target: 'none',
  effects: [{ k: 'block', n: 6 }, { k: 'heatCool', n: 2 }],
  upEffects: [{ k: 'block', n: 9 }, { k: 'heatCool', n: 3 }],
}))
reg(c({
  id: 'cinderspray', name: 'Cinder Spray', type: 'attack', rarity: 'common', char: 'vector', cost: 1, target: 'none',
  effects: [{ k: 'dmgAll', n: 4 }, { k: 'status', to: 'self', id: 'heat', n: 1 }],
  upEffects: [{ k: 'dmgAll', n: 6 }, { k: 'status', to: 'self', id: 'heat', n: 1 }],
}))
reg(c({
  id: 'backdraft', name: 'Backdraft', type: 'attack', rarity: 'uncommon', char: 'vector', cost: 2, upCost: 1, target: 'none',
  effects: [{ k: 'ventDmgAll', mult: 2 }], upEffects: [{ k: 'ventDmgAll', mult: 2 }],
}))
reg(c({
  id: 'plasmalance', name: 'Plasma Lance', type: 'attack', rarity: 'uncommon', char: 'vector', cost: 2, target: 'enemy',
  effects: [{ k: 'dmgHeatBonus', n: 10, bonus: 8, threshold: 5 }],
  upEffects: [{ k: 'dmgHeatBonus', n: 14, bonus: 10, threshold: 5 }],
}))
reg(c({
  id: 'turbopump', name: 'Turbo Pump', type: 'skill', rarity: 'uncommon', char: 'vector', cost: 0, target: 'none',
  effects: [{ k: 'energy', n: 1 }, { k: 'status', to: 'self', id: 'heat', n: 2 }],
  upEffects: [{ k: 'energy', n: 2 }, { k: 'status', to: 'self', id: 'heat', n: 3 }],
  exhaust: true, upExhaust: true,
}))
reg(c({
  id: 'afterburner', name: 'Afterburner', type: 'power', rarity: 'uncommon', char: 'vector', cost: 1, target: 'none',
  effects: [{ k: 'status', to: 'self', id: 'ignition', n: 2 }],
  upEffects: [{ k: 'status', to: 'self', id: 'ignition', n: 3 }],
}))
reg(c({
  id: 'radiator', name: 'Radiator', type: 'power', rarity: 'uncommon', char: 'vector', cost: 1, target: 'none',
  effects: [{ k: 'status', to: 'self', id: 'coolant', n: 3 }],
  upEffects: [{ k: 'status', to: 'self', id: 'coolant', n: 5 }],
}))
reg(c({
  id: 'quench', name: 'Quench', type: 'skill', rarity: 'uncommon', char: 'vector', cost: 0, target: 'none',
  effects: [{ k: 'heatCool', n: 99 }, { k: 'draw', n: 2 }],
  upEffects: [{ k: 'heatCool', n: 99 }, { k: 'draw', n: 3 }],
  exhaust: true, upExhaust: true,
}))
reg(c({
  id: 'scorch', name: 'Scorch', type: 'attack', rarity: 'uncommon', char: 'vector', cost: 1, target: 'enemy',
  effects: [{ k: 'dmg', n: 9 }, { k: 'status', to: 'self', id: 'heat', n: 1 }],
  upEffects: [{ k: 'dmg', n: 12 }, { k: 'status', to: 'self', id: 'heat', n: 1 }],
}))
reg(c({
  id: 'meltdown', name: 'Meltdown', type: 'attack', rarity: 'rare', char: 'vector', cost: 3, target: 'none',
  effects: [{ k: 'ventDmgAll', mult: 3 }], upEffects: [{ k: 'ventDmgAll', mult: 4 }],
  flavor: 'containment is a suggestion',
}))
reg(c({
  id: 'reactorcore', name: 'Reactor Core', type: 'power', rarity: 'rare', char: 'vector', cost: 2, upCost: 1, target: 'none',
  effects: [{ k: 'status', to: 'self', id: 'reactor', n: 1 }],
  upEffects: [{ k: 'status', to: 'self', id: 'reactor', n: 1 }],
  flavor: 'meltdown, weaponized',
}))
reg(c({
  id: 'redline', name: 'Redline', type: 'power', rarity: 'rare', char: 'vector', cost: 2, target: 'none',
  effects: [
    { k: 'status', to: 'self', id: 'ignition', n: 2 },
    { k: 'status', to: 'self', id: 'energyGain', n: 1 },
  ],
  upEffects: [
    { k: 'status', to: 'self', id: 'ignition', n: 3 },
    { k: 'status', to: 'self', id: 'energyGain', n: 1 },
  ],
  flavor: 'the tachometer is a liar',
}))
reg(c({
  id: 'whiteout', name: 'Whiteout', type: 'attack', rarity: 'rare', char: 'vector', cost: 2, target: 'enemy',
  effects: [{ k: 'dmg', n: 18 }, { k: 'status', to: 'self', id: 'heat', n: 4 }],
  upEffects: [{ k: 'dmg', n: 24 }, { k: 'status', to: 'self', id: 'heat', n: 4 }],
}))

// --- GHOST: the stance phaser -----------------------------------------------

reg(c({
  id: 'phaseblade', name: 'Phase Blade', type: 'attack', rarity: 'starter', char: 'ghost', cost: 1, target: 'enemy',
  effects: [{ k: 'dmg', n: 6 }], upEffects: [{ k: 'dmg', n: 9 }],
  flavor: 'half here, all edge',
}))
reg(c({
  id: 'cloakfield', name: 'Cloak Field', type: 'skill', rarity: 'starter', char: 'ghost', cost: 1, target: 'none',
  effects: [{ k: 'block', n: 5 }], upEffects: [{ k: 'block', n: 8 }],
}))
reg(c({
  id: 'redshift', name: 'Redshift', type: 'skill', rarity: 'starter', char: 'ghost', cost: 0, target: 'none',
  effects: [{ k: 'enterStance', id: 'overdrive' }],
  upEffects: [{ k: 'enterStance', id: 'overdrive' }, { k: 'draw', n: 1 }],
  flavor: 'everything gets faster and worse',
}))
reg(c({
  id: 'blackout', name: 'Blackout', type: 'skill', rarity: 'starter', char: 'ghost', cost: 0, target: 'none',
  effects: [{ k: 'enterStance', id: 'stealth' }],
  upEffects: [{ k: 'enterStance', id: 'stealth' }, { k: 'block', n: 3 }],
  flavor: 'the room forgets you',
}))
reg(c({
  id: 'flicker', name: 'Flicker', type: 'attack', rarity: 'common', char: 'ghost', cost: 1, target: 'enemy',
  effects: [{ k: 'dmgIfStance', n: 8, bonus: 4 }],
  upEffects: [{ k: 'dmgIfStance', n: 11, bonus: 5 }],
}))
reg(c({
  id: 'slipstream', name: 'Slipstream', type: 'skill', rarity: 'common', char: 'ghost', cost: 1, target: 'none',
  effects: [{ k: 'block', n: 5 }, { k: 'draw', n: 1 }],
  upEffects: [{ k: 'block', n: 8 }, { k: 'draw', n: 1 }],
}))
reg(c({
  id: 'afterimage', name: 'Afterimage', type: 'skill', rarity: 'common', char: 'ghost', cost: 1, target: 'none',
  effects: [{ k: 'enterStance', id: 'stealth' }, { k: 'block', n: 5 }],
  upEffects: [{ k: 'enterStance', id: 'stealth' }, { k: 'block', n: 8 }],
  flavor: 'you were never there',
}))
reg(c({
  id: 'surgefang', name: 'Surge Fang', type: 'attack', rarity: 'common', char: 'ghost', cost: 1, target: 'enemy',
  effects: [{ k: 'dmg', n: 7 }, { k: 'enterStance', id: 'overdrive' }],
  upEffects: [{ k: 'dmg', n: 10 }, { k: 'enterStance', id: 'overdrive' }],
}))
reg(c({
  id: 'veilstrike', name: 'Veil Strike', type: 'attack', rarity: 'common', char: 'ghost', cost: 1, target: 'enemy',
  effects: [{ k: 'dmg', n: 6 }, { k: 'enterStance', id: 'none' }],
  upEffects: [{ k: 'dmg', n: 9 }, { k: 'enterStance', id: 'none' }],
  flavor: 'strike on the way out',
}))
reg(c({
  id: 'nullstep', name: 'Null Step', type: 'skill', rarity: 'common', char: 'ghost', cost: 0, target: 'none',
  effects: [{ k: 'enterStance', id: 'none' }, { k: 'draw', n: 1 }],
  upEffects: [{ k: 'enterStance', id: 'none' }, { k: 'draw', n: 2 }],
}))
reg(c({
  id: 'eclipse', name: 'Eclipse', type: 'attack', rarity: 'uncommon', char: 'ghost', cost: 2, target: 'enemy',
  effects: [{ k: 'dmg', n: 8, times: 2 }, { k: 'enterStance', id: 'overdrive' }],
  upEffects: [{ k: 'dmg', n: 10, times: 2 }, { k: 'enterStance', id: 'overdrive' }],
}))
reg(c({
  id: 'shroudloop', name: 'Shroud Loop', type: 'power', rarity: 'uncommon', char: 'ghost', cost: 1, target: 'none',
  effects: [{ k: 'status', to: 'self', id: 'stancewall', n: 3 }],
  upEffects: [{ k: 'status', to: 'self', id: 'stancewall', n: 5 }],
}))
reg(c({
  id: 'momentumdrive', name: 'Momentum Drive', type: 'power', rarity: 'uncommon', char: 'ghost', cost: 1, target: 'none',
  effects: [{ k: 'status', to: 'self', id: 'momentum', n: 1 }],
  upEffects: [{ k: 'status', to: 'self', id: 'momentum', n: 2 }],
  flavor: 'objects in motion stay furious',
}))
reg(c({
  id: 'wraithform', name: 'Wraith Form', type: 'skill', rarity: 'uncommon', char: 'ghost', cost: 2, upCost: 1, target: 'none',
  effects: [{ k: 'enterStance', id: 'stealth' }, { k: 'block', n: 12 }],
  upEffects: [{ k: 'enterStance', id: 'stealth' }, { k: 'block', n: 12 }],
}))
reg(c({
  id: 'deathblossom', name: 'Death Blossom', type: 'attack', rarity: 'rare', char: 'ghost', cost: 3, target: 'enemy',
  effects: [{ k: 'dmgIfStance', n: 14, bonus: 14 }],
  upEffects: [{ k: 'dmgIfStance', n: 18, bonus: 18 }],
  flavor: 'blooms once per witness',
}))
reg(c({
  id: 'dualitycore', name: 'Duality Core', type: 'power', rarity: 'rare', char: 'ghost', cost: 2, target: 'none',
  effects: [{ k: 'status', to: 'self', id: 'tempoloop', n: 1 }, { k: 'status', to: 'self', id: 'stancewall', n: 2 }],
  upEffects: [{ k: 'status', to: 'self', id: 'tempoloop', n: 1 }, { k: 'status', to: 'self', id: 'stancewall', n: 4 }],
  flavor: 'be both. bill later.',
}))

// --- Keyword cards: Innate / Retain / Ethereal ------------------------------

reg(c({
  id: 'preheat', name: 'Preheat', type: 'skill', rarity: 'common', char: 'vector', cost: 0, target: 'none',
  innate: true,
  effects: [{ k: 'status', to: 'self', id: 'heat', n: 2 }, { k: 'draw', n: 1 }],
  upEffects: [{ k: 'status', to: 'self', id: 'heat', n: 3 }, { k: 'draw', n: 1 }],
  flavor: 'warm the pipes before the pipes warm you',
}))
reg(c({
  id: 'emberveil', name: 'Ember Veil', type: 'skill', rarity: 'common', char: 'vector', cost: 1, target: 'none',
  ethereal: true,
  effects: [{ k: 'block', n: 9 }], upEffects: [{ k: 'block', n: 13 }],
  flavor: 'gone by morning',
}))
reg(c({
  id: 'flashfire', name: 'Flashfire', type: 'attack', rarity: 'uncommon', char: 'vector', cost: 1, target: 'enemy',
  ethereal: true,
  effects: [{ k: 'dmg', n: 13 }, { k: 'status', to: 'self', id: 'heat', n: 2 }],
  upEffects: [{ k: 'dmg', n: 17 }, { k: 'status', to: 'self', id: 'heat', n: 2 }],
}))
reg(c({
  id: 'slowburn', name: 'Slow Burn', type: 'skill', rarity: 'uncommon', char: 'vector', cost: 1, target: 'none',
  retain: true,
  effects: [{ k: 'block', n: 5 }, { k: 'status', to: 'self', id: 'heat', n: 1 }],
  upEffects: [{ k: 'block', n: 8 }, { k: 'status', to: 'self', id: 'heat', n: 1 }],
  flavor: 'patience, weaponized',
}))
reg(c({
  id: 'sunflare', name: 'Sunflare', type: 'attack', rarity: 'rare', char: 'vector', cost: 2, target: 'enemy',
  ethereal: true,
  effects: [{ k: 'dmg', n: 24 }, { k: 'status', to: 'self', id: 'heat', n: 3 }],
  upEffects: [{ k: 'dmg', n: 32 }, { k: 'status', to: 'self', id: 'heat', n: 3 }],
  flavor: 'do not look at beam with remaining eye',
}))
reg(c({
  id: 'bootdisk', name: 'Boot Disk', type: 'skill', rarity: 'common', char: 'runner', cost: 0, target: 'none',
  innate: true,
  effects: [{ k: 'block', n: 4 }], upEffects: [{ k: 'block', n: 7 }],
  flavor: 'first read on boot',
}))
reg(c({
  id: 'residentshell', name: 'Resident Shell', type: 'skill', rarity: 'uncommon', char: 'runner', cost: 1, target: 'none',
  retain: true,
  effects: [{ k: 'block', n: 6 }], upEffects: [{ k: 'block', n: 9 }],
  flavor: 'always running, never seen',
}))
reg(c({
  id: 'ghostprocess', name: 'Ghost Process', type: 'attack', rarity: 'uncommon', char: 'runner', cost: 1, target: 'enemy',
  ethereal: true,
  effects: [{ k: 'dmg', n: 14 }], upEffects: [{ k: 'dmg', n: 19 }],
  flavor: '<defunct> but deadly',
}))

// --- Status/junk cards ------------------------------------------------------

reg(c({
  id: 'glitch', name: 'Glitch', type: 'skill', rarity: 'special', cost: 0, target: 'none',
  effects: [], upEffects: [], unplayable: true,
  flavor: '�����',
}))
reg(c({
  id: 'lag', name: 'Lag', type: 'skill', rarity: 'special', cost: 0, target: 'none',
  effects: [], upEffects: [], unplayable: true,
  flavor: 'ping: 9999ms',
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

/** Innate: always drawn into the opening hand. */
export function cardInnate(card: CardInst): boolean {
  const def = CARDS[card.id]
  return !!(card.up ? (def.upInnate ?? def.innate) : def.innate)
}

/** Retain: not discarded at end of turn. */
export function cardRetains(card: CardInst): boolean {
  const def = CARDS[card.id]
  return !!(card.up ? (def.upRetain ?? def.retain) : def.retain)
}

/** Ethereal: exhausts if still in hand at end of turn. */
export function cardEthereal(card: CardInst): boolean {
  const def = CARDS[card.id]
  return !!(card.up ? (def.upEthereal ?? def.ethereal) : def.ethereal)
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
    case 'heatCool':
      return e.n >= 99 ? 'Cool ALL Heat.' : `Cool ${e.n} Heat.`
    case 'ventDmg':
      return `Vent ALL Heat: deal ${e.mult}× that much damage.`
    case 'ventDmgAll':
      return `Vent ALL Heat: deal ${e.mult}× that much damage to ALL enemies.`
    case 'ventBlock':
      return `Vent ALL Heat: gain ${e.mult}× that much Block.`
    case 'dmgHeatBonus':
      return `Deal ${e.n} damage. Deals ${e.n + e.bonus} instead with ${e.threshold}+ Heat.`
    case 'enterStance':
      return e.id === 'none' ? 'Exit your stance.' : `Enter ${statusName(e.id)}.`
    case 'dmgIfStance':
      return `Deal ${e.n} damage. Deals ${e.n + e.bonus} instead while in a stance.`
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
    case 'heatCool':
      return e.n >= 99 ? '冷却全部高热。' : `冷却 ${e.n} 点高热。`
    case 'ventDmg':
      return `排出全部高热：造成其 ${e.mult} 倍的伤害。`
    case 'ventDmgAll':
      return `排出全部高热：对所有敌人造成其 ${e.mult} 倍的伤害。`
    case 'ventBlock':
      return `排出全部高热：获得其 ${e.mult} 倍的格挡。`
    case 'dmgHeatBonus':
      return `造成 ${e.n} 点伤害。若你有 ${e.threshold}+ 点高热，则改为造成 ${e.n + e.bonus} 点。`
    case 'enterStance':
      return e.id === 'none' ? '退出你的姿态。' : `进入${statusName(e.id)}。`
    case 'dmgIfStance':
      return `造成 ${e.n} 点伤害。若你处于姿态中，则改为造成 ${e.n + e.bonus} 点。`
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
  if (cardInnate(card)) parts.push(ES.innate())
  if (cardRetains(card)) parts.push(ES.retain())
  if (cardEthereal(card)) parts.push(ES.ethereal())
  if (card.id === 'glitch') parts.push(ES.glitchPain())
  for (const e of cardEffects(card)) parts.push(effText(e))
  if (cardExhausts(card)) parts.push(ES.exhaust())
  return parts.join(' ')
}

/** Card is in `char`'s pool (untagged cards are neutral, shared by all). */
function inPool(c: CardDef, char?: CharId): boolean {
  return !char || !c.char || c.char === char
}

export function cardsByRarity(rarity: Rarity, char?: CharId): CardDef[] {
  return Object.values(CARDS).filter((c) => c.rarity === rarity && inPool(c, char))
}

/** All cards that can appear as rewards/shop stock (for a character). */
export function obtainableCards(char?: CharId): CardDef[] {
  return Object.values(CARDS).filter((c) => c.rarity !== 'special' && c.rarity !== 'starter' && inPool(c, char))
}
