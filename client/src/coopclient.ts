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

let ws: WebSocket | null = null

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
      const p = coopPhase.value
      if (p !== 'idle' && p !== 'error' && p !== 'victory' && p !== 'defeat' && p !== 'ended') {
        coopNotice.value = coopNotice.value || 'connection lost'
        coopPhase.value = 'error'
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
          coopPhase.value = 'queued'
          break
        case 'coopstart':
        case 'coopmap':
          coopYou.value = data.you
          coopHost.value = data.you === data.host
          coopMap.value = data
          coopReward.value = null
          coopPhase.value = 'map'
          if (data.t === 'coopstart') sfx.win()
          break
        case 'coopcombat':
        case 'coopst':
          coopYou.value = data.you
          coopView.value = data.view
          coopPending.value = false
          coopPhase.value = 'combat'
          if (data.events) processEvents(data.events as GameEvent[], { delay: 200, step: 120 })
          break
        case 'coopreward':
          coopReward.value = data
          coopPhase.value = 'reward'
          sfx.win()
          break
        case 'cooprest':
          coopPhase.value = 'rest'
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

export function coopSend(msg: unknown) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
}

export function coopLeave() {
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
