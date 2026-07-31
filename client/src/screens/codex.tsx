/**
 * Compendium: discovered cards / relics / potions / enemies / events, run
 * statistics, achievements and the daily leaderboard. Undiscovered entries
 * show as ??? — clicking a discovered entry opens a full mechanics sheet
 * (cards show both upgrade levels, enemies list every move's rules text).
 */
import { useEffect, useState } from 'preact/hooks'
import {
  BOOT_EVENT,
  CARDS,
  ENEMIES,
  EVENTS,
  POTIONS,
  RELICS,
  cardBaseName,
  describeMove,
  enemyActs,
  enemyKind,
  enemyName,
  eventChoiceDetail,
  eventChoiceLabel,
  eventName,
  eventText,
  moveName,
  potionDesc,
  potionName,
  relicDesc,
  relicName,
  statusName,
  type EventDef,
  type StatusId,
} from '@neonspire/engine'
import { CardById } from '../components'
import { ACHIEVEMENTS, achievements, codex, dailyBoard, runStats } from '../meta'
import { runHistory } from '../game'
import { BalanceReportPanel } from '../balance'
import { screen } from '../store'
import { fetchGlobalBoard, type GlobalBoard } from '../account'
import { sfx } from '../sfx'
import { lang, t, tf } from '../i18n'
import { Sprite } from '../sprites'

type Tab = 'cards' | 'relics' | 'potions' | 'enemies' | 'events' | 'ach' | 'stats'
type Detail = { kind: 'card' | 'relic' | 'potion' | 'enemy' | 'event'; id: string } | null

const rarKey = (r: string) => ('rar_' + r) as Parameters<typeof t>[0]

export function CodexScreen() {
  void lang.value
  const [tab, setTab] = useState<Tab>('cards')
  const [detail, setDetail] = useState<Detail>(null)
  const [global, setGlobal] = useState<GlobalBoard | null>(null)
  useEffect(() => {
    if (tab === 'stats') fetchGlobalBoard().then(setGlobal)
  }, [tab])
  const c = codex.value
  const ach = achievements.value
  const stats = runStats()
  const cardIds = Object.keys(CARDS).filter((id) => CARDS[id].rarity !== 'special')
  const relicIds = Object.keys(RELICS)
  const potionIds = Object.keys(POTIONS)
  const enemyIds = Object.keys(ENEMIES)
  const allEvents: EventDef[] = [BOOT_EVENT, ...EVENTS]
  const open = (kind: NonNullable<Detail>['kind'], id: string, known: boolean) => {
    if (!known) return
    sfx.click()
    setDetail({ kind, id })
  }

  return (
    <div class="screen menu">
      <div class="logo" style={{ fontSize: 'clamp(26px,5vw,44px)' }}>
        CO<span>DEX</span>
      </div>
      <div class="mp-row" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
        {(['cards', 'relics', 'potions', 'enemies', 'events', 'ach', 'stats'] as Tab[]).map((k) => (
          <button key={k} class={`btn ghost ${tab === k ? 'on' : ''}`} onClick={() => (sfx.click(), setTab(k))}>
            {t(('cx_' + k) as Parameters<typeof t>[0])}
          </button>
        ))}
      </div>

      {tab === 'cards' && (
        <div class="phase-in" style={{ width: 'min(96vw, 900px)' }}>
          <div class="sub">
            {tf('cxSeen', { a: Object.keys(c.cards).length, b: cardIds.length })} · {t('cxTapHint')}
          </div>
          <div class="cxgrid">
            {cardIds.map((id) => (
              <div
                key={id}
                class={`cxitem ${c.cards[id] ? 'open' : 'locked'}`}
                onClick={() => open('card', id, !!c.cards[id])}
              >
                {c.cards[id] ? cardBaseName(id) : '???'}
              </div>
            ))}
          </div>
        </div>
      )}
      {tab === 'relics' && (
        <div class="phase-in" style={{ width: 'min(96vw, 900px)' }}>
          <div class="sub">
            {tf('cxSeen', { a: Object.keys(c.relics).length, b: relicIds.length })} · {t('cxTapHint')}
          </div>
          <div class="cxgrid">
            {relicIds.map((id) => (
              <div
                key={id}
                class={`cxitem ${c.relics[id] ? 'open' : 'locked'}`}
                onClick={() => open('relic', id, !!c.relics[id])}
              >
                {c.relics[id] ? `${RELICS[id].sym} ${relicName(id)}` : '???'}
              </div>
            ))}
          </div>
        </div>
      )}
      {tab === 'potions' && (
        <div class="phase-in" style={{ width: 'min(96vw, 900px)' }}>
          <div class="sub">
            {tf('cxSeen', { a: Object.keys(c.potions).length, b: potionIds.length })} · {t('cxTapHint')}
          </div>
          <div class="cxgrid">
            {potionIds.map((id) => (
              <div
                key={id}
                class={`cxitem ${c.potions[id] ? 'open' : 'locked'}`}
                onClick={() => open('potion', id, !!c.potions[id])}
              >
                {c.potions[id] ? `${POTIONS[id].sym} ${potionName(id)}` : '???'}
              </div>
            ))}
          </div>
        </div>
      )}
      {tab === 'enemies' && (
        <div class="phase-in" style={{ width: 'min(96vw, 900px)' }}>
          <div class="sub">
            {tf('cxSeen', { a: Object.keys(c.enemies).length, b: enemyIds.length })} · {t('cxTapHint')}
          </div>
          <div class="cxgrid wide">
            {enemyIds.map((id) => {
              const kind = enemyKind(id)
              return (
                <div
                  key={id}
                  class={`cxitem ${c.enemies[id] ? 'open' : 'locked'}`}
                  onClick={() => open('enemy', id, !!c.enemies[id])}
                >
                  {c.enemies[id] ? (
                    <>
                      <Sprite id={id} size={30} />
                      <span>
                        {enemyName(id)}
                        {kind !== 'normal' && <span class={`cxbadge ${kind}`}>{t(kind === 'boss' ? 'cxBoss' : 'cxElite')}</span>}
                      </span>
                      <small>
                        {ENEMIES[id].hp[0]}-{ENEMIES[id].hp[1]} HP · {ENEMIES[id].moves.length} {t('cxMoves')}
                      </small>
                    </>
                  ) : (
                    '???'
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
      {tab === 'events' && (
        <div class="phase-in" style={{ width: 'min(96vw, 900px)' }}>
          <div class="sub">
            {tf('cxSeen', { a: Object.keys(c.events).length, b: allEvents.length })} · {t('cxTapHint')}
          </div>
          <div class="cxgrid">
            {allEvents.map((ev) => (
              <div
                key={ev.id}
                class={`cxitem ${c.events[ev.id] ? 'open' : 'locked'}`}
                onClick={() => open('event', ev.id, !!c.events[ev.id])}
              >
                {c.events[ev.id] ? `${ev.glyph} ${eventName(ev)}` : '???'}
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
          <BalanceReportPanel history={runHistory()} />
          <h2 style={{ marginTop: '10px' }}>{global ? t('cxDailyGlobal') : t('cxDaily')}</h2>
          {global && global.you && <div class="sub" style={{ color: 'var(--gold)' }}>{tf('cxYourRank', { n: global.you })}</div>}
          {global ? (
            <div class="achlist">
              {global.top.length === 0 && <div class="sub">{t('cxNoDaily')}</div>}
              {global.top.map((e) => (
                <div key={e.rank} class="achrow got">
                  <span class="asym">#{e.rank}</span>
                  <span><b>{e.score}</b><small>{e.name} · {e.char}</small></span>
                </div>
              ))}
            </div>
          ) : (
            <>
              {dailyBoard().length === 0 && <div class="sub">{t('cxNoDaily')}</div>}
              <div class="achlist">
                {dailyBoard().map((e, i) => (
                  <div key={i} class="achrow got">
                    <span class="asym">#{i + 1}</span>
                    <span><b>{e.score}</b><small>{e.ch}{e.win ? ' · WIN' : ''}</small></span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {detail && <DetailSheet detail={detail} onClose={() => setDetail(null)} />}

      <button class="btn ghost" onClick={() => (sfx.click(), (screen.value = 'menu'))}>
        {t('back')}
      </button>
    </div>
  )
}

/** Full mechanics sheet for one discovered entry. */
function DetailSheet(props: { detail: NonNullable<Detail>; onClose: () => void }) {
  const { kind, id } = props.detail
  return (
    <div class="overlay" onClick={props.onClose}>
      <div class="panel cxdetail" onClick={(e) => e.stopPropagation()}>
        {kind === 'card' && <CardSheet id={id} />}
        {kind === 'relic' && <RelicSheet id={id} />}
        {kind === 'potion' && <PotionSheet id={id} />}
        {kind === 'enemy' && <EnemySheet id={id} />}
        {kind === 'event' && <EventSheet id={id} />}
        <button class="btn ghost" onClick={props.onClose}>
          {t('close')}
        </button>
      </div>
    </div>
  )
}

/** Both upgrade levels side by side — the full effect text lives on each face. */
function CardSheet(props: { id: string }) {
  const def = CARDS[props.id]
  return (
    <>
      <h2>{cardBaseName(props.id)}</h2>
      <div class="cx-meta">
        {t(rarKey(def.rarity))}
        {def.char ? ` · ${t(('char' + def.char[0].toUpperCase() + def.char.slice(1)) as Parameters<typeof t>[0])}` : ''}
      </div>
      <div class="cx-pair">
        <div>
          <div class="cx-facelabel">{t('cxBase')}</div>
          <CardById id={props.id} />
        </div>
        <div>
          <div class="cx-facelabel gold">{t('cxUpgraded')}</div>
          <CardById id={props.id} up />
        </div>
      </div>
    </>
  )
}

function RelicSheet(props: { id: string }) {
  const def = RELICS[props.id]
  return (
    <>
      <h2>
        {def.sym} {relicName(props.id)}
      </h2>
      <div class="cx-meta">{t(rarKey(def.rarity))}</div>
      <div class="sub" style={{ maxWidth: '380px' }}>{relicDesc(props.id)}</div>
    </>
  )
}

function PotionSheet(props: { id: string }) {
  const def = POTIONS[props.id]
  return (
    <>
      <h2>
        {def.sym} {potionName(props.id)}
      </h2>
      <div class="cx-meta">{t(rarKey(def.rarity))}</div>
      <div class="sub" style={{ maxWidth: '380px' }}>{potionDesc(props.id)}</div>
    </>
  )
}

/** HP, where it appears, opening statuses, and every move's generated rules. */
function EnemySheet(props: { id: string }) {
  const def = ENEMIES[props.id]
  const kind = enemyKind(props.id)
  const acts = enemyActs(props.id)
  const traits = Object.entries(def.traits ?? {}).filter(([, v]) => (v ?? 0) !== 0)
  return (
    <>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
        <Sprite id={props.id} size={40} />
        {enemyName(props.id)}
        {kind !== 'normal' && <span class={`cxbadge ${kind}`}>{t(kind === 'boss' ? 'cxBoss' : 'cxElite')}</span>}
      </h2>
      <div class="cx-meta">
        {def.hp[0]}-{def.hp[1]} HP · {acts.length ? tf('cxActs', { a: acts.join(', ') }) : t('cxSummonOnly')}
      </div>
      {traits.length > 0 && (
        <div class="cx-meta">
          {t('cxTraits')}: {traits.map(([k, v]) => `${statusName(k as StatusId)} ${v}`).join(' · ')}
        </div>
      )}
      <div class="cx-movelist">
        {def.moves.map((mv) => (
          <div key={mv.id} class="cx-move">
            <b>{moveName(props.id, mv.id)}</b>
            <span>{describeMove(mv)}</span>
          </div>
        ))}
      </div>
    </>
  )
}

/** The event's story text plus every choice with its outcome line. */
function EventSheet(props: { id: string }) {
  const ev = props.id === BOOT_EVENT.id ? BOOT_EVENT : EVENTS.find((e) => e.id === props.id)
  if (!ev) return null
  return (
    <>
      <div class="event-glyph" style={{ margin: '0 auto' }}>
        <Sprite id={'ev-' + ev.id} size={52} />
      </div>
      <h2 class="pink">{eventName(ev)}</h2>
      <div class="sub" style={{ maxWidth: '420px' }}>{eventText(ev)}</div>
      <div class="cx-movelist">
        {ev.choices.map((_, i) => (
          <div key={i} class="cx-move">
            <b>{eventChoiceLabel(ev, i)}</b>
            <span>{eventChoiceDetail(ev, i)}</span>
          </div>
        ))}
      </div>
    </>
  )
}
