import type { CharId, Statuses } from './types'
import { isZh } from './i18n'
import { RELIC_ZH } from './locale-zh'

export interface RelicDef {
  id: string
  name: string
  desc: string
  rarity: 'starter' | 'common' | 'rare' | 'boss'
  sym: string
  /** Character-exclusive relic; undefined = neutral (any character). */
  char?: CharId
  hooks: {
    maxHp?: number
    /** Statuses granted at combat start (str, thorns, ...). */
    combatStatuses?: Statuses
    combatStartBlock?: number
    /** Extra energy on turn 1 only. */
    firstTurnEnergy?: number
    /** Extra cards drawn on turn 1 only. */
    firstTurnDraw?: number
    /** Extra energy every turn. */
    energyPerTurn?: number
    /** Extra cards drawn every turn. */
    drawPerTurn?: number
    /** The first card played each combat costs 0. */
    firstCardFree?: boolean
    /** Heal after every combat victory. */
    afterCombatHeal?: number
    /** Gain block whenever you play a Power. */
    onPowerBlock?: number
    /** Gain energy whenever your draw pile is shuffled. */
    onShuffleEnergy?: number
    /** Apply to ALL enemies at combat start. */
    combatStartEnemyStatuses?: Statuses
    /** Percent bonus to gold rewards. */
    goldBonusPct?: number
    /** Extra healing at rest sites. */
    restBonus?: number
    /** Corrupt you apply lands this much harder. */
    corruptBonus?: number
    /** Gain block whenever you play a 0-cost card. */
    zeroCostBlock?: number
    /** Gain Strength whenever your draw pile is shuffled. */
    onShuffleStr?: number
    /** Power cards cost this much less. */
    powerDiscount?: number
    /** Extra block whenever a card grants you block. */
    cardBlockBonus?: number
    /** Gain block whenever your draw pile is shuffled. */
    onShuffleBlock?: number
  }
}

const R = (def: RelicDef) => def

export const RELICS: Record<string, RelicDef> = {}
function reg(def: RelicDef) {
  RELICS[def.id] = def
}

reg(R({
  id: 'cortexlink', name: 'Cortex Link', rarity: 'starter', sym: '◉',
  desc: 'Draw 1 additional card on your first turn each combat.',
  hooks: { firstTurnDraw: 1 },
}))
reg(R({
  id: 'neonheart', name: 'Neon Heart', rarity: 'common', sym: '♥',
  desc: 'Raise your Max HP by 12.',
  hooks: { maxHp: 12 },
}))
reg(R({
  id: 'crackedbattery', name: 'Cracked Battery', rarity: 'common', sym: '⚡',
  desc: 'Gain 1 extra Energy on your first turn each combat.',
  hooks: { firstTurnEnergy: 1 },
}))
reg(R({
  id: 'quantumchip', name: 'Quantum Chip', rarity: 'rare', sym: '❒',
  desc: 'The first card you play each combat costs 0.',
  hooks: { firstCardFree: true },
}))
reg(R({
  id: 'aegisdriver', name: 'Aegis Driver', rarity: 'common', sym: '⛨',
  desc: 'Start each combat with 6 Block.',
  hooks: { combatStartBlock: 6 },
}))
reg(R({
  id: 'overdrive', name: 'Overdrive Module', rarity: 'rare', sym: '▲',
  desc: 'Start each combat with 1 Strength.',
  hooks: { combatStatuses: { str: 1 } },
}))
reg(R({
  id: 'medkit', name: 'Nano Medkit', rarity: 'common', sym: '✚',
  desc: 'Heal 7 HP after each combat.',
  hooks: { afterCombatHeal: 7 },
}))
reg(R({
  id: 'holoemitter', name: 'Holo Emitter', rarity: 'common', sym: '◈',
  desc: 'Whenever you play a Power, gain 4 Block.',
  hooks: { onPowerBlock: 4 },
}))
reg(R({
  id: 'surgecoil', name: 'Surge Coil', rarity: 'common', sym: '∿',
  desc: 'Whenever your draw pile is shuffled, gain 1 Energy.',
  hooks: { onShuffleEnergy: 1 },
}))
reg(R({
  id: 'goldchip', name: 'Au Chip', rarity: 'common', sym: '¤',
  desc: 'Gain 25% more credits from all sources.',
  hooks: { goldBonusPct: 25 },
}))
reg(R({
  id: 'thornrouter', name: 'Thorn Router', rarity: 'common', sym: '❖',
  desc: 'Start each combat with 2 Thorns.',
  hooks: { combatStatuses: { thorns: 2 } },
}))
reg(R({
  id: 'viralcore', name: 'Viral Core', rarity: 'rare', sym: '☣',
  desc: 'Enemies start combat with 3 Corrupt.',
  hooks: { combatStartEnemyStatuses: { corrupt: 3 } },
}))
reg(R({
  id: 'mirrorshard', name: 'Mirror Shard', rarity: 'rare', sym: '◇',
  desc: 'Enemies start combat with 1 Weak.',
  hooks: { combatStartEnemyStatuses: { weak: 1 } },
}))
reg(R({
  id: 'cpuheatsink', name: 'CPU Heatsink', rarity: 'boss', sym: '⬢',
  desc: 'Gain 1 additional Energy at the start of each turn.',
  hooks: { energyPerTurn: 1 },
}))
reg(R({
  id: 'ramstick', name: 'Spare RAM', rarity: 'boss', sym: '≡',
  desc: 'Draw 1 additional card at the start of each turn.',
  hooks: { drawPerTurn: 1 },
}))
reg(R({
  id: 'solarcell', name: 'Solar Cell', rarity: 'common', sym: '☀',
  desc: 'Rest sites restore 15 additional HP.',
  hooks: { restBonus: 15 },
}))
reg(R({
  id: 'plaguerouter', name: 'Plague Router', rarity: 'rare', sym: '⌬',
  desc: 'Corrupt you apply to enemies is increased by 1.',
  hooks: { corruptBonus: 1 },
}))
reg(R({
  id: 'staticfield', name: 'Static Field', rarity: 'common', sym: '≋',
  desc: 'Whenever you play a 0-cost card, gain 2 Block.',
  hooks: { zeroCostBlock: 2 },
}))
reg(R({
  id: 'chassis', name: 'Titanium Chassis', rarity: 'common', sym: '▣',
  desc: 'Start each combat with 1 Plating (gain 1 Block at end of turn).',
  hooks: { combatStatuses: { plating: 1 } },
}))
reg(R({
  id: 'momentumdrive', name: 'Momentum Drive', rarity: 'rare', sym: '↻',
  desc: 'Whenever your draw pile is shuffled, gain 1 Strength.',
  hooks: { onShuffleStr: 1 },
}))
reg(R({
  id: 'hypervisor', name: 'Hypervisor', rarity: 'boss', sym: '⌘',
  desc: 'Power cards cost 1 less.',
  hooks: { powerDiscount: 1 },
}))
reg(R({
  id: 'pilotlight', name: 'Pilot Light', rarity: 'common', sym: '△', char: 'vector',
  desc: 'Start each combat with 2 Heat.',
  hooks: { combatStatuses: { heat: 2 } },
}))
reg(R({
  id: 'thermalpaste', name: 'Thermal Paste', rarity: 'common', sym: '❄', char: 'vector',
  desc: 'Start each combat with 2 Coolant (overheat threshold +2).',
  hooks: { combatStatuses: { coolant: 2 } },
}))
reg(R({
  id: 'meshnetwork', name: 'Mesh Network', rarity: 'rare', sym: '⊞',
  desc: 'Start each combat with 1 Regen.',
  hooks: { combatStatuses: { regen: 1 } },
}))
reg(R({
  id: 'packetfilter', name: 'Packet Filter', rarity: 'common', sym: '⋔',
  desc: 'Start each combat with 3 Block and 1 Thorns.',
  hooks: { combatStartBlock: 3, combatStatuses: { thorns: 1 } },
}))
reg(R({
  id: 'capacitorbank', name: 'Capacitor Bank', rarity: 'rare', sym: '≣',
  desc: 'Start each combat with 12 Block.',
  hooks: { combatStartBlock: 12 },
}))
reg(R({
  id: 'blackmarketchip', name: 'Black-Market Chip', rarity: 'rare', sym: '¢',
  desc: 'Gain 40% more credits from all sources.',
  hooks: { goldBonusPct: 40 },
}))
reg(R({
  id: 'fieldrepair', name: 'Field Repair Rig', rarity: 'common', sym: '⚒',
  desc: 'Heal 4 after each combat, and rest sites restore 5 more HP.',
  hooks: { afterCombatHeal: 4, restBonus: 5 },
}))
reg(R({
  id: 'prefetcher', name: 'Prefetcher', rarity: 'common', sym: '⇶',
  desc: 'Draw 2 additional cards on your first turn each combat.',
  hooks: { firstTurnDraw: 2 },
}))
reg(R({
  id: 'warmboot', name: 'Warm Boot', rarity: 'rare', sym: '◒',
  desc: 'Start each combat with 2 Plating.',
  hooks: { combatStatuses: { plating: 2 } },
}))
reg(R({
  id: 'autoloader', name: 'Autoloader', rarity: 'boss', sym: '⟳',
  desc: 'Gain 2 extra Energy on your first turn each combat.',
  hooks: { firstTurnEnergy: 2 },
}))
reg(R({
  id: 'exoframe', name: 'Exoframe', rarity: 'boss', sym: '⛊',
  desc: 'Whenever a card grants you Block, gain 2 more.',
  hooks: { cardBlockBonus: 2 },
}))
reg(R({
  id: 'berserkerchip', name: 'Berserker Chip', rarity: 'boss', sym: '⚔',
  desc: 'Start each combat with 2 Strength… at the cost of 10 Max HP.',
  hooks: { combatStatuses: { str: 2 }, maxHp: -10 },
}))
reg(R({
  id: 'faradaycage', name: 'Faraday Cage', rarity: 'rare', sym: '◈',
  desc: 'Start each combat with 1 Artifact (negates the next debuff).',
  hooks: { combatStatuses: { artifact: 1 } },
}))
reg(R({
  id: 'sentrymount', name: 'Sentry Mount', rarity: 'common', sym: '✛',
  desc: 'Start each combat with 2 Turret (2 damage to a random enemy each turn).',
  hooks: { combatStatuses: { turret: 2 } },
}))
reg(R({
  id: 'sporerouter', name: 'Spore Router', rarity: 'rare', sym: '☢',
  desc: 'Start each combat with 1 Viral (apply 1 Corrupt to ALL enemies each turn).',
  hooks: { combatStatuses: { viral: 1 } },
}))
reg(R({
  id: 'kernelmod', name: 'Kernel Mod', rarity: 'rare', sym: '☲',
  desc: 'Start each combat with 2 Kernel (block cards deal 2 damage to a random enemy).',
  hooks: { combatStatuses: { kernel: 2 } },
}))
reg(R({
  id: 'hyperlink', name: 'Hyperlink', rarity: 'rare', sym: '⋙',
  desc: 'Start each combat with 1 Hyperthread (draw 1 when you play a 0-cost card).',
  hooks: { combatStatuses: { hyper: 1 } },
}))
reg(R({
  id: 'subdermalplate', name: 'Subdermal Plate', rarity: 'common', sym: '▦',
  desc: 'Raise your Max HP by 8.',
  hooks: { maxHp: 8 },
}))
reg(R({
  id: 'nanoweave', name: 'Nanoweave', rarity: 'common', sym: '⧉',
  desc: 'Whenever a card grants you Block, gain 1 more.',
  hooks: { cardBlockBonus: 1 },
}))
reg(R({
  id: 'necrocompiler', name: 'Necro Compiler', rarity: 'rare', sym: '♆',
  desc: 'Corrupt you apply to enemies is increased by 2.',
  hooks: { corruptBonus: 2 },
}))
reg(R({
  id: 'targetpainter', name: 'Target Painter', rarity: 'rare', sym: '⊕',
  desc: 'Enemies start combat with 1 Vulnerable.',
  hooks: { combatStartEnemyStatuses: { vuln: 1 } },
}))
reg(R({
  id: 'ringbuffer', name: 'Ring Buffer', rarity: 'common', sym: '◎',
  desc: 'Whenever your draw pile is shuffled, gain 6 Block.',
  hooks: { onShuffleBlock: 6 },
}))
reg(R({
  id: 'bootrom', name: 'Boot ROM', rarity: 'boss', sym: '⏻',
  desc: 'On your first turn each combat: +1 Energy and draw 2 more cards.',
  hooks: { firstTurnEnergy: 1, firstTurnDraw: 2 },
}))
reg(R({
  id: 'unstablegov', name: 'Unstable Governor', rarity: 'boss', sym: '↯',
  desc: 'Draw 1 additional card every turn… at the cost of 8 Max HP.',
  hooks: { drawPerTurn: 1, maxHp: -8 },
}))
reg(R({
  id: 'crondaemon', name: 'Cron Daemon', rarity: 'boss', sym: '↺',
  desc: 'Start each combat with 1 Ritual (gain 1 Strength at end of each turn).',
  hooks: { combatStatuses: { ritual: 1 } },
}))
reg(R({
  id: 'slowfuse', name: 'Slow Fuse', rarity: 'common', sym: 'Δ', char: 'vector',
  desc: 'Start each combat with 1 Ignition (gain 1 Heat at end of each turn).',
  hooks: { combatStatuses: { ignition: 1 } },
}))
reg(R({
  id: 'coldplate', name: 'Cold Plate', rarity: 'rare', sym: '❆', char: 'vector',
  desc: 'Start each combat with 4 Coolant (overheat threshold +4).',
  hooks: { combatStatuses: { coolant: 4 } },
}))
reg(R({
  id: 'shadowweave', name: 'Shadow Weave', rarity: 'rare', sym: '⛉', char: 'ghost',
  desc: 'Start each combat with 2 Stance Wall (gain 2 Block on stance entry).',
  hooks: { combatStatuses: { stancewall: 2 } },
}))
reg(R({
  id: 'flywheel', name: 'Flywheel', rarity: 'common', sym: '⤁', char: 'ghost',
  desc: 'Start each combat with 1 Momentum (gain 1 Strength on Overdrive entry).',
  hooks: { combatStatuses: { momentum: 1 } },
}))
reg(R({
  id: 'metronome', name: 'Metronome', rarity: 'rare', sym: '∿', char: 'ghost',
  desc: 'Start each combat with 1 Tempo Loop (draw 1 on stance entry).',
  hooks: { combatStatuses: { tempoloop: 1 } },
}))
reg(R({
  id: 'repairswarm', name: 'Repair Swarm', rarity: 'rare', sym: '❉',
  desc: 'Start each combat with 2 Regen.',
  hooks: { combatStatuses: { regen: 2 } },
}))
reg(R({
  id: 'razorchassis', name: 'Razor Chassis', rarity: 'rare', sym: '❖',
  desc: 'Start each combat with 4 Thorns.',
  hooks: { combatStatuses: { thorns: 4 } },
}))
reg(R({
  id: 'ballastcore', name: 'Ballast Core', rarity: 'common', sym: '⬓',
  desc: 'Raise your Max HP by 4 and start each combat with 4 Block.',
  hooks: { maxHp: 4, combatStartBlock: 4 },
}))
reg(R({
  id: 'ecoreactor', name: 'Eco Reactor', rarity: 'common', sym: '♻',
  desc: 'Rest sites restore 8 additional HP.',
  hooks: { restBonus: 8 },
}))
reg(R({
  id: 'scavkit', name: 'Scavenger Kit', rarity: 'common', sym: '⚒',
  desc: 'Gain 10% more credits and heal 2 HP after each combat.',
  hooks: { goldBonusPct: 10, afterCombatHeal: 2 },
}))
reg(R({
  id: 'powergauntlet', name: 'Power Gauntlet', rarity: 'rare', sym: '⌾',
  desc: 'Whenever you play a Power, gain 8 Block.',
  hooks: { onPowerBlock: 8 },
}))
reg(R({
  id: 'zerodaycache', name: 'Zero-Day Cache', rarity: 'rare', sym: '⌗',
  desc: 'Whenever you play a 0-cost card, gain 4 Block.',
  hooks: { zeroCostBlock: 4 },
}))
reg(R({
  id: 'glasscannon', name: 'Glass Cannon', rarity: 'boss', sym: '✦',
  desc: 'Start each combat with 3 Strength… at the cost of 15 Max HP.',
  hooks: { combatStatuses: { str: 3 }, maxHp: -15 },
}))
reg(R({
  id: 'leadlining', name: 'Lead Lining', rarity: 'common', sym: '▩',
  desc: 'Raise your Max HP by 10, but earn 10% fewer credits.',
  hooks: { maxHp: 10, goldBonusPct: -10 },
}))
reg(R({
  id: 'stimloop', name: 'Stim Loop', rarity: 'rare', sym: '↹',
  desc: 'On your first turn each combat: +1 Energy and draw 1 more card.',
  hooks: { firstTurnEnergy: 1, firstTurnDraw: 1 },
}))
reg(R({
  id: 'napalmcask', name: 'Napalm Cask', rarity: 'rare', sym: '✹', char: 'vector',
  desc: 'Start each combat with 2 Ignition (gain 2 Heat at end of each turn).',
  hooks: { combatStatuses: { ignition: 2 } },
}))
reg(R({
  id: 'ventvalve', name: 'Vent Valve', rarity: 'common', sym: '⍾', char: 'vector',
  desc: 'Start combats with 1 Heat; gain 1 Energy whenever you reshuffle.',
  hooks: { combatStatuses: { heat: 1 }, onShuffleEnergy: 1 },
}))
reg(R({
  id: 'shadowbattery', name: 'Shadow Battery', rarity: 'rare', sym: '⌁', char: 'ghost',
  desc: 'Start each combat with 1 Momentum and 1 Stance Wall.',
  hooks: { combatStatuses: { momentum: 1, stancewall: 1 } },
}))
reg(R({
  id: 'phaseanchor', name: 'Phase Anchor', rarity: 'boss', sym: '⚓', char: 'ghost',
  desc: 'Start each combat with 1 Tempo Loop and 2 Stance Wall.',
  hooks: { combatStatuses: { tempoloop: 1, stancewall: 2 } },
}))
reg(R({
  id: 'rootkitinjector', name: 'Rootkit Injector', rarity: 'rare', sym: '☣', char: 'runner',
  desc: 'Enemies start combat with 2 Corrupt, and your Corrupt lands 1 harder.',
  hooks: { combatStartEnemyStatuses: { corrupt: 2 }, corruptBonus: 1 },
}))
reg(R({
  id: 'packetsniffer', name: 'Packet Sniffer', rarity: 'common', sym: '⌕', char: 'runner',
  desc: 'Draw 1 more on your first turn and earn 10% more credits.',
  hooks: { firstTurnDraw: 1, goldBonusPct: 10 },
}))
reg(R({
  id: 'focuscrystal', name: 'Focus Crystal', rarity: 'rare', sym: '⌖', char: 'array',
  desc: 'Start each combat with 1 Focus (automations trigger 1 harder).',
  hooks: { combatStatuses: { focus: 1 } },
}))
reg(R({
  id: 'prefabnest', name: 'Prefab Nest', rarity: 'common', sym: '☖', char: 'array',
  desc: 'Start each combat with 1 Turret and 1 Plating.',
  hooks: { combatStatuses: { turret: 1, plating: 1 } },
}))
reg(R({
  id: 'coprocessor', name: 'Co-Processor', rarity: 'boss', sym: '⧮',
  desc: 'Gain 1 additional Energy every turn… at the cost of 12 Max HP.',
  hooks: { energyPerTurn: 1, maxHp: -12 },
}))
reg(R({
  id: 'battlecache', name: 'Battle Cache', rarity: 'common', sym: '▤',
  desc: 'Start each combat with 5 Block and earn 5% more credits.',
  hooks: { combatStartBlock: 5, goldBonusPct: 5 },
}))
reg(R({
  id: 'triagebot', name: 'Triage Bot', rarity: 'rare', sym: '✚',
  desc: 'Heal 12 HP after each combat.',
  hooks: { afterCombatHeal: 12 },
}))
reg(R({
  id: 'spinalrig', name: 'Spinal Rig', rarity: 'rare', sym: '≑',
  desc: 'Raise your Max HP by 20.',
  hooks: { maxHp: 20 },
}))
reg(R({
  id: 'ionfilter', name: 'Ion Filter', rarity: 'common', sym: '⌇',
  desc: 'Raise your Max HP by 3; rest sites restore 5 more HP.',
  hooks: { maxHp: 3, restBonus: 5 },
}))
reg(R({
  id: 'warcache', name: 'War Cache', rarity: 'rare', sym: '⚔',
  desc: 'Start each combat with 1 Strength and 2 Thorns.',
  hooks: { combatStatuses: { str: 1, thorns: 2 } },
}))
reg(R({
  id: 'overseerlens', name: 'Overseer Lens', rarity: 'rare', sym: '◉',
  desc: 'Enemies start combat with 1 Weak and 1 Vulnerable.',
  hooks: { combatStartEnemyStatuses: { weak: 1, vuln: 1 } },
}))
reg(R({
  id: 'mempooldump', name: 'Mempool Dump', rarity: 'rare', sym: '⇊',
  desc: 'Draw 3 additional cards on your first turn each combat.',
  hooks: { firstTurnDraw: 3 },
}))
reg(R({
  id: 'daemonleash', name: 'Daemon Leash', rarity: 'rare', sym: '⛓', char: 'array',
  desc: 'Start each combat with 2 Turret.',
  hooks: { combatStatuses: { turret: 2 } },
}))
reg(R({
  id: 'nanofoundry', name: 'Nano Foundry', rarity: 'boss', sym: '⌬', char: 'array',
  desc: 'Start each combat with 1 Focus and 1 Plating.',
  hooks: { combatStatuses: { focus: 1, plating: 1 } },
}))
reg(R({
  id: 'containbreach', name: 'Containment Breach', rarity: 'boss', sym: '☢', char: 'vector',
  desc: 'Start each combat with Reactor: overheating blasts ALL enemies instead of you.',
  hooks: { combatStatuses: { reactor: 1 } },
}))
reg(R({
  id: 'echochamber', name: 'Echo Chamber', rarity: 'common', sym: '⛶', char: 'ghost',
  desc: 'Start combats with 1 Stance Wall and 3 Block.',
  hooks: { combatStatuses: { stancewall: 1 }, combatStartBlock: 3 },
}))
reg(R({
  id: 'luckycable', name: 'Lucky Cable', rarity: 'common', sym: '§',
  desc: 'Earn 15% more credits; rest sites restore 3 more HP.',
  hooks: { goldBonusPct: 15, restBonus: 3 },
}))
reg(R({
  id: 'groundedboots', name: 'Grounded Boots', rarity: 'common', sym: '⏚',
  desc: 'Raise your Max HP by 5 and start combats with 3 Block.',
  hooks: { maxHp: 5, combatStartBlock: 3 },
}))
reg(R({
  id: 'patchharness', name: 'Patch Harness', rarity: 'common', sym: '✜',
  desc: 'Heal 3 after each combat; rest sites restore 4 more HP.',
  hooks: { afterCombatHeal: 3, restBonus: 4 },
}))
reg(R({
  id: 'surgeprotector', name: 'Surge Protector', rarity: 'common', sym: '⎓',
  desc: 'Start combats with 1 Plating and 2 Block.',
  hooks: { combatStatuses: { plating: 1 }, combatStartBlock: 2 },
}))
reg(R({
  id: 'datamagnet', name: 'Data Magnet', rarity: 'common', sym: '☍',
  desc: 'Raise your Max HP by 4 and draw 1 more on your first turn.',
  hooks: { maxHp: 4, firstTurnDraw: 1 },
}))
reg(R({
  id: 'titanframe', name: 'Titan Frame', rarity: 'rare', sym: '⛆',
  desc: 'Raise your Max HP by 15 and start combats with 5 Block.',
  hooks: { maxHp: 15, combatStartBlock: 5 },
}))
reg(R({
  id: 'chargecell', name: 'Charge Cell', rarity: 'rare', sym: '⌸',
  desc: 'On your first turn: +1 Energy. Start combats with 4 Block.',
  hooks: { firstTurnEnergy: 1, combatStartBlock: 4 },
}))
reg(R({
  id: 'venomlattice', name: 'Venom Lattice', rarity: 'rare', sym: '❋',
  desc: 'Start with 2 Thorns; enemies start with 2 Corrupt.',
  hooks: { combatStatuses: { thorns: 2 }, combatStartEnemyStatuses: { corrupt: 2 } },
}))
reg(R({
  id: 'ghostcircuit', name: 'Ghost Circuit', rarity: 'rare', sym: '⌁',
  desc: 'Whenever your draw pile is shuffled: gain 1 Energy and 4 Block.',
  hooks: { onShuffleEnergy: 1, onShuffleBlock: 4 },
}))
reg(R({
  id: 'warpcoil', name: 'Warp Coil', rarity: 'rare', sym: '➰',
  desc: 'Start combats with 1 Strength and draw 1 more on your first turn.',
  hooks: { combatStatuses: { str: 1 }, firstTurnDraw: 1 },
}))
reg(R({
  id: 'sponsoredcore', name: 'Sponsored Reactor', rarity: 'boss', sym: '™',
  desc: '+1 Energy every turn… but your sponsor takes 25% of all credits.',
  hooks: { energyPerTurn: 1, goldBonusPct: -25 },
}))
reg(R({
  id: 'clockworkidol', name: 'Clockwork Idol', rarity: 'rare', sym: '⏱',
  desc: 'Start each combat with 1 Ritual… at the cost of 5 Max HP.',
  hooks: { combatStatuses: { ritual: 1 }, maxHp: -5 },
}))
reg(R({
  id: 'daemoncrown', name: 'Daemon Crown', rarity: 'boss', sym: '♔', char: 'array',
  desc: 'Start each combat with 1 Turret, 1 Plating and 1 Viral.',
  hooks: { combatStatuses: { turret: 1, plating: 1, viral: 1 } },
}))
reg(R({
  id: 'eternalflame', name: 'Eternal Flame', rarity: 'boss', sym: '♨', char: 'vector',
  desc: 'Start each combat with 1 Ignition and 3 Coolant.',
  hooks: { combatStatuses: { ignition: 1, coolant: 3 } },
}))
reg(R({
  id: 'duelistcode', name: 'Duelist Code', rarity: 'boss', sym: '❈', char: 'ghost',
  desc: 'Start each combat with 1 Momentum and 1 Tempo Loop.',
  hooks: { combatStatuses: { momentum: 1, tempoloop: 1 } },
}))
reg(R({
  id: 'adminroot', name: 'Admin Root', rarity: 'boss', sym: '♯', char: 'runner',
  desc: 'Start with 1 Hyperthread; 0-cost cards also grant 2 Block.',
  hooks: { combatStatuses: { hyper: 1 }, zeroCostBlock: 2 },
}))
reg(R({
  id: 'burnersleeve', name: 'Burner Sleeve', rarity: 'common', sym: '⁂', char: 'vector',
  desc: 'Start combats with 1 Heat and 3 Block.',
  hooks: { combatStatuses: { heat: 1 }, combatStartBlock: 3 },
}))
reg(R({
  id: 'spoolthread', name: 'Spool Thread', rarity: 'common', sym: '⌰', char: 'runner',
  desc: 'Enemies start with 1 Weak; earn 5% more credits.',
  hooks: { combatStartEnemyStatuses: { weak: 1 }, goldBonusPct: 5 },
}))
reg(R({
  id: 'shadowlens', name: 'Shadow Lens', rarity: 'common', sym: '◐', char: 'ghost',
  desc: 'Start with 1 Stance Wall and draw 1 more on your first turn.',
  hooks: { combatStatuses: { stancewall: 1 }, firstTurnDraw: 1 },
}))
reg(R({
  id: 'dronebay', name: 'Drone Bay', rarity: 'rare', sym: '⛫', char: 'array',
  desc: 'Start each combat with 3 Turret.',
  hooks: { combatStatuses: { turret: 3 } },
}))

export function relicName(id: string): string {
  return isZh() ? (RELIC_ZH[id]?.name ?? RELICS[id]?.name ?? id) : (RELICS[id]?.name ?? id)
}

export function relicDesc(id: string): string {
  return isZh() ? (RELIC_ZH[id]?.desc ?? RELICS[id]?.desc ?? '') : (RELICS[id]?.desc ?? '')
}

export function obtainableRelics(owned: string[], includeBoss = false, char?: CharId): RelicDef[] {
  return Object.values(RELICS).filter(
    (r) =>
      r.rarity !== 'starter' &&
      (includeBoss || r.rarity !== 'boss') &&
      !owned.includes(r.id) &&
      (!char || !r.char || r.char === char),
  )
}
