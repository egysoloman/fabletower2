/**
 * Compendium: discovered cards/relics/enemies, run statistics, achievements
 * and the local daily leaderboard. Undiscovered entries show as ???.
 */
import { useState } from 'preact/hooks'
import { CARDS, ENEMIES, RELICS, cardBaseName, enemyName, relicDesc, relicName } from '@neonspire/engine'
import { ACHIEVEMENTS, achievements, codex, dailyBoard, runStats } from '../meta'
import { screen } from '../store'
import { sfx } from '../sfx'
import { t, tf } from '../i18n'
import { Sprite } from '../sprites'

type Tab = 'cards' | 'relics' | 'enemies' | 'ach' | 'stats'

export function CodexScreen() {
  const [tab, setTab] = useState<Tab>('cards')
  const c = codex.value
  const ach = achievements.value
  const stats = runStats()
  const cardIds = Object.keys(CARDS).filter((id) => CARDS[id].rarity !== 'special')
  const relicIds = Object.keys(RELICS)
  const enemyIds = Object.keys(ENEMIES)
  const seen = { cards: Object.keys(c.cards).length, relics: Object.keys(c.relics).length, enemies: Object.keys(c.enemies).length }

  return (
    <div class="screen menu">
      <div class="logo" style={{ fontSize: 'clamp(26px,5vw,44px)' }}>
        CO<span>DEX</span>
      </div>
      <div class="mp-row" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
        {(['cards', 'relics', 'enemies', 'ach', 'stats'] as Tab[]).map((k) => (
          <button key={k} class={`btn ghost ${tab === k ? 'on' : ''}`} onClick={() => (sfx.click(), setTab(k))}>
            {t(('cx_' + k) as Parameters<typeof t>[0])}
          </button>
        ))}
      </div>

      {tab === 'cards' && (
        <div class="phase-in" style={{ width: 'min(96vw, 900px)' }}>
          <div class="sub">{tf('cxSeen', { a: seen.cards, b: cardIds.length })}</div>
          <div class="cxgrid">
            {cardIds.map((id) => (
              <div key={id} class={`cxitem ${c.cards[id] ? '' : 'locked'}`} data-tip={c.cards[id] ? cardBaseName(id) : '???'}>
                {c.cards[id] ? cardBaseName(id) : '???'}
              </div>
            ))}
          </div>
        </div>
      )}
      {tab === 'relics' && (
        <div class="phase-in" style={{ width: 'min(96vw, 900px)' }}>
          <div class="sub">{tf('cxSeen', { a: seen.relics, b: relicIds.length })}</div>
          <div class="cxgrid">
            {relicIds.map((id) => (
              <div key={id} class={`cxitem ${c.relics[id] ? '' : 'locked'}`} data-tip={c.relics[id] ? `${relicName(id)}\n${relicDesc(id)}` : '???'}>
                {c.relics[id] ? `${RELICS[id].sym} ${relicName(id)}` : '???'}
              </div>
            ))}
          </div>
        </div>
      )}
      {tab === 'enemies' && (
        <div class="phase-in" style={{ width: 'min(96vw, 900px)' }}>
          <div class="sub">{tf('cxSeen', { a: seen.enemies, b: enemyIds.length })}</div>
          <div class="cxgrid wide">
            {enemyIds.map((id) => (
              <div key={id} class={`cxitem ${c.enemies[id] ? '' : 'locked'}`}>
                {c.enemies[id] ? (
                  <>
                    <Sprite id={id} size={30} />
                    <span>{enemyName(id)}</span>
                    <small>
                      {ENEMIES[id].hp[0]}-{ENEMIES[id].hp[1]} HP · {ENEMIES[id].moves.length} {t('cxMoves')}
                    </small>
                  </>
                ) : (
                  '???'
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {tab === 'ach' && (
        <div class="phase-in" style={{ width: 'min(96vw, 640px)' }}>
          <div class="sub">{tf('cxSeen', { a: Object.keys(ach).length, b: ACHIEVEMENTS.length })}</div>
          <div class="achlist">
            {ACHIEVEMENTS.map((id) => (
              <div key={id} class={`achrow ${ach[id] ? 'got' : ''}`}>
                <span class="asym">{ach[id] ? '★' : '☆'}</span>
                <span>
                  <b>{t(('ach_' + id) as Parameters<typeof t>[0])}</b>
                  <small>{t(('achd_' + id) as Parameters<typeof t>[0])}</small>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {tab === 'stats' && (
        <div class="phase-in panel">
          <div class="statgrid">
            <div><b>{stats.wins}</b>{t('cxWins')}</div>
            <div><b>{stats.losses}</b>{t('cxLosses')}</div>
            <div><b>{stats.favorite ? t(('char' + stats.favorite[0].toUpperCase() + stats.favorite.slice(1)) as Parameters<typeof t>[0]) : '—'}</b>{t('cxFav')}</div>
            <div><b>A{stats.highestAscWin}</b>{t('cxAsc')}</div>
            <div><b>{stats.bestScore}</b>{t('cxBest')}</div>
          </div>
          <h2 style={{ marginTop: '10px' }}>{t('cxDaily')}</h2>
          {dailyBoard().length === 0 && <div class="sub">{t('cxNoDaily')}</div>}
          <div class="achlist">
            {dailyBoard().map((e, i) => (
              <div key={i} class="achrow got">
                <span class="asym">#{i + 1}</span>
                <span><b>{e.score}</b><small>{e.ch}{e.win ? ' · WIN' : ''}</small></span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button class="btn ghost" onClick={() => (sfx.click(), (screen.value = 'menu'))}>
        {t('back')}
      </button>
    </div>
  )
}
