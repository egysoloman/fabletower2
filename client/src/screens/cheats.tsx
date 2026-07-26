/** Solo-mode cheat console: difficulty is a suggestion. */
import { useState } from 'preact/hooks'
import { CARDS, obtainableRelics, relicDesc, relicName, RELICS } from '@neonspire/engine'
import { CardById } from '../components'
import {
  cheatAddCard,
  cheatAddPotion,
  cheatAddRelic,
  cheatDraw,
  cheatEnergy,
  cheatFullHeal,
  cheatGold,
  cheatKillAll,
  cheatMaxHp,
  cheatRemoveCard,
  cheatUpgradeAll,
} from '../game'
import { cheatOpen, combat, run, screen } from '../store'
import { t } from '../i18n'
import { sfx } from '../sfx'

type Tab = 'main' | 'cards' | 'relics'

const CHEATABLE_SCREENS = new Set(['map', 'combat', 'reward', 'shop', 'rest', 'event'])

export function CheatMenu() {
  const [tab, setTab] = useState<Tab>('main')
  if (!cheatOpen.value) return null
  const r = run.value
  if (!r || !CHEATABLE_SCREENS.has(screen.value)) return null
  const cs = combat.value
  const inCombat = !!cs && !cs.over

  const close = () => {
    cheatOpen.value = false
    setTab('main')
  }

  if (tab === 'cards') {
    const pool = Object.values(CARDS).filter((c) => c.rarity !== 'special')
    return (
      <div class="overlay" onClick={close}>
        <div class="panel" onClick={(e) => e.stopPropagation()}>
          <h2 class="pink">{t('cheatAddCard')}</h2>
          <div class="sub">{t('cheatAddCardSub')}</div>
          <div class="gridcards">
            {pool.map((def) => (
              <CardById key={def.id} id={def.id} onClick={() => cheatAddCard(def.id)} />
            ))}
          </div>
          <button class="btn ghost" onClick={() => setTab('main')}>
            {t('back')}
          </button>
        </div>
      </div>
    )
  }

  if (tab === 'relics') {
    const pool = obtainableRelics(r.relics, true)
    return (
      <div class="overlay" onClick={close}>
        <div class="panel" onClick={(e) => e.stopPropagation()}>
          <h2 class="pink">{t('cheatAddRelic')}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '56vh', overflow: 'auto' }}>
            {pool.map((def) => (
              <div key={def.id} class="relic-offer" onClick={() => cheatAddRelic(def.id)}>
                <div class="rsym">{RELICS[def.id].sym}</div>
                <div>
                  <div class="rname">{relicName(def.id)}</div>
                  <div class="rdesc">{relicDesc(def.id)}</div>
                </div>
              </div>
            ))}
            {pool.length === 0 && <div class="sub">{t('empty')}</div>}
          </div>
          <button class="btn ghost" onClick={() => setTab('main')}>
            {t('back')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div class="overlay" onClick={close}>
      <div class="panel" onClick={(e) => e.stopPropagation()}>
        <h2 class="pink">{t('cheatTitle')}</h2>
        <div class="sub">{t('cheatSub')}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', maxWidth: '560px' }}>
          <button class="btn" onClick={cheatFullHeal}>{t('cheatFullHeal')}</button>
          <button class="btn" onClick={cheatGold}>{t('cheatGold')}</button>
          <button class="btn" onClick={cheatMaxHp}>{t('cheatMaxHp')}</button>
          <button class="btn purple" onClick={cheatUpgradeAll}>{t('cheatUpgradeAll')}</button>
          <button class="btn purple" onClick={() => (sfx.click(), setTab('cards'))}>{t('cheatAddCard')}</button>
          <button class="btn purple" onClick={() => (sfx.click(), setTab('relics'))}>{t('cheatAddRelic')}</button>
          <button class="btn purple" onClick={cheatRemoveCard}>{t('cheatRemove')}</button>
          <button class="btn" onClick={cheatAddPotion}>{t('cheatPotion')}</button>
        </div>
        {inCombat && (
          <>
            <div class="sub" style={{ letterSpacing: '0.3em', color: 'var(--pink)' }}>
              — {t('cheatCombat')} —
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
              <button class="btn pink" onClick={cheatKillAll}>{t('cheatKill')}</button>
              <button class="btn pink" onClick={cheatEnergy}>{t('cheatEnergy')}</button>
              <button class="btn pink" onClick={cheatDraw}>{t('cheatDraw')}</button>
            </div>
          </>
        )}
        <button class="btn ghost" onClick={close}>
          {t('close')}
        </button>
      </div>
    </div>
  )
}
