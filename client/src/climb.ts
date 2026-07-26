/**
 * Climb-race controller: owns the WebSocket for the whole race so it
 * survives screen changes (setup → solo climb → checkpoint duel → result).
 * The solo climb itself is the normal offline game; this module just
 * reports progress, submits the run deck at the boss checkpoint, and
 * relays the server-validated duel.
 */
import { signal } from '@preact/signals'
import { EMOTES, type CharId, type GameEvent, type PvpAction, type PvpView, type RunState } from '@neonspire/engine'
import { processEvents } from './fx'
import { emoteText, mpWsUrl, showIncomingEmote } from './mp'
import { modsKey } from './mods'
import { screen } from './store'
import { sfx } from './sfx'

export type ClimbPhase =
  | 'idle'
  | 'connecting'
  | 'queued'
  | 'racing'
  | 'waiting' // at the checkpoint, rival still climbing
  | 'duel'
  | 'won'
  | 'lost'
  | 'error'

export interface OppProgress {
  act: number
  floor: number
  hp: number
}

export const climbPhase = signal<ClimbPhase>('idle')
export const climbOpp = signal<string>('')
/** Both duellists' characters, [p0, p1], from the server. */
export const climbChars = signal<CharId[]>(['runner', 'runner'])
/** Rival emote toast while outside the duel (solo map / waiting room). */
export const climbEmote = signal<{ name: string; sym: string; text: string } | null>(null)
let climbEmoteTimer = 0
export const climbOppProgress = signal<OppProgress | null>(null)
export const climbOppReady = signal(false)
export const climbView = signal<PvpView | null>(null)
export const climbNotice = signal('')
export const climbSeed = signal(0)
/** Set while an action awaits the server (blocks double-plays). */
export const climbPending = signal(false)

let ws: WebSocket | null = null
let onMatched: ((seed: number) => void) | null = null

export const climbActive = () => climbPhase.value !== 'idle' && climbPhase.value !== 'error'

export function climbQueue(name: string, char: CharId, matched: (seed: number) => void) {
  climbLeave()
  onMatched = matched
  climbNotice.value = ''
  climbPhase.value = 'connecting'
  try {
    const sock = new WebSocket(mpWsUrl())
    ws = sock
    sock.onopen = () => sock.send(JSON.stringify({ t: 'queue', name, mode: 'climb', char, modsKey: modsKey() }))
    sock.onerror = () => {
      climbNotice.value = 'server unreachable'
      climbPhase.value = 'error'
    }
    sock.onclose = () => {
      const p = climbPhase.value
      if (p === 'connecting' || p === 'queued' || p === 'racing' || p === 'waiting' || p === 'duel') {
        climbNotice.value = climbNotice.value || 'connection lost'
        climbPhase.value = 'error'
        screen.value = 'climb'
      }
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
          climbPhase.value = 'queued'
          break
        case 'climbstart':
          climbOpp.value = String(data.opp ?? 'RIVAL')
          climbSeed.value = Number(data.seed) >>> 0
          climbPhase.value = 'racing'
          sfx.win()
          onMatched?.(climbSeed.value)
          break
        case 'opp':
          climbOppProgress.value = { act: data.act, floor: data.floor, hp: data.hp }
          break
        case 'oppready':
          climbOppReady.value = true
          break
        case 'checkpoint':
          climbPhase.value = 'waiting'
          break
        case 'duelstart':
          climbView.value = data.view
          if (Array.isArray(data.chars)) climbChars.value = data.chars
          climbPending.value = false
          climbPhase.value = 'duel'
          screen.value = 'climb'
          sfx.win()
          break
        case 'emote': {
          if (climbPhase.value === 'duel') {
            showIncomingEmote(data, (i) => 'p' + i)
          } else {
            const def = data.id ? EMOTES[data.id] : undefined
            const text = def ? emoteText(def) : String(data.text ?? '')
            if (text) {
              climbEmote.value = { name: String(data.name ?? ''), sym: def?.sym ?? '❝', text }
              clearTimeout(climbEmoteTimer)
              climbEmoteTimer = window.setTimeout(() => (climbEmote.value = null), 3200)
              sfx.click()
            }
          }
          break
        }
        case 'st':
          climbView.value = data.view
          climbPending.value = false
          processEvents((data.events ?? []) as GameEvent[], { delay: 220, step: 130 })
          break
        case 'err':
          climbPending.value = false
          break
        case 'climbwin':
          climbNotice.value = String(data.reason ?? '')
          climbPhase.value = 'won'
          screen.value = 'climb'
          sfx.win()
          closeSocket()
          break
        case 'climbloss':
          climbNotice.value = String(data.reason ?? '')
          climbPhase.value = 'lost'
          screen.value = 'climb'
          sfx.lose()
          closeSocket()
          break
      }
    }
  } catch {
    climbNotice.value = 'bad server url'
    climbPhase.value = 'error'
  }
}

/** Solo-climb telemetry, sent after every floor/combat change. */
export function climbReport(run: RunState) {
  if (!ws || climbPhase.value !== 'racing') return
  ws.send(JSON.stringify({ t: 'progress', act: run.act, floor: run.floor, hp: run.hp }))
}

/** Act boss down: submit the real run deck for the checkpoint duel. */
export function climbBossKill(run: RunState) {
  if (!ws) return
  ws.send(
    JSON.stringify({
      t: 'bosskill',
      deck: run.deck.map((c) => ({ id: c.id, up: c.up })),
      maxHp: run.maxHp,
    }),
  )
  climbPhase.value = 'waiting'
  screen.value = 'climb'
}

export function climbDied() {
  if (!ws || climbPhase.value !== 'racing') return
  ws.send(JSON.stringify({ t: 'died' }))
}

export function climbSendAction(action: PvpAction) {
  if (!ws || climbPhase.value !== 'duel') return
  climbPending.value = true
  ws.send(JSON.stringify({ t: 'action', action }))
}

export function climbSendEmote(m: { id?: string; text?: string; target?: number }) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: 'emote', ...m }))
}

function closeSocket() {
  const s = ws
  ws = null
  try {
    s?.close()
  } catch {
    /* ignore */
  }
}

/** Abandon / reset the whole climb session. */
export function climbLeave() {
  closeSocket()
  onMatched = null
  climbPhase.value = 'idle'
  climbView.value = null
  climbOppProgress.value = null
  climbOppReady.value = false
  climbNotice.value = ''
  climbPending.value = false
}
