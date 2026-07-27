/**
 * Co-op controller: owns the party WebSocket and mirrors server state into
 * signals. The server is authoritative for everything in co-op — map, combat,
 * rewards — the client only renders and sends intents.
 */
import { signal } from '@preact/signals'
import { EMOTES, type CharId, type GameEvent } from '@neonspire/engine'
import { processEvents, screenWipe } from './fx'
import { emoteText, mpWsUrl, showIncomingEmote } from './mp'
import { modsKey } from './mods'
import { discoverEvent } from './meta'
import { screen } from './store'
import { sfx } from './sfx'

export type CoopPhase =
  | 'idle'
  | 'form'
  | 'shop'
  | 'event'
  | 'connecting'
  | 'queued'
  | 'map'
  | 'combat'
  | 'reward'
  | 'rest'
  | 'victory'
  | 'defeat'
  | 'ended'
  | 'error'

export const coopPhase = signal<CoopPhase>('idle')
export const coopYou = signal(0)
export const coopHost = signal(false)
export const coopMap = signal<any>(null)
export const coopView = signal<any>(null)
export const coopReward = signal<any>(null)
export const coopNotice = signal('')
export const coopPending = signal(false)
/** Queue lobby: tags of everyone waiting for this party size. */
export const coopLobby = signal<{ members: string[]; need: number } | null>(null)
/** Formation stage: full party gathered, waiting on READY from everyone. */
export const coopForm = signal<{ tag: string; char: string; ready: boolean }[] | null>(null)
export const coopConn = signal<'online' | 'reconnecting'>('online')
export const coopShop = signal<any>(null)
export const coopEvent = signal<any>(null)
export const coopRestDeck = signal<any[]>([])
export const coopBelt = signal<string[]>([])
/** Advisory path votes: one row per player {i, name, color, id|null}. */
export const coopVotes = signal<{ i: number; name: string; color: string; id: string | null }[]>([])
export const coopToast = signal('')
let toastTimer = 0
export function coopFlash(msg: string) {
  coopToast.value = msg
  clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => (coopToast.value = ''), 2400)
}

let ws: WebSocket | null = null
let token: string | null = null
let retryUntil = 0

// --- Seat persistence: a co-op run survives closing the page -----------------
// The server holds the seat for the reconnect grace window; we keep the token
// so the CO-OP screen can offer RESUME RUN after a reload.

/** Must match the server's RECONNECT_GRACE_MS. */
export const COOP_SEAT_TTL_MS = 15 * 60 * 1000

function saveSeat(url: string) {
  try {
    if (token) localStorage.setItem('ns-coop-seat', JSON.stringify({ url, token, at: Date.now() }))
  } catch {
    /* best-effort */
  }
}

function clearSeat() {
  try {
    localStorage.removeItem('ns-coop-seat')
  } catch {
    /* best-effort */
  }
}

/** Stored seat if it can still be inside the server's grace window. */
export function coopSavedSeat(): { url: string; token: string; at: number } | null {
  try {
    const s = JSON.parse(localStorage.getItem('ns-coop-seat') ?? 'null')
    if (!s?.token || !s?.url) return null
    if (Date.now() - s.at > COOP_SEAT_TTL_MS) {
      clearSeat()
      return null
    }
    return s
  } catch {
    return null
  }
}

/** Reconnect into a stored seat (after a reload / app restart). */
export function coopResumeSaved() {
  const seat = coopSavedSeat()
  if (!seat) return
  token = seat.token
  retryUntil = Date.now() + 30 * 1000
  coopNotice.value = ''
  coopConn.value = 'reconnecting'
  coopPhase.value = 'connecting'
  coopResume(seat.url)
}

/** Wire a socket with the shared handlers (queue and resume paths). */
function attach(sock: WebSocket, url: string, onOpen: () => void) {
  ws = sock
  sock.onopen = onOpen
  sock.onerror = () => {
    if (coopPhase.value === 'connecting' && !token) {
      coopNotice.value = 'server unreachable'
      coopPhase.value = 'error'
    }
  }
  sock.onclose = () => {
    if (ws !== sock) return
    const p = coopPhase.value
    const inRun = p === 'map' || p === 'combat' || p === 'reward' || p === 'rest' || p === 'shop' || p === 'event' || p === 'connecting'
    if (token && inRun) {
      // Seat is held server-side: auto-resume within the grace window.
      coopConn.value = 'reconnecting'
      if (!retryUntil) retryUntil = Date.now() + 4.5 * 60 * 1000
      if (Date.now() < retryUntil) {
        setTimeout(() => coopResume(url), 1500)
        return
      }
    }
    if (p !== 'idle' && p !== 'error' && p !== 'victory' && p !== 'defeat' && p !== 'ended') {
      coopNotice.value = coopNotice.value || 'connection lost'
      coopPhase.value = 'error'
    }
  }
  sock.onmessage = (msg) => handleMsg(msg, url)
}

export function coopQueue(name: string, char: CharId, size: number) {
  coopLeave()
  coopNotice.value = ''
  coopPhase.value = 'connecting'
  const url = mpWsUrl()
  try {
    attach(new WebSocket(url), url, () => coopSend({ t: 'coopqueue', name, char, size, modsKey: modsKey() }))
  } catch {
    coopNotice.value = 'bad server url'
    coopPhase.value = 'error'
  }
}

function handleMsg(msg: MessageEvent, url: string) {
  {
      let data: any
      try {
        data = JSON.parse(String(msg.data))
      } catch {
        return
      }
      switch (data.t) {
        case 'queued':
          coopPhase.value = 'queued'
          break
        case 'lobby':
          coopLobby.value = { members: data.members ?? [], need: data.need ?? 0 }
          break
        case 'coopform':
          coopForm.value = data.members ?? []
          coopPhase.value = 'form'
          sfx.click()
          break
        case 'resume-fail':
          token = null
          clearSeat()
          coopNotice.value = 'run expired'
          coopPhase.value = 'error'
          break
        case 'peer-conn':
          coopNotice.value = data.online ? `${data.name} reconnected` : `${data.name} connection lost…`
          setTimeout(() => (coopNotice.value = ''), 2600)
          break
        case 'coopvotes':
          coopVotes.value = data.votes ?? []
          break
        case 'coopstart':
        case 'coopmap':
          if (data.token) token = data.token
          saveSeat(url)
          retryUntil = 0
          coopConn.value = 'online'
          coopForm.value = null
          coopYou.value = data.you
          coopHost.value = data.you === data.host
          coopMap.value = data
          if (data.votes) coopVotes.value = data.votes
          coopReward.value = null
          coopPhase.value = 'map'
          if (data.t === 'coopstart' && !data.rejoin) sfx.win()
          break
        case 'coopcombat':
          if (coopPhase.value !== 'combat') screenWipe('◈', 'var(--green)')
        // fall through
        case 'coopst':
          coopYou.value = data.you
          coopView.value = data.view
          if (data.belt) coopBelt.value = data.belt
          coopPending.value = false
          coopPhase.value = 'combat'
          if (data.played && data.played.who !== data.you) {
            coopFlash(`◈ ally ▸ ${data.played.card.id}${data.played.card.up ? '+' : ''}`)
          }
          if (data.events) processEvents(data.events as GameEvent[], { delay: 200, step: 120 })
          break
        case 'coopreward':
          coopReward.value = data
          coopPhase.value = 'reward'
          sfx.win()
          break
        case 'cooprest':
          coopRestDeck.value = data.deck ?? []
          coopPhase.value = 'rest'
          break
        case 'coopshop':
          coopShop.value = data
          if (data.belt) coopBelt.value = data.belt
          coopPhase.value = 'shop'
          break
        case 'coopbought':
          coopFlash(`${data.name} ▸ ${data.id}`)
          sfx.click()
          break
        case 'coopevent':
          coopEvent.value = data
          discoverEvent(String(data.id))
          coopPhase.value = 'event'
          break
        case 'coopeventpicked':
          coopFlash(`${data.name} ▸ #${(data.choice ?? 0) + 1}`)
          break
        case 'coopcomm':
          coopFlash(`${data.name}: ${data.k.toUpperCase()}`)
          sfx.click()
          break
        case 'emote': {
          if (coopPhase.value === 'combat') {
            showIncomingEmote(data, (i) => 'c' + i, (i) => 'e' + i)
          } else {
            const def = data.id ? EMOTES[data.id] : undefined
            const text = def ? emoteText(def) : String(data.text ?? '')
            const to = data.target != null ? ` ▸ ${coopMap.value?.party?.[data.target]?.name ?? ''}` : ''
            if (text) {
              coopFlash(`${def?.sym ?? '❝'} ${data.name}${to}: ${text}`)
              sfx.click()
            }
          }
          break
        }
        case 'coopvictory':
          coopPhase.value = 'victory'
          clearSeat()
          import('./meta').then((m) => m.award('coopwin'))
          sfx.win()
          break
        case 'coopdefeat':
          coopPhase.value = 'defeat'
          clearSeat()
          sfx.lose()
          break
        case 'coopend':
          coopNotice.value = String(data.reason ?? '')
          coopPhase.value = 'ended'
          clearSeat()
          break
        case 'err':
          coopPending.value = false
          break
      }
  }
}

/** Reopen the socket and resume the held seat. */
function coopResume(url: string) {
  try {
    attach(new WebSocket(url), url, () => coopSend({ t: 'resume', token }))
  } catch {
    coopPhase.value = 'error'
  }
}

export function coopReady() {
  coopSend({ t: 'coopready' })
}

export function coopSend(msg: unknown) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
}

export function coopLeave() {
  try {
    ws?.send(JSON.stringify({ t: 'leave' }))
  } catch {
    /* gone */
  }
  token = null
  clearSeat()
  retryUntil = 0
  coopLobby.value = null
  coopForm.value = null
  coopShop.value = null
  coopEvent.value = null
  try {
    ws?.close()
  } catch {
    /* ignore */
  }
  ws = null
  coopPhase.value = 'idle'
  coopMap.value = null
  coopView.value = null
  coopReward.value = null
  coopPending.value = false
}

export function coopExit() {
  coopLeave()
  screen.value = 'menu'
}
