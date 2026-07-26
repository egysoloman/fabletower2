/**
 * NEONSPIRE PvP server.
 *
 * Matchmaking is a simple queue; game rules are NOT implemented here — every
 * move is validated by running the same `pvpReduce` from @neonspire/engine
 * that the client uses, so the server is authoritative by construction.
 * Clients only ever receive redacted views (opponent hands stay hidden).
 */
import { createServer, type ServerResponse } from 'node:http'
import { randomBytes } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocket, WebSocketServer } from 'ws'
import { CARDS, pvpReduce, newPvp, viewFor, type PvpAction, type PvpState } from '@neonspire/engine'

const PORT = Number(process.env.PORT ?? 8787)
const HERE = dirname(fileURLToPath(import.meta.url))
const DIST = resolve(HERE, '../../client/dist')

// --- Static hosting of the built client (optional convenience) --------------

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.map': 'application/json',
}

async function serveStatic(url: string, res: ServerResponse) {
  try {
    const clean = normalize(url.split('?')[0]).replace(/^(\.\.[/\\])+/, '')
    let file = join(DIST, clean)
    if (!file.startsWith(DIST)) throw new Error('forbidden')
    let st = await stat(file).catch(() => null)
    if (!st || st.isDirectory()) {
      file = join(DIST, 'index.html')
      st = await stat(file).catch(() => null)
    }
    if (!st) {
      res.writeHead(200, { 'content-type': 'text/plain' })
      res.end('NEONSPIRE PvP server is running.\nBuild the client (npm run build) to serve the game from here too.')
      return
    }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
    res.end(await readFile(file))
  } catch {
    res.writeHead(500).end()
  }
}

const http = createServer((req, res) => serveStatic(req.url ?? '/', res))

// --- Matchmaking + rooms -----------------------------------------------------

type Mode = 'duel' | 'climb'

interface Client {
  ws: WebSocket
  name: string
  room: Room | null
  alive: boolean
}

interface ClimbDeckEntry {
  id: string
  up: boolean
}

interface Room {
  mode: Mode
  players: [Client, Client]
  /** Active duel state (direct mode: always; climb mode: at the checkpoint). */
  state: PvpState | null
  /** Climb race only. */
  seed: number
  ready: [{ deck: ClimbDeckEntry[]; hp: number } | null, { deck: ClimbDeckEntry[]; hp: number } | null]
}

const waiting: Record<Mode, Client | null> = { duel: null, climb: null }

function send(ws: WebSocket, msg: unknown) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
}

function cleanName(raw: unknown): string {
  const s = String(raw ?? '').replace(/[^\w\- ]/g, '').trim().slice(0, 16)
  return s || 'RUNNER'
}

/** Climb duels use client-submitted run decks — sanitize hard. */
function cleanDeck(raw: unknown): ClimbDeckEntry[] | null {
  if (!Array.isArray(raw) || raw.length < 5 || raw.length > 120) return null
  const out: ClimbDeckEntry[] = []
  for (const c of raw) {
    const id = String((c as any)?.id ?? '')
    if (!CARDS[id]) return null
    out.push({ id, up: !!(c as any)?.up })
  }
  return out
}

function startMatch(a: Client, b: Client, mode: Mode) {
  const seed = randomBytes(4).readUInt32LE(0)
  if (mode === 'duel') {
    const state = newPvp(seed, [a.name, b.name])
    const room: Room = { mode, players: [a, b], state, seed, ready: [null, null] }
    a.room = room
    b.room = room
    room.players.forEach((p, i) => {
      send(p.ws, { t: 'match', you: i, view: viewFor(state, i as 0 | 1) })
    })
    return
  }
  // Climb race: both players run the SAME seed solo; the duel comes later.
  const room: Room = { mode, players: [a, b], state: null, seed, ready: [null, null] }
  a.room = room
  b.room = room
  room.players.forEach((p, i) => {
    send(p.ws, { t: 'climbstart', you: i, seed, opp: room.players[1 - i].name })
  })
}

function endRoom(room: Room) {
  for (const p of room.players) if (p.room === room) p.room = null
}

/** The checkpoint duel fires once both racers have felled their act boss. */
function maybeStartClimbDuel(room: Room) {
  const [a, b] = room.ready
  if (!a || !b || room.state) return
  room.state = newPvp(room.seed ^ 0x9e3779b9, [room.players[0].name, room.players[1].name], [
    { deck: a.deck, hp: a.hp },
    { deck: b.deck, hp: b.hp },
  ])
  room.players.forEach((p, i) => {
    send(p.ws, { t: 'duelstart', you: i, view: viewFor(room.state!, i as 0 | 1) })
  })
}

function finishClimb(room: Room, winnerIdx: 0 | 1, reason: string) {
  send(room.players[winnerIdx].ws, { t: 'climbwin', reason })
  send(room.players[1 - winnerIdx].ws, { t: 'climbloss', reason })
  endRoom(room)
}

function handleAction(client: Client, rawAction: unknown) {
  const room = client.room
  if (!room || !room.state) return send(client.ws, { t: 'err', msg: 'not in a match' })
  const idx = room.players.indexOf(client) as 0 | 1
  const a = rawAction as PvpAction
  const valid =
    a && typeof a === 'object' &&
    ((a.t === 'play' && Number.isInteger(a.hand)) || a.t === 'end')
  if (!valid) return send(client.ws, { t: 'err', msg: 'malformed action' })

  const res = pvpReduce(room.state, idx, a)
  if (res.error) return send(client.ws, { t: 'err', msg: res.error })

  room.state = res.state
  room.players.forEach((p, i) => {
    send(p.ws, { t: 'st', view: viewFor(room.state!, i as 0 | 1), events: res.events })
  })
  if (room.state.over) {
    if (room.mode === 'climb') {
      finishClimb(room, room.state.over.winner, room.state.over.reason)
    } else {
      endRoom(room)
    }
  }
}

const wss = new WebSocketServer({ server: http })

wss.on('connection', (ws) => {
  const client: Client = { ws, name: 'RUNNER', room: null, alive: true }

  ws.on('pong', () => (client.alive = true))

  ws.on('message', (data) => {
    let msg: any
    try {
      msg = JSON.parse(String(data))
    } catch {
      return send(ws, { t: 'err', msg: 'malformed message' })
    }
    switch (msg?.t) {
      case 'queue': {
        if (client.room) return send(ws, { t: 'err', msg: 'already in a match' })
        client.name = cleanName(msg.name)
        const mode: Mode = msg.mode === 'climb' ? 'climb' : 'duel'
        if (waiting[mode] === client) return
        if (waiting[mode] && waiting[mode]!.ws.readyState === WebSocket.OPEN) {
          const opponent = waiting[mode]!
          waiting[mode] = null
          startMatch(opponent, client, mode)
        } else {
          if (waiting.duel === client) waiting.duel = null
          if (waiting.climb === client) waiting.climb = null
          waiting[mode] = client
          send(ws, { t: 'queued', mode })
        }
        break
      }
      case 'cancel': {
        if (waiting.duel === client) waiting.duel = null
        if (waiting.climb === client) waiting.climb = null
        send(ws, { t: 'cancelled' })
        break
      }
      case 'action':
        handleAction(client, msg.action)
        break
      case 'progress': {
        // Climb race telemetry: relay the racer's position to the rival.
        const room = client.room
        if (!room || room.mode !== 'climb') break
        const other = room.players.find((p) => p !== client)
        if (other) {
          send(other.ws, {
            t: 'opp',
            act: Number(msg.act) || 1,
            floor: Number(msg.floor) || 0,
            hp: Number(msg.hp) || 0,
          })
        }
        break
      }
      case 'bosskill': {
        // Racer reached the checkpoint: submit the run deck for the duel.
        const room = client.room
        if (!room || room.mode !== 'climb') return send(ws, { t: 'err', msg: 'not in a climb race' })
        if (room.state) return send(ws, { t: 'err', msg: 'duel already running' })
        const idx = room.players.indexOf(client) as 0 | 1
        const deck = cleanDeck(msg.deck)
        if (!deck) return send(ws, { t: 'err', msg: 'invalid deck' })
        const hp = Math.max(1, Math.min(999, Math.floor(Number(msg.maxHp) || 1)))
        room.ready[idx] = { deck, hp }
        const other = room.players.find((p) => p !== client)
        if (other) send(other.ws, { t: 'oppready' })
        send(ws, { t: 'checkpoint' })
        maybeStartClimbDuel(room)
        break
      }
      case 'died': {
        // Racer flatlined mid-climb: the rival takes the race.
        const room = client.room
        if (!room || room.mode !== 'climb' || room.state) break
        const idx = room.players.indexOf(client) as 0 | 1
        finishClimb(room, (1 - idx) as 0 | 1, `${client.name} flatlined on the climb`)
        break
      }
      default:
        send(ws, { t: 'err', msg: 'unknown message type' })
    }
  })

  ws.on('close', () => {
    if (waiting.duel === client) waiting.duel = null
    if (waiting.climb === client) waiting.climb = null
    const room = client.room
    if (room) {
      const over = room.state?.over
      endRoom(room)
      const other = room.players.find((p) => p !== client)
      if (other && !over) {
        if (room.mode === 'climb') send(other.ws, { t: 'climbwin', reason: `${client.name} disconnected` })
        else send(other.ws, { t: 'opp-left' })
      }
    }
  })
})

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) ws.ping()
}, 30000)
wss.on('close', () => clearInterval(heartbeat))

http.listen(PORT, () => {
  console.log(`NEONSPIRE server listening on http://localhost:${PORT} (ws same port)`)
})
