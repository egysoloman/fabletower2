import { isZh } from './i18n'
import { EVENT_ZH } from './locale-zh'

export type Outcome =
  | { k: 'gold'; n: number }
  | { k: 'damage'; n: number }
  | { k: 'heal'; n: number }
  | { k: 'maxhp'; n: number }
  | { k: 'relic' }
  | { k: 'cardRandom'; rarity: 'common' | 'uncommon' | 'rare' }
  | { k: 'cardGlitch' }
  | { k: 'upgradeRandom' }
  | { k: 'removeChoose' }
  | { k: 'potion' }
  | { k: 'curse' }

export interface EventChoice {
  label: string
  detail: string
  outcomes: Outcome[]
  needGold?: number
}

export interface EventDef {
  id: string
  name: string
  glyph: string
  text: string
  choices: EventChoice[]
}

export function eventName(ev: EventDef): string {
  return isZh() ? (EVENT_ZH[ev.id]?.name ?? ev.name) : ev.name
}

export function eventText(ev: EventDef): string {
  return isZh() ? (EVENT_ZH[ev.id]?.text ?? ev.text) : ev.text
}

export function eventChoiceLabel(ev: EventDef, i: number): string {
  return isZh() ? (EVENT_ZH[ev.id]?.choices[i]?.label ?? ev.choices[i].label) : ev.choices[i].label
}

export function eventChoiceDetail(ev: EventDef, i: number): string {
  return isZh() ? (EVENT_ZH[ev.id]?.choices[i]?.detail ?? ev.choices[i].detail) : ev.choices[i].detail
}

export const EVENTS: EventDef[] = [
  {
    id: 'server',
    name: 'Abandoned Server Farm',
    glyph: '🏚',
    text: 'Racks of dead machines hum with residual charge. Something valuable is still plugged in — behind a mesh of live wires.',
    choices: [
      { label: 'JACK IN', detail: 'Gain a random relic. Take 12 damage.', outcomes: [{ k: 'relic' }, { k: 'damage', n: 12 }] },
      { label: 'WALK AWAY', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'courier',
    name: 'Black Market Courier',
    glyph: '🛵',
    text: 'A courier drone idles in the alley, cargo bay cracked open. "Prototype deck tech. No refunds. No questions."',
    choices: [
      { label: 'BUY THE CHIP', detail: 'Pay 50¤: add a random RARE card to your deck.', needGold: 50, outcomes: [{ k: 'gold', n: -50 }, { k: 'cardRandom', rarity: 'rare' }] },
      { label: 'DECLINE', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'shrine',
    name: 'Neon Shrine',
    glyph: '⛩',
    text: 'A shrine of stacked CRTs flickers in the dark. The static almost sounds like a voice offering you a trade.',
    choices: [
      { label: 'PRAY', detail: 'Upgrade a random card. Lose 8 HP.', outcomes: [{ k: 'upgradeRandom' }, { k: 'damage', n: 8 }] },
      { label: 'REST', detail: 'Heal 18 HP.', outcomes: [{ k: 'heal', n: 18 }] },
    ],
  },
  {
    id: 'cache',
    name: 'Corrupted Cache',
    glyph: '📦',
    text: 'A supply cache, seals broken, contents scrambled. The credits inside look real. The checksum does not.',
    choices: [
      { label: 'CRACK IT OPEN', detail: 'Gain 60¤. A Glitch is permanently added to your deck.', outcomes: [{ k: 'gold', n: 60 }, { k: 'cardGlitch' }] },
      { label: 'LEAVE IT', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'ghost',
    name: 'Ghost in the Shell',
    glyph: '🫥',
    text: 'A fragment of an old runner\'s consciousness drifts through your HUD. "Travel light," it whispers, "or grow strong."',
    choices: [
      { label: 'TRAVEL LIGHT', detail: 'Remove a card from your deck.', outcomes: [{ k: 'removeChoose' }] },
      { label: 'GROW STRONG', detail: 'Raise your Max HP by 6.', outcomes: [{ k: 'maxhp', n: 6 }] },
    ],
  },
  {
    id: 'terminal',
    name: 'Overclocked Terminal',
    glyph: '⌨',
    text: 'A dev terminal, still logged in, fans screaming at redline. The build pipeline is wide open — if you can stand the heat.',
    choices: [
      { label: 'HIJACK THE BUILD', detail: 'Upgrade 2 random cards. Take 10 damage.', outcomes: [{ k: 'upgradeRandom' }, { k: 'upgradeRandom' }, { k: 'damage', n: 10 }] },
      { label: 'STEP AWAY', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'broker',
    name: 'Data Broker',
    glyph: '🕴',
    text: '"Everything sells," the broker says, tapping a slate of grey-market listings. "Even the code you\'re carrying."',
    choices: [
      { label: 'SELL A CARD', detail: 'Remove a card from your deck and gain 45¤.', outcomes: [{ k: 'removeChoose' }, { k: 'gold', n: 45 }] },
      { label: 'DECLINE', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'quarantine',
    name: 'Quarantine Vault',
    glyph: '⚠',
    text: 'A sealed vault stamped with hazard glyphs. Whatever is inside was locked away for a reason — and it is still running.',
    choices: [
      { label: 'BREACH THE SEAL', detail: 'Add a random RARE card to your deck. A Glitch comes with it.', outcomes: [{ k: 'cardRandom', rarity: 'rare' }, { k: 'cardGlitch' }] },
      { label: 'LEAVE IT SEALED', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'backup',
    name: 'Backup Node',
    glyph: '◍',
    text: 'An intact backup node hums behind a cracked wall, brimming with clean state. Enough to restore — or to permanently extend.',
    choices: [
      { label: 'RESTORE', detail: 'Heal 25 HP.', outcomes: [{ k: 'heal', n: 25 }] },
      { label: 'EXTEND', detail: 'Raise your Max HP by 5.', outcomes: [{ k: 'maxhp', n: 5 }] },
    ],
  },
  {
    id: 'cursedware',
    name: 'Cursed Firmware',
    glyph: '☠',
    text: 'A payment terminal offers an absurd bounty for one small install. The changelog is a single line: "minor latency issues."',
    choices: [
      { label: 'INSTALL IT', detail: 'Gain 120¤. A Lag curse is permanently added to your deck.', outcomes: [{ k: 'gold', n: 120 }, { k: 'curse' }] },
      { label: 'REFUSE', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'dispenser',
    name: 'Med Dispenser',
    glyph: '✚',
    text: 'A field-medic dispenser, still stocked. The lock is broken and the expiry dates are… optimistic.',
    choices: [
      { label: 'RAID THE TRAY', detail: 'Gain a random potion and heal 5 HP.', outcomes: [{ k: 'potion' }, { k: 'heal', n: 5 }] },
      { label: 'LEAVE', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
]

/** Run-start bonus choice (Neow-style). Not part of the random event pool. */
export const BOOT_EVENT: EventDef = {
  id: 'boot',
  name: 'BOOT SEQUENCE',
  glyph: '⏻',
  text: 'The Spire\'s outer firewall parses your signature and hesitates. One free write to your loadout before the climb begins.',
  choices: [
    { label: 'REINFORCE', detail: 'Raise your Max HP by 8.', outcomes: [{ k: 'maxhp', n: 8 }] },
    { label: 'LIQUIDATE', detail: 'Gain 75¤.', outcomes: [{ k: 'gold', n: 75 }] },
    { label: 'SCAVENGE', detail: 'Gain a random relic.', outcomes: [{ k: 'relic' }] },
    { label: 'DEFRAG', detail: 'Remove a card from your deck.', outcomes: [{ k: 'removeChoose' }] },
  ],
}
