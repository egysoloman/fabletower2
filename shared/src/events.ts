import { isZh } from './i18n'
import { EVENT_ZH } from './locale-zh'

export type Outcome =
  | { k: 'gold'; n: number }
  | { k: 'damage'; n: number }
  | { k: 'heal'; n: number }
  | { k: 'maxhp'; n: number }
  | { k: 'relic' }
  | { k: 'cardRandomRare' }
  | { k: 'cardGlitch' }
  | { k: 'upgradeRandom' }
  | { k: 'removeChoose' }

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
      { label: 'BUY THE CHIP', detail: 'Pay 50¤: add a random RARE card to your deck.', needGold: 50, outcomes: [{ k: 'gold', n: -50 }, { k: 'cardRandomRare' }] },
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
]
