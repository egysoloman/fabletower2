/**
 * PvP duel screen. The client sends raw actions; ALL rules run server-side
 * through the same shared engine, and we just render the redacted views the
 * server sends back (opponent hand stays hidden).
 */
import { useEffect, useRef, useState } from 'preact/hooks'
import { CARDS, cardName, predictPvpPlay, pvpChecksum, type GameEvent, type MpMode, type PvpAction, type PvpView } from '@neonspire/engine'
import { BlockChip, CardView, HpBar, StatusRow } from '../components'
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
import { screen } from '../store'
import { sfx } from '../sfx'
import { t, tf } from '../i18n'
import { Sprite } from '../sprites'
import { DraggableHand, dragHoverWho, dragMode } from './hand'

type Phase = 'setup' | 'connecting' | 'queued' | 'playing' | 'over' | 'error'

function defaultWsUrl(): string {
  const loc = window.location
  if (loc.protocol.startsWith('http')) {
    const dev = loc.port === '5173' || loc.port === '4173'
    if (dev) return `ws://${loc.hostname}:8787`
    return `${loc.protocol === 'https:' ? 'wss:' : 'ws:'}//${loc.host}`
  }
  return 'ws://localhost:8787'
}

/** Lobby badge: fetches the server's current mode for display. */
function ModeBadgeFetch() {
  const [m, setM] = useState<string | null>(null)
  useEffect(() => {
    let base = ''
    const loc = window.location
    if (loc.port === '5173' || loc.port === '4173') base = `http://${loc.hostname}:8787`
    fetch(base + '/api/mpmode').then((r) => r.json()).then((d) => setM(d.mode)).catch(() => {})
  }, [])
  if (!m) return null
  return (
    <span class={`modebadge ${m}`} data-tip={m === 'strict' ? t('modeStrictTip') : t('modeHybridTip')}>
      {m.toUpperCase()}
    </span>
  )
}

export function PvpScreen() {
  const [url, setUrl] = useState(defaultWsUrl())
  const [name, setName] = useState('RUNNER')
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
  const [pileOpen, setPileOpen] = useState(false)
  const shakeCls = useShake()

  const showToast = (msg: string) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2200)
  }

  /** Open a socket wired with the shared message handler. */
  const openSocket = (onOpen: (sock: WebSocket) => void): WebSocket | null => {
    try {
      const sock = new WebSocket(url)
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
            setMyTag(`${name}#${data.vid}`)
            break
          case 'queued':
            setPhase('queued')
            break
          case 'match':
            if (data.mode) setMode(data.mode)
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
    setPhase('connecting')
    openSocket((sock) => sock.send(JSON.stringify({ t: 'queue', name })))
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
    return (
      <div class="screen menu">
        <div class="logo" style={{ fontSize: 'clamp(30px,6vw,54px)' }}>
          PVP<span>DUEL</span>
        </div>
        <div class="pvp-status">
          {phase === 'setup' && (
            <>
              <input class="neon" style={{ width: '300px' }} value={name} maxLength={16} onInput={(e) => setName((e.target as HTMLInputElement).value)} placeholder={t('handlePlaceholder')} />
              <input class="neon" style={{ width: '300px' }} value={url} onInput={(e) => setUrl((e.target as HTMLInputElement).value)} placeholder="ws://server:8787" />
              <button class="btn big pink" onClick={connect}>
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
    <div class={`combat screen ${shakeCls}`}>
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
          <div class="glyph">
            <Sprite id="runner" size={58} />
          </div>
          <div class="pname">{tf('youSuffix', { name: me.name })}</div>
          <HpBar hp={me.hp} maxHp={me.maxHp} mine />
          <StatusRow statuses={me.statuses} />
          <div class="linkish" style={{ fontSize: '11px', color: 'var(--dim)' }} onClick={() => setPileOpen(true)}>
            {tf('pvpCounts', { a: me.drawCount, b: me.discard.length })} ▾
          </div>
        </div>

        <div class={`opp-zone ${oppHl} ${fxPulses.value[oppWho] ?? ''}`} ref={(el) => registerAnchor('p' + (1 - view.you), el)}>
          <div class="facedown-row">
            {Array.from({ length: them.handCount }).map((_, i) => (
              <div key={i} class="facedown" />
            ))}
          </div>
          <BlockChip block={them.block} />
          <div class="glyph" style={{ color: '#ff7fc0' }}>
            <Sprite id="netrunner" size={54} />
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

      {pileOpen && (
        <div class="overlay" onClick={() => setPileOpen(false)}>
          <div class="panel popin" onClick={(e) => e.stopPropagation()}>
            <h2>{tf('discardPileTitle', { a: me.discard.length, b: 0 })}</h2>
            <div class="gridcards">
              {me.discard.length === 0 && <div class="sub">{t('empty')}</div>}
              {me.discard.map((c, i) => (
                <CardView key={i} card={c} style={{ '--fan': Math.min(i, 14) } as never} />
              ))}
            </div>
            <button class="btn" onClick={() => setPileOpen(false)}>
              {t('close')}
            </button>
          </div>
        </div>
      )}
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
          <DraggableHand
            cards={hand}
            playable={playableSet}
            targets={myTurn && !pending ? [oppWho] : []}
            disabled={!myTurn || pending}
            onCardClick={(i) => playableSet.has(i) && playFromHand(i, oppWho)}
            onPlay={playFromHand}
          />
          <button class="btn pink endturn" disabled={!myTurn || pending} onClick={() => send({ t: 'end' })}>
            {t('endTurn')}
          </button>
        </div>
      )}
    </div>
  )
}
