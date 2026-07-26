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
  | { k: 'blockAsDmg' }
  | { k: 'block'; n: number }
  | { k: 'draw'; n: number }
  | { k: 'energy'; n: number }
  | { k: 'heal'; n: number }
  | { k: 'selfDmg'; n: number }
  | { k: 'status'; to: 'self' | 'target' | 'all'; id: StatusId; n: number }
  | { k: 'cleanse' }
  | { k: 'addCard'; id: string; where: 'discard' | 'draw'; n: number }

export interface CardDef {
  id: string
  name: string
  type: CardType
  rarity: Rarity
  cost: number
  upCost?: number
  /** 'enemy' cards need a target; 'none' cards resolve immediately. */
  target: 'enemy' | 'none'
  effects: Effect[]
  upEffects: Effect[]
  exhaust?: boolean
  upExhaust?: boolean
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
}

export type CombatAction = { t: 'play'; hand: number; target?: number } | { t: 'end' }

/**
 * Animation/log events emitted by a reducer step.
 * `who`: 'p' for the player, 'e0'/'e1'/'e2' for enemies, 'p0'/'p1' in PvP.
 */
export interface GameEvent {
  e: 'hit' | 'blocked' | 'block' | 'status' | 'heal' | 'die' | 'move' | 'lifted' | 'addcard'
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
}
