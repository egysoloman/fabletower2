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
import { pvpReduce, newPvp, viewFor, type PvpAction, type PvpState } from '@neonspire/engine'

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

interface Client {
  ws: WebSocket
  name: string
  room: Room | null
  alive: boolean
}

interface Room {
  players: [Client, Client]
  state: PvpState
}

let waiting: Client | null = null

function send(ws: WebSocket, msg: unknown) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
}

function cleanName(raw: unknown): string {
  const s = String(raw ?? '').replace(/[^\w\- ]/g, '').trim().slice(0, 16)
  return s || 'RUNNER'
}

function startMatch(a: Client, b: Client) {
  const seed = randomBytes(4).readUInt32LE(0)
  const state = newPvp(seed, [a.name, b.name])
  const room: Room = { players: [a, b], state }
  a.room = room
  b.room = room
  room.players.forEach((p, i) => {
    send(p.ws, { t: 'match', you: i, view: viewFor(state, i as 0 | 1) })
  })
}

function endRoom(room: Room) {
  for (const p of room.players) if (p.room === room) p.room = null
}

function handleAction(client: Client, rawAction: unknown) {
  const room = client.room
  if (!room) return send(client.ws, { t: 'err', msg: 'not in a match' })
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
    send(p.ws, { t: 'st', view: viewFor(room.state, i as 0 | 1), events: res.events })
  })
  if (room.state.over) endRoom(room)
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
        if (waiting === client) return
        if (waiting && waiting.ws.readyState === WebSocket.OPEN) {
          const opponent = waiting
          waiting = null
          startMatch(opponent, client)
        } else {
          waiting = client
          send(ws, { t: 'queued' })
        }
        break
      }
      case 'cancel': {
        if (waiting === client) waiting = null
        send(ws, { t: 'cancelled' })
        break
      }
      case 'action':
        handleAction(client, msg.action)
        break
      default:
        send(ws, { t: 'err', msg: 'unknown message type' })
    }
  })

  ws.on('close', () => {
    if (waiting === client) waiting = null
    const room = client.room
    if (room) {
      endRoom(room)
      const other = room.players.find((p) => p !== client)
      if (other && !room.state.over) send(other.ws, { t: 'opp-left' })
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
