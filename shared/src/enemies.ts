import type { CombatState, EnemyC, EnemyDef, Intent, IntentKind, MoveDef } from './types'
import { weightedPick, type Rng } from './rng'
import { modifiedDamage } from './core'
import { isZh, statusName } from './i18n'
import { ENEMY_ZH } from './locale-zh'
import { ascensionEnemyAttack } from './ascension'

const E = (def: EnemyDef) => def

export const ENEMIES: Record<string, EnemyDef> = {}
function reg(def: EnemyDef) {
  ENEMIES[def.id] = def
}

// --- Act 1 ------------------------------------------------------------------

reg(E({
  id: 'spambot', name: 'Spam Bot', glyph: '🤖', hp: [20, 25],
  moves: [
    { id: 'ping', name: 'Ping', weight: 3, effects: [{ k: 'atk', n: 5 }] },
    { id: 'flood', name: 'Flood', weight: 3, effects: [{ k: 'atk', n: 2, times: 3 }] },
    { id: 'popup', name: 'Pop-Up', weight: 2, maxRepeat: 1, effects: [{ k: 'debuff', id: 'weak', n: 1 }] },
  ],
}))
reg(E({
  id: 'drone', name: 'Patrol Drone', glyph: '🛸', hp: [28, 34],
  moves: [
    { id: 'laser', name: 'Laser', weight: 3, effects: [{ k: 'atk', n: 7 }] },
    { id: 'shield', name: 'Shield Up', weight: 2, maxRepeat: 1, effects: [{ k: 'block', n: 8 }] },
    { id: 'ram', name: 'Ram', weight: 2, cooldown: 2, effects: [{ k: 'atk', n: 11 }] },
  ],
}))
reg(E({
  id: 'kiddie', name: 'Script Kiddie', glyph: '👾', hp: [24, 30],
  moves: [
    { id: 'inject', name: 'Inject', weight: 3, effects: [{ k: 'atk', n: 5 }, { k: 'debuff', id: 'corrupt', n: 2 }] },
    { id: 'brag', name: 'Brag', weight: 1, maxRepeat: 1, effects: [{ k: 'buff', id: 'str', n: 2 }] },
    { id: 'smash', name: 'Keyboard Smash', weight: 2, effects: [{ k: 'atk', n: 8 }] },
  ],
}))
reg(E({
  id: 'golem', name: 'Firewall Golem', glyph: '🗿', hp: [42, 48],
  moves: [
    { id: 'fortify', name: 'Fortify', weight: 2, maxRepeat: 1, effects: [{ k: 'block', n: 9 }, { k: 'buff', id: 'str', n: 1 }] },
    { id: 'slam', name: 'Slam', weight: 3, effects: [{ k: 'atk', n: 9 }] },
    { id: 'bash', name: 'Bash', weight: 2, effects: [{ k: 'atk', n: 6 }, { k: 'debuff', id: 'weak', n: 1 }] },
  ],
}))
reg(E({
  id: 'hatchery', name: 'Hatchery', glyph: '☗', hp: [30, 36],
  moves: [
    { id: 'spawn', name: 'Spawn', weight: 2, maxRepeat: 1, effects: [{ k: 'summon', id: 'spambot' }] },
    { id: 'spit', name: 'Acid Spit', weight: 2, effects: [{ k: 'atk', n: 6 }] },
    { id: 'shell', name: 'Shell Up', weight: 1, maxRepeat: 1, effects: [{ k: 'block', n: 7 }] },
  ],
}))
reg(E({
  id: 'hound', name: 'Cyber Hound', glyph: '🐺', hp: [64, 70],
  moves: [
    { id: 'maul', name: 'Maul', weight: 3, effects: [{ k: 'atk', n: 12 }] },
    { id: 'rend', name: 'Rend', weight: 2, effects: [{ k: 'atk', n: 7 }, { k: 'debuff', id: 'vuln', n: 2 }] },
    { id: 'howl', name: 'Howl', weight: 2, maxRepeat: 1, effects: [{ k: 'buff', id: 'str', n: 2 }] },
  ],
}))
reg(E({
  id: 'compiler', name: 'THE COMPILER', glyph: '💽', hp: [120, 120], boss: true,
  moves: [
    { id: 'compile', name: 'Compile', weight: 2, maxRepeat: 1, effects: [{ k: 'block', n: 12 }, { k: 'buff', id: 'str', n: 2 }] },
    { id: 'execute', name: 'Execute', weight: 3, cooldown: 1, effects: [{ k: 'atk', n: 16 }] },
    { id: 'forloop', name: 'For Loop', weight: 2, effects: [{ k: 'atk', n: 5, times: 3 }] },
    { id: 'segfault', name: 'Segfault', weight: 2, cooldown: 2, effects: [{ k: 'atk', n: 8 }, { k: 'debuff', id: 'vuln', n: 2 }] },
    { id: 'recompile', name: 'RECOMPILE', weight: 14, cond: { hpBelow: 0.5, once: true }, effects: [{ k: 'cleanseSelf' }, { k: 'block', n: 20 }, { k: 'buff', id: 'str', n: 3 }] },
  ],
}))

reg(E({
  id: 'leech', name: 'Cache Leech', glyph: '🪱', hp: [26, 30],
  moves: [
    { id: 'siphon', name: 'Siphon', weight: 3, effects: [{ k: 'atk', n: 5 }, { k: 'heal', n: 5 }] },
    { id: 'numb', name: 'Numbing Coat', weight: 2, maxRepeat: 1, effects: [{ k: 'debuff', id: 'weak', n: 1 }] },
    { id: 'gnaw', name: 'Gnaw', weight: 2, effects: [{ k: 'atk', n: 7 }] },
  ],
}))
reg(E({
  id: 'watchdog', name: 'WATCHDOG PRIME', glyph: '🐕', hp: [115, 115], boss: true,
  moves: [
    { id: 'bark', name: 'Bark Signal', weight: 2, maxRepeat: 1, effects: [{ k: 'buff', id: 'str', n: 2 }, { k: 'block', n: 8 }] },
    { id: 'bite', name: 'Bite', weight: 3, effects: [{ k: 'atk', n: 7, times: 2 }] },
    { id: 'pounce', name: 'Pounce', weight: 2, cooldown: 1, effects: [{ k: 'atk', n: 13 }] },
    { id: 'leash', name: 'SNAPPED LEASH', weight: 13, cond: { hpBelow: 0.5, once: true }, effects: [{ k: 'cleanseSelf' }, { k: 'buff', id: 'thorns', n: 3 }, { k: 'buff', id: 'str', n: 2 }] },
  ],
}))

// --- Act 2 ------------------------------------------------------------------

reg(E({
  id: 'ice', name: 'ICE Shard', glyph: '🧊', hp: [36, 42],
  moves: [
    { id: 'freeze', name: 'Freeze Ray', weight: 3, effects: [{ k: 'atk', n: 9 }] },
    { id: 'harden', name: 'Harden', weight: 2, maxRepeat: 1, effects: [{ k: 'block', n: 11 }] },
    { id: 'shatter', name: 'Shatter', weight: 2, cooldown: 2, effects: [{ k: 'atk', n: 14 }] },
  ],
}))
reg(E({
  id: 'netrunner', name: 'Netrunner', glyph: '🥷', hp: [44, 50],
  moves: [
    { id: 'jackin', name: 'Jack In', weight: 3, effects: [{ k: 'atk', n: 8 }, { k: 'debuff', id: 'weak', n: 1 }] },
    { id: 'ddos', name: 'DDoS', weight: 2, effects: [{ k: 'atk', n: 4, times: 3 }] },
    { id: 'siphon', name: 'Siphon', weight: 2, cooldown: 1, effects: [{ k: 'atk', n: 6 }, { k: 'heal', n: 6 }] },
  ],
}))
reg(E({
  id: 'daemon', name: 'Proxy Daemon', glyph: '😈', hp: [48, 56],
  moves: [
    { id: 'curse', name: 'Corrupt Data', weight: 2, maxRepeat: 1, effects: [{ k: 'debuff', id: 'corrupt', n: 3 }] },
    { id: 'blast', name: 'Hex Blast', weight: 3, effects: [{ k: 'atk', n: 11 }] },
    { id: 'rally', name: 'Rally', weight: 2, maxRepeat: 1, effects: [{ k: 'buffAll', id: 'str', n: 2 }] },
  ],
}))
reg(E({
  id: 'sentry', name: 'Turret Sentry', glyph: '📡', hp: [34, 40],
  traits: { thorns: 2 },
  moves: [
    { id: 'snipe', name: 'Snipe', weight: 3, effects: [{ k: 'atk', n: 12 }] },
    { id: 'lockon', name: 'Lock On', weight: 2, maxRepeat: 1, effects: [{ k: 'debuff', id: 'vuln', n: 2 }] },
    { id: 'reinforce', name: 'Reinforce', weight: 2, maxRepeat: 1, effects: [{ k: 'block', n: 8 }, { k: 'buff', id: 'thorns', n: 1 }] },
  ],
}))
reg(E({
  id: 'subproc', name: 'Sub-Process', glyph: '·', hp: [13, 16],
  moves: [
    { id: 'nip', name: 'Nip', weight: 3, effects: [{ k: 'atk', n: 4 }] },
    { id: 'feed', name: 'Feed Cycles', weight: 1, maxRepeat: 1, effects: [{ k: 'buffAll', id: 'str', n: 1 }] },
  ],
}))
reg(E({
  id: 'loadbalancer', name: 'Load Balancer', glyph: '⌸', hp: [46, 54],
  moves: [
    { id: 'forkchild', name: 'fork()', weight: 3, maxRepeat: 2, effects: [{ k: 'summon', id: 'subproc' }] },
    { id: 'rebalance', name: 'Rebalance', weight: 2, maxRepeat: 1, effects: [{ k: 'block', n: 9 }, { k: 'buffAll', id: 'str', n: 1 }] },
    { id: 'swapout', name: 'Swap Out', weight: 2, effects: [{ k: 'atk', n: 9 }] },
  ],
}))
reg(E({
  id: 'blackice', name: 'BLACK ICE', glyph: '🕸', hp: [96, 104],
  traits: { thorns: 3 },
  moves: [
    { id: 'crush', name: 'Crush', weight: 3, effects: [{ k: 'atk', n: 16 }] },
    { id: 'freezewall', name: 'Freeze Wall', weight: 2, maxRepeat: 1, effects: [{ k: 'block', n: 14 }, { k: 'buff', id: 'str', n: 1 }] },
    { id: 'lockdown', name: 'Lockdown', weight: 2, cooldown: 1, effects: [{ k: 'debuff', id: 'weak', n: 2 }, { k: 'debuff', id: 'vuln', n: 1 }] },
  ],
}))
reg(E({
  id: 'mainframe', name: 'MAINFRAME', glyph: '🖥', hp: [190, 190], boss: true,
  moves: [
    { id: 'firewall', name: 'Firewall', weight: 2, maxRepeat: 1, effects: [{ k: 'block', n: 18 }, { k: 'buff', id: 'str', n: 2 }] },
    { id: 'purgebeam', name: 'Purge Beam', weight: 2, cooldown: 2, effects: [{ k: 'atk', n: 22 }] },
    { id: 'forkproc', name: 'Fork Process', weight: 3, effects: [{ k: 'atk', n: 8, times: 2 }, { k: 'debuff', id: 'weak', n: 1 }] },
    { id: 'corruptdata', name: 'Corrupt Data', weight: 2, cooldown: 2, effects: [{ k: 'addCard', id: 'glitch', n: 2 }, { k: 'debuff', id: 'corrupt', n: 3 }] },
    { id: 'hotreboot', name: 'HOT REBOOT', weight: 14, cond: { hpBelow: 0.5, once: true }, effects: [{ k: 'cleanseSelf' }, { k: 'heal', n: 25 }, { k: 'summon', id: 'sentry' }] },
  ],
}))

reg(E({
  id: 'minelayer', name: 'Mine Layer', glyph: '💣', hp: [44, 50],
  moves: [
    { id: 'seed', name: 'Seed Mines', weight: 3, maxRepeat: 2, effects: [{ k: 'addCard', id: 'glitch', n: 1 }, { k: 'block', n: 5 }] },
    { id: 'shrapnel', name: 'Shrapnel', weight: 3, effects: [{ k: 'atk', n: 4, times: 2 }] },
    { id: 'detonate', name: 'Detonate', weight: 2, cooldown: 2, effects: [{ k: 'atk', n: 14 }] },
  ],
}))
reg(E({
  id: 'overseer', name: 'Overseer', glyph: '👁', hp: [92, 98],
  traits: { artifact: 1 },
  moves: [
    { id: 'judge', name: 'Judgement', weight: 3, effects: [{ k: 'atk', n: 12 }, { k: 'debuff', id: 'weak', n: 1 }] },
    { id: 'decree', name: 'Decree', weight: 2, maxRepeat: 1, effects: [{ k: 'buff', id: 'str', n: 2 }, { k: 'block', n: 10 }] },
    { id: 'sentence', name: 'Sentence', weight: 2, cooldown: 2, effects: [{ k: 'atk', n: 18 }] },
  ],
}))
reg(E({
  id: 'botnetlord', name: 'BOTNET GENERAL', glyph: '🎖', hp: [175, 175], boss: true,
  moves: [
    { id: 'conscript', name: 'Conscript', weight: 3, maxRepeat: 2, effects: [{ k: 'summon', id: 'subproc' }] },
    { id: 'command', name: 'Command Volley', weight: 3, effects: [{ k: 'atk', n: 9, times: 2 }] },
    { id: 'rally', name: 'Rally', weight: 2, maxRepeat: 1, effects: [{ k: 'block', n: 14 }, { k: 'buff', id: 'str', n: 2 }] },
    { id: 'surge2', name: 'FULL MOBILIZATION', weight: 13, cond: { hpBelow: 0.5, once: true }, effects: [{ k: 'summon', id: 'subproc', n: 2 }, { k: 'buff', id: 'str', n: 2 }] },
  ],
}))

// --- Act 3 ------------------------------------------------------------------

reg(E({
  id: 'nullptr', name: 'Null Pointer', glyph: '💀', hp: [52, 60],
  moves: [
    { id: 'deref', name: 'Dereference', weight: 3, effects: [{ k: 'atk', n: 14 }] },
    { id: 'void', name: 'Void Guard', weight: 2, maxRepeat: 1, effects: [{ k: 'block', n: 12 }] },
    { id: 'leak', name: 'Memory Leak', weight: 2, maxRepeat: 1, effects: [{ k: 'debuff', id: 'corrupt', n: 4 }] },
  ],
}))
reg(E({
  id: 'wraith', name: 'Quantum Wraith', glyph: '👻', hp: [56, 64],
  moves: [
    { id: 'phase', name: 'Phase Strike', weight: 3, effects: [{ k: 'atk', n: 9, times: 2 }] },
    { id: 'blur', name: 'Blur', weight: 2, maxRepeat: 1, effects: [{ k: 'block', n: 10 }, { k: 'debuff', id: 'weak', n: 1 }] },
    { id: 'collapse', name: 'Collapse', weight: 2, cooldown: 2, effects: [{ k: 'atk', n: 19 }] },
  ],
}))
reg(E({
  id: 'botnode', name: 'Botnet Node', glyph: '🕷', hp: [26, 30],
  moves: [
    { id: 'pester', name: 'Pester', weight: 3, effects: [{ k: 'atk', n: 6 }] },
    { id: 'sync', name: 'Sync', weight: 2, maxRepeat: 1, effects: [{ k: 'buffAll', id: 'str', n: 1 }] },
    { id: 'guard', name: 'Guard', weight: 1, effects: [{ k: 'block', n: 6 }] },
  ],
}))
reg(E({
  id: 'hivemind', name: 'Hive Mind', glyph: '◈', hp: [66, 74],
  moves: [
    { id: 'assimilate', name: 'Assimilate', weight: 3, maxRepeat: 2, effects: [{ k: 'summon', id: 'botnode' }] },
    { id: 'mindlash', name: 'Mind Lash', weight: 2, effects: [{ k: 'atk', n: 11 }] },
    { id: 'sync-all', name: 'Synchronize', weight: 2, maxRepeat: 1, effects: [{ k: 'buffAll', id: 'str', n: 1 }] },
  ],
}))
reg(E({
  id: 'rootdaemon', name: 'ROOT DAEMON', glyph: '🐲', hp: [130, 140],
  traits: { str: 2, artifact: 1 },
  moves: [
    { id: 'sudo', name: 'Sudo', weight: 1, maxRepeat: 1, effects: [{ k: 'buff', id: 'str', n: 3 }] },
    { id: 'smite', name: 'Smite', weight: 3, effects: [{ k: 'atk', n: 20 }] },
    { id: 'chainatk', name: 'Chain Attack', weight: 2, effects: [{ k: 'atk', n: 7, times: 3 }] },
  ],
}))
reg(E({
  id: 'architect', name: 'THE ARCHITECT', glyph: '🌐', hp: [280, 280], boss: true,
  moves: [
    { id: 'genesis', name: 'Genesis Build', weight: 2, maxRepeat: 1, effects: [{ k: 'block', n: 20 }, { k: 'buff', id: 'str', n: 3 }] },
    { id: 'deleterow', name: 'DELETE ROW', weight: 2, cooldown: 2, effects: [{ k: 'atk', n: 26 }] },
    { id: 'rewrite', name: 'Rewrite', weight: 2, cooldown: 2, effects: [{ k: 'addCard', id: 'glitch', n: 2 }, { k: 'debuff', id: 'weak', n: 2 }] },
    { id: 'cascade', name: 'Cascade', weight: 3, effects: [{ k: 'atk', n: 9, times: 3 }] },
    { id: 'awaken', name: 'AWAKEN', weight: 12, cond: { hpBelow: 0.5, once: true }, effects: [{ k: 'buff', id: 'str', n: 4 }, { k: 'buff', id: 'ritual', n: 1 }, { k: 'summon', id: 'botnode', n: 2 }] },
  ],
}))

reg(E({
  id: 'phantom', name: 'Phantom Process', glyph: '👻', hp: [40, 46],
  // Permanent Stealth: everything you throw at it lands at half strength.
  traits: { stealth: 1 },
  moves: [
    { id: 'haunt', name: 'Haunt', weight: 3, effects: [{ k: 'atk', n: 11 }] },
    { id: 'dread', name: 'Dread', weight: 2, maxRepeat: 1, effects: [{ k: 'debuff', id: 'weak', n: 2 }] },
    { id: 'shriek', name: 'Shriek', weight: 2, cooldown: 1, effects: [{ k: 'atk', n: 7 }, { k: 'debuff', id: 'vuln', n: 1 }] },
  ],
}))
reg(E({
  id: 'nullmonarch', name: 'NULL MONARCH', glyph: '👑', hp: [265, 265], boss: true,
  moves: [
    { id: 'decay', name: 'Decay Edict', weight: 3, effects: [{ k: 'atk', n: 10 }, { k: 'debuff', id: 'corrupt', n: 4 }] },
    { id: 'voidlance', name: 'Void Lance', weight: 2, cooldown: 2, effects: [{ k: 'atk', n: 24 }] },
    { id: 'crown', name: 'Hollow Crown', weight: 2, maxRepeat: 1, effects: [{ k: 'block', n: 16 }, { k: 'buff', id: 'plating', n: 3 }] },
    { id: 'coronation', name: 'DARK CORONATION', weight: 13, cond: { hpBelow: 0.5, once: true }, effects: [{ k: 'cleanseSelf' }, { k: 'buff', id: 'artifact', n: 2 }, { k: 'buff', id: 'str', n: 3 }] },
  ],
}))

// --- Act 4: THE ROOT --------------------------------------------------------

reg(E({
  id: 'spearproc', name: 'Spear Process', glyph: '⚚', hp: [88, 88],
  moves: [
    { id: 'skewer', name: 'Skewer', weight: 3, effects: [{ k: 'atk', n: 8, times: 3 }] },
    { id: 'pierce', name: 'Pierce', weight: 2, cooldown: 1, effects: [{ k: 'atk', n: 18 }, { k: 'debuff', id: 'vuln', n: 2 }] },
    { id: 'sharpen', name: 'Sharpen', weight: 1, maxRepeat: 1, effects: [{ k: 'buff', id: 'str', n: 3 }] },
  ],
}))
reg(E({
  id: 'shieldproc', name: 'Shield Process', glyph: '⛨', hp: [110, 110],
  traits: { plating: 3 },
  moves: [
    { id: 'bulwark', name: 'Bulwark', weight: 2, maxRepeat: 1, effects: [{ k: 'block', n: 22 }] },
    { id: 'bashwall', name: 'Wall Bash', weight: 3, effects: [{ k: 'atk', n: 13 }] },
    { id: 'mend', name: 'Mend', weight: 1, cooldown: 2, effects: [{ k: 'heal', n: 14 }, { k: 'block', n: 10 }] },
    { id: 'suppress', name: 'Suppress', weight: 2, cooldown: 1, effects: [{ k: 'debuff', id: 'weak', n: 2 }] },
  ],
}))
reg(E({
  id: 'theroot', name: 'THE ROOT', glyph: '⌬', hp: [400, 400], boss: true,
  // Ritual makes it hit harder every single turn — the clock you race.
  // Artifact blunts opening debuff stacks; you must chew through it first.
  traits: { ritual: 1, artifact: 2 },
  moves: [
    { id: 'rootpulse', name: 'Root Pulse', weight: 3, effects: [{ k: 'atk', n: 10, times: 2 }] },
    { id: 'overwrite', name: 'OVERWRITE', weight: 2, cooldown: 2, effects: [{ k: 'atk', n: 30 }] },
    { id: 'nullwave', name: 'Null Wave', weight: 2, cooldown: 2, effects: [{ k: 'debuff', id: 'weak', n: 2 }, { k: 'debuff', id: 'corrupt', n: 4 }] },
    { id: 'regrow', name: 'Regrow', weight: 1, maxRepeat: 1, effects: [{ k: 'block', n: 24 }, { k: 'heal', n: 12 }] },
    { id: 'metastasize', name: 'METASTASIZE', weight: 12, cond: { hpBelow: 0.66, once: true }, effects: [{ k: 'buff', id: 'str', n: 2 }, { k: 'summon', id: 'botnode', n: 2 }] },
    { id: 'singularity', name: 'SINGULARITY', weight: 14, cond: { hpBelow: 0.33, once: true }, effects: [{ k: 'cleanseSelf' }, { k: 'block', n: 30 }, { k: 'buff', id: 'str', n: 4 }] },
  ],
}))

// --- Volume: cycle 39 — act 1 ------------------------------------------------

reg(E({ id: 'bitrat', name: 'Bit Rat', glyph: '¤', hp: [14, 18], moves: [
  { id: 'gnaw', name: 'Gnaw', weight: 3, effects: [{ k: 'atk', n: 4 }] },
  { id: 'scurry', name: 'Scurry', weight: 1, maxRepeat: 1, effects: [{ k: 'block', n: 4 }] },
] }))
reg(E({ id: 'adfly', name: 'Ad Fly', glyph: '✕', hp: [16, 20], moves: [
  { id: 'popup', name: 'Pop-Up', weight: 2, maxRepeat: 1, effects: [{ k: 'debuff', id: 'weak', n: 1 }] },
  { id: 'swarmbite', name: 'Swarm Bite', weight: 3, effects: [{ k: 'atk', n: 3, times: 2 }] },
] }))
reg(E({ id: 'cursorghoul', name: 'Cursor Ghoul', glyph: '➤', hp: [26, 32], moves: [
  { id: 'click', name: 'Click', weight: 3, effects: [{ k: 'atk', n: 6 }] },
  { id: 'dblclick', name: 'Double Click', weight: 2, cooldown: 1, effects: [{ k: 'atk', n: 4, times: 2 }] },
  { id: 'hover', name: 'Hover', weight: 1, maxRepeat: 1, effects: [{ k: 'block', n: 6 }] },
] }))
reg(E({ id: 'staticjelly', name: 'Static Jelly', glyph: '≋', hp: [30, 36], traits: { thorns: 2 }, moves: [
  { id: 'wobble', name: 'Wobble', weight: 2, maxRepeat: 1, effects: [{ k: 'block', n: 7 }] },
  { id: 'zap', name: 'Zap', weight: 3, effects: [{ k: 'atk', n: 6 }] },
  { id: 'discharge', name: 'Discharge', weight: 1, cooldown: 2, effects: [{ k: 'atk', n: 9 }, { k: 'buff', id: 'thorns', n: 1 }] },
] }))
reg(E({ id: 'packmule', name: 'Pack Mule', glyph: '▦', hp: [38, 44], moves: [
  { id: 'trample', name: 'Trample', weight: 3, effects: [{ k: 'atk', n: 8 }] },
  { id: 'unload', name: 'Unload', weight: 1, cooldown: 2, effects: [{ k: 'heal', n: 8 }, { k: 'block', n: 6 }] },
  { id: 'brace', name: 'Brace', weight: 2, maxRepeat: 1, effects: [{ k: 'block', n: 8 }] },
] }))
reg(E({ id: 'popupspawner', name: 'Pop-Up Spawner', glyph: '⧉', hp: [32, 38], moves: [
  { id: 'spawnad', name: 'Spawn Ad', weight: 3, maxRepeat: 1, effects: [{ k: 'summon', id: 'adfly' }] },
  { id: 'flashbang', name: 'Flashbang', weight: 2, effects: [{ k: 'atk', n: 5 }, { k: 'debuff', id: 'weak', n: 1 }] },
] }))
reg(E({ id: 'lintbeast', name: 'Lint Beast', glyph: '๛', hp: [40, 46], moves: [
  { id: 'nag', name: 'Nag', weight: 2, effects: [{ k: 'debuff', id: 'vuln', n: 2 }] },
  { id: 'swat', name: 'Swat', weight: 3, effects: [{ k: 'atk', n: 9 }] },
  { id: 'strictmode', name: 'Strict Mode', weight: 1, maxRepeat: 1, effects: [{ k: 'buff', id: 'str', n: 2 }] },
] }))
reg(E({ id: 'firewallwarden', name: 'Firewall Warden', glyph: '⛩', hp: [72, 80], traits: { artifact: 1 }, moves: [
  { id: 'gateclose', name: 'Gate Close', weight: 2, maxRepeat: 1, effects: [{ k: 'block', n: 12 }] },
  { id: 'sentence', name: 'Sentence', weight: 3, effects: [{ k: 'atk', n: 11 }] },
  { id: 'judgement', name: 'Judgement', weight: 2, cooldown: 2, effects: [{ k: 'atk', n: 7 }, { k: 'debuff', id: 'vuln', n: 2 }] },
] }))

// --- Volume: cycle 39 — act 2 ------------------------------------------------

reg(E({ id: 'proxyshark', name: 'Proxy Shark', glyph: '⋙', hp: [44, 52], moves: [
  { id: 'circle', name: 'Circle', weight: 1, maxRepeat: 1, effects: [{ k: 'buff', id: 'str', n: 2 }] },
  { id: 'breach', name: 'Breach', weight: 3, effects: [{ k: 'atk', n: 12 }] },
  { id: 'frenzy', name: 'Frenzy', weight: 2, cooldown: 2, effects: [{ k: 'atk', n: 5, times: 3 }] },
] }))
reg(E({ id: 'tokenthief', name: 'Token Thief', glyph: '¢', hp: [40, 46], moves: [
  { id: 'skim', name: 'Skim', weight: 3, effects: [{ k: 'atk', n: 7 }, { k: 'debuff', id: 'weak', n: 1 }] },
  { id: 'vanishcloak', name: 'Vanish', weight: 2, maxRepeat: 1, effects: [{ k: 'block', n: 10 }] },
  { id: 'fence', name: 'Fence', weight: 1, cooldown: 2, effects: [{ k: 'heal', n: 6 }, { k: 'buff', id: 'str', n: 1 }] },
] }))
reg(E({ id: 'voltmoth', name: 'Volt Moth', glyph: '∿', hp: [36, 42], moves: [
  { id: 'dustshed', name: 'Dust Shed', weight: 2, effects: [{ k: 'debuff', id: 'corrupt', n: 3 }] },
  { id: 'flutter', name: 'Flutter', weight: 2, effects: [{ k: 'atk', n: 6 }] },
  { id: 'lamplight', name: 'Lamplight', weight: 1, maxRepeat: 1, effects: [{ k: 'buffAll', id: 'str', n: 1 }] },
] }))
reg(E({ id: 'coldstorage', name: 'Cold Storage', glyph: '❆', hp: [56, 64], traits: { plating: 2 }, moves: [
  { id: 'freeze', name: 'Freeze', weight: 2, effects: [{ k: 'debuff', id: 'weak', n: 2 }] },
  { id: 'icefall', name: 'Icefall', weight: 3, effects: [{ k: 'atk', n: 10 }] },
  { id: 'defrag2', name: 'Defrost', weight: 1, cooldown: 2, effects: [{ k: 'heal', n: 10 }] },
] }))
reg(E({ id: 'quicksort', name: 'Quicksort', glyph: '⇅', hp: [42, 50], moves: [
  { id: 'partition', name: 'Partition', weight: 3, effects: [{ k: 'atk', n: 4, times: 3 }] },
  { id: 'pivot', name: 'Pivot', weight: 2, maxRepeat: 1, effects: [{ k: 'block', n: 8 }, { k: 'buff', id: 'str', n: 1 }] },
] }))
reg(E({ id: 'stackghast', name: 'Stack Ghast', glyph: '≡', hp: [48, 56], moves: [
  { id: 'pushframe', name: 'Push Frame', weight: 2, effects: [{ k: 'buff', id: 'plating', n: 2 }] },
  { id: 'popframe', name: 'Pop Frame', weight: 3, effects: [{ k: 'atk', n: 9 }] },
  { id: 'overflow2', name: 'Overflow', weight: 1, cooldown: 2, effects: [{ k: 'atk', n: 6 }, { k: 'debuff', id: 'corrupt', n: 2 }] },
] }))
reg(E({ id: 'loadmaster', name: 'Loadmaster', glyph: '⚓', hp: [88, 96], moves: [
  { id: 'conscript', name: 'Conscript', weight: 2, maxRepeat: 1, effects: [{ k: 'summon', id: 'bitrat', n: 2 }] },
  { id: 'crane', name: 'Crane Swing', weight: 3, effects: [{ k: 'atk', n: 13 }] },
  { id: 'ballast', name: 'Ballast', weight: 1, maxRepeat: 1, effects: [{ k: 'block', n: 14 }, { k: 'buff', id: 'str', n: 1 }] },
] }))

// --- Volume: cycle 39 — act 3 / 4 + bosses ----------------------------------

reg(E({ id: 'nullhound', name: 'Null Hound', glyph: '∅', hp: [58, 66], moves: [
  { id: 'voidbite', name: 'Void Bite', weight: 3, effects: [{ k: 'atk', n: 14 }] },
  { id: 'erase', name: 'Erase', weight: 2, cooldown: 1, effects: [{ k: 'atk', n: 9 }, { k: 'debuff', id: 'weak', n: 2 }] },
  { id: 'stalk', name: 'Stalk', weight: 1, maxRepeat: 1, effects: [{ k: 'buff', id: 'str', n: 3 }] },
] }))
reg(E({ id: 'panicdaemon', name: 'Panic Daemon', glyph: '⁉', hp: [50, 58], moves: [
  { id: 'lagbomb', name: 'Lag Bomb', weight: 2, cooldown: 2, effects: [{ k: 'addCard', id: 'lag', n: 1 }, { k: 'atk', n: 6 }] },
  { id: 'shriek', name: 'Shriek', weight: 3, effects: [{ k: 'atk', n: 11 }] },
  { id: 'jitter', name: 'Jitter', weight: 2, maxRepeat: 1, effects: [{ k: 'block', n: 10 }] },
] }))
reg(E({ id: 'memleech', name: 'Memory Leech', glyph: '⌇', hp: [54, 62], moves: [
  { id: 'drain', name: 'Drain', weight: 3, effects: [{ k: 'atk', n: 9 }, { k: 'heal', n: 9 }] },
  { id: 'bloat', name: 'Bloat', weight: 2, maxRepeat: 1, effects: [{ k: 'heal', n: 12 }, { k: 'block', n: 8 }] },
  { id: 'burst2', name: 'Burst', weight: 2, cooldown: 2, effects: [{ k: 'atk', n: 15 }] },
] }))
reg(E({ id: 'forkbomblet', name: 'Forklet', glyph: '⑂', hp: [10, 12], moves: [
  { id: 'pop2', name: 'Pop', weight: 3, effects: [{ k: 'atk', n: 5 }] },
] }))
reg(E({ id: 'forkbomb', name: 'Fork Bomb', glyph: '⑃', hp: [46, 54], moves: [
  { id: 'forkfork', name: 'fork(fork())', weight: 3, maxRepeat: 2, effects: [{ k: 'summon', id: 'forkbomblet', n: 2 }] },
  { id: 'detonate', name: 'Detonate', weight: 2, cooldown: 2, effects: [{ k: 'atk', n: 13 }] },
] }))
reg(E({ id: 'ossifier', name: 'Ossifier', glyph: '▓', hp: [64, 72], traits: { plating: 3 }, moves: [
  { id: 'calcify', name: 'Calcify', weight: 2, maxRepeat: 1, effects: [{ k: 'block', n: 12 }, { k: 'buff', id: 'plating', n: 1 }] },
  { id: 'stonefist', name: 'Stone Fist', weight: 3, effects: [{ k: 'atk', n: 12 }] },
  { id: 'petrify', name: 'Petrify', weight: 2, cooldown: 2, effects: [{ k: 'debuff', id: 'weak', n: 2 }] },
] }))
reg(E({ id: 'gatekeeper', name: 'Gatekeeper', glyph: '⌥', hp: [98, 108], traits: { artifact: 2 }, moves: [
  { id: 'authdeny', name: 'AUTH DENY', weight: 2, cooldown: 1, effects: [{ k: 'atk', n: 10, times: 2 }] },
  { id: 'revoke', name: 'Revoke', weight: 2, effects: [{ k: 'debuff', id: 'vuln', n: 2 }, { k: 'debuff', id: 'weak', n: 1 }] },
  { id: 'seal', name: 'Seal', weight: 2, maxRepeat: 1, effects: [{ k: 'block', n: 16 }] },
  { id: 'purge2', name: 'PURGE', weight: 12, cond: { hpBelow: 0.5, once: true }, effects: [{ k: 'cleanseSelf' }, { k: 'buff', id: 'str', n: 3 }] },
] }))
reg(E({ id: 'rootling', name: 'Rootling', glyph: '⌔', hp: [30, 36], moves: [
  { id: 'lash', name: 'Lash', weight: 3, effects: [{ k: 'atk', n: 8 }] },
  { id: 'burrow', name: 'Burrow', weight: 1, maxRepeat: 1, effects: [{ k: 'block', n: 9 }] },
] }))
reg(E({ id: 'sporewall', name: 'Spore Wall', glyph: '▒', hp: [70, 80], traits: { thorns: 3, plating: 2 }, moves: [
  { id: 'sporeburst', name: 'Spore Burst', weight: 2, effects: [{ k: 'debuff', id: 'corrupt', n: 4 }] },
  { id: 'wallcrush', name: 'Wall Crush', weight: 3, effects: [{ k: 'atk', n: 13 }] },
  { id: 'regrow2', name: 'Regrow', weight: 1, cooldown: 2, effects: [{ k: 'heal', n: 14 }] },
] }))

reg(E({ id: 'daemoncore', name: 'DAEMON CORE', glyph: '◉', hp: [118, 118], boss: true, moves: [
  { id: 'spinup', name: 'Spin Up', weight: 2, maxRepeat: 1, effects: [{ k: 'buff', id: 'str', n: 2 }, { k: 'block', n: 10 }] },
  { id: 'coreburst', name: 'Core Burst', weight: 3, effects: [{ k: 'atk', n: 6, times: 2 }] },
  { id: 'meltcheck', name: 'Melt Check', weight: 2, cooldown: 2, effects: [{ k: 'atk', n: 14 }, { k: 'debuff', id: 'weak', n: 1 }] },
  { id: 'overclock2', name: 'OVERCLOCK', weight: 13, cond: { hpBelow: 0.5, once: true }, effects: [{ k: 'cleanseSelf' }, { k: 'buff', id: 'ritual', n: 1 }, { k: 'block', n: 12 }] },
] }))
reg(E({ id: 'garbagecollector', name: 'GARBAGE COLLECTOR', glyph: '♻', hp: [186, 186], boss: true, moves: [
  { id: 'sweepphase', name: 'Sweep Phase', weight: 3, effects: [{ k: 'atk', n: 9, times: 2 }] },
  { id: 'markphase', name: 'Mark Phase', weight: 2, effects: [{ k: 'debuff', id: 'vuln', n: 2 }, { k: 'debuff', id: 'corrupt', n: 2 }] },
  { id: 'compact', name: 'Compact', weight: 2, maxRepeat: 1, effects: [{ k: 'cleanseSelf' }, { k: 'block', n: 16 }] },
  { id: 'finalize', name: 'FINALIZE', weight: 13, cond: { hpBelow: 0.4, once: true }, effects: [{ k: 'buff', id: 'str', n: 4 }, { k: 'heal', n: 20 }] },
] }))
reg(E({ id: 'archivewarden', name: 'ARCHIVE WARDEN', glyph: '⍟', hp: [270, 270], boss: true, traits: { artifact: 1 }, moves: [
  { id: 'catalog', name: 'Catalog', weight: 2, maxRepeat: 1, effects: [{ k: 'block', n: 20 }, { k: 'buff', id: 'plating', n: 2 }] },
  { id: 'redact', name: 'REDACT', weight: 2, cooldown: 2, effects: [{ k: 'atk', n: 24 }] },
  { id: 'index', name: 'Index Strike', weight: 3, effects: [{ k: 'atk', n: 8, times: 3 }] },
  { id: 'checkout', name: 'Checkout', weight: 2, cooldown: 2, effects: [{ k: 'addCard', id: 'glitch', n: 2 }, { k: 'debuff', id: 'weak', n: 2 }] },
  { id: 'closestacks', name: 'CLOSE THE STACKS', weight: 12, cond: { hpBelow: 0.5, once: true }, effects: [{ k: 'cleanseSelf' }, { k: 'buff', id: 'str', n: 3 }, { k: 'summon', id: 'botnode', n: 2 }] },
] }))
reg(E({ id: 'singularityshard', name: 'SINGULARITY SHARD', glyph: '✦', hp: [265, 265], boss: true, traits: { artifact: 2, ritual: 1 }, moves: [
  { id: 'gravwell', name: 'Gravity Well', weight: 3, effects: [{ k: 'atk', n: 11, times: 2 }] },
  { id: 'lens', name: 'Lens Flare', weight: 2, cooldown: 1, effects: [{ k: 'debuff', id: 'vuln', n: 2 }, { k: 'atk', n: 8 }] },
  { id: 'accrete', name: 'Accrete', weight: 2, maxRepeat: 1, effects: [{ k: 'block', n: 18 }, { k: 'heal', n: 10 }] },
  { id: 'collapse', name: 'COLLAPSE', weight: 13, cond: { hpBelow: 0.33, once: true }, effects: [{ k: 'cleanseSelf' }, { k: 'buff', id: 'str', n: 5 }, { k: 'block', n: 25 }] },
] }))
reg(E({ id: 'rootkernel', name: 'THE ROOT: KERNEL', glyph: '⎈', hp: [420, 420], boss: true, traits: { ritual: 1, artifact: 2, thorns: 3 }, moves: [
  { id: 'kernelpanic2', name: 'KERNEL PANIC', weight: 2, cooldown: 2, effects: [{ k: 'atk', n: 34 }] },
  { id: 'interrupt', name: 'Interrupt', weight: 3, effects: [{ k: 'atk', n: 12, times: 2 }] },
  { id: 'syscall', name: 'Syscall', weight: 2, cooldown: 2, effects: [{ k: 'addCard', id: 'lag', n: 1 }, { k: 'debuff', id: 'corrupt', n: 4 }] },
  { id: 'ringzero', name: 'RING ZERO', weight: 13, cond: { hpBelow: 0.5, once: true }, effects: [{ k: 'cleanseSelf' }, { k: 'buff', id: 'str', n: 4 }, { k: 'summon', id: 'rootling', n: 2 }] },
] }))

// --- Volume: cycle 39 — batch 3 ---------------------------------------------

reg(E({ id: 'glitchmite', name: 'Glitch Mite', glyph: '·', hp: [12, 15], moves: [
  { id: 'nibble', name: 'Nibble', weight: 3, effects: [{ k: 'atk', n: 3 }] },
  { id: 'staticjolt', name: 'Static Jolt', weight: 1, effects: [{ k: 'debuff', id: 'weak', n: 1 }] },
] }))
reg(E({ id: 'wiremouse', name: 'Wire Mouse', glyph: '∽', hp: [18, 22], moves: [
  { id: 'chew', name: 'Chew', weight: 3, effects: [{ k: 'atk', n: 5 }] },
  { id: 'shortout', name: 'Short Out', weight: 2, cooldown: 2, effects: [{ k: 'atk', n: 3 }, { k: 'debuff', id: 'vuln', n: 1 }] },
] }))
reg(E({ id: 'phishfin', name: 'Phish Fin', glyph: '◃', hp: [24, 28], moves: [
  { id: 'lure', name: 'Lure', weight: 2, effects: [{ k: 'debuff', id: 'weak', n: 2 }] },
  { id: 'hookbite', name: 'Hook Bite', weight: 3, effects: [{ k: 'atk', n: 7 }] },
] }))
reg(E({ id: 'spamwhale', name: 'Spam Whale', glyph: '◖', hp: [52, 60], moves: [
  { id: 'broadcast2', name: 'Broadcast', weight: 2, effects: [{ k: 'summon', id: 'glitchmite', n: 2 }] },
  { id: 'bodyslam', name: 'Body Slam', weight: 3, effects: [{ k: 'atk', n: 11 }] },
  { id: 'blubber', name: 'Blubber', weight: 1, maxRepeat: 1, effects: [{ k: 'block', n: 12 }] },
] }))
reg(E({ id: 'boltcrab', name: 'Bolt Crab', glyph: '⊃', hp: [34, 40], traits: { plating: 1 }, moves: [
  { id: 'pinch', name: 'Pinch', weight: 3, effects: [{ k: 'atk', n: 4, times: 2 }] },
  { id: 'shellup2', name: 'Shell Up', weight: 2, maxRepeat: 1, effects: [{ k: 'block', n: 10 }] },
] }))
reg(E({ id: 'tapeworm', name: 'Tape Worm', glyph: '∫', hp: [40, 46], moves: [
  { id: 'coil', name: 'Coil', weight: 2, effects: [{ k: 'debuff', id: 'corrupt', n: 2 }] },
  { id: 'constrict', name: 'Constrict', weight: 3, effects: [{ k: 'atk', n: 8 }] },
  { id: 'rewind', name: 'Rewind', weight: 1, cooldown: 2, effects: [{ k: 'heal', n: 8 }] },
] }))
reg(E({ id: 'keylogger', name: 'Keylogger', glyph: '⌨', hp: [36, 42], moves: [
  { id: 'record', name: 'Record', weight: 2, maxRepeat: 1, effects: [{ k: 'buff', id: 'str', n: 2 }] },
  { id: 'playback', name: 'Playback', weight: 3, effects: [{ k: 'atk', n: 9 }] },
] }))
reg(E({ id: 'pixelmoth', name: 'Pixel Moth', glyph: '✸', hp: [24, 30], moves: [
  { id: 'flutter', name: 'Flutter', weight: 2, effects: [{ k: 'block', n: 5 }] },
  { id: 'nibble', name: 'Nibble', weight: 3, effects: [{ k: 'atk', n: 6 }] },
  { id: 'dust', name: 'Dust', weight: 1, maxRepeat: 1, effects: [{ k: 'debuff', id: 'weak', n: 1 }] },
] }))
reg(E({ id: 'hashrig', name: 'Hash Rig', glyph: '⛏', hp: [48, 56], moves: [
  { id: 'difficultyspike', name: 'Difficulty Spike', weight: 1, maxRepeat: 1, effects: [{ k: 'buff', id: 'str', n: 2 }] },
  { id: 'proofofwork', name: 'Proof of Work', weight: 3, effects: [{ k: 'atk', n: 11 }] },
  { id: 'doublespend', name: 'Double Spend', weight: 2, cooldown: 1, effects: [{ k: 'atk', n: 6, times: 2 }] },
] }))
reg(E({ id: 'cryptomite', name: 'Cryptomite', glyph: '₿', hp: [30, 36], moves: [
  { id: 'mine2', name: 'Mine', weight: 2, maxRepeat: 1, effects: [{ k: 'buff', id: 'plating', n: 2 }] },
  { id: 'hashsmash', name: 'Hash Smash', weight: 3, effects: [{ k: 'atk', n: 8 }] },
] }))
reg(E({ id: 'junkgolem', name: 'Junk Golem', glyph: '▙', hp: [58, 66], moves: [
  { id: 'scrapfist', name: 'Scrap Fist', weight: 3, effects: [{ k: 'atk', n: 12 }] },
  { id: 'reassemble', name: 'Reassemble', weight: 2, cooldown: 2, effects: [{ k: 'heal', n: 10 }, { k: 'block', n: 8 }] },
] }))
reg(E({ id: 'sirenode', name: 'Siren Node', glyph: '♫', hp: [42, 48], moves: [
  { id: 'song', name: 'Sync Song', weight: 2, maxRepeat: 1, effects: [{ k: 'buffAll', id: 'str', n: 1 }, { k: 'block', n: 6 }] },
  { id: 'screech', name: 'Screech', weight: 3, effects: [{ k: 'atk', n: 9 }, { k: 'debuff', id: 'weak', n: 1 }] },
] }))
reg(E({ id: 'hexbat', name: 'Hex Bat', glyph: '⌵', hp: [28, 34], moves: [
  { id: 'divebomb', name: 'Dive Bomb', weight: 3, effects: [{ k: 'atk', n: 8 }] },
  { id: 'hexdust', name: 'Hex Dust', weight: 2, effects: [{ k: 'debuff', id: 'corrupt', n: 3 }] },
] }))
reg(E({ id: 'ratking', name: 'Rat King', glyph: '♛', hp: [80, 90], moves: [
  { id: 'command', name: 'Command', weight: 2, maxRepeat: 1, effects: [{ k: 'summon', id: 'bitrat', n: 2 }] },
  { id: 'crownbite', name: 'Crown Bite', weight: 3, effects: [{ k: 'atk', n: 12 }] },
  { id: 'tangle', name: 'Tangle', weight: 2, cooldown: 1, effects: [{ k: 'debuff', id: 'weak', n: 2 }] },
] }))
reg(E({ id: 'coilviper', name: 'Coil Viper', glyph: '§', hp: [46, 54], moves: [
  { id: 'venom', name: 'Venom', weight: 2, effects: [{ k: 'debuff', id: 'corrupt', n: 4 }] },
  { id: 'strikefast', name: 'Strike', weight: 3, effects: [{ k: 'atk', n: 6, times: 2 }] },
] }))
reg(E({ id: 'brokerimp', name: 'Broker Imp', glyph: '¥', hp: [38, 44], moves: [
  { id: 'shortsell', name: 'Short Sell', weight: 2, effects: [{ k: 'debuff', id: 'vuln', n: 2 }] },
  { id: 'margincall', name: 'Margin Call', weight: 3, effects: [{ k: 'atk', n: 10 }] },
] }))
reg(E({ id: 'chainhound', name: 'Chain Hound', glyph: '⛓', hp: [56, 64], moves: [
  { id: 'linkbite', name: 'Link Bite', weight: 3, effects: [{ k: 'atk', n: 7, times: 2 }] },
  { id: 'shackle', name: 'Shackle', weight: 2, cooldown: 1, effects: [{ k: 'debuff', id: 'weak', n: 2 }] },
] }))
reg(E({ id: 'autosave', name: 'Auto-Save Daemon', glyph: '⤾', hp: [52, 60], moves: [
  { id: 'checkpoint', name: 'Checkpoint', weight: 2, effects: [{ k: 'block', n: 9 }] },
  { id: 'restore', name: 'Restore', weight: 2, maxRepeat: 1, cond: { hpBelow: 0.6 }, effects: [{ k: 'heal', n: 12 }, { k: 'buff', id: 'str', n: 1 }] },
  { id: 'forcequit', name: 'Force Quit', weight: 3, effects: [{ k: 'atk', n: 13 }] },
] }))
reg(E({ id: 'vaultmimic', name: 'Vault Mimic', glyph: '▣', hp: [62, 70], traits: { artifact: 1 }, moves: [
  { id: 'lidslam', name: 'Lid Slam', weight: 3, effects: [{ k: 'atk', n: 13 }] },
  { id: 'goldglint', name: 'Gold Glint', weight: 2, maxRepeat: 1, effects: [{ k: 'block', n: 11 }, { k: 'buff', id: 'str', n: 1 }] },
] }))
reg(E({ id: 'echoshade', name: 'Echo Shade', glyph: '⌐', hp: [50, 58], moves: [
  { id: 'mirrorhit', name: 'Mirror Hit', weight: 3, effects: [{ k: 'atk', n: 10 }] },
  { id: 'fade2', name: 'Fade', weight: 2, maxRepeat: 1, effects: [{ k: 'block', n: 12 }] },
  { id: 'reverb', name: 'Reverb', weight: 1, cooldown: 2, effects: [{ k: 'atk', n: 5, times: 3 }] },
] }))
reg(E({ id: 'plagueherald', name: 'Plague Herald', glyph: '☨', hp: [66, 74], moves: [
  { id: 'toll', name: 'Toll', weight: 2, effects: [{ k: 'debuff', id: 'corrupt', n: 5 }] },
  { id: 'scythe', name: 'Scythe', weight: 3, effects: [{ k: 'atk', n: 14 }] },
  { id: 'lastrites', name: 'Last Rites', weight: 1, cooldown: 2, effects: [{ k: 'buff', id: 'str', n: 2 }, { k: 'heal', n: 8 }] },
] }))
reg(E({ id: 'ironbarnacle', name: 'Iron Barnacle', glyph: '◍', hp: [44, 52], traits: { thorns: 4 }, moves: [
  { id: 'clamp', name: 'Clamp', weight: 3, effects: [{ k: 'atk', n: 7 }] },
  { id: 'encrust', name: 'Encrust', weight: 2, maxRepeat: 1, effects: [{ k: 'block', n: 10 }, { k: 'buff', id: 'thorns', n: 1 }] },
] }))
reg(E({ id: 'nullnun', name: 'Null Nun', glyph: '✝', hp: [54, 62], moves: [
  { id: 'silence', name: 'Silence', weight: 2, effects: [{ k: 'debuff', id: 'weak', n: 2 }, { k: 'debuff', id: 'vuln', n: 1 }] },
  { id: 'litany', name: 'Litany', weight: 3, effects: [{ k: 'atk', n: 9 }] },
  { id: 'benediction', name: 'Benediction', weight: 1, maxRepeat: 1, effects: [{ k: 'buffAll', id: 'str', n: 1 }, { k: 'heal', n: 6 }] },
] }))

/** Localized enemy display name. */
export function enemyName(defId: string): string {
  return isZh() ? (ENEMY_ZH[defId]?.name ?? ENEMIES[defId]?.name ?? defId) : (ENEMIES[defId]?.name ?? defId)
}

/** Localized move display name (for intent tooltips). */
export function moveName(defId: string, moveId: string): string {
  const en = ENEMIES[defId]?.moves.find((m) => m.id === moveId)?.name ?? moveId
  return isZh() ? (ENEMY_ZH[defId]?.moves[moveId] ?? en) : en
}

/** Generated rules text for one enemy move — the codex "mechanics" line. */
export function describeMove(mv: MoveDef): string {
  const parts: string[] = []
  for (const e of mv.effects) {
    switch (e.k) {
      case 'atk':
        parts.push(
          isZh()
            ? `造成 ${e.n}${e.times && e.times > 1 ? `×${e.times}` : ''} 伤害`
            : `Deal ${e.n}${e.times && e.times > 1 ? `×${e.times}` : ''} damage`,
        )
        break
      case 'block':
        parts.push(isZh() ? `获得 ${e.n} 格挡` : `Gain ${e.n} Block`)
        break
      case 'buff':
        parts.push(isZh() ? `自身 +${e.n} ${statusName(e.id)}` : `Self +${e.n} ${statusName(e.id)}`)
        break
      case 'buffAll':
        parts.push(isZh() ? `全体敌人 +${e.n} ${statusName(e.id)}` : `All enemies +${e.n} ${statusName(e.id)}`)
        break
      case 'debuff':
        parts.push(isZh() ? `施加 ${e.n} 层${statusName(e.id)}` : `Apply ${e.n} ${statusName(e.id)}`)
        break
      case 'heal':
        parts.push(isZh() ? `回复 ${e.n} 生命` : `Heal ${e.n} HP`)
        break
      case 'addCard':
        parts.push(isZh() ? `将 ${e.n} 张干扰牌塞入你的牌组` : `Shuffle ${e.n} junk card${e.n > 1 ? 's' : ''} into your deck`)
        break
      case 'summon':
        parts.push(
          isZh()
            ? `召唤${e.n && e.n > 1 ? ` ${e.n} 个` : ''}「${enemyName(e.id)}」`
            : `Summon ${e.n && e.n > 1 ? `${e.n}× ` : ''}${enemyName(e.id)}`,
        )
        break
      case 'cleanseSelf':
        parts.push(isZh() ? '清除自身负面状态' : 'Cleanse own debuffs')
        break
    }
  }
  const mods: string[] = []
  if (mv.cooldown) mods.push(isZh() ? `冷却 ${mv.cooldown} 回合` : `${mv.cooldown}-turn cooldown`)
  if (mv.maxRepeat === 1) mods.push(isZh() ? '不会连续使用' : 'never twice in a row')
  if (mv.cond?.hpBelow !== undefined) mods.push(isZh() ? `生命低于 ${Math.round(mv.cond.hpBelow * 100)}% 时` : `below ${Math.round(mv.cond.hpBelow * 100)}% HP`)
  if (mv.cond?.afterTurn !== undefined) mods.push(isZh() ? `第 ${mv.cond.afterTurn} 回合起` : `from turn ${mv.cond.afterTurn}`)
  if (mv.cond?.once) mods.push(isZh() ? '每场战斗一次' : 'once per combat')
  const tail = mods.length ? (isZh() ? `（${mods.join('，')}）` : ` (${mods.join(', ')})`) : ''
  return parts.join(isZh() ? '，' : ', ') + tail
}

/** Boss / elite / normal classification, derived from defs + encounter tables. */
export function enemyKind(id: string): 'boss' | 'elite' | 'normal' {
  if (ENEMIES[id]?.boss) return 'boss'
  for (const table of Object.values(ENCOUNTERS)) {
    if (table.elite.some((g) => g.includes(id))) return 'elite'
  }
  return 'normal'
}

/** Acts an enemy shows up in (empty for summon-only spawns). */
export function enemyActs(id: string): number[] {
  const acts: number[] = []
  for (const [act, table] of Object.entries(ENCOUNTERS)) {
    if ([...table.normal, ...table.elite, ...table.boss].some((g) => g.includes(id))) acts.push(Number(act))
  }
  return acts
}

// --- Encounters -------------------------------------------------------------

export interface EncounterTable {
  normal: string[][]
  elite: string[][]
  boss: string[][]
}

export const ENCOUNTERS: Record<number, EncounterTable> = {
  1: {
    normal: [
      ['spambot', 'spambot'],
      ['drone'],
      ['kiddie'],
      ['golem'],
      ['drone', 'spambot'],
      ['kiddie', 'spambot'],
      ['bitrat', 'bitrat', 'adfly'],
      ['cursorghoul'],
      ['pixelmoth'],
      ['staticjelly'],
      ['packmule'],
      ['popupspawner', 'bitrat'],
      ['lintbeast'],
      ['glitchmite', 'glitchmite', 'wiremouse'],
      ['phishfin', 'bitrat'],
      ['boltcrab'],
      ['spamwhale'],
      ['hatchery'],
      ['hatchery', 'spambot'],
      ['leech'],
      ['leech', 'spambot'],
    ],
    elite: [['hound'], ['hatchery', 'kiddie'], ['firewallwarden'], ['ratking']],
    boss: [['compiler'], ['watchdog'], ['daemoncore']],
  },
  2: {
    normal: [
      ['proxyshark'],
      ['tokenthief', 'voltmoth'],
      ['coldstorage'],
      ['hashrig'],
      ['quicksort', 'quicksort'],
      ['stackghast'],
      ['tapeworm', 'hexbat'],
      ['keylogger', 'cryptomite'],
      ['junkgolem'],
      ['sirenode', 'boltcrab'],
      ['coilviper'],
      ['ice', 'ice'],
      ['netrunner'],
      ['daemon'],
      ['sentry', 'ice'],
      ['daemon', 'spambot'],
      ['netrunner', 'sentry'],
      ['loadbalancer'],
      ['loadbalancer', 'subproc'],
      ['minelayer'],
      ['minelayer', 'ice'],
    ],
    elite: [['loadmaster'], ['blackice'], ['loadbalancer', 'sentry'], ['overseer']],
    boss: [['mainframe'], ['botnetlord'], ['garbagecollector']],
  },
  3: {
    normal: [
      ['nullhound'],
      ['panicdaemon', 'forkbomblet'],
      ['memleech'],
      ['autosave'],
      ['forkbomb'],
      ['ossifier'],
      ['brokerimp', 'chainhound'],
      ['vaultmimic'],
      ['echoshade', 'echoshade'],
      ['plagueherald'],
      ['ironbarnacle', 'nullnun'],
      ['nullptr'],
      ['wraith'],
      ['botnode', 'botnode', 'botnode'],
      ['nullptr', 'wraith'],
      ['wraith', 'botnode'],
      ['hivemind'],
      ['hivemind', 'botnode'],
      ['phantom'],
      ['phantom', 'botnode'],
    ],
    elite: [['gatekeeper'], ['rootdaemon'], ['hivemind', 'wraith']],
    boss: [['architect'], ['nullmonarch'], ['archivewarden'], ['singularityshard']],
  },
  4: {
    // The Root's gauntlet has no normal combat floors; table kept for safety.
    normal: [['rootling', 'rootling'], ['sporewall']],
    elite: [['spearproc', 'shieldproc']],
    boss: [['theroot'], ['rootkernel']],
  },
}

// --- Smart intent selection -------------------------------------------------

function moveTags(m: MoveDef): IntentKind[] {
  const tags = new Set<IntentKind>()
  for (const e of m.effects) {
    if (e.k === 'atk') tags.add('attack')
    if (e.k === 'block' || e.k === 'heal' || e.k === 'cleanseSelf') tags.add('defend')
    if (e.k === 'buff' || e.k === 'buffAll' || e.k === 'summon') tags.add('buff')
    if (e.k === 'debuff' || e.k === 'addCard') tags.add('debuff')
  }
  return [...tags]
}

export function moveIntentKind(m: MoveDef): IntentKind {
  const tags = moveTags(m)
  if (tags.length === 0) return 'buff'
  if (tags.length === 1) return tags[0]
  if (tags.includes('attack')) return 'mixed'
  return tags[0]
}

function movePlannedDamage(m: MoveDef, e: EnemyC, player: { statuses: { vuln?: number } }): number {
  let total = 0
  for (const eff of m.effects) {
    if (eff.k === 'atk') total += modifiedDamage(eff.n, e, player) * (eff.times ?? 1)
  }
  return total
}

function isLegal(m: MoveDef, e: EnemyC, turn: number): boolean {
  if (m.cond?.hpBelow !== undefined && e.hp / e.maxHp >= m.cond.hpBelow) return false
  if (m.cond?.afterTurn !== undefined && turn < m.cond.afterTurn) return false
  if (m.cond?.once && m.id in e.usedOn) return false
  if (m.cooldown && m.id in e.usedOn && turn - e.usedOn[m.id] <= m.cooldown) return false
  const maxRep = m.maxRepeat ?? 2
  const recent = e.lastMoves.slice(-maxRep)
  if (recent.length >= maxRep && recent.every((id) => id === m.id)) return false
  return true
}

/** Max living foes at once — stops summoners from flooding the arena. */
export const MAX_ALIVE_ENEMIES = 4

/**
 * Heuristic enemy AI. Enemies react to the board instead of rolling a fixed
 * script: they go for lethal, turtle when hurt, punish Vulnerability, and
 * shut down Strength stacking with Weak.
 */
export function chooseMove(e: EnemyC, cs: CombatState, rng: Rng): MoveDef {
  const def = ENEMIES[e.defId]
  // No summoning into a full arena.
  const aliveCount = cs.enemies.filter((x) => !x.dead).length
  const noSummon = (m: MoveDef) => !(aliveCount >= MAX_ALIVE_ENEMIES && m.effects.some((x) => x.k === 'summon'))
  let legal = def.moves.filter((m) => isLegal(m, e, cs.turn) && noSummon(m))
  if (legal.length === 0) legal = def.moves.filter(noSummon)
  if (legal.length === 0) legal = def.moves
  const player = cs.player
  const hpFrac = e.hp / e.maxHp

  const score = (m: MoveDef): number => {
    let s = m.weight
    const tags = moveTags(m)
    const dmg = movePlannedDamage(m, e, player)
    // Go for the kill: enough damage to end it outranks everything.
    if (dmg > 0 && dmg >= player.hp + player.block) s *= 6
    // Wounded: prefer to turtle or stabilize.
    if (hpFrac < 0.35) {
      if (tags.includes('defend')) s *= 2.2
      if (tags.includes('buff')) s *= 1.3
    }
    // Player snowballing Strength: try to Weaken them.
    if ((player.statuses.str ?? 0) >= 3 && m.effects.some((x) => x.k === 'debuff' && x.id === 'weak')) s *= 2
    // Player is Vulnerable: capitalize with attacks.
    if ((player.statuses.vuln ?? 0) > 0 && tags.includes('attack')) s *= 1.5
    // Player already Weak: don't stack more, hit them instead.
    if ((player.statuses.weak ?? 0) > 1 && m.effects.some((x) => x.k === 'debuff' && x.id === 'weak')) s *= 0.4
    return s
  }

  return weightedPick(rng, legal, score)
}

/** Act difficulty ramp: act 1 is gentle (players build their deck), then
 * +10% enemy HP/damage per act (2/3/4). Multiplies with ascension scaling. */
export function actEnemyScale(act: number): number {
  return 1 + Math.max(0, act - 1) * 0.1
}

/** Ascension damage scaling for enemy attacks (+3% per level) × act ramp. */
export function ascAtk(n: number, asc: number, act = 1): number {
  return ascensionEnemyAttack(n, asc, actEnemyScale(act))
}

export function intentFor(m: MoveDef, e: EnemyC, player: { statuses: { vuln?: number } }, asc = 0, act = 1): Intent {
  const kind = moveIntentKind(m)
  const atk = m.effects.find((x) => x.k === 'atk')
  const intent: Intent = { moveId: m.id, name: m.name, kind }
  if (atk && atk.k === 'atk') {
    intent.dmg = modifiedDamage(ascAtk(atk.n, asc, act), e, player)
    if (atk.times && atk.times > 1) intent.times = atk.times
  }
  return intent
}
