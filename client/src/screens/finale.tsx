import { useEffect } from 'preact/hooks'
import { newGame, backToMenu } from '../game'
import { defeatFx, victoryFx } from '../fx'
import { run } from '../store'
import { t, tf } from '../i18n'

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
        {props.win ? t('spireDeleted') : t('flatlined')}
      </div>
      <div class="sub" style={{ color: 'var(--dim)', maxWidth: '480px', lineHeight: 1.6 }}>
        {props.win ? t('winText') : t('loseText')}
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
