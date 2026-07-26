import { useState } from 'preact/hooks'
import { MAX_ASC } from '@neonspire/engine'
import { ascUnlocked, newGame, runHistory } from '../game'
import { hasSave, loadGame, screen } from '../store'
import { muted, sfx, toggleMute } from '../sfx'
import { lang, t, tf, toggleLang } from '../i18n'
import { SoundIcon } from '../sprites'

export function MenuScreen() {
  const [seedText, setSeedText] = useState('')
  const [asc, setAsc] = useState(0)
  const canContinue = hasSave()
  const maxAsc = ascUnlocked()
  const history = runHistory().slice(0, 5)

  const start = () => {
    sfx.click()
    const trimmed = seedText.trim()
    newGame(trimmed ? hashSeed(trimmed) : undefined, Math.min(asc, maxAsc))
  }

  const startDaily = () => {
    sfx.click()
    const today = new Date().toISOString().slice(0, 10)
    newGame(hashSeed('daily-' + today), 0)
  }

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
            class="btn big"
            onClick={() => {
              sfx.click()
              if (!loadGame()) newGame()
            }}
          >
            {t('continueRun')}
          </button>
        )}
        <button class="btn big pink" onClick={start}>
          {t('newRun')}
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
        <button class="btn big" onClick={startDaily}>
          {t('dailyRun')}
        </button>
        <button
          class="btn big purple"
          onClick={() => {
            sfx.click()
            screen.value = 'pvp'
          }}
        >
          {t('pvpDuel')}
        </button>
        <div class="seedrow">
          <input
            class="neon"
            placeholder={t('seedPlaceholder')}
            value={seedText}
            onInput={(e) => setSeedText((e.target as HTMLInputElement).value)}
          />
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
              <span class="hseed">#{h.seed}</span>
            </div>
          ))}
        </div>
      )}

      <small style={{ maxWidth: '460px', textAlign: 'center', lineHeight: 1.6 }}>{t('menuFooter')}</small>
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
