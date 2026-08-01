/**
 * JSON-only mod support. Mods declare content (cards, relics, enemies,
 * potions, events, character loadout tweaks) as plain data validated against
 * the engine's existing effect vocabulary — no code execution, ever. Invalid
 * entries are skipped with warnings; a mod can be unloaded cleanly because
 * every id it registered is tracked.
 */
import type { CardDef, CharId, EnemyDef, Rarity } from './types'
import { CARDS } from './cards'
import { RELICS, type RelicDef } from './relics'
import { ENEMIES } from './enemies'
import { POTIONS, type PotionDef } from './potions'
import { EVENTS, type EventDef, type Outcome } from './events'
import { STARTER_DECKS, STARTER_RELICS } from './run'
import { EMOTES, type EmoteDef } from './emotes'

export interface ModManifest {
  id: string
  name: string
  author?: string
  version?: string
  description?: string
  cards?: unknown[]
  relics?: unknown[]
  enemies?: unknown[]
  potions?: unknown[]
  events?: unknown[]
  /** Loadout tweaks for EXISTING characters (base must be one of the four). */
  characters?: unknown[]
  /** Multiplayer emotes / quick phrases: {id, sym, text, zh?}. */
  emotes?: unknown[]
}

export interface ModReport {
  id: string
  added: string[]
  warnings: string[]
}

const ID_RE = /^[a-z0-9_-]{3,24}$/
const CARD_EFFECTS = new Set([
  'dmg', 'dmgAll', 'dmgVulnBonus', 'dmgPerPower', 'dmgPerCorrupt', 'dmgIfCombo', 'blockAsDmg',
  'block', 'doubleBlock', 'doubleCorrupt', 'draw', 'energy', 'heal', 'selfDmg', 'status',
  'cleanse', 'addCard', 'heatCool', 'ventDmg', 'ventDmgAll', 'ventBlock', 'dmgHeatBonus',
  'summonAlly', 'commandMinions', 'enterStance', 'dmgIfStance', 'dmgPerAuto',
])
const MOVE_EFFECTS = new Set(['atk', 'block', 'buff', 'buffAll', 'debuff', 'heal', 'addCard', 'summon', 'cleanseSelf'])
const OUTCOMES = new Set(['gold', 'damage', 'heal', 'maxhp', 'relic', 'cardRandom', 'cardGlitch', 'upgradeRandom', 'removeChoose', 'potion', 'curse', 'cardSpecific'])
const RARITIES: Rarity[] = ['common', 'uncommon', 'rare']
const CHARS: CharId[] = ['runner', 'vector', 'ghost', 'array']

/** Per-mod ledger of what was registered, for clean unload. */
const ledger = new Map<string, { cards: string[]; relics: string[]; enemies: string[]; potions: string[]; events: string[]; emotes: string[]; loadouts: [CharId, string[], string][] }>()

const num = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi

function validEffects(list: unknown, allowed: Set<string>, warn: (m: string) => void): boolean {
  if (!Array.isArray(list)) return false
  for (const e of list) {
    const k = (e as any)?.k
    if (typeof k !== 'string' || !allowed.has(k)) {
      warn(`unknown effect kind "${k}"`)
      return false
    }
    for (const f of ['n', 'times', 'base', 'per', 'mult', 'bonus', 'threshold']) {
      const v = (e as any)[f]
      if (v !== undefined && !num(v, f === 'n' && k === 'selfDmg' ? 0 : 0, 99)) {
        warn(`effect ${k}: field ${f} out of range`)
        return false
      }
    }
  }
  return true
}

export function applyMod(m: ModManifest): ModReport {
  const rep: ModReport = { id: m.id, added: [], warnings: [] }
  const warn = (msg: string) => rep.warnings.push(`[${m.id}] ${msg}`)
  if (!ID_RE.test(m.id ?? '')) return { id: String(m.id), added: [], warnings: ['mod id invalid — mod ignored'] }
  if (ledger.has(m.id)) removeMod(m.id)
  const led = { cards: [] as string[], relics: [] as string[], enemies: [] as string[], potions: [] as string[], events: [] as string[], emotes: [] as string[], loadouts: [] as [CharId, string[], string][] }

  for (const raw of m.cards ?? []) {
    const c = raw as Partial<CardDef>
    const id = String(c.id ?? '')
    if (!ID_RE.test(id)) { warn(`card id "${id}" invalid`); continue }
    if (CARDS[id]) { warn(`card "${id}" collides with existing content`); continue }
    if (!c.name || !['attack', 'skill', 'power'].includes(c.type as string) || !num(c.cost, 0, 3) ||
        !RARITIES.includes(c.rarity as Rarity) || !['enemy', 'none', 'ally'].includes(c.target as string) ||
        !validEffects(c.effects, CARD_EFFECTS, warn) || !validEffects(c.upEffects ?? c.effects, CARD_EFFECTS, warn)) {
      warn(`card "${id}" failed validation`)
      continue
    }
    if (c.char !== undefined && !CHARS.includes(c.char as CharId)) { warn(`card "${id}": unknown character`); continue }
    CARDS[id] = { ...(c as CardDef), id, upEffects: (c.upEffects ?? c.effects) as CardDef['upEffects'] }
    led.cards.push(id)
    rep.added.push('card:' + id)
  }

  for (const raw of m.relics ?? []) {
    const r = raw as Partial<RelicDef>
    const id = String(r.id ?? '')
    if (!ID_RE.test(id) || RELICS[id]) { warn(`relic "${id}" invalid or collides`); continue }
    if (!r.name || !r.desc || !['common', 'rare', 'boss'].includes(r.rarity as string) || typeof r.hooks !== 'object' || r.hooks === null) {
      warn(`relic "${id}" failed validation`)
      continue
    }
    // hooks must be numeric/boolean/status-record values on known keys only
    const HOOK_OK = new Set(['maxHp', 'combatStatuses', 'combatStartBlock', 'firstTurnEnergy', 'firstTurnDraw', 'energyPerTurn', 'drawPerTurn', 'firstCardFree', 'afterCombatHeal', 'onPowerBlock', 'onShuffleEnergy', 'combatStartEnemyStatuses', 'goldBonusPct', 'restBonus', 'corruptBonus', 'zeroCostBlock', 'onShuffleStr', 'powerDiscount', 'cardBlockBonus', 'onShuffleBlock', 'minionPower', 'minionHp', 'startMinion'])
    const badHook = Object.keys(r.hooks).find((k) => !HOOK_OK.has(k))
    if (badHook) { warn(`relic "${id}": unknown hook ${badHook}`); continue }
    RELICS[id] = { ...(r as RelicDef), sym: r.sym ?? '◆', id }
    led.relics.push(id)
    rep.added.push('relic:' + id)
  }

  for (const raw of m.enemies ?? []) {
    const e = raw as Partial<EnemyDef> & { act?: number }
    const id = String(e.id ?? '')
    if (!ID_RE.test(id) || ENEMIES[id]) { warn(`enemy "${id}" invalid or collides`); continue }
    const hpOk = Array.isArray(e.hp) && e.hp.length === 2 && num(e.hp[0], 1, 999) && num(e.hp[1], 1, 999)
    const movesOk = Array.isArray(e.moves) && e.moves.length > 0 && e.moves.every((mv: any) =>
      typeof mv?.id === 'string' && typeof mv?.name === 'string' && num(mv?.weight, 1, 99) && validEffects(mv?.effects, MOVE_EFFECTS, warn))
    if (!e.name || !hpOk || !movesOk) { warn(`enemy "${id}" failed validation`); continue }
    ENEMIES[id] = { ...(e as EnemyDef), glyph: e.glyph ?? '◆', id }
    led.enemies.push(id)
    rep.added.push('enemy:' + id)
  }

  for (const raw of m.potions ?? []) {
    const p = raw as Partial<PotionDef>
    const id = String(p.id ?? '')
    if (!ID_RE.test(id) || POTIONS[id]) { warn(`potion "${id}" invalid or collides`); continue }
    if (!p.name || !['common', 'rare'].includes(p.rarity as string) || !['enemy', 'none'].includes(p.target as string) ||
        !validEffects(p.effects, CARD_EFFECTS, warn)) {
      warn(`potion "${id}" failed validation`)
      continue
    }
    POTIONS[id] = { ...(p as PotionDef), sym: p.sym ?? '◆', id }
    led.potions.push(id)
    rep.added.push('potion:' + id)
  }

  for (const raw of m.events ?? []) {
    const ev = raw as Partial<EventDef>
    const id = String(ev.id ?? '')
    if (!ID_RE.test(id) || EVENTS.some((x) => x.id === id)) { warn(`event "${id}" invalid or collides`); continue }
    const choicesOk = Array.isArray(ev.choices) && ev.choices.length >= 1 && ev.choices.length <= 4 &&
      ev.choices.every((ch: any) => typeof ch?.label === 'string' && typeof ch?.detail === 'string' &&
        Array.isArray(ch?.outcomes) && ch.outcomes.every((o: Outcome) => OUTCOMES.has(o?.k)))
    if (!ev.name || !ev.text || !choicesOk) { warn(`event "${id}" failed validation`); continue }
    EVENTS.push({ ...(ev as EventDef), glyph: ev.glyph ?? '◆', id })
    led.events.push(id)
    rep.added.push('event:' + id)
  }

  for (const raw of m.emotes ?? []) {
    const e = raw as Partial<EmoteDef>
    const id = String(e.id ?? '')
    if (!ID_RE.test(id) || EMOTES[id]) { warn(`emote "${id}" invalid or collides`); continue }
    const sym = String(e.sym ?? '').trim()
    const text = String(e.text ?? '').replace(/[\r\n\t]/g, ' ').trim()
    const zh = e.zh === undefined ? undefined : String(e.zh).replace(/[\r\n\t]/g, ' ').trim().slice(0, 40)
    if (!sym || sym.length > 4 || !text || text.length > 40) { warn(`emote "${id}" failed validation`); continue }
    EMOTES[id] = { id, sym, text, ...(zh ? { zh } : {}) }
    led.emotes.push(id)
    rep.added.push('emote:' + id)
  }

  for (const raw of m.characters ?? []) {
    const ch = raw as { base?: string; startingDeck?: unknown; startingRelic?: unknown }
    const base = ch.base as CharId
    if (!CHARS.includes(base)) { warn(`character tweak: base must be one of ${CHARS.join('/')}`); continue }
    const deck = Array.isArray(ch.startingDeck) ? ch.startingDeck.map(String) : null
    if (deck && (deck.length < 5 || deck.length > 15 || deck.some((c) => !CARDS[c]))) {
      warn(`character ${base}: startingDeck invalid`)
      continue
    }
    const relic = ch.startingRelic !== undefined ? String(ch.startingRelic) : null
    if (relic && !RELICS[relic]) { warn(`character ${base}: unknown startingRelic`); continue }
    led.loadouts.push([base, STARTER_DECKS[base], STARTER_RELICS[base]])
    if (deck) STARTER_DECKS[base] = deck
    if (relic) STARTER_RELICS[base] = relic
    rep.added.push('character:' + base)
  }

  ledger.set(m.id, led)
  return rep
}

/** Cleanly unload everything a mod registered (loadouts restored). */
export function removeMod(modId: string) {
  const led = ledger.get(modId)
  if (!led) return
  for (const id of led.cards) delete CARDS[id]
  for (const id of led.relics) delete RELICS[id]
  for (const id of led.enemies) delete ENEMIES[id]
  for (const id of led.potions) delete POTIONS[id]
  for (const id of led.events) {
    const at = EVENTS.findIndex((e) => e.id === id)
    if (at >= 0) EVENTS.splice(at, 1)
  }
  for (const id of led.emotes) delete EMOTES[id]
  for (const [base, deck, relic] of led.loadouts) {
    STARTER_DECKS[base] = deck
    STARTER_RELICS[base] = relic
  }
  ledger.delete(modId)
}

export function loadedMods(): string[] {
  return [...ledger.keys()]
}
