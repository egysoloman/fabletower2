/**
 * Co-op screens: party setup, the shared map (host picks the path), team
 * combat against shared enemies, per-player rewards and rest choices.
 * Everything is server-authoritative; this file only renders and asks.
 */
import { useEffect, useRef, useState } from 'preact/hooks'
import { CARDS, EVENTS, POTIONS, cardCost, cardName, coopChecksum, eventChoiceDetail, eventChoiceLabel, eventName, eventText, predictCoopPlay, previewCard, previewEnemyIntent, relicName, type CharId } from '@neonspire/engine'
import { BlockChip, CardById, CardView, HpBar, StatusRow } from '../components'
import { anchorCenter, burst, flyCard, fxPulses, processEvents, registerAnchor, useShake } from '../fx'
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
  coopMode,
  coopPredicted,
  coopRestDeck,
  coopResumeSaved,
  coopSavedSeat,
  coopShop,
  coopToast,
} from '../coopclient'
import { sfx } from '../sfx'
import { t, tf } from '../i18n'
import { Sprite } from '../sprites'
import { DraggableHand, dragHoverWho } from './hand'
import { charColor, lastChar } from './charselect'
import { CharPickButton, CharSelectPage, EmotePanel, MpConnect } from './mpsetup'
import { MapView, mapGeometry } from './mapview'
import { mpName } from '../mp'

export function CoopScreen() {
  const [char, setChar] = useState<CharId>(lastChar())
  const [picking, setPicking] = useState(false)
  const [size, setSize] = useState(2)
  const phase = coopPhase.value
  const shakeCls = useShake()
  /** Party members other than you — emote targets. */
  const emoteTargets = () => {
    const m = coopMap.value
    if (!m?.party) return []
    return m.party
      .map((p: any, i: number) => ({ idx: i, name: String(p.name ?? '') }))
      .filter((tg: { idx: number }) => tg.idx !== m.you)
  }
  const sendEmote = (m: { id?: string; text?: string; target?: number }) => coopSend({ t: 'emote', ...m })

  // Party-orbit overlay: track the current node's on-screen position.
  const coopSvg = useRef<SVGSVGElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [orbitPos, setOrbitPos] = useState<{ x: number; y: number } | null>(null)
  const mapPos = coopMap.value?.pos ?? null
  useEffect(() => {
    if (phase !== 'map' || !mapPos) {
      setOrbitPos(null)
      return
    }
    const raf = requestAnimationFrame(() => {
      const svg = coopSvg.current
      const wrap = wrapRef.current
      const mm = coopMap.value
      if (!svg || !wrap || !mm) return
      const node = mm.map.rows.flat().find((n: any) => n.id === mm.pos)
      if (!node) return
      const g = mapGeometry(mm.map)
      const sr = svg.getBoundingClientRect()
      const wr = wrap.getBoundingClientRect()
      setOrbitPos({
        x: sr.left - wr.left + (g.cx(node) / g.W) * sr.width,
        y: sr.top - wr.top + (g.cy(node) / g.H) * sr.height,
      })
    })
    return () => cancelAnimationFrame(raf)
  }, [phase, mapPos])

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
      const action = { t: 'play', hand: idx, target, ally: def.target === 'ally' ? you : undefined }
      // Hybrid: play the outcome instantly from a local prediction; the
      // authoritative reply snaps in behind it. Strict: wait for the server.
      if (coopMode.value === 'hybrid') {
        const sum = coopChecksum(v)
        const pred = predictCoopPlay(v, you, idx, target)
        if (pred) {
          coopPredicted.current = true
          coopView.value = pred.view
          processEvents(pred.events, { delay: 200 })
        }
        coopPending.value = true
        coopSend({ t: 'coopaction', action, sum })
        return
      }
      coopPending.value = true
      coopSend({ t: 'coopaction', action })
    }
    const enemyTargets = v.enemies.map((e: any, i: number) => (e.dead ? null : 'e' + i)).filter(Boolean) as string[]
    const hoverWho = dragHoverWho.value
    const hoverEnemy = hoverWho?.startsWith('e') ? v.enemies[Number(hoverWho.slice(1))] : undefined
    const previewTargets =
      hoverEnemy && !hoverEnemy.dead ? [hoverEnemy] : v.enemies.filter((e: any) => !e.dead)

    return (
      <div class={`combat screen ${shakeCls}`}>
        <div class="topbar">
          <span class="stat" style={{ color: 'var(--green)' }}>{t('coopParty')}</span>
          <span
            class={`modebadge ${coopMode.value}`}
            data-tip={coopMode.value === 'strict' ? t('modeStrictTip') : t('modeHybridTip')}
          >
            {coopMode.value.toUpperCase()}
          </span>
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
                  {e.intent && (() => {
                    const focus = typeof e.focus === 'number' && v.players[e.focus] ? e.focus : v.active
                    const live = previewEnemyIntent(e, v.players[focus], v.asc) ?? e.intent
                    const text =
                      live.kind === 'attack' || live.kind === 'mixed'
                        ? `${t('intentAtk')} ${live.dmg ?? '?'}${live.times ? '×' + live.times : ''}`
                        : live.kind === 'defend'
                          ? t('intentDef')
                          : live.kind === 'buff'
                            ? t('intentBuf')
                            : t('intentHex')
                    return (
                      <div class={`intent ${live.kind}`}>
                        {text} <small>→ {v.players[focus]?.name}</small>
                      </div>
                    )
                  })()}
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
            previewCard={(card) =>
              previewCard(card, me, previewTargets, {
                relics: v.playerRelics[you] ?? [],
                firstCardFree: v.firstCardFree,
              })
            }
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
        <EmotePanel
          send={sendEmote}
          targets={emoteTargets()}
          dropZones={[
            ...v.players.map((_: unknown, i: number) => ({ anchor: 'c' + i, payload: { target: i } })),
            ...(v.enemies
              .map((e: any, i: number) => (e.dead ? null : { anchor: 'e' + i, payload: { etarget: i } }))
              .filter(Boolean) as { anchor: string; payload: Record<string, number> }[]),
          ]}
        />
        {coopToast.value && (
          <div class="turnbanner bare" style={{ top: '20%', fontSize: '15px', animation: 'none', color: 'var(--green)' }}>
            {coopToast.value}
          </div>
        )}
      </div>
    )
  }

  // --- Map / overlays ---------------------------------------------------------
  if (picking && phase === 'idle') {
    return <CharSelectPage value={char} onChange={setChar} onDone={() => setPicking(false)} />
  }
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
            {coopSavedSeat() && (
              <button
                class="btn big"
                style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}
                onClick={() => (sfx.click(), coopResumeSaved())}
              >
                ↻ {t('coopResume')}
              </button>
            )}
            <CharPickButton char={char} onOpen={() => setPicking(true)} />
            <div style={{ display: 'flex', gap: '10px' }}>
              {[2, 3, 4].map((n) => (
                <button key={n} class={`btn ${size === n ? 'pink' : 'ghost'}`} onClick={() => setSize(n)}>
                  {n}P
                </button>
              ))}
            </div>
            <MpConnect />
            <button class="btn big pink" onClick={() => coopQueue(mpName(), char, size)}>
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
          <div class="turnbanner bare" style={{ top: '20%', fontSize: '15px', animation: 'none', color: 'var(--green)' }}>
            {coopToast.value}
          </div>
        )}
        {(phase === 'map' || phase === 'shop' || phase === 'event' || phase === 'rest') && (
          <EmotePanel send={sendEmote} targets={emoteTargets()} />
        )}
        {phase === 'map' && m && (
          <>
            <div class="sub" style={{ color: 'var(--gold)' }}>
              {tf('actFloor', { act: m.act, floor: m.floor })} · {coopHost.value ? t('coopYouLead') : t('coopHostLeads')}
            </div>
            <div class="map-wrap coopmapwrap" ref={wrapRef}>
              <MapView
                map={m.map}
                pos={m.pos}
                path={m.path ?? []}
                open={
                  new Set<string>(
                    m.pos === null
                      ? m.map.rows[0].map((n: any) => n.id)
                      : (m.map.rows.flat().find((n: any) => n.id === m.pos)?.next ?? []),
                  )
                }
                onNode={(n) => coopSend(coopHost.value ? { t: 'cooppick', id: n.id } : { t: 'coopvote', id: n.id })}
                pc={charColor((m.party?.[0]?.char ?? 'runner') as never)}
                ringColors={(m.party ?? []).slice(1).map((p: any) => charColor((p.char ?? 'runner') as never))}
                votes={(() => {
                  const out: Record<string, string[]> = {}
                  for (const v of coopVotes.value) if (v.id) (out[v.id] ??= []).push(v.color)
                  return out
                })()}
                svgRef={(el) => (coopSvg.current = el)}
              />
              {orbitPos && (
                <div class="orbitwrap onmap" style={{ left: orbitPos.x + 'px', top: orbitPos.y + 'px' }}>
                  {m.party.map((p: any, i: number) => (
                    <div
                      key={i}
                      class="orbit-token"
                      style={{ '--oc': p.color, animationDelay: `${(-8 * i) / m.party.length}s` }}
                    >
                      <span style={{ color: p.color }}>
                        <Sprite id={p.char} size={22} />
                      </span>
                    </div>
                  ))}
                </div>
              )}
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
                    class={`bigchoice pop-in ${i % 2 ? 'pink' : ''} ${ch.needGold && coopEvent.value.gold < ch.needGold ? 'disabled' : ''}`}
                    style={{ '--i': i } as never}
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
