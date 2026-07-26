import { useEffect } from 'preact/hooks'
import { scoreRun, type ScoreLine } from '@neonspire/engine'
import { newGame, backToMenu } from '../game'
import { defeatFx, victoryFx } from '../fx'
import { run } from '../store'
import { t, tf, type Key } from '../i18n'

const SCORE_KEYS: Record<ScoreLine['k'], Key> = {
  floors: 'scFloors',
  acts: 'scActs',
  relics: 'scRelics',
  upgrades: 'scUpgrades',
  gold: 'scGold',
  asc: 'scAsc',
  win: 'scWin',
  deep: 'scDeep',
}

export function FinaleScreen(props: { win: boolean }) {
  const r = run.value
  const win = props.win

  useEffect(() => {
    // Set piece on entry; victory keeps celebrating in waves.
    if (win) {
      victoryFx(true)
      const encore = setInterval(() => victoryFx(true), 2600)
      const stop = setTimeout(() => clearInterval(encore), 8000)
      return () => {
        clearInterval(encore)
        clearTimeout(stop)
      }
    }
    defeatFx()
    const echo = setTimeout(() => defeatFx(), 700)
    return () => clearTimeout(echo)
  }, [win])
  return (
    <div class="screen finale">
      <div class={`big-title ${props.win ? 'win' : 'lose'}`}>
        {props.win ? (r && r.act >= 4 ? t('rootSevered') : t('spireDeleted')) : t('flatlined')}
      </div>
      <div class="sub" style={{ color: 'var(--dim)', maxWidth: '480px', lineHeight: 1.6 }}>
        {props.win ? (r && r.act >= 4 ? t('deepWinText') : t('winText')) : t('loseText')}
      </div>
      {r && (
        <div class="statgrid">
          <div>
            <b>{r.floor}</b>
            {t('stFloors')}
          </div>
          <div>
            <b>{r.act}</b>
            {t('stAct')}
          </div>
          <div>
            <b>{r.deck.length}</b>
            {t('stCards')}
          </div>
          <div>
            <b>{r.relics.length}</b>
            {t('stRelics')}
          </div>
          <div>
            <b>{r.gold}</b>
            {t('stCredits')}
          </div>
        </div>
      )}
      {r &&
        (() => {
          const sc = scoreRun(r, win)
          return (
            <div class="scorebox">
              <div class="scorehead">{t('scoreTitle')}</div>
              {sc.lines.map((l, i) => (
                <div class="scoreline" key={l.k} style={{ '--i': i }}>
                  <span>{l.k === 'win' ? t('scWin') : tf(SCORE_KEYS[l.k], { n: l.n })}</span>
                  <span class="pts">+{l.pts}</span>
                </div>
              ))}
              <div class="scoreline total" style={{ '--i': sc.lines.length }}>
                <span>{t('scoreTitle')}</span>
                <span class="pts">{sc.total}</span>
              </div>
            </div>
          )
        })()}
      <div style={{ display: 'flex', gap: '14px' }}>
        <button class="btn pink big" onClick={() => newGame()}>
          {t('runItBack')}
        </button>
        <button class="btn ghost big" onClick={backToMenu}>
          {t('menuBtn')}
        </button>
      </div>
      {r && <small style={{ color: 'var(--dim)' }}>{tf('seedLabel', { n: r.seed })}</small>}
    </div>
  )
}
