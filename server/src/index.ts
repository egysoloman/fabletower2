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
import {
  CARDS,
  ENCOUNTERS,
  STARTER_DECKS,
  STARTER_RELICS,
  cardsByRarity,
  coopReduce,
  coopViewFor,
  genActMap,
  newPvp,
  nodeById,
  obtainableRelics,
  pvpReduce,
  rngFromSeed,
  randInt,
  pick,
  startCoopCombat,
  viewFor,
  type ActMap,
  type CardInst,
  type CharId,
  type CoopAction,
  type CoopState,
  type PvpAction,
  type PvpState,
  type Rng,
} from '@neonspire/engine'

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
  /** Reconnect identity: stable across socket drops for one match. */
  token: string | null
  online: boolean
  dcTimer: NodeJS.Timeout | null
  /** Short public visitor id, shown next to names to disambiguate. */
  vid: string
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
  /** Match concluded (duel over / race decided) — room lingers for rematch/spectate. */
  finished: boolean
  rematch: [boolean, boolean]
}

const waiting: Record<Mode, Client | null> = { duel: null, climb: null }

/** token -> seated client, alive for the duration of a match (+grace). */
const seats = new Map<string, Client>()
const RECONNECT_GRACE_MS = 5 * 60 * 1000

function mintToken(c: Client): string {
  if (c.token) seats.delete(c.token)
  const token = randomBytes(12).toString('hex')
  c.token = token
  seats.set(token, c)
  return token
}

function releaseSeat(c: Client) {
  if (c.token) seats.delete(c.token)
  c.token = null
  if (c.dcTimer) clearTimeout(c.dcTimer)
  c.dcTimer = null
}

function peersOf(c: Client): Client[] {
  const room = c.room
  if (room) return room.players.filter((p) => p !== c)
  const coop = coopRooms.get(c)
  if (coop) return coop.players.map((p) => p.client).filter((x) => x !== c)
  return []
}

function notifyPeerConn(c: Client, online: boolean) {
  for (const p of peersOf(c)) send(p.ws, { t: 'peer-conn', name: c.name, online })
}

// --- Co-op: shared climb, shared battles -------------------------------------

interface CoopPlayer {
  client: Client
  char: CharId
  hp: number
  maxHp: number
  deck: CardInst[]
  relics: string[]
  gold: number
  /** Pending per-node reply (reward pick / rest pick). */
  replied: boolean
}

interface CoopRoom {
  players: CoopPlayer[]
  rng: Rng
  uid: number
  act: number
  floor: number
  pos: string | null
  map: ActMap
  combat: CoopState | null
  kind: 'normal' | 'elite' | 'boss'
  rewards: { cards: string[]; relic: string | null; gold: number }[] | null
  lastEncounter: string
  ended: boolean
}

const coopQueues: Record<number, Client[]> = { 2: [], 3: [], 4: [] }
const coopRooms = new Map<Client, CoopRoom>()

const tagOf = (c: Client) => `${c.name}#${c.vid}`

/** Pre-run team formation: everyone sees the party and readies up. */
interface PendingParty {
  clients: Client[]
  chars: CharId[]
  ready: boolean[]
  size: number
}
const pendingParties = new Map<Client, PendingParty>()

function broadcastLobby(size: number) {
  const q = coopQueues[size].filter((c) => c.ws.readyState === WebSocket.OPEN)
  coopQueues[size] = q
  for (const c of q) send(c.ws, { t: 'lobby', size, members: q.map(tagOf), need: size - q.length })
}

function broadcastForm(party: PendingParty) {
  for (const c of party.clients) {
    send(c.ws, {
      t: 'coopform',
      size: party.size,
      members: party.clients.map((m, i) => ({ tag: tagOf(m), char: party.chars[i], ready: party.ready[i] })),
    })
  }
}

function dissolveForm(party: PendingParty, gone: Client | null) {
  for (const c of party.clients) pendingParties.delete(c)
  // Remaining members rejoin the head of the queue and keep waiting.
  for (const c of party.clients) {
    if (c === gone || c.ws.readyState !== WebSocket.OPEN) continue
    coopQueues[party.size].unshift(c)
  }
  broadcastLobby(party.size)
}

/** Co-op map profile: no per-player shops/events in v1 — retype to keep the party together. */
function coopMap(act: number, rng: Rng): ActMap {
  const map = genActMap(act, rng)
  for (const row of map.rows) {
    for (const n of row) {
      if (n.type === 'shop') n.type = 'rest'
      else if (n.type === 'event') n.type = 'combat'
    }
  }
  return map
}

function coopBroadcast(room: CoopRoom, msg: (idx: number) => unknown) {
  room.players.forEach((p, i) => send(p.client.ws, msg(i)))
}

function coopMapMsg(room: CoopRoom, idx: number) {
  return {
    t: 'coopmap',
    you: idx,
    host: 0,
    act: room.act,
    floor: room.floor,
    pos: room.pos,
    map: room.map,
    party: room.players.map((p) => ({
      name: tagOf(p.client), char: p.char, hp: p.hp, maxHp: p.maxHp, gold: p.gold, deckSize: p.deck.length,
    })),
  }
}

function startCoopParty(clients: Client[], chars: CharId[]) {
  const seed = randomBytes(4).readUInt32LE(0)
  const rng = rngFromSeed(seed)
  let uid = 1
  const players: CoopPlayer[] = clients.map((client, i) => ({
    client,
    char: chars[i],
    hp: 75,
    maxHp: 75,
    deck: STARTER_DECKS[chars[i]].map((id): CardInst => ({ uid: uid++, id, up: false })),
    relics: [STARTER_RELICS[chars[i]]],
    gold: 99,
    replied: false,
  }))
  const room: CoopRoom = {
    players, rng, uid: uid + 1000, act: 1, floor: 0, pos: null,
    map: coopMap(1, rng), combat: null, kind: 'normal', rewards: null, lastEncounter: '', ended: false,
  }
  for (const c of clients) coopRooms.set(c, room)
  coopBroadcast(room, (i) => ({ ...coopMapMsg(room, i), t: 'coopstart', seed, token: mintToken(room.players[i].client) }))
}

function coopAvailable(room: CoopRoom): string[] {
  if (room.pos === null) return room.map.rows[0].map((n) => n.id)
  return nodeById(room.map, room.pos)?.next ?? []
}

function coopStartFight(room: CoopRoom, kind: 'normal' | 'elite' | 'boss') {
  const pool = ENCOUNTERS[room.act][kind]
  let enc = pick(room.rng, pool)
  if (pool.length > 1 && enc.join(',') === room.lastEncounter) enc = pick(room.rng, pool)
  room.lastEncounter = enc.join(',')
  room.kind = kind
  room.combat = startCoopCombat({
    players: room.players.map((p) => ({ name: p.client.name, hp: p.hp, maxHp: p.maxHp, deck: p.deck, relics: p.relics })),
    enemyIds: enc,
    encounterId: enc.join(','),
    seed: randInt(room.rng, 1, 0x7fffffff),
    uidStart: room.uid,
  })
  coopBroadcast(room, (i) => ({ t: 'coopcombat', you: i, view: coopViewFor(room.combat!) }))
}

function coopFinishFight(room: CoopRoom) {
  const cs = room.combat!
  room.combat = null
  room.uid = cs.uid
  room.players.forEach((p, i) => {
    p.hp = Math.max(1, cs.players[i].hp)
  })
  // Per-player rewards: gold for all, card choices from each char's pool,
  // a relic on elite/boss kills.
  room.rewards = room.players.map((p) => {
    const gold = randInt(room.rng, 15, 28) + room.act * 4
    p.gold += gold
    const cards: string[] = []
    let guard = 0
    while (cards.length < 3 && guard++ < 30) {
      const r = randInt(room.rng, 1, 100)
      const rarity = room.kind === 'boss' ? 'rare' : r <= 8 ? 'rare' : r <= 40 ? 'uncommon' : 'common'
      const def = pick(room.rng, cardsByRarity(rarity, p.char))
      if (!cards.includes(def.id)) cards.push(def.id)
    }
    let relic: string | null = null
    if (room.kind !== 'normal') {
      const rpool = obtainableRelics(p.relics, room.kind === 'boss', p.char)
      if (rpool.length > 0) relic = pick(room.rng, rpool).id
    }
    p.replied = false
    return { cards, relic, gold }
  })
  coopBroadcast(room, (i) => ({ t: 'coopreward', you: i, ...room.rewards![i] }))
}

function coopMaybeAdvance(room: CoopRoom) {
  if (!room.players.every((p) => p.replied)) return
  room.rewards = null
  const wasBoss = room.kind === 'boss'
  room.kind = 'normal'
  if (wasBoss) {
    if (room.act >= 3) {
      coopBroadcast(room, () => ({ t: 'coopvictory' }))
      endCoop(room)
      return
    }
    room.act++
    room.map = coopMap(room.act, room.rng)
    room.pos = null
    room.players.forEach((p) => {
      p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.25))
    })
  }
  coopBroadcast(room, (i) => coopMapMsg(room, i))
}

function endCoop(room: CoopRoom) {
  room.ended = true
  for (const p of room.players) {
    coopRooms.delete(p.client)
    releaseSeat(p.client)
  }
}

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
    const room: Room = { mode, players: [a, b], state, seed, ready: [null, null], finished: false, rematch: [false, false] }
    a.room = room
    b.room = room
    room.players.forEach((p, i) => {
      send(p.ws, { t: 'match', you: i, view: viewFor(state, i as 0 | 1), token: mintToken(p) })
    })
    return
  }
  // Climb race: both players run the SAME seed solo; the duel comes later.
  const room: Room = { mode, players: [a, b], state: null, seed, ready: [null, null], finished: false, rematch: [false, false] }
  a.room = room
  b.room = room
  room.players.forEach((p, i) => {
    send(p.ws, { t: 'climbstart', you: i, seed, opp: room.players[1 - i].name, token: mintToken(p) })
  })
}

function endRoom(room: Room) {
  for (const p of room.players) {
    if (p.room === room) p.room = null
    releaseSeat(p)
  }
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
  room.finished = true
  send(room.players[winnerIdx].ws, { t: 'climbwin', reason })
  send(room.players[1 - winnerIdx].ws, { t: 'climbloss', reason })
  // room lingers: the winner may CONTINUE the climb (progress keeps
  // relaying so the loser can spectate) until both leave.
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
    room.finished = true
    if (room.mode === 'climb') finishClimb(room, room.state.over.winner, room.state.over.reason)
    // duel rooms linger so both sides can hit REMATCH
  }
}

const wss = new WebSocketServer({ server: http })

wss.on('connection', (ws) => {
  let client: Client = {
    ws, name: 'RUNNER', room: null, alive: true, token: null, online: true, dcTimer: null,
    vid: randomBytes(2).toString('hex'),
  }
  ;(ws as any).isAlive = true
  send(ws, { t: 'hello', vid: client.vid })

  ws.on('pong', () => { client.alive = true; (ws as any).isAlive = true })

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
      case 'resume': {
        // Reconnect into a live seat within the grace window.
        const seat = seats.get(String(msg.token ?? ''))
        if (!seat) return send(ws, { t: 'resume-fail' })
        if (seat.ws !== ws && seat.ws.readyState === WebSocket.OPEN) return send(ws, { t: 'resume-fail' })
        if (seat.dcTimer) clearTimeout(seat.dcTimer)
        seat.dcTimer = null
        seat.ws = ws
        seat.alive = true
        seat.online = true
        client = seat
        notifyPeerConn(client, true)
        const room = client.room
        const coop = coopRooms.get(client)
        if (room) {
          const idx = room.players.indexOf(client) as 0 | 1
          if (room.mode === 'duel' || room.state) {
            send(ws, { t: 'match', you: idx, view: viewFor(room.state!, idx), token: client.token, rejoin: true })
          } else {
            send(ws, { t: 'climbstart', you: idx, seed: room.seed, opp: room.players[1 - idx].name, token: client.token, rejoin: true })
          }
        } else if (coop && !coop.ended) {
          const idx = coop.players.findIndex((p) => p.client === client)
          send(ws, { ...coopMapMsg(coop, idx), t: 'coopstart', seed: 0, token: client.token, rejoin: true })
          if (coop.combat) send(ws, { t: 'coopcombat', you: idx, view: coopViewFor(coop.combat) })
          else if (coop.rewards) send(ws, { t: 'coopreward', you: idx, ...coop.rewards[idx] })
        } else {
          releaseSeat(client)
          send(ws, { t: 'resume-fail' })
        }
        break
      }
      case 'rematch': {
        const room = client.room
        if (!room || room.mode !== 'duel' || !room.finished) break
        const idx = room.players.indexOf(client) as 0 | 1
        room.rematch[idx] = true
        const other = room.players[1 - idx]
        if (room.rematch[0] && room.rematch[1]) {
          const seed = randomBytes(4).readUInt32LE(0)
          room.state = newPvp(seed, [room.players[0].name, room.players[1].name])
          room.finished = false
          room.rematch = [false, false]
          room.players.forEach((p, i) => {
            send(p.ws, { t: 'match', you: i, view: viewFor(room.state!, i as 0 | 1), token: p.token })
          })
        } else {
          send(other.ws, { t: 'rematch-offer' })
          send(ws, { t: 'rematch-wait' })
        }
        break
      }
      case 'leave': {
        const coop = coopRooms.get(client)
        if (coop && !coop.ended) {
          coopBroadcast(coop, () => ({ t: 'coopend', reason: `${client.name} left` }))
          endCoop(coop)
        }
        const room = client.room
        if (room) {
          const live = !room.finished && (room.state ? !room.state.over : room.mode === 'climb')
          endRoom(room)
          const other = room.players.find((p) => p !== client)
          if (other && live) {
            if (room.mode === 'climb') send(other.ws, { t: 'climbwin', reason: `${client.name} left` })
            else send(other.ws, { t: 'opp-left' })
          } else if (other) {
            send(other.ws, { t: 'peer-conn', name: client.name, online: false, gone: true })
          }
        }
        break
      }
      case 'coopqueue': {
        if (client.room || coopRooms.has(client)) return send(ws, { t: 'err', msg: 'already in a match' })
        client.name = cleanName(msg.name)
        const size = Math.max(2, Math.min(4, Math.floor(Number(msg.size) || 2)))
        const char: CharId = (['runner', 'vector', 'ghost', 'array'] as CharId[]).includes(msg.char) ? msg.char : 'runner'
        ;(client as any).coopChar = char
        for (const q of Object.values(coopQueues)) {
          const at = q.indexOf(client)
          if (at >= 0) q.splice(at, 1)
        }
        coopQueues[size].push(client)
        send(ws, { t: 'queued', mode: 'coop', size })
        broadcastLobby(size)
        const q = coopQueues[size]
        if (q.length >= size) {
          const members = q.splice(0, size)
          const party: PendingParty = {
            clients: members,
            chars: members.map((c) => ((c as any).coopChar ?? 'runner') as CharId),
            ready: members.map(() => false),
            size,
          }
          for (const c of members) pendingParties.set(c, party)
          broadcastForm(party)
        }
        break
      }
      case 'coopready': {
        const party = pendingParties.get(client)
        if (!party) break
        const idx = party.clients.indexOf(client)
        party.ready[idx] = true
        broadcastForm(party)
        if (party.ready.every(Boolean)) {
          for (const c of party.clients) pendingParties.delete(c)
          startCoopParty(party.clients, party.chars)
        }
        break
      }
      case 'cooppick': {
        const room = coopRooms.get(client)
        if (!room || room.ended || room.combat || room.rewards) break
        if (room.players[0].client !== client) return send(ws, { t: 'err', msg: 'only the host picks the path' })
        const id = String(msg.id ?? '')
        if (!coopAvailable(room).includes(id)) return send(ws, { t: 'err', msg: 'invalid node' })
        const node = nodeById(room.map, id)
        if (!node) break
        room.pos = id
        room.floor++
        if (node.type === 'combat' || node.type === 'elite' || node.type === 'boss') {
          coopStartFight(room, node.type === 'combat' ? 'normal' : node.type)
        } else if (node.type === 'treasure') {
          room.players.forEach((p) => {
            p.gold += randInt(room.rng, 22, 40)
            p.replied = true
          })
          coopMaybeAdvance(room)
        } else {
          // rest: every player chooses heal / heal-an-ally / upgrade
          room.players.forEach((p) => (p.replied = false))
          coopBroadcast(room, (i) => ({ t: 'cooprest', you: i }))
        }
        break
      }
      case 'coopaction': {
        const room = coopRooms.get(client)
        if (!room || !room.combat || room.ended) break
        const idx = room.players.findIndex((p) => p.client === client)
        const a = msg.action as CoopAction
        const valid = a && typeof a === 'object' && ((a.t === 'play' && Number.isInteger(a.hand)) || a.t === 'end')
        if (!valid) return send(ws, { t: 'err', msg: 'malformed action' })
        const res = coopReduce(room.combat, idx, a)
        if (res.error) return send(ws, { t: 'err', msg: res.error })
        room.combat = res.state
        coopBroadcast(room, (i) => ({ t: 'coopst', you: i, view: coopViewFor(room.combat!), events: res.events }))
        if (room.combat.over === 'win') coopFinishFight(room)
        else if (room.combat.over === 'lose') {
          coopBroadcast(room, () => ({ t: 'coopdefeat' }))
          endCoop(room)
        }
        break
      }
      case 'cooptake': {
        // Reward reply: optional card pick, always acknowledges.
        const room = coopRooms.get(client)
        if (!room || !room.rewards || room.ended) break
        const idx = room.players.findIndex((p) => p.client === client)
        const player = room.players[idx]
        if (player.replied) break
        const cardId = msg.card ? String(msg.card) : null
        if (cardId && room.rewards[idx].cards.includes(cardId)) {
          player.deck.push({ uid: room.uid++, id: cardId, up: false })
        }
        if (msg.relic && room.rewards[idx].relic) {
          player.relics.push(room.rewards[idx].relic!)
        }
        player.replied = true
        coopMaybeAdvance(room)
        break
      }
      case 'cooprestpick': {
        const room = coopRooms.get(client)
        if (!room || room.ended || room.combat) break
        const idx = room.players.findIndex((p) => p.client === client)
        const player = room.players[idx]
        if (player.replied) break
        const what = String(msg.what ?? 'heal')
        if (what === 'ally') {
          // Sacrifice your rest to patch a teammate for 40%.
          const allyIdx = Math.floor(Number(msg.ally))
          const ally = room.players[allyIdx]
          if (ally && ally !== player) {
            ally.hp = Math.min(ally.maxHp, ally.hp + Math.floor(ally.maxHp * 0.4))
          }
        } else if (what === 'upgrade') {
          const uid = Math.floor(Number(msg.uid))
          const card = player.deck.find((c) => c.uid === uid)
          if (card && !card.up && CARDS[card.id]?.rarity !== 'special') card.up = true
        } else {
          player.hp = Math.min(player.maxHp, player.hp + Math.floor(player.maxHp * 0.3))
        }
        player.replied = true
        if (room.players.every((p) => p.replied)) {
          coopBroadcast(room, (i) => coopMapMsg(room, i))
        }
        break
      }
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
    if (client.ws !== ws) return // an old socket of a reconnected seat
    if (waiting.duel === client) waiting.duel = null
    if (waiting.climb === client) waiting.climb = null
    for (const [sz, q] of Object.entries(coopQueues)) {
      const at = q.indexOf(client)
      if (at >= 0) {
        q.splice(at, 1)
        broadcastLobby(Number(sz))
      }
    }
    const pending = pendingParties.get(client)
    if (pending) dissolveForm(pending, client)
    const inMatch = (client.room && !client.room.finished) || coopRooms.has(client)
    if (!inMatch) {
      // finished rooms: dropping the socket counts as leaving
      const room = client.room
      if (room) endRoom(room)
      releaseSeat(client)
      return
    }
    // Live match: hold the seat for the reconnect grace window.
    client.online = false
    notifyPeerConn(client, false)
    client.dcTimer = setTimeout(() => {
      client.dcTimer = null
      const coop = coopRooms.get(client)
      if (coop && !coop.ended) {
        coopBroadcast(coop, () => ({ t: 'coopend', reason: `${client.name} disconnected` }))
        endCoop(coop)
      }
      const room = client.room
      if (room) {
        const over = room.finished || room.state?.over
        endRoom(room)
        const other = room.players.find((p) => p !== client)
        if (other && !over) {
          if (room.mode === 'climb') send(other.ws, { t: 'climbwin', reason: `${client.name} disconnected` })
          else send(other.ws, { t: 'opp-left' })
        }
      }
      releaseSeat(client)
    }, RECONNECT_GRACE_MS)
  })
})

const heartbeat = setInterval(() => {
  // Terminate unresponsive sockets so seats/queues never leak under load;
  // the close handler then runs the normal reconnect-grace path.
  for (const ws of wss.clients) {
    if ((ws as any).isAlive === false) {
      ws.terminate()
      continue
    }
    ;(ws as any).isAlive = false
    ws.ping()
  }
}, 30000)
wss.on('close', () => clearInterval(heartbeat))

http.listen(PORT, () => {
  console.log(`NEONSPIRE server listening on http://localhost:${PORT} (ws same port)`)
})
