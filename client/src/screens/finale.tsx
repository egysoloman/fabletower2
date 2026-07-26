import { newGame, backToMenu } from '../game'
import { run } from '../store'

export function FinaleScreen(props: { win: boolean }) {
  const r = run.value
  return (
    <div class="screen finale">
      <div class={`big-title ${props.win ? 'win' : 'lose'}`}>
        {props.win ? 'SPIRE DELETED' : 'FLATLINED'}
      </div>
      <div class="sub" style={{ color: 'var(--dim)', maxWidth: '480px', lineHeight: 1.6 }}>
        {props.win
          ? 'THE ARCHITECT dissolves into static. The tower goes dark, floor by floor, and for the first time in years the city hears silence.'
          : 'Your deck scatters into the datastream. The Spire hums on, indifferent.'}
      </div>
      {r && (
        <div class="statgrid">
          <div>
            <b>{r.floor}</b>FLOORS
          </div>
          <div>
            <b>{r.act}</b>ACT
          </div>
          <div>
            <b>{r.deck.length}</b>CARDS
          </div>
          <div>
            <b>{r.relics.length}</b>RELICS
          </div>
          <div>
            <b>{r.gold}</b>CREDITS
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: '14px' }}>
        <button class="btn pink big" onClick={() => newGame()}>
          RUN IT BACK
        </button>
        <button class="btn ghost big" onClick={backToMenu}>
          MENU
        </button>
      </div>
      {r && <small style={{ color: 'var(--dim)' }}>seed: {r.seed}</small>}
    </div>
  )
}
