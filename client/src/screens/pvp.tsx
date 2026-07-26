/**
 * PvP duel screen. The client sends raw actions; ALL rules run server-side
 * through the same shared engine, and we just render the redacted views the
 * server sends back (opponent hand stays hidden).
 */
import { useEffect, useRef, useState } from 'preact/hooks'
import { CARDS, type GameEvent, type PvpAction, type PvpView } from '@neonspire/engine'
import { BlockChip, CardView, HpBar, StatusRow } from '../components'
import { processEvents, registerAnchor } from '../fx'
import { screen } from '../store'
import { sfx } from '../sfx'

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

export function PvpScreen() {
  const [url, setUrl] = useState(defaultWsUrl())
  const [name, setName] = useState('RUNNER')
  const [phase, setPhase] = useState<Phase>('setup')
  const [view, setView] = useState<PvpView | null>(null)
  const [notice, setNotice] = useState('')
  const [toast, setToast] = useState('')
  const ws = useRef<WebSocket | null>(null)
  const toastTimer = useRef<number>()

  const showToast = (msg: string) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2200)
  }

  const connect = () => {
    try {
      setPhase('connecting')
      const sock = new WebSocket(url)
      ws.current = sock
      sock.onopen = () => sock.send(JSON.stringify({ t: 'queue', name }))
      sock.onerror = () => {
        setNotice('Could not reach the relay server. Solo mode never needs one — but PvP does. Start it with:  npm run dev:server')
        setPhase('error')
      }
      sock.onclose = () => {
        setPhase((p) => (p === 'playing' || p === 'queued' || p === 'connecting' ? 'error' : p))
        setNotice((n) => n || 'Connection lost.')
      }
      sock.onmessage = (msg) => {
        let data: any
        try {
          data = JSON.parse(String(msg.data))
        } catch {
          return
        }
        switch (data.t) {
          case 'queued':
            setPhase('queued')
            break
          case 'match':
            setView(data.view)
            setPhase('playing')
            sfx.win()
            break
          case 'st': {
            setView(data.view)
            processEvents((data.events ?? []) as GameEvent[])
            if (data.view?.over) {
              setPhase('over')
            }
            break
          }
          case 'err':
            showToast(data.msg ?? 'rejected')
            break
          case 'opp-left':
            setNotice('Your opponent disconnected. You win by default.')
            setPhase('over')
            break
        }
      }
    } catch {
      setNotice('Invalid server URL.')
      setPhase('error')
    }
  }

  useEffect(() => () => ws.current?.close(), [])

  const send = (action: PvpAction) => {
    ws.current?.send(JSON.stringify({ t: 'action', action }))
  }

  const leave = () => {
    ws.current?.close()
    screen.value = 'menu'
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
              <input class="neon" style={{ width: '300px' }} value={name} maxLength={16} onInput={(e) => setName((e.target as HTMLInputElement).value)} placeholder="handle" />
              <input class="neon" style={{ width: '300px' }} value={url} onInput={(e) => setUrl((e.target as HTMLInputElement).value)} placeholder="ws://server:8787" />
              <button class="btn big pink" onClick={connect}>
                FIND OPPONENT
              </button>
            </>
          )}
          {phase === 'connecting' && <div class="pulse">▚ CONNECTING…</div>}
          {phase === 'queued' && <div class="pulse">▚ SCANNING FOR OPPONENT… (open a second tab to duel yourself)</div>}
          {phase === 'error' && (
            <>
              <div style={{ color: 'var(--red)', maxWidth: '440px', textAlign: 'center', lineHeight: 1.6 }}>{notice}</div>
              <button class="btn" onClick={() => setPhase('setup')}>
                RETRY
              </button>
            </>
          )}
          <button class="btn ghost" onClick={leave}>
            ← BACK
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
  const n = hand.length
  const iWon = view.over ? view.over.winner === view.you : notice.includes('win')

  return (
    <div class="combat screen">
      <div class="topbar">
        <span class="stat" style={{ color: 'var(--purple)' }}>
          PVP · TURN {view.turn}
        </span>
        <span class="spacer" />
        <span class={`turn-indicator ${myTurn ? 'you' : 'them'}`}>{myTurn ? '◈ YOUR TURN' : `${them.name}'S TURN`}</span>
        <span class="spacer" />
        <span class="stat linkish" style={{ color: 'var(--dim)' }} onClick={leave}>
          ✕ LEAVE
        </span>
      </div>

      <div class="arena">
        <div class="player-zone" ref={(el) => registerAnchor('p' + view.you, el)}>
          <div class="energy-orb" data-tip="Energy">
            {me.energy}/{me.energyMax}
          </div>
          <BlockChip block={me.block} />
          <div class="glyph">👤</div>
          <div class="pname">{me.name} (YOU)</div>
          <HpBar hp={me.hp} maxHp={me.maxHp} mine />
          <StatusRow statuses={me.statuses} />
          <div style={{ fontSize: '11px', color: 'var(--dim)' }}>
            draw {me.drawCount} · discard {me.discard.length}
          </div>
        </div>

        <div class="opp-zone" ref={(el) => registerAnchor('p' + (1 - view.you), el)}>
          <div class="facedown-row">
            {Array.from({ length: them.handCount }).map((_, i) => (
              <div key={i} class="facedown" />
            ))}
          </div>
          <BlockChip block={them.block} />
          <div class="glyph" style={{ fontSize: '54px', filter: 'drop-shadow(0 0 12px rgba(255,45,149,.8))' }}>
            🥷
          </div>
          <div class="ename" style={{ fontFamily: 'var(--font-head)', fontSize: '12px', color: '#ffb8d9' }}>
            {them.name}
          </div>
          <HpBar hp={them.hp} maxHp={them.maxHp} />
          <StatusRow statuses={them.statuses} />
          <div style={{ fontSize: '11px', color: 'var(--dim)' }}>
            draw {them.drawCount} · discard {them.discard.length}
          </div>
        </div>
      </div>

      {toast && (
        <div class="turnbanner" style={{ top: '58%', fontSize: '16px', animation: 'none', color: 'var(--red)' }}>
          {toast}
        </div>
      )}

      {view.over || phase === 'over' ? (
        <div class="overlay">
          <div class="panel">
            <h2 class={iWon ? '' : 'pink'}>{iWon ? '▚ VICTORY ▞' : '▚ FLATLINED ▞'}</h2>
            <div class="sub">{view.over?.reason ?? notice}</div>
            <button class="btn pink" onClick={() => { setView(null); setPhase('setup'); setNotice('') }}>
              REMATCH QUEUE
            </button>
            <button class="btn ghost" onClick={leave}>
              MENU
            </button>
          </div>
        </div>
      ) : (
        <div class="dock">
          <div class="hand">
            {hand.map((c, i) => {
              const mid = (n - 1) / 2
              const playable = myTurn && !CARDS[c.id].unplayable && me.energy >= (c.up && CARDS[c.id].upCost !== undefined ? CARDS[c.id].upCost! : CARDS[c.id].cost)
              return (
                <CardView
                  key={c.uid}
                  card={c}
                  cls={playable ? '' : 'unplayable'}
                  style={{ '--rot': `${(i - mid) * 4}deg`, '--lift': `${Math.abs(i - mid) * 8}px`, zIndex: i }}
                  onClick={() => playable && (sfx.play(), send({ t: 'play', hand: i }))}
                />
              )
            })}
          </div>
          <button class="btn pink endturn" disabled={!myTurn} onClick={() => send({ t: 'end' })}>
            END TURN ▶
          </button>
        </div>
      )}
    </div>
  )
}
