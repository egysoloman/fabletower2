/**
 * PvP duel screen. The client sends raw actions; ALL rules run server-side
 * through the same shared engine, and we just render the redacted views the
 * server sends back (opponent hand stays hidden).
 */
import { useEffect, useRef, useState } from 'preact/hooks'
import { CARDS, PVP_DRAFT_SIZE, cardName, cardRetains, obtainableCards, predictPvpPlay, previewCard, pvpChecksum, type CharId, type GameEvent, type MpMode, type PvpAction, type PvpView } from '@neonspire/engine'
import { BlockChip, CardView, HpBar, StatusRow, byName } from '../components'
import { charColor, lastChar } from './charselect'
import { CharPickButton, CharSelectPage, EmotePanel, MpConnect, queueIdentity, showIncomingEmote } from './mpsetup'
import { mpName, mpWsUrl } from '../mp'
import { apiBase } from '../account'
import {
  anchorCenter,
  defeatFx,
  energyRipple,
  flyCard,
  fxPulses,
  localWho,
  processEvents,
  registerAnchor,
  useShake,
  victoryFx,
} from '../fx'
import { pileView, screen } from '../store'
import { sfx } from '../sfx'
import { t, tf } from '../i18n'
import { Sprite } from '../sprites'
import { DraggableHand, dragHoverWho, dragMode } from './hand'
import { HandDrawFlights, sweepHandToDiscard } from './pilefx'

type Phase = 'setup' | 'connecting' | 'queued' | 'playing' | 'over' | 'error'

const rarityRank = { common: 0, uncommon: 1, rare: 2 } as const

function duelPool(char: CharId) {
  return obtainableCards(char).sort((a, b) => {
    const charOrder = Number(b.char === char) - Number(a.char === char)
    if (charOrder) return charOrder
    return rarityRank[a.rarity as keyof typeof rarityRank] - rarityRank[b.rarity as keyof typeof rarityRank]
  })
}

function recommendedDuelDraft(char: CharId): string[] {
  return duelPool(char).slice(0, PVP_DRAFT_SIZE).map((card) => card.id)
}

/** Lobby badge: fetches the server's current mode for display. */
function ModeBadgeFetch() {
  const [m, setM] = useState<string | null>(null)
  useEffect(() => {
    fetch(apiBase() + '/api/mpmode').then((r) => r.json()).then((d) => setM(d.mode)).catch(() => {})
  }, [])
  if (!m) return null
  return (
    <span class={`modebadge ${m}`} data-tip={m === 'strict' ? t('modeStrictTip') : t('modeHybridTip')}>
      {m.toUpperCase()}
    </span>
  )
}

export function PvpScreen() {
  const [char, setChar] = useState<CharId>(lastChar())
  const [picking, setPicking] = useState(false)
  const [draftOpen, setDraftOpen] = useState(false)
  const [draft, setDraft] = useState<string[]>(() => recommendedDuelDraft(char))
  const [chars, setChars] = useState<CharId[]>(['runner', 'runner'])
  const [phase, setPhase] = useState<Phase>('setup')
  const [view, setView] = useState<PvpView | null>(null)
  const [notice, setNotice] = useState('')
  const [forfeitWin, setForfeitWin] = useState(false)
  const [toast, setToast] = useState('')
  /** True while a play/end action awaits the server's response — blocks
   * follow-up actions so hand indices can never race the round-trip. */
  const [pending, setPending] = useState(false)
  const ws = useRef<WebSocket | null>(null)
  const toastTimer = useRef<number>()
  const token = useRef<string | null>(null)
  const retryTimer = useRef<number>()
  const retryDeadline = useRef(0)
  const [conn, setConn] = useState<'online' | 'reconnecting'>('online')
  const [mode, setMode] = useState<MpMode>('hybrid')
  const predicted = useRef(false)
  const [myTag, setMyTag] = useState('')
  const shakeCls = useShake()

  const showToast = (msg: string) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2200)
  }

  /** Open a socket wired with the shared message handler. */
  const openSocket = (onOpen: (sock: WebSocket) => void): WebSocket | null => {
    try {
      const sock = new WebSocket(mpWsUrl())
      ws.current = sock
      sock.onopen = () => onOpen(sock)
      sock.onerror = () => {
        if (!token.current) {
          setNotice(t('serverErr'))
          setPhase('error')
        }
      }
      sock.onclose = () => {
        if (ws.current !== sock) return
        // Seated in a live match: try to resume within the grace window.
        if (token.current) {
          setConn('reconnecting')
          if (!retryDeadline.current) retryDeadline.current = Date.now() + 4.5 * 60 * 1000
          if (Date.now() < retryDeadline.current) {
            retryTimer.current = window.setTimeout(() => {
              openSocket((s2) => s2.send(JSON.stringify({ t: 'resume', token: token.current })))
            }, 1500)
            return
          }
        }
        setPhase((p) => (p === 'playing' || p === 'queued' || p === 'connecting' ? 'error' : p))
        setNotice((n) => n || t('connLost'))
      }
      sock.onmessage = (msg) => {
        let data: any
        try {
          data = JSON.parse(String(msg.data))
        } catch {
          return
        }
        switch (data.t) {
          case 'hello':
            setMyTag(`${mpName()}#${data.vid}`)
            break
          case 'queued':
            setPhase('queued')
            break
          case 'emote':
            showIncomingEmote(data, (i) => 'p' + i)
            break
          case 'match':
            if (data.mode) setMode(data.mode)
            if (Array.isArray(data.chars)) setChars(data.chars)
            if (data.token) token.current = data.token
            retryDeadline.current = 0
            setConn('online')
            setView(data.view)
            setPending(false)
            setNotice('')
            setForfeitWin(false)
            setPhase('playing')
            if (!data.rejoin) sfx.win()
            break
          case 'resume-fail':
            token.current = null
            setNotice(t('connLost'))
            setPhase('error')
            break
          case 'rematch-wait':
            showToast(t('rematchWait'))
            break
          case 'rematch-offer':
            showToast(t('rematchOffer'))
            break
          case 'peer-conn':
            showToast(data.online ? t('oppBack') : t('oppDropped'))
            break
          case 'st': {
            if (data.mode) setMode(data.mode)
            const mine = data.by !== undefined && data.by === data.view?.you
            setView(data.view)
            setPending(false)
            if (data.corrected) showToast(t('desyncFixed'))
            // Hybrid: our own action already animated locally — the server
            // view just snaps in silently. Everything else animates as usual.
            if (!(mine && predicted.current && !data.corrected)) {
              processEvents((data.events ?? []) as GameEvent[], { delay: 220, step: 130 })
            }
            predicted.current = false
            if (data.view?.over) {
              setPhase('over')
            }
            break
          }
          case 'err':
            setPending(false)
            showToast(data.msg ?? 'rejected')
            break
          case 'opp-left':
            token.current = null
            setNotice(t('oppLeft'))
            setForfeitWin(true)
            setPhase('over')
            break
        }
      }
      return sock
    } catch {
      setNotice(t('badUrl'))
      setPhase('error')
      return null
    }
  }

  const connect = () => {
    if (draft.length !== PVP_DRAFT_SIZE) {
      setDraftOpen(true)
      return
    }
    setPhase('connecting')
    openSocket((sock) => sock.send(JSON.stringify({ t: 'queue', name: mpName(), char, draft, ...queueIdentity() })))
  }

  useEffect(
    () => () => {
      clearTimeout(retryTimer.current)
      const sock = ws.current
      ws.current = null
      try {
        sock?.send(JSON.stringify({ t: 'leave' }))
      } catch {
        /* already gone */
      }
      sock?.close()
    },
    [],
  )

  const youIdx = view?.you
  useEffect(() => {
    if (youIdx !== undefined) localWho.value = 'p' + youIdx
    return () => {
      localWho.value = 'p'
    }
  }, [youIdx])

  // Dramatic duel close-out.
  const winner = view?.over?.winner
  useEffect(() => {
    if (winner === undefined || youIdx === undefined) return
    if (winner === youIdx) victoryFx(true)
    else defeatFx()
  }, [winner])

  const send = (action: PvpAction) => {
    setPending(true)
    const sum = view ? pvpChecksum(view) : undefined
    ws.current?.send(JSON.stringify({ t: 'action', action, sum }))
  }

  const leave = () => {
    try {
      ws.current?.send(JSON.stringify({ t: 'leave' }))
    } catch {
      /* already gone */
    }
    token.current = null
    const sock = ws.current
    ws.current = null
    sock?.close()
    screen.value = 'menu'
  }

  const requestRematch = () => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ t: 'rematch' }))
      showToast(t('rematchWait'))
    } else {
      setView(null)
      setPhase('setup')
      setNotice('')
      setForfeitWin(false)
    }
  }

  if (phase !== 'playing' && phase !== 'over') {
    if (picking && phase === 'setup') {
      return (
        <CharSelectPage
          value={char}
          onChange={(next) => {
            setChar(next)
            setDraft(recommendedDuelDraft(next))
          }}
          onDone={() => setPicking(false)}
        />
      )
    }
    if (draftOpen && phase === 'setup') {
      const pool = duelPool(char)
      const full = draft.length >= PVP_DRAFT_SIZE
      const toggleDraft = (id: string) => {
        setDraft((current) =>
          current.includes(id)
            ? current.filter((pick) => pick !== id)
            : current.length < PVP_DRAFT_SIZE
              ? [...current, id]
              : current,
        )
      }
      return (
        <div class="screen menu pvp-draft-screen">
          <div class="panel pvp-draft-panel">
            <h2>{t('duelDraftTitle')}</h2>
            <div class="sub">{t('duelDraftDesc')}</div>
            <div class={`duel-draft-count ${full ? 'ready' : ''}`}>
              {tf('duelDraftCount', { n: draft.length, max: PVP_DRAFT_SIZE })}
            </div>
            <div class="gridcards duel-draft-grid">
              {pool.map((def, i) => {
                const selected = draft.includes(def.id)
                return (
                  <CardView
                    key={def.id}
                    card={{ uid: i + 1, id: def.id, up: false }}
                    cls={`picker-card duel-draft-card ${selected ? 'selected' : full ? 'unavailable' : ''}`}
                    onClick={() => toggleDraft(def.id)}
                  />
                )
              })}
            </div>
            <div class="duel-draft-actions">
              <button class="btn ghost" onClick={() => setDraft(recommendedDuelDraft(char))}>{t('duelDraftReset')}</button>
              <button class="btn pink" disabled={!full} onClick={() => setDraftOpen(false)}>{t('charConfirm')}</button>
            </div>
          </div>
        </div>
      )
    }
    return (
      <div class="screen menu">
        <div class="logo" style={{ fontSize: 'clamp(30px,6vw,54px)' }}>
          PVP<span>DUEL</span>
        </div>
        <div class="pvp-status">
          {phase === 'setup' && (
            <>
              <CharPickButton char={char} onOpen={() => setPicking(true)} />
              <button class="btn ghost duel-draft-open" onClick={() => setDraftOpen(true)}>
                {tf('duelDraftButton', { n: draft.length, max: PVP_DRAFT_SIZE })}
              </button>
              <div class="duel-draft-summary">
                <b>{t('duelStarterDeck')}</b>
                <span>+</span>
                <span>{draft.map((id) => cardName({ uid: 0, id, up: false })).join(' · ')}</span>
              </div>
              <MpConnect />
              <button class="btn big pink" disabled={draft.length !== PVP_DRAFT_SIZE} onClick={connect}>
                {t('findOpponent')}
              </button>
            </>
          )}
          {phase === 'connecting' && <div class="pulse">{t('connecting')}</div>}
          {phase === 'queued' && (
            <>
              <div class="pulse">{t('scanning')}</div>
              <ModeBadgeFetch />
              {myTag && <div style={{ color: 'var(--dim)', fontSize: '12px' }}>{tf('youAre', { tag: myTag })}</div>}
            </>
          )}
          {phase === 'error' && (
            <>
              <div style={{ color: 'var(--red)', maxWidth: '440px', textAlign: 'center', lineHeight: 1.6 }}>{notice}</div>
              <button class="btn" onClick={() => setPhase('setup')}>
                {t('retry')}
              </button>
            </>
          )}
          <button class="btn ghost" onClick={leave}>
            {t('back')}
          </button>
        </div>
      </div>
    )
  }

  if (!view) return null
  const me = view.sides[view.you]
  const them = view.sides[1 - view.you]
  const myTurn = view.active === view.you && !view.over
  const hand = me.hand ?? []
  const iWon = view.over ? view.over.winner === view.you : forfeitWin
  const meWho = 'p' + view.you
  const oppWho = 'p' + (1 - view.you)

  const playableSet = new Set(
    myTurn
      ? hand
          .map((c, i) => {
            const def = CARDS[c.id]
            const cost = c.up && def.upCost !== undefined ? def.upCost : def.cost
            return !def.unplayable && me.energy >= cost ? i : -1
          })
          .filter((i) => i >= 0)
      : [],
  )

  const playFromHand = (idx: number, _who: string | undefined, from?: { x: number; y: number }) => {
    if (!myTurn || pending) return
    const card = hand[idx]
    if (!card) return
    const def = CARDS[card.id]
    const dest = anchorCenter(def.target === 'enemy' ? oppWho : meWho)
    const src = from ?? anchorCenter(meWho)
    if (src && dest) {
      flyCard(src, dest, def.type, cardName(card))
      sfx.whoosh()
    }
    energyRipple()
    sfx.play()
    // Hybrid: play the outcome instantly from a local prediction; the
    // authoritative reply snaps in behind it (with a correction toast if
    // the states had diverged). Strict: wait for the server.
    if (mode === 'hybrid' && view) {
      const sum = pvpChecksum(view)
      const pred = predictPvpPlay(view, idx)
      if (pred) {
        predicted.current = true
        setView(pred.view)
        processEvents(pred.events, { delay: 200 })
      }
      setPending(true)
      ws.current?.send(JSON.stringify({ t: 'action', action: { t: 'play', hand: idx }, sum }))
      return
    }
    send({ t: 'play', hand: idx })
  }

  const oppHl = dragMode.value === 'target' ? (dragHoverWho.value === oppWho ? 'snap' : 'targetable') : ''

  return (
    <div class={`combat screen pvp-combat ${shakeCls}`}>
      <div class="topbar">
        <span class={`conndot ${conn}`} data-tip={conn === 'online' ? t('connOnline') : t('connReconnecting')} />
        <span class={`modebadge ${mode}`} data-tip={mode === 'strict' ? t('modeStrictTip') : t('modeHybridTip')}>
          {mode.toUpperCase()}
        </span>
        <span class="stat" style={{ color: 'var(--purple)' }}>
          {tf('pvpTurn', { n: view.turn })}
        </span>
        <span class="spacer" />
        <span class={`turn-indicator ${myTurn ? 'you' : 'them'}`}>
          {myTurn ? t('yourTurn') : tf('theirTurn', { name: them.name })}
        </span>
        <span class="spacer" />
        <span class="stat linkish" style={{ color: 'var(--dim)' }} onClick={leave}>
          {t('leaveBtn')}
        </span>
      </div>

      <div class="arena">
        <div class={`player-zone ${fxPulses.value[meWho] ?? ''}`} ref={(el) => registerAnchor('p' + view.you, el)}>
          <div
            class={`energy-orb ${fxPulses.value['orb'] ?? ''}`}
            data-tip={t('energyTip')}
            ref={(el) => registerAnchor('orb', el)}
          >
            {me.energy}/{me.energyMax}
          </div>
          <BlockChip block={me.block} />
          <div class="glyph" style={{ color: charColor(chars[view.you] ?? 'runner') }}>
            <Sprite id={chars[view.you] ?? 'runner'} size={58} />
          </div>
          <div class="pname">{tf('youSuffix', { name: me.name })}</div>
          <HpBar hp={me.hp} maxHp={me.maxHp} mine />
          <StatusRow statuses={me.statuses} />
          <div style={{ fontSize: '11px', color: 'var(--dim)' }}>
            {tf('pvpCounts', { a: me.drawCount, b: me.discard.length })}
          </div>
        </div>

        <div class={`opp-zone ${oppHl} ${fxPulses.value[oppWho] ?? ''}`} ref={(el) => registerAnchor('p' + (1 - view.you), el)}>
          <div class="facedown-row">
            {Array.from({ length: them.handCount }).map((_, i) => (
              <div key={i} class="facedown" />
            ))}
          </div>
          <BlockChip block={them.block} />
          <div class="glyph" style={{ color: charColor(chars[1 - view.you] ?? 'runner') }}>
            <Sprite id={chars[1 - view.you] ?? 'runner'} size={54} />
          </div>
          <div class="ename" style={{ fontFamily: 'var(--font-head)', fontSize: '12px', color: '#ffb8d9' }}>
            {them.name}
          </div>
          <HpBar hp={them.hp} maxHp={them.maxHp} />
          <StatusRow statuses={them.statuses} />
          <div style={{ fontSize: '11px', color: 'var(--dim)' }}>
            {tf('pvpCounts', { a: them.drawCount, b: them.discard.length })}
          </div>
        </div>
      </div>

      {toast && (
        <div class="turnbanner bare" style={{ top: '58%', fontSize: '16px', animation: 'none', color: 'var(--red)' }}>
          {toast}
        </div>
      )}

      <EmotePanel
        send={(m) => ws.current?.send(JSON.stringify({ t: 'emote', ...m }))}
        targets={[{ idx: 1 - view.you, name: them.name }]}
        dropZones={[
          { anchor: 'p' + view.you, payload: { target: view.you } },
          { anchor: 'p' + (1 - view.you), payload: { target: 1 - view.you } },
        ]}
      />

      {view.over || phase === 'over' ? (
        <div class="overlay">
          <div class="panel">
            <h2 class={iWon ? '' : 'pink'}>{iWon ? t('pvpVictory') : t('pvpDefeat')}</h2>
            <div class="sub">
              {view.over ? tf('flatlinedWho', { name: view.sides[view.over.winner === 0 ? 1 : 0].name }) : notice}
            </div>
            <button class="btn pink" onClick={requestRematch}>
              {t('rematch')}
            </button>
            <button class="btn ghost" onClick={leave}>
              {t('menuBtn')}
            </button>
          </div>
        </div>
      ) : (
        <div class="dock">
          <div
            class="pilebtn left"
            onClick={() => (pileView.value = {
              title: tf('drawPileTitle', { n: me.drawCount }),
              cards: [...(me.draw ?? [])].sort(byName),
            })}
          >
            {tf('drawBtn', { n: me.drawCount })}
          </div>
          <DraggableHand
            cards={hand}
            playable={playableSet}
            targets={myTurn && !pending ? [oppWho] : []}
            disabled={!myTurn || pending}
            previewCard={(card) => previewCard(card, me, [them])}
            onCardClick={(i) => playableSet.has(i) && playFromHand(i, oppWho)}
            onPlay={playFromHand}
          />
          <HandDrawFlights hand={hand} root=".pvp-combat" />
          <div
            class="pilebtn right"
            onClick={() => (pileView.value = {
              title: tf('discardPileTitle', { a: me.discard.length, b: me.exhausted.length }),
              cards: [...me.discard].sort(byName).concat([...me.exhausted].sort(byName)),
            })}
          >
            {tf('discardBtn', { n: me.discard.length })}
          </div>
          <button
            class="btn pink endturn"
            disabled={!myTurn || pending}
            onClick={() => {
              sweepHandToDiscard('.pvp-combat', hand, cardRetains)
              send({ t: 'end' })
            }}
          >
            {t('endTurn')}
          </button>
        </div>
      )}
    </div>
  )
}
