/**
 * Co-op controller: owns the party WebSocket and mirrors server state into
 * signals. The server is authoritative for everything in co-op — map, combat,
 * rewards — the client only renders and sends intents.
 */
import { signal } from '@preact/signals'
import type { CharId, GameEvent } from '@neonspire/engine'
import { processEvents } from './fx'
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

export function coopQueue(url: string, name: string, char: CharId, size: number) {
  coopLeave()
  coopNotice.value = ''
  coopPhase.value = 'connecting'
  try {
    const sock = new WebSocket(url)
    ws = sock
    sock.onopen = () => sock.send(JSON.stringify({ t: 'coopqueue', name, char, size }))
    sock.onerror = () => {
      coopNotice.value = 'server unreachable'
      coopPhase.value = 'error'
    }
    sock.onclose = () => {
      if (ws !== sock) return
      const p = coopPhase.value
      const inRun = p === 'map' || p === 'combat' || p === 'reward' || p === 'rest'
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
    sock.onmessage = handlerRef = (msg) => {
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
          coopNotice.value = 'connection lost'
          coopPhase.value = 'error'
          break
        case 'peer-conn':
          coopNotice.value = data.online ? `${data.name} reconnected` : `${data.name} connection lost…`
          setTimeout(() => (coopNotice.value = ''), 2600)
          break
        case 'coopstart':
        case 'coopmap':
          if (data.token) token = data.token
          retryUntil = 0
          coopConn.value = 'online'
          coopForm.value = null
          coopYou.value = data.you
          coopHost.value = data.you === data.host
          coopMap.value = data
          coopReward.value = null
          coopPhase.value = 'map'
          if (data.t === 'coopstart' && !data.rejoin) sfx.win()
          break
        case 'coopcombat':
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
          coopPhase.value = 'event'
          break
        case 'coopeventpicked':
          coopFlash(`${data.name} ▸ #${(data.choice ?? 0) + 1}`)
          break
        case 'coopcomm':
          coopFlash(`${data.name}: ${data.k.toUpperCase()}`)
          sfx.click()
          break
        case 'coopvictory':
          coopPhase.value = 'victory'
          sfx.win()
          break
        case 'coopdefeat':
          coopPhase.value = 'defeat'
          sfx.lose()
          break
        case 'coopend':
          coopNotice.value = String(data.reason ?? '')
          coopPhase.value = 'ended'
          break
        case 'err':
          coopPending.value = false
          break
      }
    }
  } catch {
    coopNotice.value = 'bad server url'
    coopPhase.value = 'error'
  }
}

/** Reopen the socket and resume the held seat. */
function coopResume(url: string) {
  try {
    const sock = new WebSocket(url)
    const prev = ws
    ws = sock
    void prev
    sock.onopen = () => sock.send(JSON.stringify({ t: 'resume', token }))
    sock.onerror = () => {}
    // reuse the full handler by re-dispatching through coopQueue's wiring is
    // not possible here; instead clone the minimal handlers:
    sock.onclose = (ev) => {
      void ev
      if (ws !== sock) return
      if (token && Date.now() < retryUntil) setTimeout(() => coopResume(url), 2000)
      else {
        coopNotice.value = 'connection lost'
        coopPhase.value = 'error'
      }
    }
    sock.onmessage = handlerRef!
  } catch {
    coopPhase.value = 'error'
  }
}

let handlerRef: ((msg: MessageEvent) => void) | null = null

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
