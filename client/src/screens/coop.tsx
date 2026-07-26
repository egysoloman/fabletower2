/**
 * Co-op screens: party setup, the shared map (host picks the path), team
 * combat against shared enemies, per-player rewards and rest choices.
 * Everything is server-authoritative; this file only renders and asks.
 */
import { useState } from 'preact/hooks'
import { CARDS, cardCost, cardName, type CharId } from '@neonspire/engine'
import { BlockChip, CardView, HpBar, StatusRow } from '../components'
import { anchorCenter, flyCard, fxPulses, registerAnchor, useShake } from '../fx'
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
  coopYou,
  coopConn,
  coopForm,
  coopLobby,
  coopReady,
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
          <span class={`turn-indicator ${myTurn ? 'you' : 'them'}`}>
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
                ref={(el) => registerAnchor('c' + i, el)}
              >
                {i === v.active && !v.over && <div class="turnchip">▶</div>}
                <BlockChip block={p.block} />
                <div class="glyph" style={{ opacity: v.downed[i] ? 0.3 : 1 }}>
                  <Sprite id="runner" size={44} />
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
        {phase === 'map' && m && (
          <>
            <div class="sub" style={{ color: 'var(--gold)' }}>
              {tf('actFloor', { act: m.act, floor: m.floor })} · {coopHost.value ? t('coopYouLead') : t('coopHostLeads')}
            </div>
            <div class="coopnodes">
              {(m.pos === null
                ? m.map.rows[0].map((n: any) => n.id)
                : (m.map.rows.flat().find((n: any) => n.id === m.pos)?.next ?? [])
              ).map((id: string) => {
                const node = m.map.rows.flat().find((n: any) => n.id === id)
                return (
                  <button
                    key={id}
                    class="btn"
                    disabled={!coopHost.value}
                    onClick={() => coopSend({ t: 'cooppick', id })}
                  >
                    {NODE_LABEL[node?.type ?? 'combat']} {t(('node_' + (node?.type ?? 'combat')) as Parameters<typeof t>[0])}
                  </button>
                )
              })}
            </div>
            <div class="coopparty-list">
              {m.party.map((p: any, i: number) => (
                <div key={i} class="hrow">
                  <span>{p.name}{i === m.you ? ' ★' : ''}</span>
                  <span>{p.hp}/{p.maxHp}</span>
                  <span>¤{p.gold}</span>
                  <span>{tf('deckN', { n: p.deckSize })}</span>
                </div>
              ))}
            </div>
          </>
        )}
        {phase === 'reward' && coopReward.value && (
          <>
            <h2 style={{ color: 'var(--gold)' }}>{t('spoils')}</h2>
            <div class="sub">+{coopReward.value.gold}¤{coopReward.value.relic ? ` · ${coopReward.value.relic}` : ''}</div>
            <div style={{ display: 'flex', gap: '12px' }}>
              {coopReward.value.cards.map((id: string) => (
                <div key={id} onClick={() => (coopSend({ t: 'cooptake', card: id, relic: true }), (coopReward.value = null), (coopPhase.value = 'map'))}>
                  <CardView card={{ uid: 0, id, up: false }} />
                </div>
              ))}
            </div>
            <button class="btn ghost" onClick={() => (coopSend({ t: 'cooptake', card: null, relic: true }), (coopReward.value = null), (coopPhase.value = 'map'))}>
              {t('skip')}
            </button>
          </>
        )}
        {phase === 'rest' && m && (
          <>
            <h2>{t('safehouse')}</h2>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button class="btn" onClick={() => coopSend({ t: 'cooprestpick', what: 'heal' })}>
                {t('coopRestHeal')}
              </button>
              {m.party.map((p: any, i: number) =>
                i === m.you ? null : (
                  <button key={i} class="btn ghost" onClick={() => coopSend({ t: 'cooprestpick', what: 'ally', ally: i })}>
                    {tf('coopRestAlly', { name: p.name })}
                  </button>
                ),
              )}
            </div>
          </>
        )}
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
