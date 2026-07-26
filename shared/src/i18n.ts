/**
 * Engine-side localization. Presentation-only: game state never contains
 * localized text, so locale is a render-time concern and PvP states stay
 * locale-agnostic. The client sets the locale once (and on toggle); all
 * engine text helpers (card/relic/enemy/status/event names + generated
 * rules text) read it.
 */
import { STATUS_INFO, type StatusId } from './types'
import { STATUS_ZH } from './locale-zh'

export type Locale = 'en' | 'zh'

let current: Locale = 'en'

export function setLocale(l: Locale) {
  current = l
}

export function getLocale(): Locale {
  return current
}

export const isZh = () => current === 'zh'

// --- Localized status accessors ---------------------------------------------

export function statusName(id: StatusId): string {
  return isZh() ? STATUS_ZH[id].name : STATUS_INFO[id].name
}

/** Tooltip template with {n} placeholder. */
export function statusDesc(id: StatusId): string {
  return isZh() ? STATUS_ZH[id].desc : STATUS_INFO[id].desc
}

/** Full rules text for "gain N of this status" on power cards. */
export function statusPowerText(id: StatusId): string | undefined {
  return isZh() ? STATUS_ZH[id].powerText : STATUS_INFO[id].powerText
}

// --- Engine-generated strings ------------------------------------------------

/** Fixed tokens and templated lines the engine itself produces. */
export const ES = {
  unplayable: () => (isZh() ? '无法打出。' : 'Unplayable.'),
  exhaust: () => (isZh() ? '消耗。' : 'Exhaust.'),
  glitchPain: () =>
    isZh()
      ? '回合结束时若此牌在你手中，失去 1 点生命。'
      : 'If this is in your hand at the end of your turn, lose 1 HP.',
  hpLoss: (n: number) => (isZh() ? `-${n} 生命` : `-${n} HP`),
  hpGain: (n: number) => (isZh() ? `+${n} 生命` : `+${n} HP`),
  maxHpGain: (n: number) => (isZh() ? `生命上限 +${n}` : `+${n} Max HP`),
  acquiredRelic: (name: string) => (isZh() ? `获得了「${name}」` : `Acquired ${name}`),
  noRelicsLeft: (gold: number) => (isZh() ? `没有剩余遗物 — +${gold}¤` : `No relics left — +${gold}¤`),
  addedCard: (name: string) => (isZh() ? `「${name}」加入了牌组` : `Added ${name}`),
  glitchInfects: () => (isZh() ? '一张「故障」感染了你的牌组' : 'A Glitch infects your deck'),
  upgradedCard: (name: string) => (isZh() ? `升级了「${name}+」` : `Upgraded ${name}+`),
  nothingToUpgrade: () => (isZh() ? '没有可升级的牌' : 'Nothing left to upgrade'),
  gotPotion: (name: string) => (isZh() ? `获得了「${name}」` : `Gained ${name}`),
  potionsFull: () => (isZh() ? '药剂栏已满' : 'Potion belt is full'),
}
