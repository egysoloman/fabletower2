/**
 * Readable enemy-intent labels. Attack numbers come from the live preview
 * (Weak/Vulnerable already applied); for mixed/buff moves we append the
 * non-attack part (e.g. "ATK 14 + STR2") so players can read the whole
 * move at a glance instead of a bare "+".
 */
import { ENEMIES, statusName, type Intent, type MoveDef } from '@neonspire/engine'
import { t } from './i18n'

/** The MoveDef behind an enemy's current intent, when one exists. */
export function enemyMove(e: { defId: string; intent: Intent | null }): MoveDef | undefined {
  if (!e.intent) return undefined
  return ENEMIES[e.defId]?.moves.find((m) => m.id === e.intent?.moveId)
}

/** Compact description of every non-attack effect in a move. */
function intentExtra(move?: MoveDef): string {
  if (!move) return ''
  const parts: string[] = []
  for (const eff of move.effects) {
    if (eff.k === 'atk') continue
    if (eff.k === 'buff') parts.push(`${statusName(eff.id)}${eff.n}`)
    else if (eff.k === 'buffAll') parts.push(`全${statusName(eff.id)}${eff.n}`)
    else if (eff.k === 'block') parts.push(t('intentDef'))
    else if (eff.k === 'heal') parts.push(`✚${eff.n}`)
    else if (eff.k === 'summon') parts.push(t('intentSummon'))
    else if (eff.k === 'debuff') parts.push(`${statusName(eff.id)}${eff.n}`)
    else if (eff.k === 'addCard') parts.push(t('intentAddCard'))
    else if (eff.k === 'cleanseSelf') parts.push(t('intentCleanse'))
  }
  return parts.join('·')
}

export function intentText(intent: Intent, move?: MoveDef): string {
  const extra = intentExtra(move)
  switch (intent.kind) {
    case 'attack':
      return `${t('intentAtk')} ${intent.dmg}${intent.times ? '×' + intent.times : ''}`
    case 'defend':
      return t('intentDef')
    case 'buff':
      return extra || t('intentBuf')
    case 'debuff':
      return extra ? `▼ ${extra}` : t('intentHex')
    case 'mixed':
      return `${t('intentAtk')} ${intent.dmg ?? '?'}${intent.times ? '×' + intent.times : ''}${extra ? ' + ' + extra : ' +'}`
  }
}
