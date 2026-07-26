import { newGame, backToMenu } from '../game'
import { run } from '../store'
import { t, tf } from '../i18n'

export function FinaleScreen(props: { win: boolean }) {
  const r = run.value
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
