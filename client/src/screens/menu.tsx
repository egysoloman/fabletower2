import { useState } from 'preact/hooks'
import type { CharId } from '@neonspire/engine'
import { ascUnlocked, newGame, runHistory } from '../game'
import { CharSelect } from './charselect'
import { hasSave, loadGame, screen } from '../store'
import { muted, sfx, toggleMute } from '../sfx'
import { lang, t, tf, toggleLang } from '../i18n'
import { SoundIcon } from '../sprites'

export function MenuScreen() {
  const canContinue = hasSave()
  const history = runHistory().slice(0, 5)

  return (
    <div class="screen menu">
      <div>
        <div class="logo">
          NEON<span>SPIRE</span>
        </div>
        <div class="tagline" style={{ textAlign: 'center', marginTop: '10px' }}>
          {t('tagline')}
        </div>
      </div>

      <div class="menu-buttons">
        {canContinue && (
          <button
            class="btn"
            onClick={() => {
              sfx.click()
              if (!loadGame()) newGame()
            }}
          >
            {t('continueRun')}
          </button>
        )}
        <button class="btn big pink" onClick={() => (sfx.click(), (screen.value = 'newrun'))}>
          {t('newRun')}
        </button>
        <div class="mp-row">
          <button class="btn purple" onClick={() => (sfx.click(), (screen.value = 'pvp'))}>
            {t('pvpDuel')}
          </button>
          <button
            class="btn"
            style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}
            onClick={() => (sfx.click(), (screen.value = 'climb'))}
          >
            {t('climbRace')}
          </button>
          <button
            class="btn"
            style={{ borderColor: 'var(--green)', color: 'var(--green)' }}
            onClick={() => (sfx.click(), (screen.value = 'coop'))}
          >
            {t('coopMode')}
          </button>
        </div>
        <div class="seedrow">
          <button class="btn ghost" onClick={toggleLang}>
            {lang.value === 'zh' ? 'EN' : '中文'}
          </button>
          <button class="btn ghost" onClick={toggleMute}>
            <SoundIcon muted={muted.value} />
          </button>
        </div>
      </div>

      {history.length > 0 && (
        <div class="history">
          <div class="htitle">{t('historyTitle')}</div>
          {history.map((h, i) => (
            <div key={i} class="hrow">
              <span class={h.win ? 'hwin' : 'hloss'}>{h.win ? t('winShort') : t('lossShort')}</span>
              <span>{tf('actFloor', { act: h.act, floor: h.floor })}</span>
              {h.asc > 0 && <span>A{h.asc}</span>}
              {h.sc != null && <span class="hscore">{h.sc}</span>}
              <span class="hseed">#{h.seed}</span>
            </div>
          ))}
        </div>
      )}

      <small style={{ maxWidth: '460px', textAlign: 'center', lineHeight: 1.6 }}>{t('menuFooter')}</small>
    </div>
  )
}

/** Run-start loadout screen: pick your character, ascension and seed here. */
export function NewRunScreen() {
  const [seedText, setSeedText] = useState('')
  const [asc, setAsc] = useState(0)
  const [char, setChar] = useState<CharId>('runner')
  const maxAsc = ascUnlocked()

  const start = () => {
    sfx.click()
    const trimmed = seedText.trim()
    newGame(trimmed ? hashSeed(trimmed) : undefined, Math.min(asc, maxAsc), char)
  }

  const startDaily = () => {
    sfx.click()
    const today = new Date().toISOString().slice(0, 10)
    newGame(hashSeed('daily-' + today), 0, char)
  }

  return (
    <div class="screen menu">
      <div class="logo" style={{ fontSize: 'clamp(26px,5vw,44px)' }}>
        JACK<span>IN</span>
      </div>

      <CharSelect value={char} onChange={setChar} onStart={start} />

      <div class="menu-buttons">
        <button class="btn big pink" onClick={start}>
          {t('startRun')}
          {asc > 0 ? `  ·  A${asc}` : ''}
        </button>
        {maxAsc > 0 && (
          <div class="ascrow">
            <button class="btn ghost" onClick={() => setAsc(Math.max(0, asc - 1))} disabled={asc === 0}>
              −
            </button>
            <span class="asclabel" data-tip={t('ascTip')}>
              {tf('ascLabel', { n: asc })} / {maxAsc}
            </span>
            <button class="btn ghost" onClick={() => setAsc(Math.min(maxAsc, asc + 1))} disabled={asc >= maxAsc}>
              +
            </button>
          </div>
        )}
        {asc > 0 && <div class="ascmod">{t(`ascMod${asc}` as Parameters<typeof t>[0])}</div>}
        <div class="seedrow">
          <input
            class="neon"
            placeholder={t('seedPlaceholder')}
            value={seedText}
            onInput={(e) => setSeedText((e.target as HTMLInputElement).value)}
          />
          <button class="btn" onClick={startDaily}>
            {t('dailyRun')}
          </button>
        </div>
        <button class="btn ghost" onClick={() => (sfx.click(), (screen.value = 'menu'))}>
          {t('back')}
        </button>
      </div>
    </div>
  )
}

function hashSeed(s: string): number {
  const asNum = Number(s)
  if (Number.isFinite(asNum) && s.length > 0 && /^\d+$/.test(s)) return asNum >>> 0
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
