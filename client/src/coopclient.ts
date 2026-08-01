/**
 * Co-op controller: owns the party WebSocket and mirrors server state into
 * signals. The server is authoritative for everything in co-op — map, combat,
 * rewards — the client only renders and sends intents.
 */
import { signal } from '@preact/signals'
import { CARDS, EMOTES, cardName, coopChecksum, predictCoopPlay, type CharId, type GameEvent } from '@neonspire/engine'
import { anchorCenter, flyCard, fxRemainingMs, processEvents, screenWipe } from './fx'
import { emoteText, mpWsUrl, showIncomingEmote } from './mp'
import { modsKey } from './mods'
import { discoverEvent } from './meta'
import { screen } from './store'
import { sfx } from './sfx'
import { t } from './i18n'

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
  | 'waiting'
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
/** Predicted Hybrid plays waiting behind the card currently being validated. */
export const coopActionQueueDepth = signal(0)
/** True only while Hybrid is validating a card play, so more cards may queue. */
export const coopHybridPlayOpen = signal(false)
export interface CoopQueuedCardVisual {
  uid: number
  id: string
  label: string
  cls: string
}
/** Cards still visible in the center stack; the in-flight top card is removed. */
export const coopActionQueueCards = signal<CoopQueuedCardVisual[]>([])
export const coopQueueDispatch = signal<(CoopQueuedCardVisual & { seq: number; target?: number; ally?: number }) | null>(null)
export const coopRevision = signal(0)
export const coopWaitingFor = signal('')
export const coopWaitProgress = signal<{ replied: number; total: number; closesAt: number | null } | null>(null)
export const coopTravelTarget = signal<string | null>(null)
export const coopCompletedNode = signal<string | null>(null)
/** Queue lobby: tags of everyone waiting for this party size. */
export const coopLobby = signal<{ members: string[]; need: number } | null>(null)
/** Formation stage: full party gathered, waiting on READY from everyone. */
export const coopForm = signal<{ tag: string; char: string; ready: boolean }[] | null>(null)
export const coopConn = signal<'online' | 'reconnecting'>('online')
/** Server security/performance mode, mirrored from combat messages. */
export const coopMode = signal<'strict' | 'hybrid'>('hybrid')
export const coopShop = signal<any>(null)
export const coopEvent = signal<any>(null)
export const coopRestDeck = signal<any[]>([])
export const coopBelt = signal<string[]>([])
export const coopDeck = signal<any[]>([])
export const coopRelics = signal<string[]>([])
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
let phaseTimer = 0

interface HybridQueuedPlay {
  uid: number
  id: string
  label: string
  cls: string
  target?: number
  ally?: number
}

/** Only one action is in flight; later clicks wait here in visual order. */
const hybridPlayQueue: HybridQueuedPlay[] = []
let hybridInFlight: HybridQueuedPlay | null = null
let hybridDispatchSeq = 0

function updateHybridQueueState() {
  const depth = hybridPlayQueue.length
  coopActionQueueDepth.value = depth
  coopActionQueueCards.value = hybridPlayQueue.map(({ uid, id, label, cls }) => ({ uid, id, label, cls }))
  coopHybridPlayOpen.value = hybridInFlight !== null
  coopPending.value = depth > 0 || hybridInFlight !== null
}

function resetHybridQueue() {
  hybridPlayQueue.length = 0
  hybridInFlight = null
  coopActionQueueDepth.value = 0
  coopHybridPlayOpen.value = false
  coopActionQueueCards.value = []
  coopQueueDispatch.value = null
  coopPending.value = false
}

function sendHybridPlay(item: HybridQueuedPlay, authoritativeView: any, animateFromQueue = false): boolean {
  const hand = authoritativeView?.players?.[coopYou.value]?.hand as { uid: number }[] | undefined
  const handIdx = hand?.findIndex((card) => card.uid === item.uid) ?? -1
  if (handIdx < 0) return false
  hybridInFlight = item
  if (animateFromQueue) {
    coopQueueDispatch.value = {
      uid: item.uid,
      id: item.id,
      label: item.label,
      cls: item.cls,
      seq: ++hybridDispatchSeq,
      target: item.target,
      ally: item.ally,
    }
  }
  coopSend({
    t: 'coopaction',
    action: { t: 'play', hand: handIdx, target: item.target, ally: item.ally },
    sum: coopChecksum(authoritativeView),
  })
  return true
}

/**
 * Queue a play that was already applied to coopView by predictCoopPlay.
 * Card identity, rather than its shifting hand index, survives every rebase.
 */
export function coopEnqueueHybridPlay(item: HybridQueuedPlay, authoritativeView: any) {
  // The first click is already flying directly to its target. Only clicks
  // made while that card is being validated belong in the visible stack.
  if (!hybridInFlight && hybridPlayQueue.length === 0) {
    if (!sendHybridPlay(item, authoritativeView)) {
      resetHybridQueue()
      coopSend({ t: 'coopsync' })
      coopFlash(t('coopQueueAdjusted'))
      return false
    }
    updateHybridQueueState()
    return true
  }
  hybridPlayQueue.push(item)
  updateHybridQueueState()
  return true
}

/** Rebase unsent predictions on the newest server view, then dispatch one. */
function settleHybridPlay(authoritativeView: any): { view: any; dropped: boolean } {
  hybridInFlight = null
  let optimisticView = authoritativeView
  const rebased: HybridQueuedPlay[] = []
  let dropped = false

  for (const item of hybridPlayQueue) {
    const hand = optimisticView?.players?.[coopYou.value]?.hand as { uid: number }[] | undefined
    const handIdx = hand?.findIndex((card) => card.uid === item.uid) ?? -1
    const predicted = handIdx >= 0
      ? predictCoopPlay(optimisticView, coopYou.value, handIdx, item.target)
      : null
    if (!predicted) {
      dropped = true
      break
    }
    rebased.push(item)
    optimisticView = predicted.view
  }

  hybridPlayQueue.length = 0
  const next = rebased.shift()
  hybridPlayQueue.push(...rebased)
  if (next && !sendHybridPlay(next, authoritativeView, true)) {
    hybridPlayQueue.length = 0
    hybridInFlight = null
    optimisticView = authoritativeView
    dropped = true
  }
  updateHybridQueueState()
  return { view: optimisticView, dropped }
}

// --- Seat persistence: a co-op run survives closing the page -----------------
// The server holds the seat for the reconnect grace window; we keep the token
// so the CO-OP screen can offer RESUME RUN after a reload.

/** Must match the server's COOP_RESUME_TTL_MS. */
export const COOP_SEAT_TTL_MS = 7 * 24 * 60 * 60 * 1000

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
    resetHybridQueue()
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

export function coopQueue(name: string, char: CharId, size: number, asc: number) {
  coopLeave()
  coopNotice.value = ''
  coopPhase.value = 'connecting'
  const url = mpWsUrl()
  try {
    attach(new WebSocket(url), url, () => coopSend({ t: 'coopqueue', name, char, size, asc, modsKey: modsKey() }))
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
      if (Number.isInteger(data.rev)) {
        const rev = Number(data.rev)
        if (rev < coopRevision.value) return
        if (coopRevision.value > 0 && rev > coopRevision.value + 1) coopSend({ t: 'coopsync' })
        coopRevision.value = Math.max(coopRevision.value, rev)
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
        case 'cooptravel':
          coopTravelTarget.value = String(data.id ?? '')
          coopCompletedNode.value = String(data.id ?? '')
          break
        case 'coopstart':
        case 'coopmap':
          if (data.t === 'coopmap' || data.rejoin) coopTravelTarget.value = null
          if (data.token) token = data.token
          saveSeat(url)
          retryUntil = 0
          coopConn.value = 'online'
          coopForm.value = null
          coopYou.value = data.you
          coopHost.value = data.you === data.host
          coopMap.value = data
          if (Array.isArray(data.deck)) coopDeck.value = data.deck
          if (Array.isArray(data.relics)) coopRelics.value = data.relics
          if (Array.isArray(data.belt)) coopBelt.value = data.belt
          if (data.votes) coopVotes.value = data.votes
          coopReward.value = null
          coopWaitingFor.value = ''
          coopWaitProgress.value = null
          coopPhase.value = 'map'
          if (data.t === 'coopstart' && !data.rejoin) sfx.win()
          break
        case 'coopcombat':
          coopTravelTarget.value = null
          resetHybridQueue()
          if (coopPhase.value !== 'combat') screenWipe('◈', 'var(--green)')
        // fall through
        case 'coopst': {
          if (data.mode) coopMode.value = data.mode
          coopYou.value = data.you
          if (data.belt) coopBelt.value = data.belt
          if (Array.isArray(data.view?.playerRelics?.[data.you])) coopRelics.value = data.view.playerRelics[data.you]
          coopPhase.value = 'combat'
          if (data.played && data.played.who !== data.you) {
            coopFlash(`◈ ally ▸ ${data.played.card.id}${data.played.card.up ? '+' : ''}`)
            const def = CARDS[data.played.card.id]
            const src = anchorCenter('c' + data.played.who)
            const destWho =
              def?.target === 'enemy' && Number.isInteger(data.played.target)
                ? 'e' + data.played.target
                : def?.target === 'ally' && Number.isInteger(data.played.ally)
                  ? 'c' + data.played.ally
                  : 'c' + data.played.who
            const dest = anchorCenter(destWho)
            if (def && src && dest) {
              flyCard(src, dest, def.type, cardName(data.played.card))
              sfx.whoosh()
            }
          }
          if (data.corrected) coopFlash(t('desyncFixed'))
          const mine = data.by !== undefined && data.by === data.you
          const predictedAck = mine && hybridInFlight !== null
          if (data.events && !(predictedAck && !data.corrected)) {
            processEvents(data.events as GameEvent[], { delay: 200, step: 120 })
          }
          if (predictedAck) {
            const settled = settleHybridPlay(data.view)
            coopView.value = settled.view
            if (settled.dropped) coopFlash(t('coopQueueAdjusted'))
          } else {
            coopView.value = data.view
            if (mine) coopPending.value = false
          }
          break
        }
        case 'coopreward': {
          const show = () => {
            coopReward.value = data
            coopPhase.value = 'reward'
            sfx.win()
          }
          clearTimeout(phaseTimer)
          const wait = coopPhase.value === 'combat' && !data.rejoin ? fxRemainingMs() + 450 : 0
          if (wait > 0) phaseTimer = window.setTimeout(show, wait)
          else show()
          break
        }
        case 'cooprest':
          coopTravelTarget.value = null
          coopRestDeck.value = data.deck ?? []
          coopPhase.value = 'rest'
          break
        case 'coopshop':
          coopTravelTarget.value = null
          coopShop.value = data
          coopWaitProgress.value = data.closesAt
            ? { replied: Number(data.replied) || 0, total: Number(data.total) || 0, closesAt: Number(data.closesAt) }
            : null
          if (data.belt) coopBelt.value = data.belt
          if (Array.isArray(data.deck)) coopDeck.value = data.deck
          if (Array.isArray(data.relics)) coopRelics.value = data.relics
          coopPhase.value = 'shop'
          break
        case 'coopbought':
          coopFlash(`${data.name} ▸ ${data.id}`)
          sfx.click()
          break
        case 'coopevent':
          coopTravelTarget.value = null
          coopEvent.value = data
          discoverEvent(String(data.id))
          coopPhase.value = 'event'
          break
        case 'coopeventpicked':
          coopFlash(`${data.name} ▸ #${(data.choice ?? 0) + 1}`)
          break
        case 'coopwaiting':
          coopWaitingFor.value = String(data.phase ?? '')
          coopWaitProgress.value = data.phase === 'shop'
            ? { replied: Number(data.replied) || 0, total: Number(data.total) || 0, closesAt: Number(data.closesAt) || null }
            : null
          coopPhase.value = 'waiting'
          break
        case 'coopprogress':
          if (data.phase === 'shop') {
            coopWaitProgress.value = {
              replied: Number(data.replied) || 0,
              total: Number(data.total) || 0,
              closesAt: Number(data.closesAt) || null,
            }
          }
          if (data.waiting) {
            coopWaitingFor.value = String(data.phase ?? '')
            coopPhase.value = 'waiting'
          }
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
        case 'coopvictory': {
          const show = () => {
            coopPhase.value = 'victory'
            clearSeat()
            import('./meta').then((m) => m.award('coopwin'))
            sfx.win()
          }
          clearTimeout(phaseTimer)
          const wait = coopPhase.value === 'combat' ? fxRemainingMs() + 450 : 0
          if (wait > 0) phaseTimer = window.setTimeout(show, wait)
          else show()
          break
        }
        case 'coopdefeat': {
          const show = () => {
            coopPhase.value = 'defeat'
            clearSeat()
            sfx.lose()
          }
          clearTimeout(phaseTimer)
          const wait = coopPhase.value === 'combat' ? fxRemainingMs() + 650 : 0
          if (wait > 0) phaseTimer = window.setTimeout(show, wait)
          else show()
          break
        }
        case 'coopend':
          coopNotice.value = String(data.reason ?? '')
          coopPhase.value = 'ended'
          clearSeat()
          break
        case 'err':
          if (hybridInFlight || hybridPlayQueue.length > 0) {
            resetHybridQueue()
            coopSend({ t: 'coopsync' })
            coopFlash(t('coopQueueAdjusted'))
          } else coopPending.value = false
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
  clearTimeout(phaseTimer)
  resetHybridQueue()
  coopRevision.value = 0
  coopWaitingFor.value = ''
  coopWaitProgress.value = null
  coopTravelTarget.value = null
  coopCompletedNode.value = null
  coopLobby.value = null
  coopForm.value = null
  coopShop.value = null
  coopEvent.value = null
  coopDeck.value = []
  coopRelics.value = []
  coopBelt.value = []
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
}

export function coopExit() {
  coopLeave()
  screen.value = 'menu'
}
