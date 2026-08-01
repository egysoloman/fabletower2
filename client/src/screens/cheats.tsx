/** Solo-mode cheat console: difficulty is a suggestion. */
import { useState } from 'preact/hooks'
import { CARDS, cardName, MAX_ASC, obtainableRelics, relicDesc, relicName, RELICS } from '@neonspire/engine'
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
  cheatGenerateCard,
  cheatRemoveCard,
  cheatUnlockAscensions,
  cheatUpgradeAll,
  ascUnlocked,
} from '../game'
import { cheatOpen, combat, run, screen } from '../store'
import { t, tf } from '../i18n'
import { sfx } from '../sfx'
import { cheatsEnabled } from '../account'

type Tab = 'main' | 'cards' | 'play' | 'relics'

const CHEATABLE_SCREENS = new Set(['map', 'combat', 'reward', 'shop', 'rest', 'event'])

/** Searchable, filterable card picker shared by ADD ANY CARD and PLAY ANY CARD. */
function CardPicker(props: {
  title: string
  sub?: string
  onPick: (id: string) => void
  onBack: () => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const [type, setType] = useState<'all' | 'attack' | 'skill' | 'power'>('all')
  const norm = q.trim().toLowerCase()
  const pool = Object.values(CARDS).filter((c) => c.rarity !== 'special')
  const shown = pool.filter((def) => {
    if (type !== 'all' && def.type !== type) return false
    if (!norm) return true
    const name = cardName({ uid: 0, id: def.id, up: false }).toLowerCase()
    return name.includes(norm) || def.id.toLowerCase().includes(norm)
  })
  return (
    <div class="overlay" onClick={props.onClose}>
      <div class="panel" onClick={(e) => e.stopPropagation()}>
        <h2 class="pink">{props.title}</h2>
        {props.sub && <div class="sub">{props.sub}</div>}
        <div class="cheat-filters">
          <input
            class="neon cheat-search"
            placeholder={t('cheatSearch')}
            value={q}
            onInput={(e) => setQ((e.target as HTMLInputElement).value)}
          />
          <div class="cheat-type">
            {(['all', 'attack', 'skill', 'power'] as const).map((k) => (
              <button
                key={k}
                class={`btn ${type === k ? 'on' : ''}`}
                onClick={() => setType(k)}
              >
                {k === 'all'
                  ? t('cheatTypeAll')
                  : t(k === 'attack' ? 'typeAttack' : k === 'skill' ? 'typeSkill' : 'typePower')}
              </button>
            ))}
          </div>
        </div>
        <div class="gridcards">
          {shown.map((def) => (
            <CardById key={def.id} id={def.id} onClick={() => props.onPick(def.id)} />
          ))}
          {shown.length === 0 && <div class="sub">{t('empty')}</div>}
        </div>
        <button class="btn ghost" onClick={props.onBack}>
          {t('back')}
        </button>
      </div>
    </div>
  )
}

export function CheatMenu() {
  const [tab, setTab] = useState<Tab>('main')
  const [relicQ, setRelicQ] = useState('')
  const [allAscUnlocked, setAllAscUnlocked] = useState(() => ascUnlocked() >= MAX_ASC)
  if (!cheatsEnabled.value || !cheatOpen.value) return null
  const r = run.value
  if (!r || !CHEATABLE_SCREENS.has(screen.value)) return null
  const cs = combat.value
  const inCombat = !!cs && !cs.over

  const close = () => {
    cheatOpen.value = false
    setTab('main')
  }

  if (tab === 'cards' || tab === 'play') {
    const play = tab === 'play'
    return (
      <CardPicker
        title={play ? t('cheatPlay') : t('cheatAddCard')}
        sub={play ? t('cheatPlaySub') : t('cheatAddCardSub')}
        onPick={play
          ? (id) => {
              if (cheatGenerateCard(id)) setTab('main')
            }
          : cheatAddCard}
        onBack={() => setTab('main')}
        onClose={close}
      />
    )
  }

  if (tab === 'relics') {
    const pool = obtainableRelics(r.relics, true)
    const norm = relicQ.trim().toLowerCase()
    const shown = pool.filter((def) => {
      if (!norm) return true
      return [def.id, def.name, def.desc, relicName(def.id), relicDesc(def.id)]
        .some((value) => value.toLowerCase().includes(norm))
    })
    return (
      <div class="overlay" onClick={close}>
        <div class="panel" onClick={(e) => e.stopPropagation()}>
          <h2 class="pink">{t('cheatAddRelic')}</h2>
          <div class="cheat-filters cheat-relic-filters">
            <input
              class="neon cheat-search"
              placeholder={t('cheatRelicSearch')}
              value={relicQ}
              onInput={(e) => setRelicQ((e.target as HTMLInputElement).value)}
            />
          </div>
          <div class="cheat-relic-list">
            {shown.map((def) => (
              <div key={def.id} class="relic-offer" onClick={() => cheatAddRelic(def.id)}>
                <div class="rsym">{RELICS[def.id].sym}</div>
                <div>
                  <div class="rname">{relicName(def.id)}</div>
                  <div class="rdesc">{relicDesc(def.id)}</div>
                </div>
              </div>
            ))}
            {shown.length === 0 && <div class="sub">{t('empty')}</div>}
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
          <button
            class="btn purple"
            disabled={allAscUnlocked}
            onClick={() => {
              cheatUnlockAscensions()
              setAllAscUnlocked(true)
            }}
          >
            {tf(allAscUnlocked ? 'cheatAscUnlocked' : 'cheatUnlockAsc', { max: MAX_ASC })}
          </button>
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
              <button class="btn pink" onClick={() => (sfx.click(), setTab('play'))}>{t('cheatPlay')}</button>
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
