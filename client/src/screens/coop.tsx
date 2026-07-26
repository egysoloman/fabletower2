/**
 * Co-op screens: party setup, the shared map (host picks the path), team
 * combat against shared enemies, per-player rewards and rest choices.
 * Everything is server-authoritative; this file only renders and asks.
 */
import { useState } from 'preact/hooks'
import { CARDS, EVENTS, POTIONS, cardCost, cardName, eventChoiceDetail, eventChoiceLabel, eventName, eventText, relicName, type CharId } from '@neonspire/engine'
import { BlockChip, CardById, CardView, HpBar, StatusRow } from '../components'
import { anchorCenter, burst, flyCard, fxPulses, registerAnchor, useShake } from '../fx'
import {
  coopExit,
  coopHost,
  coopMap,
  coopNotice,
  coopPending,
  coopPhase,
  coopQueue,
  coopReward,
  coopSend,
  coopView,
  coopVotes,
  coopYou,
  coopConn,
  coopBelt,
  coopEvent,
  coopForm,
  coopLobby,
  coopReady,
  coopRestDeck,
  coopShop,
  coopToast,
} from '../coopclient'
import { sfx } from '../sfx'
import { t, tf } from '../i18n'
import { Sprite } from '../sprites'
import { DraggableHand } from './hand'

function defaultWsUrl(): string {
  const loc = window.location
  if (loc.protocol.startsWith('http')) {
    const dev = loc.port === '5173' || loc.port === '4173'
    if (dev) return `ws://${loc.hostname}:8787`
    return `${loc.protocol === 'https:' ? 'wss:' : 'ws:'}//${loc.host}`
  }
  return 'ws://localhost:8787'
}

const NODE_LABEL: Record<string, string> = {
  combat: '⚔', elite: '☠', boss: '◆', rest: '✚', treasure: '¤', shop: '$', event: '?',
}

export function CoopScreen() {
  const [url, setUrl] = useState(defaultWsUrl())
  const [name, setName] = useState('RUNNER')
  const [char, setChar] = useState<CharId>('runner')
  const [size, setSize] = useState(2)
  const phase = coopPhase.value
  const shakeCls = useShake()

  // --- Combat ---------------------------------------------------------------
  if (phase === 'combat' && coopView.value) {
    const v = coopView.value
    const you = coopYou.value
    const me = v.players[you]
    const myTurn = v.active === you && !v.over && !v.downed[you]
    const pending = coopPending.value
    const hand = me.hand as { uid: number; id: string; up: boolean }[]
    const playableSet = new Set(
      myTurn
        ? hand.map((c, i) => (!CARDS[c.id]?.unplayable && me.energy >= cardCost(c) ? i : -1)).filter((i) => i >= 0)
        : [],
    )
    const play = (idx: number, who: string | undefined, from?: { x: number; y: number }) => {
      if (!myTurn || pending) return
      const card = hand[idx]
      if (!card) return
      const def = CARDS[card.id]
      const target = who?.startsWith('e') ? Number(who.slice(1)) : undefined
      const dest = anchorCenter(who ?? 'c' + you)
      if (from && dest) {
        flyCard(from, dest, def.type, cardName(card))
        sfx.whoosh()
      }
      sfx.play()
      coopPending.value = true
      coopSend({ t: 'coopaction', action: { t: 'play', hand: idx, target, ally: def.target === 'ally' ? you : undefined } })
    }
    const enemyTargets = v.enemies.map((e: any, i: number) => (e.dead ? null : 'e' + i)).filter(Boolean) as string[]

    return (
      <div class={`combat screen ${shakeCls}`}>
        <div class="topbar">
          <span class="stat" style={{ color: 'var(--green)' }}>{t('coopParty')}</span>
          <span class="spacer" />
          <span
            class={`turn-indicator ${myTurn ? 'you' : 'them'}`}
            style={{ color: coopMap.value?.party?.[v.active]?.color }}
          >
            {myTurn ? t('yourTurn') : tf('theirTurn', { name: v.players[v.active]?.name ?? '…' })}
          </span>
          <span class="spacer" />
        </div>
        <div class="arena">
          <div class="coopparty">
            {v.players.map((p: any, i: number) => (
              <div
                key={i}
                class={`player-zone coopmate ${v.downed[i] ? 'downed' : ''} ${fxPulses.value['c' + i] ?? ''}`}
                style={{ borderColor: coopMap.value?.party?.[i]?.color }}
                ref={(el) => registerAnchor('c' + i, el)}
              >
                {i === v.active && !v.over && <div class="turnchip">▶</div>}
                <BlockChip block={p.block} />
                <div class="glyph" style={{ opacity: v.downed[i] ? 0.3 : 1, color: coopMap.value?.party?.[i]?.color }}>
                  <Sprite id={coopMap.value?.party?.[i]?.char ?? 'runner'} size={44} />
                </div>
                <div class="pname">{p.name}{i === you ? ' ★' : ''}</div>
                <HpBar hp={p.hp} maxHp={p.maxHp} mine={i === you} />
                <StatusRow statuses={p.statuses} />
              </div>
            ))}
          </div>
          <div class="enemies">
            {v.enemies.map((e: any, i: number) =>
              e.dead ? null : (
                <div key={i} class={`enemy ${fxPulses.value['e' + i] ?? ''}`} ref={(el) => registerAnchor('e' + i, el)}>
                  {e.intent && (
                    <div class="intent">
                      {e.intent.kind === 'attack' || e.intent.kind === 'mixed'
                        ? `${t('intentAtk')} ${e.intent.dmg ?? '?'}${e.intent.times ? '×' + e.intent.times : ''}`
                        : e.intent.kind === 'defend'
                          ? t('intentDef')
                          : e.intent.kind === 'buff'
                            ? t('intentBuf')
                            : t('intentHex')}
                    </div>
                  )}
                  <div class="glyph">
                    <Sprite id={e.defId} size={52} />
                  </div>
                  <div class="ename">{e.name}</div>
                  <HpBar hp={e.hp} maxHp={e.maxHp} />
                  <StatusRow statuses={e.statuses} />
                </div>
              ),
            )}
          </div>
        </div>
        {coopBelt.value.length > 0 && (
          <div class="potionbelt incombat">
            {coopBelt.value.map((pid, i) => (
              <div class="potionwrap" key={i}>
                <div
                  class={`potion ${POTIONS[pid]?.rarity ?? 'common'} usable`}
                  data-tip={pid}
                  onClick={() => {
                    const needsTarget = POTIONS[pid]?.target === 'enemy'
                    const tgt = needsTarget ? Number((enemyTargets[0] ?? 'e0').slice(1)) : undefined
                    coopSend({ t: 'cooppotion', idx: i, target: tgt })
                    sfx.heal()
                  }}
                >
                  {POTIONS[pid]?.sym ?? '?'}
                </div>
              </div>
            ))}
          </div>
        )}
        <div class="dock">
          <DraggableHand
            cards={hand}
            playable={playableSet}
            targets={myTurn && !pending ? enemyTargets : []}
            disabled={!myTurn || pending}
            onCardClick={(i) => playableSet.has(i) && play(i, enemyTargets[0])}
            onPlay={play}
          />
          <button
            class="btn pink endturn"
            disabled={!myTurn || pending}
            onClick={() => {
              coopPending.value = true
              coopSend({ t: 'coopaction', action: { t: 'end' } })
            }}
          >
            {t('endTurn')}
          </button>
        </div>
        <div class="commrow" style={{ bottom: 'auto', top: '52px' }}>
          {(['go', 'wait', 'help', 'gg'] as const).map((k) => (
            <button key={k} class="btn ghost" onClick={() => coopSend({ t: 'coopcomm', k })}>
              {t(('comm_' + k) as Parameters<typeof t>[0])}
            </button>
          ))}
        </div>
        {coopToast.value && (
          <div class="turnbanner" style={{ top: '20%', fontSize: '15px', animation: 'none', color: 'var(--green)' }}>
            {coopToast.value}
          </div>
        )}
      </div>
    )
  }

  // --- Map / overlays ---------------------------------------------------------
  const m = coopMap.value
  return (
    <div class="screen menu">
      <div class="logo" style={{ fontSize: 'clamp(28px,5vw,46px)' }}>
        CO<span>OP</span>
      </div>
      <div class="pvp-status">
        {phase === 'idle' && (
          <>
            <div class="sub" style={{ maxWidth: '460px', textAlign: 'center', lineHeight: 1.6 }}>{t('coopIntro')}</div>
            <div class="charrow">
              {(['runner', 'vector', 'ghost', 'array'] as CharId[]).map((c) => (
                <div key={c} class={`charcard ${c} ${char === c ? 'picked' : ''}`} onClick={() => (sfx.click(), setChar(c))}>
                  <Sprite id={c} size={34} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              {[2, 3, 4].map((n) => (
                <button key={n} class={`btn ${size === n ? 'pink' : 'ghost'}`} onClick={() => setSize(n)}>
                  {n}P
                </button>
              ))}
            </div>
            <input class="neon" style={{ width: '300px' }} value={name} maxLength={16} onInput={(e) => setName((e.target as HTMLInputElement).value)} placeholder={t('handlePlaceholder')} />
            <input class="neon" style={{ width: '300px' }} value={url} onInput={(e) => setUrl((e.target as HTMLInputElement).value)} placeholder="ws://server:8787" />
            <button class="btn big pink" onClick={() => coopQueue(url, name, char, size)}>
              {t('coopFind')}
            </button>
          </>
        )}
        {(phase === 'connecting' || phase === 'queued') && (
          <>
            <div class="pulse">{t('coopGathering')}</div>
            {coopLobby.value && (
              <div class="lobbylist">
                {coopLobby.value.members.map((m: string) => (
                  <div key={m} class="lobbyrow">{m}</div>
                ))}
                {Array.from({ length: Math.max(0, coopLobby.value.need) }).map((_, i) => (
                  <div key={'w' + i} class="lobbyrow empty">{t('lobbyWaiting')}</div>
                ))}
              </div>
            )}
          </>
        )}
        {phase === 'form' && coopForm.value && (
          <div class="panel popin">
            <h2>{t('formTitle')}</h2>
            <div class="lobbylist">
              {coopForm.value.map((m: any) => (
                <div key={m.tag} class={`lobbyrow ${m.ready ? 'ready' : ''}`}>
                  <Sprite id={m.char} size={26} />
                  <span>{m.tag}</span>
                  <span class="rdy">{m.ready ? t('readyYes') : t('readyWait')}</span>
                </div>
              ))}
            </div>
            <button class="btn big pink" onClick={coopReady}>
              {t('readyBtn')}
            </button>
          </div>
        )}
        {coopToast.value && (
          <div class="turnbanner" style={{ top: '20%', fontSize: '15px', animation: 'none', color: 'var(--green)' }}>
            {coopToast.value}
          </div>
        )}
        {(phase === 'map' || phase === 'combat') && (
          <div class="commrow">
            {(['go', 'wait', 'help', 'gg'] as const).map((k) => (
              <button key={k} class="btn ghost" onClick={() => coopSend({ t: 'coopcomm', k })}>
                {t(('comm_' + k) as Parameters<typeof t>[0])}
              </button>
            ))}
          </div>
        )}
        {phase === 'map' && m && (
          <>
            <div class="sub" style={{ color: 'var(--gold)' }}>
              {tf('actFloor', { act: m.act, floor: m.floor })} · {coopHost.value ? t('coopYouLead') : t('coopHostLeads')}
            </div>
            <div class="orbitwrap" data-tip={t('partyHere')}>
              {m.party.map((p: any, i: number) => (
                <div
                  key={i}
                  class="orbit-token"
                  style={{ '--oc': p.color, animationDelay: `${(-8 * i) / m.party.length}s` }}
                  data-tip={p.name}
                >
                  <span style={{ color: p.color }}>
                    <Sprite id={p.char} size={26} />
                  </span>
                </div>
              ))}
              <div class="orbit-core" />
            </div>
            <div class="coopnodes">
              {(m.pos === null
                ? m.map.rows[0].map((n: any) => n.id)
                : (m.map.rows.flat().find((n: any) => n.id === m.pos)?.next ?? [])
              ).map((id: string) => {
                const node = m.map.rows.flat().find((n: any) => n.id === id)
                const voters = coopVotes.value.filter((v) => v.id === id)
                return (
                  <button
                    key={id}
                    class="btn coopnode"
                    onClick={() => coopSend(coopHost.value ? { t: 'cooppick', id } : { t: 'coopvote', id })}
                  >
                    {NODE_LABEL[node?.type ?? 'combat']} {t(('node_' + (node?.type ?? 'combat')) as Parameters<typeof t>[0])}
                    {voters.length > 0 && (
                      <span class="voterow">
                        {voters.map((v) => (
                          <span key={v.i} class="votedot" style={{ background: v.color }} data-tip={v.name} />
                        ))}
                        {coopHost.value && <small class="votecount">{tf('votesN', { n: voters.length })}</small>}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            {!coopHost.value && <div class="sub" style={{ fontSize: '11px' }}>{t('voteHint')}</div>}
            <div class="coopparty-list">
              {m.party.map((p: any, i: number) => (
                <div key={i} class="hrow" style={{ borderLeft: `3px solid ${p.color ?? 'transparent'}`, paddingLeft: '8px' }}>
                  <span style={{ color: p.color }}>{p.name}{i === m.you ? ' ★' : ''}</span>
                  <span>{p.hp}/{p.maxHp}</span>
                  <span>¤{p.gold}</span>
                  <span>{tf('deckN', { n: p.deckSize })}</span>
                </div>
              ))}
            </div>
          </>
        )}
        {phase === 'reward' && coopReward.value && (
          <div class="phase-in">
            <h2 style={{ color: 'var(--gold)' }}>{t('spoils')}</h2>
            <div class="sub">+{coopReward.value.gold}¤{coopReward.value.relic ? ` · ${coopReward.value.relic}` : ''}</div>
            <div class="cardrow" style={{ display: 'flex', gap: '12px' }}>
              {coopReward.value.cards.map((id: string, i: number) => (
                <div key={id} onClick={() => (coopSend({ t: 'cooptake', card: id, relic: true }), (coopReward.value = null), (coopPhase.value = 'map'))}>
                  <CardView card={{ uid: 0, id, up: false }} cls="reveal" style={{ '--reveal': `${i * 110}ms` } as never} />
                </div>
              ))}
            </div>
            <button class="btn ghost" onClick={() => (coopSend({ t: 'cooptake', card: null, relic: true }), (coopReward.value = null), (coopPhase.value = 'map'))}>
              {t('skip')}
            </button>
          </div>
        )}
        {phase === 'rest' && m && (
          <div class="phase-in panel restglow">
            <h2>{t('safehouse')}</h2>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button class="btn" onClick={() => coopSend({ t: 'cooprestpick', what: 'heal' })}>
                {t('coopRestHeal')}
              </button>
              <details>
                <summary class="btn" style={{ display: 'inline-block', cursor: 'pointer' }}>{t('patch')}</summary>
                <div class="gridcards" style={{ maxWidth: '640px' }}>
                  {coopRestDeck.value.filter((c: any) => !c.up && CARDS[c.id]?.rarity !== 'special').map((c: any, i: number) => (
                    <div key={c.uid} style={{ '--fan': Math.min(i, 14) } as never} onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, '#ffd166', 16, 3.2); coopSend({ t: 'cooprestpick', what: 'upgrade', uid: c.uid }); sfx.heal() }}>
                      <CardView card={c} />
                    </div>
                  ))}
                </div>
              </details>
              <details>
                <summary class="btn ghost" style={{ display: 'inline-block', cursor: 'pointer' }}>{t('removeTitle')}</summary>
                <div class="gridcards" style={{ maxWidth: '640px' }}>
                  {coopRestDeck.value.map((c: any, i: number) => (
                    <div key={c.uid} style={{ '--fan': Math.min(i, 14) } as never} onClick={() => coopSend({ t: 'cooprestpick', what: 'remove', uid: c.uid })}>
                      <CardView card={c} />
                    </div>
                  ))}
                </div>
              </details>
              {m.party.map((p: any, i: number) =>
                i === m.you ? null : (
                  <button key={i} class="btn ghost" onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); burst(r.left + r.width / 2, r.top, '#3dffa2', 18, 3); coopSend({ t: 'cooprestpick', what: 'ally', ally: i }); sfx.heal() }}>
                    {tf('coopRestAlly', { name: p.name })}
                  </button>
                ),
              )}
            </div>
          </div>
        )}
        {phase === 'shop' && coopShop.value && (
          <div class="phase-in">
            <h2 style={{ color: 'var(--gold)' }}>{t('blackMarket')}</h2>
            <div class="sub" style={{ fontStyle: 'italic' }}>{t('shopkeeper')}</div>
            <div class="sub">¤{coopShop.value.gold}</div>
            <div class="cardrow" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {coopShop.value.stock.cards.map((it: any, i: number) => (
                <div key={i} class={`shopitem ${it.sold ? 'soldout' : ''}`} style={{ '--reveal': `${i * 70}ms` } as never}>
                  <CardById id={it.id} />
                  <button class="btn" disabled={it.sold || coopShop.value.gold < it.price} onClick={() => coopSend({ t: 'coopbuy', kind: 'card', idx: i })}>
                    {it.sold ? t('sold') : `${it.price}¤`}
                  </button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {(coopShop.value.stock.potions ?? []).map((it: any, i: number) => (
                <button key={'p' + i} class="btn" style={{ borderColor: 'var(--green)', color: 'var(--green)' }} disabled={it.sold || coopShop.value.gold < it.price} onClick={() => coopSend({ t: 'coopbuy', kind: 'potion', idx: i })}>
                  {it.sold ? t('sold') : `${POTIONS[it.id]?.sym ?? '?'} ${it.price}¤`}
                </button>
              ))}
              {coopShop.value.stock.relics.map((it: any, i: number) => (
                <button key={i} class="btn" disabled={it.sold || coopShop.value.gold < it.price} onClick={() => coopSend({ t: 'coopbuy', kind: 'relic', idx: i })}>
                  {it.sold ? t('sold') : `${relicName(it.id)} · ${it.price}¤`}
                </button>
              ))}
              <details>
                <summary class="btn ghost" style={{ display: 'inline-block', cursor: 'pointer' }}>
                  {tf('purgeBtn', { n: coopShop.value.stock.removePrice })}
                </summary>
                <div class="gridcards" style={{ maxWidth: '640px' }}>
                  {(coopShop.value.deck ?? []).map((c: any, i: number) => (
                    <div key={c.uid} style={{ '--fan': Math.min(i, 14) } as never} onClick={() => coopSend({ t: 'coopbuy', kind: 'remove', uid: c.uid })}>
                      <CardView card={c} />
                    </div>
                  ))}
                </div>
              </details>
            </div>
            <button class="btn pink" onClick={() => coopSend({ t: 'coopshopdone' })}>
              {t('leave')}
            </button>
          </div>
        )}
        {phase === 'event' && coopEvent.value && (() => {
          const ev = EVENTS.find((e) => e.id === coopEvent.value.id)
          if (!ev) return null
          return (
            <div class="phase-in panel popin">
              <div class="event-glyph">
                <Sprite id={'ev-' + ev.id} size={60} />
              </div>
              <h2 class="pink">{eventName(ev)}</h2>
              <div class="sub">{eventText(ev)}</div>
              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {ev.choices.map((ch, i) => (
                  <div
                    key={i}
                    class={`bigchoice ${i % 2 ? 'pink' : ''} ${ch.needGold && coopEvent.value.gold < ch.needGold ? 'disabled' : ''}`}
                    onClick={() => (coopSend({ t: 'coopeventpick', choice: i }), sfx.click())}
                  >
                    <div class="t">{eventChoiceLabel(ev, i)}</div>
                    <div class="d">{eventChoiceDetail(ev, i)}</div>
                  </div>
                ))}
              </div>
              <div class="sub" style={{ fontSize: '11px' }}>{t('coopEventEach')}</div>
            </div>
          )
        })()}
        {(phase === 'victory' || phase === 'defeat' || phase === 'ended' || phase === 'error') && (
          <>
            <h2 class={phase === 'victory' ? '' : 'pink'}>
              {phase === 'victory' ? t('coopVictory') : phase === 'defeat' ? t('coopDefeat') : coopNotice.value || t('connLost')}
            </h2>
            <button class="btn" onClick={coopExit}>
              {t('menuBtn')}
            </button>
          </>
        )}
        {(phase === 'idle' || phase === 'connecting' || phase === 'queued') && (
          <button class="btn ghost" onClick={coopExit}>
            {t('back')}
          </button>
        )}
      </div>
    </div>
  )
}
