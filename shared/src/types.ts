import type { Rng } from './rng'

// ---------------------------------------------------------------------------
// Statuses
// ---------------------------------------------------------------------------

export type StatusId =
  | 'str' // attacks deal +N
  | 'weak' // attacks deal 25% less, N turns
  | 'vuln' // takes 50% more attack damage, N turns
  | 'corrupt' // poison: lose N HP at start of own turn, then N-1
  | 'thorns' // attackers take N damage back
  | 'plating' // gain N block at end of own turn
  | 'turret' // deal N damage to a random foe at end of own turn
  | 'viral' // apply N corrupt to all foes at end of own turn
  | 'energyGain' // +N energy each turn
  | 'drawGain' // +N cards drawn each turn
  | 'ritual' // gain N strength at end of own turn
  | 'regen' // restore N HP at start of own turn
  | 'barricade' // block no longer expires at start of own turn
  | 'kernel' // when a card gives you block, deal N to a random foe
  | 'hyper' // when you play a 0-cost card, draw N
  | 'chronic' // corrupt you apply to foes no longer wears off
  | 'heat' // attacks deal +N; at turn start, N >= threshold burns you for N
  | 'coolant' // overheat threshold +N
  | 'ignition' // gain N heat at end of own turn
  | 'reactor' // overheat damages ALL enemies instead of you
  | 'artifact' // negates the next N debuffs applied to this fighter
  | 'overdrive' // stance: attacks deal x1.5, attacks taken x1.5
  | 'stealth' // stance: attacks taken x0.5; +2 energy when you leave it
  | 'stancewall' // gain N block whenever you enter a stance
  | 'momentum' // gain N Strength whenever you enter Overdrive
  | 'tempoloop' // draw N whenever you enter a stance

export type Statuses = Partial<Record<StatusId, number>>

export interface StatusInfo {
  name: string
  sym: string
  bad: boolean
  /** Tooltip text; {n} is replaced with the stack count. */
  desc: string
  /** For power cards: full rules text of "gain N of this". */
  powerText?: string
}

export const STATUS_INFO: Record<StatusId, StatusInfo> = {
  str: { name: 'Strength', sym: '▲', bad: false, desc: 'Attacks deal {n} additional damage.' },
  weak: { name: 'Weak', sym: '↯', bad: true, desc: 'Attacks deal 25% less damage for {n} turns.' },
  vuln: { name: 'Vulnerable', sym: '◎', bad: true, desc: 'Takes 50% more attack damage for {n} turns.' },
  corrupt: { name: 'Corrupt', sym: '☣', bad: true, desc: 'Loses {n} HP at the start of its turn, then reduces by 1.' },
  thorns: { name: 'Thorns', sym: '❖', bad: false, desc: 'When attacked, deals {n} damage back.' },
  plating: { name: 'Plating', sym: '▣', bad: false, desc: 'Gains {n} Block at end of turn.', powerText: 'At the end of your turn, gain {n} Block.' },
  turret: { name: 'Turret', sym: '✛', bad: false, desc: 'Deals {n} damage to a random enemy at end of turn.', powerText: 'At the end of your turn, deal {n} damage to a random enemy.' },
  viral: { name: 'Viral', sym: '☢', bad: false, desc: 'Applies {n} Corrupt to all enemies at end of turn.', powerText: 'At the end of your turn, apply {n} Corrupt to ALL enemies.' },
  energyGain: { name: 'Overclock', sym: '⬢', bad: false, desc: '{n} extra Energy each turn.', powerText: 'Gain {n} additional Energy at the start of each turn.' },
  drawGain: { name: 'Uplink', sym: '≡', bad: false, desc: 'Draws {n} extra cards each turn.', powerText: 'Draw {n} additional card(s) at the start of each turn.' },
  ritual: { name: 'Ritual', sym: '↺', bad: false, desc: 'Gains {n} Strength at end of turn.', powerText: 'At the end of your turn, gain {n} Strength.' },
  regen: { name: 'Regen', sym: '✚', bad: false, desc: 'Restores {n} HP at the start of its turn.', powerText: 'At the start of your turn, restore {n} HP.' },
  barricade: { name: 'Barricade', sym: '▓', bad: false, desc: 'Block no longer expires.', powerText: 'Your Block no longer expires at the start of your turn.' },
  kernel: { name: 'Kernel', sym: '☲', bad: false, desc: 'When a card grants Block, deals {n} damage to a random enemy.', powerText: 'Whenever a card grants you Block, deal {n} damage to a random enemy.' },
  hyper: { name: 'Hyperthread', sym: '⋙', bad: false, desc: 'Draws {n} card(s) when a 0-cost card is played.', powerText: 'Whenever you play a 0-cost card, draw {n} card(s).' },
  chronic: { name: 'Chronic', sym: '∞', bad: false, desc: 'Corrupt on enemies no longer wears off.', powerText: 'Corrupt on enemies no longer wears off.' },
  heat: { name: 'Heat', sym: '♨', bad: false, desc: 'Attacks deal +{n}. At the start of your turn, Heat at or past your threshold (8) burns you for {n} and resets.' },
  coolant: { name: 'Coolant', sym: '❄', bad: false, desc: 'Overheat threshold raised by {n}.', powerText: 'Raise your overheat threshold by {n}.' },
  ignition: { name: 'Ignition', sym: 'Δ', bad: false, desc: 'Gains {n} Heat at end of turn.', powerText: 'At the end of your turn, gain {n} Heat.' },
  reactor: { name: 'Reactor', sym: '☢', bad: false, desc: 'Overheating damages ALL enemies instead of you.', powerText: 'Overheating no longer hurts you — it deals the damage to ALL enemies instead.' },
  artifact: { name: 'Artifact', sym: '◈', bad: false, desc: 'Negates the next {n} debuff(s).', powerText: 'Gain {n} Artifact: each charge negates the next debuff applied to you.' },
  overdrive: { name: 'Overdrive', sym: '≫', bad: false, desc: 'Stance: attacks deal 50% more, but attacks against you also deal 50% more.' },
  stealth: { name: 'Stealth', sym: '⌇', bad: false, desc: 'Stance: attacks against you deal half damage. Leaving it grants 2 Energy.' },
  stancewall: { name: 'Stance Wall', sym: '⛉', bad: false, desc: 'Gain {n} Block whenever you enter a stance.', powerText: 'Whenever you enter a stance, gain {n} Block.' },
  momentum: { name: 'Momentum', sym: '⤁', bad: false, desc: 'Gain {n} Strength whenever you enter Overdrive.', powerText: 'Whenever you enter Overdrive, gain {n} Strength.' },
  tempoloop: { name: 'Tempo Loop', sym: '∿', bad: false, desc: 'Draw {n} card(s) whenever you enter a stance.', powerText: 'Whenever you enter a stance, draw {n} card(s).' },
}

export const DEBUFFS: StatusId[] = ['weak', 'vuln', 'corrupt']

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

export type CardType = 'attack' | 'skill' | 'power'
export type Rarity = 'starter' | 'common' | 'uncommon' | 'rare' | 'special'

export type Effect =
  | { k: 'dmg'; n: number; times?: number }
  | { k: 'dmgAll'; n: number; times?: number }
  | { k: 'dmgVulnBonus'; n: number; bonus: number }
  | { k: 'dmgPerPower'; base: number; per: number }
  | { k: 'dmgPerCorrupt'; mult: number }
  | { k: 'dmgIfCombo'; n: number; bonus: number; threshold: number }
  | { k: 'blockAsDmg' }
  | { k: 'block'; n: number }
  | { k: 'doubleBlock' }
  | { k: 'doubleCorrupt' }
  | { k: 'draw'; n: number }
  | { k: 'energy'; n: number }
  | { k: 'heal'; n: number }
  | { k: 'selfDmg'; n: number }
  | { k: 'status'; to: 'self' | 'target' | 'all'; id: StatusId; n: number }
  | { k: 'cleanse' }
  | { k: 'addCard'; id: string; where: 'discard' | 'draw'; n: number }
  | { k: 'heatCool'; n: number }
  | { k: 'ventDmg'; mult: number }
  | { k: 'ventDmgAll'; mult: number }
  | { k: 'ventBlock'; mult: number }
  | { k: 'dmgHeatBonus'; n: number; bonus: number; threshold: number }
  | { k: 'enterStance'; id: 'overdrive' | 'stealth' | 'none' }
  | { k: 'dmgIfStance'; n: number; bonus: number }

export type CharId = 'runner' | 'vector' | 'ghost'

export interface CardDef {
  id: string
  name: string
  type: CardType
  rarity: Rarity
  /** Character-exclusive card; undefined = neutral (any character). */
  char?: CharId
  cost: number
  upCost?: number
  /** 'enemy' cards need a target; 'none' cards resolve immediately. */
  target: 'enemy' | 'none'
  effects: Effect[]
  upEffects: Effect[]
  exhaust?: boolean
  upExhaust?: boolean
  /** Always drawn into your opening hand. */
  innate?: boolean
  upInnate?: boolean
  /** Not discarded at end of turn. */
  retain?: boolean
  upRetain?: boolean
  /** Exhausts if still in hand at end of turn. */
  ethereal?: boolean
  upEthereal?: boolean
  unplayable?: boolean
  flavor?: string
}

/** One copy of a card owned by a player. */
export interface CardInst {
  uid: number
  id: string
  up: boolean
}

// ---------------------------------------------------------------------------
// Fighters
// ---------------------------------------------------------------------------

export interface Fighter {
  name: string
  hp: number
  maxHp: number
  block: number
  statuses: Statuses
}

/** A fighter that plays cards: the PvE player, or either PvP side. */
export interface DeckSide extends Fighter {
  energy: number
  energyMax: number
  hand: CardInst[]
  draw: CardInst[]
  discard: CardInst[]
  exhausted: CardInst[]
  powersPlayed: number
  cardsPlayed: number
  /** Cards played since this side's turn began (combo payoffs). */
  cardsThisTurn: number
}

// ---------------------------------------------------------------------------
// Enemies
// ---------------------------------------------------------------------------

export type MoveEffect =
  | { k: 'atk'; n: number; times?: number }
  | { k: 'block'; n: number }
  | { k: 'buff'; id: StatusId; n: number }
  | { k: 'buffAll'; id: StatusId; n: number }
  | { k: 'debuff'; id: StatusId; n: number }
  | { k: 'heal'; n: number }
  | { k: 'addCard'; id: string; n: number }
  | { k: 'summon'; id: string; n?: number }
  | { k: 'cleanseSelf' }

export interface MoveCond {
  /** Only when own hp fraction is below this. */
  hpBelow?: number
  /** Only from this turn number on. */
  afterTurn?: number
  /** Usable at most once per combat. */
  once?: boolean
}

export interface MoveDef {
  id: string
  name: string
  effects: MoveEffect[]
  weight: number
  /** Min turns between uses (1 = can't use two turns in a row). */
  cooldown?: number
  /** Max consecutive uses (default 2). */
  maxRepeat?: number
  cond?: MoveCond
}

export interface EnemyDef {
  id: string
  name: string
  glyph: string
  hp: [number, number]
  moves: MoveDef[]
  /** Statuses the enemy starts combat with. */
  traits?: Statuses
  boss?: boolean
}

export type IntentKind = 'attack' | 'defend' | 'buff' | 'debuff' | 'mixed'

export interface Intent {
  moveId: string
  name: string
  kind: IntentKind
  /** Fully modified damage preview (str/weak/vuln applied), if attacking. */
  dmg?: number
  times?: number
}

export interface EnemyC extends Fighter {
  defId: string
  glyph: string
  intent: Intent | null
  lastMoves: string[]
  /** turn number each move was last used on */
  usedOn: Record<string, number>
  dead: boolean
}

// ---------------------------------------------------------------------------
// Combat
// ---------------------------------------------------------------------------

export interface CombatState {
  rng: Rng
  turn: number
  player: DeckSide
  enemies: EnemyC[]
  over: null | 'win' | 'lose'
  /** Quantum Chip charge: next card this combat costs 0. */
  firstCardFree: boolean
  relics: string[]
  uid: number
  encounterId: string
  /** Ascension level the combat was started at (0 = base difficulty). */
  asc: number
}

export type CombatAction = { t: 'play'; hand: number; target?: number } | { t: 'end' }

/**
 * Animation/log events emitted by a reducer step.
 * `who`: 'p' for the player, 'e0'/'e1'/'e2' for enemies, 'p0'/'p1' in PvP.
 */
export interface GameEvent {
  e: 'hit' | 'blocked' | 'block' | 'status' | 'heal' | 'die' | 'move' | 'lifted' | 'addcard' | 'summon'
  who: string
  n?: number
  id?: string
  name?: string
}

export interface StepResult<S> {
  state: S
  events: GameEvent[]
  error?: string
}

// ---------------------------------------------------------------------------
// PvP
// ---------------------------------------------------------------------------

export interface PvpState {
  rng: Rng
  turn: number
  active: 0 | 1
  sides: [DeckSide, DeckSide]
  over: null | { winner: 0 | 1; reason: string }
  uid: number
}

export type PvpAction = { t: 'play'; hand: number } | { t: 'end' }

// ---------------------------------------------------------------------------
// Map / Run
// ---------------------------------------------------------------------------

export type NodeType = 'combat' | 'elite' | 'rest' | 'shop' | 'treasure' | 'event' | 'boss'

export interface MapNode {
  id: string
  row: number
  col: number
  type: NodeType
  next: string[]
}

export interface ActMap {
  act: number
  /** rows[r] is the list of nodes on that floor, bottom (0) to boss (last). */
  rows: MapNode[][]
}

export interface ShopStock {
  cards: { id: string; price: number; sold: boolean }[]
  relics: { id: string; price: number; sold: boolean }[]
  potions: { id: string; price: number; sold: boolean }[]
  removePrice: number
}

export interface RunState {
  seed: number
  rng: Rng
  act: number
  map: ActMap
  /** Current node id, or null at the start of an act (pick any row-0 node). */
  pos: string | null
  /** Node ids visited this act, in order. */
  path: string[]
  hp: number
  maxHp: number
  gold: number
  deck: CardInst[]
  relics: string[]
  uid: number
  floor: number
  lastEncounter: string
  /** Card-removal price rises with each purchase. */
  removesBought: number
  /** Event ids already visited this run (no repeats until pool exhausts). */
  seenEvents: string[]
  /** Potion belt (max 3). */
  potions: string[]
  /** Ascension level of this run (0-5). */
  asc: number
  /** Playable character for this run. */
  char: CharId
}
