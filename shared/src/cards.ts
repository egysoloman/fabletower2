import type { CardDef, CardInst, CharId, Effect, Rarity } from './types'
import { ES, isZh, statusName, statusPowerText } from './i18n'
import { CARD_ZH } from './locale-zh'
import { minionDesc, minionName } from './minions'

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
  id: 'momentumdrive', name: 'Inertia Engine', type: 'power', rarity: 'uncommon', char: 'ghost', cost: 1, target: 'none',
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

// --- ARRAY: the daemon conductor --------------------------------------------

reg(c({
  id: 'pulsebolt', name: 'Pulse Bolt', type: 'attack', rarity: 'starter', char: 'array', cost: 1, target: 'enemy',
  effects: [{ k: 'dmg', n: 6 }], upEffects: [{ k: 'dmg', n: 9 }],
  flavor: 'hello_world.exe',
}))
reg(c({
  id: 'fieldwall', name: 'Field Wall', type: 'skill', rarity: 'starter', char: 'array', cost: 1, target: 'none',
  effects: [{ k: 'block', n: 5 }], upEffects: [{ k: 'block', n: 8 }],
}))
reg(c({
  id: 'deployturret', name: 'Deploy Turret', type: 'skill', rarity: 'starter', char: 'array', cost: 1, target: 'none',
  effects: [{ k: 'status', to: 'self', id: 'turret', n: 2 }],
  upEffects: [{ k: 'status', to: 'self', id: 'turret', n: 3 }],
  flavor: 'it only knows one song',
}))
reg(c({
  id: 'deployplating', name: 'Deploy Plating', type: 'skill', rarity: 'starter', char: 'array', cost: 1, target: 'none',
  effects: [{ k: 'status', to: 'self', id: 'plating', n: 2 }],
  upEffects: [{ k: 'status', to: 'self', id: 'plating', n: 3 }],
}))
reg(c({
  id: 'sparkloop', name: 'Spark Loop', type: 'attack', rarity: 'common', char: 'array', cost: 1, target: 'enemy',
  effects: [{ k: 'dmg', n: 5 }, { k: 'status', to: 'self', id: 'turret', n: 1 }],
  upEffects: [{ k: 'dmg', n: 8 }, { k: 'status', to: 'self', id: 'turret', n: 1 }],
}))
reg(c({
  id: 'bufferfield', name: 'Buffer Field', type: 'skill', rarity: 'common', char: 'array', cost: 1, target: 'none',
  effects: [{ k: 'block', n: 4 }, { k: 'status', to: 'self', id: 'plating', n: 1 }],
  upEffects: [{ k: 'block', n: 6 }, { k: 'status', to: 'self', id: 'plating', n: 2 }],
}))
reg(c({
  id: 'chainzap', name: 'Chain Zap', type: 'attack', rarity: 'common', char: 'array', cost: 1, target: 'none',
  effects: [{ k: 'dmgAll', n: 4 }], upEffects: [{ k: 'dmgAll', n: 6 }],
}))
reg(c({
  id: 'recalibrate', name: 'Recalibrate', type: 'skill', rarity: 'common', char: 'array', cost: 0, target: 'none',
  effects: [{ k: 'block', n: 2 }, { k: 'draw', n: 1 }],
  upEffects: [{ k: 'block', n: 3 }, { k: 'draw', n: 2 }],
}))
reg(c({
  id: 'patchdrone', name: 'Patch Drone', type: 'skill', rarity: 'common', char: 'array', cost: 1, target: 'none',
  effects: [{ k: 'heal', n: 3 }, { k: 'status', to: 'self', id: 'plating', n: 1 }],
  upEffects: [{ k: 'heal', n: 5 }, { k: 'status', to: 'self', id: 'plating', n: 1 }],
}))
reg(c({
  id: 'focuslens', name: 'Focus Lens', type: 'power', rarity: 'uncommon', char: 'array', cost: 1, target: 'none',
  effects: [{ k: 'status', to: 'self', id: 'focus', n: 1 }],
  upEffects: [{ k: 'status', to: 'self', id: 'focus', n: 2 }],
  flavor: 'sharper daemons, same leash',
}))
reg(c({
  id: 'viralnode', name: 'Viral Node', type: 'skill', rarity: 'uncommon', char: 'array', cost: 1, target: 'none',
  effects: [{ k: 'status', to: 'self', id: 'viral', n: 1 }, { k: 'block', n: 3 }],
  upEffects: [{ k: 'status', to: 'self', id: 'viral', n: 2 }, { k: 'block', n: 3 }],
}))
reg(c({
  id: 'overclockarray', name: 'Overclock Array', type: 'skill', rarity: 'uncommon', char: 'array', cost: 2, target: 'none',
  effects: [{ k: 'status', to: 'self', id: 'turret', n: 3 }, { k: 'status', to: 'self', id: 'plating', n: 2 }],
  upEffects: [{ k: 'status', to: 'self', id: 'turret', n: 4 }, { k: 'status', to: 'self', id: 'plating', n: 3 }],
}))
reg(c({
  id: 'daemonstrike', name: 'Daemon Strike', type: 'attack', rarity: 'uncommon', char: 'array', cost: 1, target: 'enemy',
  effects: [{ k: 'dmgPerAuto', base: 4, per: 2 }],
  upEffects: [{ k: 'dmgPerAuto', base: 6, per: 2 }],
}))
reg(c({
  id: 'hivecore', name: 'Hive Core', type: 'power', rarity: 'rare', char: 'array', cost: 2, upCost: 1, target: 'none',
  effects: [{ k: 'status', to: 'self', id: 'focus', n: 2 }],
  upEffects: [{ k: 'status', to: 'self', id: 'focus', n: 2 }],
  flavor: 'the swarm dreams in unison',
}))
reg(c({
  id: 'omegabarrage', name: 'Omega Barrage', type: 'attack', rarity: 'rare', char: 'array', cost: 3, target: 'enemy',
  effects: [{ k: 'dmgPerAuto', base: 10, per: 3 }],
  upEffects: [{ k: 'dmgPerAuto', base: 14, per: 3 }],
  flavor: 'every daemon fires at once',
}))
reg(c({
  id: 'selfassembly', name: 'Self-Assembly', type: 'power', rarity: 'rare', char: 'array', cost: 2, target: 'none',
  effects: [
    { k: 'status', to: 'self', id: 'turret', n: 2 },
    { k: 'status', to: 'self', id: 'plating', n: 2 },
    { k: 'status', to: 'self', id: 'viral', n: 1 },
  ],
  upEffects: [
    { k: 'status', to: 'self', id: 'turret', n: 3 },
    { k: 'status', to: 'self', id: 'plating', n: 3 },
    { k: 'status', to: 'self', id: 'viral', n: 1 },
  ],
  flavor: 'the factory builds the factory',
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

// --- Pool padding: cycle 12 -------------------------------------------------

reg(c({
  id: 'airgap', name: 'Air Gap', type: 'skill', rarity: 'rare', char: 'runner', cost: 1, target: 'none',
  effects: [{ k: 'status', to: 'self', id: 'artifact', n: 1 }],
  upEffects: [{ k: 'status', to: 'self', id: 'artifact', n: 1 }, { k: 'block', n: 6 }],
  exhaust: true, upExhaust: true,
  flavor: 'unplug everything',
}))
reg(c({
  id: 'ddosburst', name: 'DDoS Burst', type: 'attack', rarity: 'uncommon', char: 'runner', cost: 2, target: 'none',
  effects: [{ k: 'dmgAll', n: 8 }, { k: 'status', to: 'all', id: 'weak', n: 1 }],
  upEffects: [{ k: 'dmgAll', n: 11 }, { k: 'status', to: 'all', id: 'weak', n: 1 }],
}))
reg(c({
  id: 'sudosu', name: 'sudo su', type: 'skill', rarity: 'uncommon', char: 'runner', cost: 0, target: 'none',
  effects: [{ k: 'energy', n: 2 }],
  upEffects: [{ k: 'energy', n: 2 }, { k: 'draw', n: 1 }],
  exhaust: true, upExhaust: true,
  flavor: 'permission granted',
}))
reg(c({
  id: 'coretap', name: 'Core Tap', type: 'skill', rarity: 'uncommon', char: 'vector', cost: 1, target: 'none',
  effects: [{ k: 'draw', n: 2 }, { k: 'status', to: 'self', id: 'heat', n: 2 }],
  upEffects: [{ k: 'draw', n: 3 }, { k: 'status', to: 'self', id: 'heat', n: 2 }],
}))
reg(c({
  id: 'slagshot', name: 'Slag Shot', type: 'attack', rarity: 'common', char: 'vector', cost: 0, target: 'enemy',
  effects: [{ k: 'dmg', n: 4 }, { k: 'status', to: 'self', id: 'heat', n: 1 }],
  upEffects: [{ k: 'dmg', n: 6 }, { k: 'status', to: 'self', id: 'heat', n: 1 }],
}))
reg(c({
  id: 'ghoststride', name: 'Ghost Stride', type: 'attack', rarity: 'uncommon', char: 'ghost', cost: 1, target: 'enemy',
  effects: [{ k: 'dmg', n: 5, times: 2 }],
  upEffects: [{ k: 'dmg', n: 7, times: 2 }],
}))
reg(c({
  id: 'crashout', name: 'Crash Out', type: 'attack', rarity: 'rare', char: 'ghost', cost: 2, target: 'enemy',
  effects: [{ k: 'dmg', n: 16 }, { k: 'enterStance', id: 'none' }],
  upEffects: [{ k: 'dmg', n: 22 }, { k: 'enterStance', id: 'none' }],
  flavor: 'exit through the target',
}))
reg(c({
  id: 'spectralarmor', name: 'Spectral Armor', type: 'skill', rarity: 'common', char: 'ghost', cost: 2, target: 'none',
  effects: [{ k: 'block', n: 12 }], upEffects: [{ k: 'block', n: 16 }],
}))

reg(c({
  id: 'firewallpatch', name: 'Firewall Patch', type: 'skill', rarity: 'common', char: 'runner', cost: 1, target: 'none',
  effects: [{ k: 'block', n: 7 }], upEffects: [{ k: 'block', n: 10 }],
}))
reg(c({
  id: 'overflowex', name: 'Overflow Exploit', type: 'attack', rarity: 'uncommon', char: 'runner', cost: 2, target: 'enemy',
  effects: [{ k: 'dmg', n: 11 }, { k: 'status', to: 'target', id: 'vuln', n: 2 }],
  upEffects: [{ k: 'dmg', n: 14 }, { k: 'status', to: 'target', id: 'vuln', n: 2 }],
}))
reg(c({
  id: 'wipecache', name: 'Wipe Cache', type: 'skill', rarity: 'uncommon', char: 'runner', cost: 1, target: 'none',
  effects: [{ k: 'draw', n: 3 }], upEffects: [{ k: 'draw', n: 4 }],
  exhaust: true, upExhaust: true,
  flavor: 'rm -rf ~/.doubt',
}))
reg(c({
  id: 'induction', name: 'Induction Coil', type: 'power', rarity: 'uncommon', char: 'vector', cost: 1, target: 'none',
  effects: [{ k: 'status', to: 'self', id: 'coolant', n: 2 }, { k: 'status', to: 'self', id: 'ignition', n: 1 }],
  upEffects: [{ k: 'status', to: 'self', id: 'coolant', n: 3 }, { k: 'status', to: 'self', id: 'ignition', n: 2 }],
}))
reg(c({
  id: 'brightstep', name: 'Bright Step', type: 'skill', rarity: 'common', char: 'ghost', cost: 1, target: 'none',
  effects: [{ k: 'enterStance', id: 'overdrive' }, { k: 'block', n: 4 }],
  upEffects: [{ k: 'enterStance', id: 'overdrive' }, { k: 'block', n: 7 }],
}))
reg(c({
  id: 'patchwork', name: 'Patchwork', type: 'skill', rarity: 'common', cost: 0, target: 'none',
  effects: [{ k: 'block', n: 3 }, { k: 'draw', n: 1 }],
  upEffects: [{ k: 'block', n: 5 }, { k: 'draw', n: 1 }],
}))
reg(c({
  id: 'saturate', name: 'Saturate', type: 'attack', rarity: 'rare', cost: 3, target: 'none',
  effects: [{ k: 'dmgAll', n: 14 }], upEffects: [{ k: 'dmgAll', n: 18 }],
  flavor: 'flood every lane at once',
}))

// --- Pool depth: cycle 18 ---------------------------------------------------

reg(c({
  id: 'nullroutine', name: 'Null Routine', type: 'skill', rarity: 'common', char: 'runner', cost: 1, target: 'enemy',
  effects: [{ k: 'block', n: 4 }, { k: 'status', to: 'target', id: 'corrupt', n: 2 }],
  upEffects: [{ k: 'block', n: 6 }, { k: 'status', to: 'target', id: 'corrupt', n: 3 }],
}))
reg(c({
  id: 'tarpit', name: 'Tar Pit', type: 'skill', rarity: 'uncommon', char: 'runner', cost: 1, target: 'none',
  effects: [{ k: 'block', n: 4 }, { k: 'status', to: 'all', id: 'weak', n: 1 }],
  upEffects: [{ k: 'block', n: 6 }, { k: 'status', to: 'all', id: 'weak', n: 2 }],
}))
reg(c({
  id: 'branchpredict', name: 'Branch Predict', type: 'attack', rarity: 'common', char: 'runner', cost: 0, target: 'enemy',
  effects: [{ k: 'dmgIfCombo', n: 4, bonus: 4, threshold: 2 }],
  upEffects: [{ k: 'dmgIfCombo', n: 6, bonus: 5, threshold: 2 }],
  flavor: 'called it',
}))
reg(c({
  id: 'stacksmash', name: 'Stack Smash', type: 'attack', rarity: 'uncommon', char: 'runner', cost: 2, target: 'enemy',
  effects: [{ k: 'dmg', n: 7, times: 2 }],
  upEffects: [{ k: 'dmg', n: 9, times: 2 }],
}))
reg(c({
  id: 'hotpatch', name: 'Hot Patch', type: 'skill', rarity: 'common', char: 'runner', cost: 1, target: 'none',
  effects: [{ k: 'heal', n: 4 }, { k: 'block', n: 3 }],
  upEffects: [{ k: 'heal', n: 6 }, { k: 'block', n: 4 }],
}))
reg(c({
  id: 'boilover', name: 'Boil Over', type: 'attack', rarity: 'uncommon', char: 'vector', cost: 2, target: 'none',
  effects: [{ k: 'dmgAll', n: 7 }, { k: 'status', to: 'self', id: 'heat', n: 2 }],
  upEffects: [{ k: 'dmgAll', n: 10 }, { k: 'status', to: 'self', id: 'heat', n: 2 }],
}))
reg(c({
  id: 'pressuretank', name: 'Pressure Tank', type: 'skill', rarity: 'uncommon', char: 'vector', cost: 1, target: 'none',
  effects: [{ k: 'status', to: 'self', id: 'coolant', n: 3 }, { k: 'block', n: 5 }],
  upEffects: [{ k: 'status', to: 'self', id: 'coolant', n: 4 }, { k: 'block', n: 7 }],
}))
reg(c({
  id: 'emberdance', name: 'Ember Dance', type: 'attack', rarity: 'common', char: 'vector', cost: 1, target: 'enemy',
  effects: [{ k: 'dmg', n: 4, times: 2 }, { k: 'status', to: 'self', id: 'heat', n: 1 }],
  upEffects: [{ k: 'dmg', n: 5, times: 2 }, { k: 'status', to: 'self', id: 'heat', n: 1 }],
}))
reg(c({
  id: 'flareout', name: 'Flare Out', type: 'skill', rarity: 'uncommon', char: 'vector', cost: 0, target: 'none',
  effects: [{ k: 'ventBlock', mult: 1 }, { k: 'draw', n: 1 }],
  upEffects: [{ k: 'ventBlock', mult: 2 }, { k: 'draw', n: 1 }],
}))
reg(c({
  id: 'supernova', name: 'Supernova', type: 'attack', rarity: 'rare', char: 'vector', cost: 3, target: 'enemy',
  effects: [{ k: 'dmgHeatBonus', n: 20, bonus: 15, threshold: 6 }],
  upEffects: [{ k: 'dmgHeatBonus', n: 26, bonus: 18, threshold: 6 }],
  flavor: 'brightest thing on the block, briefly',
}))
reg(c({
  id: 'shadowfeint', name: 'Shadow Feint', type: 'attack', rarity: 'common', char: 'ghost', cost: 0, target: 'enemy',
  effects: [{ k: 'dmg', n: 3 }, { k: 'enterStance', id: 'stealth' }],
  upEffects: [{ k: 'dmg', n: 5 }, { k: 'enterStance', id: 'stealth' }],
}))
reg(c({
  id: 'blurcut', name: 'Blur Cut', type: 'attack', rarity: 'uncommon', char: 'ghost', cost: 2, target: 'enemy',
  effects: [{ k: 'dmgIfStance', n: 11, bonus: 6 }],
  upEffects: [{ k: 'dmgIfStance', n: 14, bonus: 8 }],
}))
reg(c({
  id: 'quickfade', name: 'Quick Fade', type: 'skill', rarity: 'uncommon', char: 'ghost', cost: 0, target: 'none',
  effects: [{ k: 'enterStance', id: 'stealth' }, { k: 'draw', n: 1 }],
  upEffects: [{ k: 'enterStance', id: 'stealth' }, { k: 'draw', n: 2 }],
}))
reg(c({
  id: 'strobeloop', name: 'Strobe Loop', type: 'power', rarity: 'uncommon', char: 'ghost', cost: 1, target: 'none',
  effects: [{ k: 'status', to: 'self', id: 'momentum', n: 1 }, { k: 'status', to: 'self', id: 'stancewall', n: 1 }],
  upEffects: [{ k: 'status', to: 'self', id: 'momentum', n: 1 }, { k: 'status', to: 'self', id: 'stancewall', n: 3 }],
}))
reg(c({
  id: 'finalcurtain', name: 'Final Curtain', type: 'attack', rarity: 'rare', char: 'ghost', cost: 2, target: 'enemy',
  ethereal: true,
  effects: [{ k: 'dmg', n: 12, times: 2 }, { k: 'enterStance', id: 'overdrive' }],
  upEffects: [{ k: 'dmg', n: 15, times: 2 }, { k: 'enterStance', id: 'overdrive' }],
  flavor: 'no encore',
}))
reg(c({
  id: 'zapdrone', name: 'Zap Drone', type: 'attack', rarity: 'common', char: 'array', cost: 0, target: 'enemy',
  effects: [{ k: 'dmg', n: 3 }, { k: 'status', to: 'self', id: 'turret', n: 1 }],
  upEffects: [{ k: 'dmg', n: 5 }, { k: 'status', to: 'self', id: 'turret', n: 1 }],
}))
reg(c({
  id: 'shieldlattice', name: 'Shield Lattice', type: 'skill', rarity: 'uncommon', char: 'array', cost: 2, target: 'none',
  effects: [{ k: 'block', n: 8 }, { k: 'status', to: 'self', id: 'plating', n: 2 }],
  upEffects: [{ k: 'block', n: 10 }, { k: 'status', to: 'self', id: 'plating', n: 3 }],
}))
reg(c({
  id: 'swarmprotocol', name: 'Swarm Protocol', type: 'skill', rarity: 'uncommon', char: 'array', cost: 1, target: 'none',
  effects: [{ k: 'status', to: 'self', id: 'turret', n: 1 }, { k: 'status', to: 'self', id: 'plating', n: 1 }],
  upEffects: [
    { k: 'status', to: 'self', id: 'turret', n: 1 },
    { k: 'status', to: 'self', id: 'plating', n: 1 },
    { k: 'status', to: 'self', id: 'viral', n: 1 },
  ],
  exhaust: true, upExhaust: true,
}))
reg(c({
  id: 'gridsurge', name: 'Grid Surge', type: 'attack', rarity: 'uncommon', char: 'array', cost: 2, target: 'none',
  effects: [{ k: 'dmgAll', n: 6 }, { k: 'status', to: 'self', id: 'turret', n: 1 }],
  upEffects: [{ k: 'dmgAll', n: 8 }, { k: 'status', to: 'self', id: 'turret', n: 2 }],
}))
reg(c({
  id: 'unitytick', name: 'Unity Tick', type: 'attack', rarity: 'rare', char: 'array', cost: 2, target: 'enemy',
  effects: [{ k: 'dmgPerAuto', base: 6, per: 3 }],
  upEffects: [{ k: 'dmgPerAuto', base: 8, per: 3 }],
  flavor: 'one clock, many hammers',
}))

// --- Summons ----------------------------------------------------------------

reg(c({
  id: 'summonferro', name: 'Summon: Ferro', type: 'skill', rarity: 'common', char: 'array', cost: 1, target: 'none',
  effects: [{ k: 'summonAlly', id: 'ferrodrone' }],
  upEffects: [{ k: 'summonAlly', id: 'ferroprime' }],
  flavor: 'it bites for you now',
}))
reg(c({
  id: 'summonbulwark', name: 'Summon: Bulwark', type: 'skill', rarity: 'common', char: 'array', cost: 1, target: 'none',
  effects: [{ k: 'summonAlly', id: 'bulwarkpod' }],
  upEffects: [{ k: 'summonAlly', id: 'bulwarkprime' }],
}))
reg(c({
  id: 'summonspore', name: 'Summon: Spore Mite', type: 'skill', rarity: 'uncommon', char: 'array', cost: 1, target: 'none',
  effects: [{ k: 'summonAlly', id: 'sporemite' }],
  upEffects: [{ k: 'summonAlly', id: 'sporeprime' }],
}))
reg(c({
  id: 'twinforge', name: 'Twin Forge', type: 'skill', rarity: 'rare', char: 'array', cost: 2, target: 'none',
  effects: [{ k: 'summonAlly', id: 'ferrodrone', n: 2 }],
  upEffects: [{ k: 'summonAlly', id: 'ferroprime', n: 2 }],
  flavor: 'two of everything, as designed',
}))
reg(c({
  id: 'rentadrone', name: 'Rent-a-Drone', type: 'skill', rarity: 'uncommon', cost: 1, target: 'none',
  effects: [{ k: 'summonAlly', id: 'ferrodrone' }],
  upEffects: [{ k: 'summonAlly', id: 'ferroprime' }],
  exhaust: true, upExhaust: true,
  flavor: 'terms and conditions apply',
}))

// --- Volume: cycle 23 -------------------------------------------------------

reg(c({
  id: 'bitflip', name: 'Bit Flip', type: 'attack', rarity: 'common', char: 'runner', cost: 1, target: 'enemy',
  effects: [{ k: 'dmg', n: 5 }, { k: 'draw', n: 1 }], upEffects: [{ k: 'dmg', n: 8 }, { k: 'draw', n: 1 }],
}))
reg(c({
  id: 'cachepurge', name: 'Cache Purge', type: 'skill', rarity: 'common', char: 'runner', cost: 1, target: 'none',
  effects: [{ k: 'block', n: 6 }], upEffects: [{ k: 'block', n: 8 }, { k: 'draw', n: 1 }],
}))
reg(c({
  id: 'logicbomb', name: 'Logic Bomb', type: 'attack', rarity: 'uncommon', char: 'runner', cost: 2, target: 'enemy',
  effects: [{ k: 'dmg', n: 8 }, { k: 'status', to: 'target', id: 'corrupt', n: 3 }],
  upEffects: [{ k: 'dmg', n: 10 }, { k: 'status', to: 'target', id: 'corrupt', n: 4 }],
}))
reg(c({
  id: 'proxychain', name: 'Proxy Chain', type: 'skill', rarity: 'uncommon', char: 'runner', cost: 1, target: 'enemy',
  effects: [{ k: 'block', n: 5 }, { k: 'status', to: 'target', id: 'weak', n: 1 }],
  upEffects: [{ k: 'block', n: 7 }, { k: 'status', to: 'target', id: 'weak', n: 2 }],
}))
reg(c({
  id: 'rootshell', name: 'Root Shell', type: 'power', rarity: 'rare', char: 'runner', cost: 2, target: 'none',
  effects: [{ k: 'status', to: 'self', id: 'viral', n: 2 }],
  upEffects: [{ k: 'status', to: 'self', id: 'viral', n: 3 }],
}))
reg(c({
  id: 'quicksort', name: 'Quicksort', type: 'skill', rarity: 'common', char: 'runner', cost: 0, target: 'none',
  effects: [{ k: 'draw', n: 1 }], upEffects: [{ k: 'draw', n: 2 }],
  flavor: 'O(n log n) or bust',
}))
reg(c({
  id: 'bufferoverflow2', name: 'Buffer Overflow', type: 'attack', rarity: 'uncommon', char: 'runner', cost: 1, target: 'enemy',
  effects: [{ k: 'dmgIfCombo', n: 6, bonus: 6, threshold: 3 }],
  upEffects: [{ k: 'dmgIfCombo', n: 8, bonus: 8, threshold: 3 }],
}))
reg(c({
  id: 'sysreset', name: 'System Reset', type: 'skill', rarity: 'rare', char: 'runner', cost: 1, target: 'none',
  effects: [{ k: 'cleanse' }, { k: 'block', n: 8 }], upEffects: [{ k: 'cleanse' }, { k: 'block', n: 12 }],
}))
reg(c({
  id: 'wormhole', name: 'Wormhole', type: 'attack', rarity: 'rare', char: 'runner', cost: 2, target: 'enemy',
  effects: [{ k: 'dmg', n: 7 }, { k: 'draw', n: 2 }], upEffects: [{ k: 'dmg', n: 10 }, { k: 'draw', n: 2 }],
}))
reg(c({
  id: 'adminlock', name: 'Admin Lock', type: 'skill', rarity: 'uncommon', char: 'runner', cost: 2, target: 'none',
  effects: [{ k: 'block', n: 12 }], upEffects: [{ k: 'block', n: 16 }],
}))
reg(c({
  id: 'heatspike', name: 'Heat Spike', type: 'attack', rarity: 'common', char: 'vector', cost: 1, target: 'enemy',
  effects: [{ k: 'dmg', n: 6 }, { k: 'status', to: 'self', id: 'heat', n: 1 }],
  upEffects: [{ k: 'dmg', n: 9 }, { k: 'status', to: 'self', id: 'heat', n: 1 }],
}))
reg(c({
  id: 'moltencore', name: 'Molten Core', type: 'power', rarity: 'rare', char: 'vector', cost: 2, target: 'none',
  effects: [{ k: 'status', to: 'self', id: 'str', n: 1 }, { k: 'status', to: 'self', id: 'ignition', n: 1 }],
  upEffects: [{ k: 'status', to: 'self', id: 'str', n: 2 }, { k: 'status', to: 'self', id: 'ignition', n: 1 }],
}))
reg(c({
  id: 'ashguard', name: 'Ash Guard', type: 'skill', rarity: 'common', char: 'vector', cost: 1, target: 'none',
  effects: [{ k: 'block', n: 5 }, { k: 'status', to: 'self', id: 'heat', n: 1 }],
  upEffects: [{ k: 'block', n: 8 }, { k: 'status', to: 'self', id: 'heat', n: 1 }],
}))
reg(c({
  id: 'flamewall', name: 'Flame Wall', type: 'skill', rarity: 'uncommon', char: 'vector', cost: 2, target: 'none',
  effects: [{ k: 'block', n: 10 }, { k: 'status', to: 'self', id: 'thorns', n: 2 }],
  upEffects: [{ k: 'block', n: 13 }, { k: 'status', to: 'self', id: 'thorns', n: 3 }],
}))
reg(c({
  id: 'cauterize', name: 'Cauterize', type: 'skill', rarity: 'uncommon', char: 'vector', cost: 1, target: 'none',
  effects: [{ k: 'heal', n: 6 }, { k: 'heatCool', n: 3 }],
  upEffects: [{ k: 'heal', n: 9 }, { k: 'heatCool', n: 4 }],
  exhaust: true, upExhaust: true,
}))
reg(c({
  id: 'infernojab', name: 'Inferno Jab', type: 'attack', rarity: 'common', char: 'vector', cost: 0, target: 'enemy',
  effects: [{ k: 'dmg', n: 2, times: 2 }, { k: 'status', to: 'self', id: 'heat', n: 1 }],
  upEffects: [{ k: 'dmg', n: 3, times: 2 }, { k: 'status', to: 'self', id: 'heat', n: 1 }],
}))
reg(c({
  id: 'thermallance', name: 'Thermal Lance', type: 'attack', rarity: 'uncommon', char: 'vector', cost: 2, target: 'enemy',
  effects: [{ k: 'dmgHeatBonus', n: 12, bonus: 8, threshold: 4 }],
  upEffects: [{ k: 'dmgHeatBonus', n: 15, bonus: 10, threshold: 4 }],
}))
reg(c({
  id: 'sunforge', name: 'Sunforge', type: 'power', rarity: 'rare', char: 'vector', cost: 3, upCost: 2, target: 'none',
  effects: [{ k: 'status', to: 'self', id: 'ignition', n: 2 }, { k: 'status', to: 'self', id: 'coolant', n: 2 }],
  upEffects: [{ k: 'status', to: 'self', id: 'ignition', n: 2 }, { k: 'status', to: 'self', id: 'coolant', n: 2 }],
}))
reg(c({
  id: 'veilslip', name: 'Veil Slip', type: 'skill', rarity: 'common', char: 'ghost', cost: 0, target: 'none',
  effects: [{ k: 'enterStance', id: 'none' }, { k: 'block', n: 4 }],
  upEffects: [{ k: 'enterStance', id: 'none' }, { k: 'block', n: 6 }],
}))
reg(c({
  id: 'razorflicker', name: 'Razor Flicker', type: 'attack', rarity: 'common', char: 'ghost', cost: 1, target: 'enemy',
  effects: [{ k: 'dmgIfStance', n: 9, bonus: 3 }],
  upEffects: [{ k: 'dmgIfStance', n: 12, bonus: 4 }],
}))
reg(c({
  id: 'duskblade', name: 'Dusk Blade', type: 'attack', rarity: 'uncommon', char: 'ghost', cost: 1, target: 'enemy',
  effects: [{ k: 'dmg', n: 8 }, { k: 'enterStance', id: 'stealth' }],
  upEffects: [{ k: 'dmg', n: 11 }, { k: 'enterStance', id: 'stealth' }],
}))
reg(c({
  id: 'dawnbreaker', name: 'Dawnbreaker', type: 'attack', rarity: 'uncommon', char: 'ghost', cost: 2, target: 'enemy',
  effects: [{ k: 'dmg', n: 12 }, { k: 'enterStance', id: 'overdrive' }],
  upEffects: [{ k: 'dmg', n: 16 }, { k: 'enterStance', id: 'overdrive' }],
}))
reg(c({
  id: 'mirrorpalace', name: 'Mirror Palace', type: 'power', rarity: 'rare', char: 'ghost', cost: 2, target: 'none',
  effects: [{ k: 'status', to: 'self', id: 'stancewall', n: 4 }],
  upEffects: [{ k: 'status', to: 'self', id: 'stancewall', n: 6 }],
}))
reg(c({
  id: 'hushfield', name: 'Hush Field', type: 'skill', rarity: 'uncommon', char: 'ghost', cost: 1, target: 'none',
  retain: true,
  effects: [{ k: 'block', n: 7 }], upEffects: [{ k: 'block', n: 10 }],
}))
reg(c({
  id: 'eventide', name: 'Eventide', type: 'skill', rarity: 'rare', char: 'ghost', cost: 1, target: 'none',
  ethereal: true,
  effects: [{ k: 'enterStance', id: 'stealth' }, { k: 'draw', n: 2 }],
  upEffects: [{ k: 'enterStance', id: 'stealth' }, { k: 'draw', n: 3 }],
}))
reg(c({
  id: 'zealcircuit', name: 'Zeal Circuit', type: 'power', rarity: 'uncommon', char: 'ghost', cost: 2, target: 'none',
  effects: [{ k: 'status', to: 'self', id: 'momentum', n: 2 }],
  upEffects: [{ k: 'status', to: 'self', id: 'momentum', n: 3 }],
}))
reg(c({
  id: 'pulsecannon', name: 'Pulse Cannon', type: 'attack', rarity: 'uncommon', char: 'array', cost: 2, target: 'enemy',
  effects: [{ k: 'dmg', n: 6, times: 2 }, { k: 'status', to: 'self', id: 'turret', n: 1 }],
  upEffects: [{ k: 'dmg', n: 8, times: 2 }, { k: 'status', to: 'self', id: 'turret', n: 1 }],
}))
reg(c({
  id: 'hexfield', name: 'Hex Field', type: 'skill', rarity: 'uncommon', char: 'array', cost: 1, target: 'none',
  effects: [{ k: 'status', to: 'self', id: 'viral', n: 1 }, { k: 'status', to: 'self', id: 'plating', n: 1 }],
  upEffects: [{ k: 'status', to: 'self', id: 'viral', n: 1 }, { k: 'status', to: 'self', id: 'plating', n: 2 }],
}))
reg(c({
  id: 'reproduce', name: 'Reproduce', type: 'skill', rarity: 'rare', char: 'array', cost: 2, target: 'none',
  effects: [{ k: 'summonAlly', id: 'sporemite', n: 2 }],
  upEffects: [{ k: 'summonAlly', id: 'sporeprime', n: 2 }],
  flavor: 'mitosis as a service',
}))
reg(c({
  id: 'buffernet', name: 'Buffer Net', type: 'skill', rarity: 'common', char: 'array', cost: 0, target: 'none',
  effects: [{ k: 'block', n: 2 }, { k: 'status', to: 'self', id: 'plating', n: 1 }],
  upEffects: [{ k: 'block', n: 4 }, { k: 'status', to: 'self', id: 'plating', n: 1 }],
}))
reg(c({
  id: 'omegashield', name: 'Omega Shield', type: 'skill', rarity: 'rare', char: 'array', cost: 3, target: 'none',
  effects: [{ k: 'block', n: 8 }, { k: 'doubleBlock' }],
  upEffects: [{ k: 'block', n: 12 }, { k: 'doubleBlock' }],
}))
reg(c({
  id: 'servolimb', name: 'Servo Limb', type: 'attack', rarity: 'common', char: 'array', cost: 1, target: 'enemy',
  effects: [{ k: 'dmg', n: 6 }, { k: 'status', to: 'self', id: 'plating', n: 1 }],
  upEffects: [{ k: 'dmg', n: 9 }, { k: 'status', to: 'self', id: 'plating', n: 1 }],
}))
reg(c({
  id: 'nanospray', name: 'Nano Spray', type: 'attack', rarity: 'common', char: 'array', cost: 1, target: 'none',
  effects: [{ k: 'dmgAll', n: 3 }, { k: 'status', to: 'self', id: 'plating', n: 1 }],
  upEffects: [{ k: 'dmgAll', n: 5 }, { k: 'status', to: 'self', id: 'plating', n: 1 }],
}))
reg(c({
  id: 'corecharge', name: 'Core Charge', type: 'skill', rarity: 'uncommon', char: 'array', cost: 0, target: 'none',
  effects: [{ k: 'energy', n: 1 }, { k: 'status', to: 'self', id: 'turret', n: 1 }],
  upEffects: [{ k: 'energy', n: 2 }, { k: 'status', to: 'self', id: 'turret', n: 1 }],
  exhaust: true, upExhaust: true,
}))
reg(c({
  id: 'sidearm', name: 'Sidearm', type: 'attack', rarity: 'common', cost: 0, target: 'enemy',
  effects: [{ k: 'dmg', n: 4 }], upEffects: [{ k: 'dmg', n: 7 }],
}))
reg(c({
  id: 'scrapplate', name: 'Scrap Plate', type: 'skill', rarity: 'common', cost: 1, target: 'none',
  effects: [{ k: 'block', n: 6 }], upEffects: [{ k: 'block', n: 9 }],
}))
reg(c({
  id: 'adrenal', name: 'Adrenal Shot', type: 'skill', rarity: 'uncommon', cost: 0, target: 'none',
  effects: [{ k: 'energy', n: 1 }, { k: 'draw', n: 1 }],
  upEffects: [{ k: 'energy', n: 1 }, { k: 'draw', n: 1 }],
  exhaust: true, upExhaust: false,
}))
reg(c({
  id: 'empburst', name: 'EMP Burst', type: 'skill', rarity: 'rare', cost: 1, target: 'none',
  effects: [{ k: 'status', to: 'all', id: 'weak', n: 1 }, { k: 'status', to: 'all', id: 'vuln', n: 1 }],
  upEffects: [{ k: 'status', to: 'all', id: 'weak', n: 2 }, { k: 'status', to: 'all', id: 'vuln', n: 2 }],
  exhaust: true, upExhaust: true,
}))
reg(c({
  id: 'leadpipe', name: 'Lead Pipe', type: 'attack', rarity: 'common', cost: 2, target: 'enemy',
  effects: [{ k: 'dmg', n: 12 }], upEffects: [{ k: 'dmg', n: 16 }],
  flavor: 'analog solutions',
}))
reg(c({
  id: 'datafeast', name: 'Data Feast', type: 'skill', rarity: 'rare', cost: 2, target: 'none',
  effects: [{ k: 'draw', n: 4 }], upEffects: [{ k: 'draw', n: 5 }],
}))

// --- Volume: cycle 25 -------------------------------------------------------

reg(c({ id: 'spearphish', name: 'Spearphish', type: 'attack', rarity: 'common', char: 'runner', cost: 1, target: 'enemy', effects: [{ k: 'dmg', n: 7 }, { k: 'status', to: 'target', id: 'weak', n: 1 }], upEffects: [{ k: 'dmg', n: 10 }, { k: 'status', to: 'target', id: 'weak', n: 1 }] }))
reg(c({ id: 'droptable', name: 'Drop Table', type: 'attack', rarity: 'uncommon', char: 'runner', cost: 3, target: 'enemy', effects: [{ k: 'dmg', n: 18 }], upEffects: [{ k: 'dmg', n: 24 }], flavor: "'); DROP TABLE foes;--" }))
reg(c({ id: 'honeypot', name: 'Honeypot', type: 'skill', rarity: 'uncommon', char: 'runner', cost: 1, target: 'none', effects: [{ k: 'block', n: 6 }, { k: 'status', to: 'self', id: 'thorns', n: 2 }], upEffects: [{ k: 'block', n: 8 }, { k: 'status', to: 'self', id: 'thorns', n: 3 }] }))
reg(c({ id: 'keylogger', name: 'Keylogger', type: 'skill', rarity: 'common', char: 'runner', cost: 0, target: 'enemy', effects: [{ k: 'status', to: 'target', id: 'corrupt', n: 2 }], upEffects: [{ k: 'status', to: 'target', id: 'corrupt', n: 3 }, { k: 'draw', n: 1 }] }))
reg(c({ id: 'darkcompile', name: 'Dark Compile', type: 'attack', rarity: 'rare', char: 'runner', cost: 2, target: 'enemy', effects: [{ k: 'dmgPerCorrupt', mult: 3 }], upEffects: [{ k: 'dmgPerCorrupt', mult: 4 }] }))
reg(c({ id: 'sandboxed', name: 'Sandboxed', type: 'skill', rarity: 'common', char: 'runner', cost: 2, target: 'none', effects: [{ k: 'block', n: 11 }], upEffects: [{ k: 'block', n: 15 }] }))
reg(c({ id: 'saltmine', name: 'Salt Mine', type: 'skill', rarity: 'uncommon', char: 'runner', cost: 1, target: 'none', effects: [{ k: 'status', to: 'self', id: 'plating', n: 2 }], upEffects: [{ k: 'status', to: 'self', id: 'plating', n: 3 }] }))
reg(c({ id: 'zipbomb', name: 'Zip Bomb', type: 'attack', rarity: 'rare', char: 'runner', cost: 1, target: 'none', ethereal: true, effects: [{ k: 'dmgAll', n: 11 }], upEffects: [{ k: 'dmgAll', n: 15 }] }))
reg(c({ id: 'hashcrack', name: 'Hash Crack', type: 'attack', rarity: 'common', char: 'runner', cost: 1, target: 'enemy', effects: [{ k: 'dmg', n: 4, times: 2 }], upEffects: [{ k: 'dmg', n: 6, times: 2 }] }))
reg(c({ id: 'privilege', name: 'Privilege Escalation', type: 'power', rarity: 'rare', char: 'runner', cost: 2, target: 'none', effects: [{ k: 'status', to: 'self', id: 'energyGain', n: 1 }], upEffects: [{ k: 'status', to: 'self', id: 'energyGain', n: 1 }, { k: 'draw', n: 2 }] }))
reg(c({ id: 'traceroute', name: 'Traceroute', type: 'skill', rarity: 'common', char: 'runner', cost: 1, target: 'none', effects: [{ k: 'draw', n: 2 }], upEffects: [{ k: 'draw', n: 3 }] }))
reg(c({ id: 'nullcheck', name: 'Null Check', type: 'skill', rarity: 'uncommon', char: 'runner', cost: 0, target: 'none', innate: true, effects: [{ k: 'block', n: 3 }], upEffects: [{ k: 'block', n: 6 }] }))
reg(c({ id: 'brazier', name: 'Brazier', type: 'skill', rarity: 'common', char: 'vector', cost: 0, target: 'none', effects: [{ k: 'status', to: 'self', id: 'heat', n: 2 }], upEffects: [{ k: 'status', to: 'self', id: 'heat', n: 3 }] }))
reg(c({ id: 'geyser', name: 'Geyser', type: 'attack', rarity: 'uncommon', char: 'vector', cost: 1, target: 'none', effects: [{ k: 'ventDmgAll', mult: 1 }, { k: 'draw', n: 1 }], upEffects: [{ k: 'ventDmgAll', mult: 2 }, { k: 'draw', n: 1 }] }))
reg(c({ id: 'firebreak', name: 'Firebreak', type: 'skill', rarity: 'common', char: 'vector', cost: 1, target: 'none', effects: [{ k: 'block', n: 7 }, { k: 'heatCool', n: 1 }], upEffects: [{ k: 'block', n: 10 }, { k: 'heatCool', n: 2 }] }))
reg(c({ id: 'magmaslug', name: 'Magma Slug', type: 'attack', rarity: 'common', char: 'vector', cost: 2, target: 'enemy', effects: [{ k: 'dmg', n: 12 }, { k: 'status', to: 'self', id: 'heat', n: 2 }], upEffects: [{ k: 'dmg', n: 16 }, { k: 'status', to: 'self', id: 'heat', n: 2 }] }))
reg(c({ id: 'kilnheart', name: 'Kiln Heart', type: 'power', rarity: 'uncommon', char: 'vector', cost: 1, target: 'none', effects: [{ k: 'status', to: 'self', id: 'regen', n: 2 }], upEffects: [{ k: 'status', to: 'self', id: 'regen', n: 3 }] }))
reg(c({ id: 'whitecoal', name: 'White Coal', type: 'skill', rarity: 'rare', char: 'vector', cost: 0, target: 'none', exhaust: true, upExhaust: true, effects: [{ k: 'status', to: 'self', id: 'heat', n: 5 }, { k: 'draw', n: 1 }], upEffects: [{ k: 'status', to: 'self', id: 'heat', n: 6 }, { k: 'draw', n: 2 }] }))
reg(c({ id: 'steamvent', name: 'Steam Vent', type: 'skill', rarity: 'uncommon', char: 'vector', cost: 1, target: 'none', effects: [{ k: 'ventBlock', mult: 2 }, { k: 'draw', n: 1 }], upEffects: [{ k: 'ventBlock', mult: 3 }, { k: 'draw', n: 1 }] }))
reg(c({ id: 'charflare', name: 'Char Flare', type: 'attack', rarity: 'common', char: 'vector', cost: 1, target: 'enemy', effects: [{ k: 'dmg', n: 8 }, { k: 'status', to: 'self', id: 'heat', n: 3 }], upEffects: [{ k: 'dmg', n: 11 }, { k: 'status', to: 'self', id: 'heat', n: 3 }] }))
reg(c({ id: 'smelter', name: 'Smelter', type: 'power', rarity: 'rare', char: 'vector', cost: 2, target: 'none', effects: [{ k: 'status', to: 'self', id: 'str', n: 2 }, { k: 'status', to: 'self', id: 'heat', n: 2 }], upEffects: [{ k: 'status', to: 'self', id: 'str', n: 3 }, { k: 'status', to: 'self', id: 'heat', n: 2 }] }))
reg(c({ id: 'boilerplate', name: 'Boilerplate', type: 'skill', rarity: 'common', char: 'vector', cost: 2, target: 'none', effects: [{ k: 'block', n: 12 }, { k: 'status', to: 'self', id: 'heat', n: 1 }], upEffects: [{ k: 'block', n: 15 }, { k: 'status', to: 'self', id: 'heat', n: 1 }] }))
reg(c({ id: 'emberstorm', name: 'Ember Storm', type: 'attack', rarity: 'rare', char: 'vector', cost: 2, target: 'none', effects: [{ k: 'dmgAll', n: 5, times: 2 }, { k: 'status', to: 'self', id: 'heat', n: 2 }], upEffects: [{ k: 'dmgAll', n: 6, times: 2 }, { k: 'status', to: 'self', id: 'heat', n: 2 }] }))
reg(c({ id: 'palefire', name: 'Pale Fire', type: 'skill', rarity: 'common', char: 'ghost', cost: 1, target: 'none', effects: [{ k: 'block', n: 6 }, { k: 'enterStance', id: 'overdrive' }], upEffects: [{ k: 'block', n: 9 }, { k: 'enterStance', id: 'overdrive' }] }))
reg(c({ id: 'graveglide', name: 'Grave Glide', type: 'attack', rarity: 'common', char: 'ghost', cost: 1, target: 'enemy', effects: [{ k: 'dmg', n: 6 }, { k: 'draw', n: 1 }], upEffects: [{ k: 'dmg', n: 9 }, { k: 'draw', n: 1 }] }))
reg(c({ id: 'whisperedge', name: 'Whisper Edge', type: 'attack', rarity: 'uncommon', char: 'ghost', cost: 0, target: 'enemy', effects: [{ k: 'dmgIfStance', n: 4, bonus: 4 }], upEffects: [{ k: 'dmgIfStance', n: 6, bonus: 5 }] }))
reg(c({ id: 'palanquin', name: 'Palanquin', type: 'skill', rarity: 'uncommon', char: 'ghost', cost: 2, target: 'none', effects: [{ k: 'block', n: 10 }, { k: 'enterStance', id: 'stealth' }], upEffects: [{ k: 'block', n: 13 }, { k: 'enterStance', id: 'stealth' }] }))
reg(c({ id: 'twiceborn', name: 'Twiceborn', type: 'power', rarity: 'rare', char: 'ghost', cost: 2, target: 'none', effects: [{ k: 'status', to: 'self', id: 'tempoloop', n: 1 }, { k: 'status', to: 'self', id: 'momentum', n: 1 }], upEffects: [{ k: 'status', to: 'self', id: 'tempoloop', n: 1 }, { k: 'status', to: 'self', id: 'momentum', n: 2 }] }))
reg(c({ id: 'sablecoil', name: 'Sable Coil', type: 'skill', rarity: 'common', char: 'ghost', cost: 0, target: 'none', effects: [{ k: 'draw', n: 1 }, { k: 'block', n: 2 }], upEffects: [{ k: 'draw', n: 1 }, { k: 'block', n: 5 }] }))
reg(c({ id: 'requiem', name: 'Requiem', type: 'attack', rarity: 'rare', char: 'ghost', cost: 3, target: 'none', effects: [{ k: 'dmgAll', n: 9 }, { k: 'enterStance', id: 'overdrive' }, { k: 'draw', n: 1 }], upEffects: [{ k: 'dmgAll', n: 13 }, { k: 'enterStance', id: 'overdrive' }, { k: 'draw', n: 1 }] }))
reg(c({ id: 'silhouette', name: 'Silhouette', type: 'skill', rarity: 'uncommon', char: 'ghost', cost: 1, target: 'none', retain: true, effects: [{ k: 'enterStance', id: 'stealth' }, { k: 'block', n: 3 }], upEffects: [{ k: 'enterStance', id: 'stealth' }, { k: 'block', n: 6 }] }))
reg(c({ id: 'coldapplause', name: 'Cold Applause', type: 'skill', rarity: 'common', char: 'ghost', cost: 1, target: 'enemy', effects: [{ k: 'status', to: 'target', id: 'vuln', n: 2 }], upEffects: [{ k: 'status', to: 'target', id: 'vuln', n: 3 }] }))
reg(c({ id: 'phantomtroupe', name: 'Phantom Troupe', type: 'attack', rarity: 'uncommon', char: 'ghost', cost: 2, target: 'enemy', effects: [{ k: 'dmg', n: 5, times: 3 }], upEffects: [{ k: 'dmg', n: 6, times: 3 }] }))
reg(c({ id: 'circuitrider', name: 'Circuit Rider', type: 'attack', rarity: 'common', char: 'array', cost: 1, target: 'enemy', effects: [{ k: 'dmg', n: 7 }, { k: 'draw', n: 1 }], upEffects: [{ k: 'dmg', n: 10 }, { k: 'draw', n: 1 }] }))
reg(c({ id: 'sentryweb', name: 'Sentry Web', type: 'skill', rarity: 'common', char: 'array', cost: 2, target: 'none', effects: [{ k: 'status', to: 'self', id: 'turret', n: 2 }, { k: 'block', n: 5 }], upEffects: [{ k: 'status', to: 'self', id: 'turret', n: 2 }, { k: 'block', n: 8 }] }))
reg(c({ id: 'ironbrood', name: 'Iron Brood', type: 'skill', rarity: 'uncommon', char: 'array', cost: 2, target: 'none', effects: [{ k: 'summonAlly', id: 'ferrodrone' }, { k: 'block', n: 5 }], upEffects: [{ k: 'summonAlly', id: 'ferroprime' }, { k: 'block', n: 5 }] }))
reg(c({ id: 'assembler', name: 'Assembler', type: 'power', rarity: 'uncommon', char: 'array', cost: 1, target: 'none', effects: [{ k: 'status', to: 'self', id: 'plating', n: 2 }], upEffects: [{ k: 'status', to: 'self', id: 'plating', n: 3 }] }))
reg(c({ id: 'faultline', name: 'Fault Line', type: 'attack', rarity: 'rare', char: 'array', cost: 3, target: 'none', effects: [{ k: 'dmgAll', n: 10 }, { k: 'status', to: 'self', id: 'plating', n: 2 }], upEffects: [{ k: 'dmgAll', n: 14 }, { k: 'status', to: 'self', id: 'plating', n: 2 }] }))
reg(c({ id: 'sporeburst', name: 'Spore Burst', type: 'attack', rarity: 'uncommon', char: 'array', cost: 1, target: 'none', effects: [{ k: 'dmgAll', n: 4 }, { k: 'status', to: 'all', id: 'corrupt', n: 2 }], upEffects: [{ k: 'dmgAll', n: 6 }, { k: 'status', to: 'all', id: 'corrupt', n: 3 }] }))
reg(c({ id: 'liveungrid', name: 'Living Grid', type: 'power', rarity: 'rare', char: 'array', cost: 2, target: 'none', effects: [{ k: 'status', to: 'self', id: 'regen', n: 2 }, { k: 'status', to: 'self', id: 'plating', n: 1 }], upEffects: [{ k: 'status', to: 'self', id: 'regen', n: 3 }, { k: 'status', to: 'self', id: 'plating', n: 1 }] }))
reg(c({ id: 'stackrelay', name: 'Stack Relay', type: 'skill', rarity: 'common', char: 'array', cost: 1, target: 'none', effects: [{ k: 'draw', n: 2 }], upEffects: [{ k: 'draw', n: 2 }, { k: 'block', n: 3 }] }))
reg(c({ id: 'gridlock', name: 'Gridlock', type: 'skill', rarity: 'uncommon', char: 'array', cost: 1, target: 'enemy', effects: [{ k: 'status', to: 'target', id: 'weak', n: 2 }, { k: 'block', n: 4 }], upEffects: [{ k: 'status', to: 'target', id: 'weak', n: 2 }, { k: 'block', n: 7 }] }))
reg(c({ id: 'beamsplit', name: 'Beam Splitter', type: 'attack', rarity: 'common', char: 'array', cost: 2, target: 'none', effects: [{ k: 'dmgAll', n: 7 }], upEffects: [{ k: 'dmgAll', n: 10 }] }))
reg(c({ id: 'ratking2', name: 'Packet Rat', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', effects: [{ k: 'dmg', n: 6 }, { k: 'status', to: 'self', id: 'plating', n: 1 }], upEffects: [{ k: 'dmg', n: 8 }, { k: 'status', to: 'self', id: 'plating', n: 1 }] }))
reg(c({ id: 'fleamarket', name: 'Flea Market Find', type: 'skill', rarity: 'common', cost: 0, target: 'none', exhaust: true, upExhaust: true, effects: [{ k: 'block', n: 5 }], upEffects: [{ k: 'block', n: 5 }, { k: 'draw', n: 1 }] }))
reg(c({ id: 'ricochet', name: 'Ricochet', type: 'attack', rarity: 'uncommon', cost: 1, target: 'none', effects: [{ k: 'dmgAll', n: 5 }], upEffects: [{ k: 'dmgAll', n: 7 }] }))
reg(c({ id: 'fieldration', name: 'Field Ration', type: 'skill', rarity: 'uncommon', cost: 1, target: 'none', exhaust: true, upExhaust: true, effects: [{ k: 'heal', n: 7 }], upEffects: [{ k: 'heal', n: 11 }] }))
reg(c({ id: 'ironwill', name: 'Iron Will', type: 'power', rarity: 'rare', cost: 2, target: 'none', effects: [{ k: 'status', to: 'self', id: 'plating', n: 2 }, { k: 'status', to: 'self', id: 'thorns', n: 2 }], upEffects: [{ k: 'status', to: 'self', id: 'plating', n: 3 }, { k: 'status', to: 'self', id: 'thorns', n: 3 }] }))
reg(c({ id: 'lastresort', name: 'Last Resort', type: 'attack', rarity: 'rare', cost: 0, target: 'enemy', exhaust: true, upExhaust: true, effects: [{ k: 'blockAsDmg' }], upEffects: [{ k: 'blockAsDmg' }, { k: 'draw', n: 1 }] }))
reg(c({ id: 'streetsmarts', name: 'Street Smarts', type: 'skill', rarity: 'common', cost: 1, target: 'none', effects: [{ k: 'block', n: 4 }, { k: 'draw', n: 1 }], upEffects: [{ k: 'block', n: 6 }, { k: 'draw', n: 1 }] }))
reg(c({ id: 'trainhop', name: 'Train Hop', type: 'skill', rarity: 'uncommon', cost: 0, target: 'none', ethereal: true, effects: [{ k: 'energy', n: 1 }], upEffects: [{ k: 'energy', n: 1 }, { k: 'draw', n: 1 }] }))

// --- Co-op support cards (target an ally; yourself outside co-op) -----------

reg(c({
  id: 'medpatch', name: 'Med Patch', type: 'skill', rarity: 'uncommon', cost: 1, target: 'ally',
  effects: [{ k: 'heal', n: 8 }], upEffects: [{ k: 'heal', n: 12 }],
  flavor: 'field-rated adhesive mercy',
}))
reg(c({
  id: 'coverfire', name: 'Cover Fire', type: 'skill', rarity: 'uncommon', cost: 1, target: 'ally',
  effects: [{ k: 'block', n: 8 }], upEffects: [{ k: 'block', n: 12 }],
}))
reg(c({
  id: 'rationpack', name: 'Ration Pack', type: 'skill', rarity: 'common', cost: 0, target: 'ally',
  exhaust: true, upExhaust: true,
  effects: [{ k: 'heal', n: 4 }, { k: 'block', n: 4 }],
  upEffects: [{ k: 'heal', n: 6 }, { k: 'block', n: 6 }],
}))

reg(c({
  id: 'summonproxy', name: 'Summon: Proxy Worm', type: 'skill', rarity: 'uncommon', char: 'runner', cost: 1, target: 'none',
  effects: [{ k: 'summonAlly', id: 'proxyworm' }],
  upEffects: [{ k: 'summonAlly', id: 'proxyhydra' }],
  flavor: 'it tunnels so you do not have to',
}))
reg(c({
  id: 'summoncinder', name: 'Summon: Cinder Imp', type: 'skill', rarity: 'uncommon', char: 'vector', cost: 1, target: 'none',
  effects: [{ k: 'summonAlly', id: 'cinderimp' }],
  upEffects: [{ k: 'summonAlly', id: 'cinderfiend' }],
  flavor: 'it bites AND feeds the furnace',
}))
reg(c({
  id: 'summonshade', name: 'Summon: Dusk Shade', type: 'skill', rarity: 'uncommon', char: 'ghost', cost: 1, target: 'none',
  effects: [{ k: 'summonAlly', id: 'duskshade' }],
  upEffects: [{ k: 'summonAlly', id: 'duskwraith' }],
  flavor: 'a sliver of you, sharpened',
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
    case 'dmgPerAuto':
      return `Deal ${e.base} damage, plus ${e.per} per automation stack (Turret, Plating, Viral).`
    case 'summonAlly': {
      const who = `${minionName(e.id)} (${minionDesc(e.id)})`
      return e.n && e.n > 1 ? `Summon ${e.n} ${who}.` : `Summon a ${who}.`
    }
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
    case 'dmgPerAuto':
      return `造成 ${e.base} 点伤害，每层自动装置（炮塔、镀层、病毒扩散）额外 +${e.per} 点。`
    case 'summonAlly': {
      const who = `${minionName(e.id)}（${minionDesc(e.id)}）`
      return e.n && e.n > 1 ? `召唤 ${e.n} 个${who}。` : `召唤一个${who}。`
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
  if (def.target === 'ally') parts.push(ES.ally())
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
