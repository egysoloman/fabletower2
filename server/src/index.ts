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
import { ADMIN_API_PATH, flushAccounts, getMpMode, handleApi, initializeAccounts } from './accounts'
import {
  deleteCoopSnapshot,
  flushCoopSnapshots,
  initializeCoopStore,
  loadCoopSnapshots,
  saveCoopSnapshot,
} from './coop-store'
import { closePostgres, persistenceBackend } from './postgres-store'

const ADMIN_UI_PATH = (process.env.ADMIN_UI_PATH ?? '/admin').replace(/\/$/, '')
import { adminHtml } from './admin-ui'
import {
  CARDS,
  ENCOUNTERS,
  activateProductionBalance,
  pvpChecksum,
  coopChecksum,
  EVENTS,
  POTIONS,
  coopUsePotion,
  STARTER_DECKS,
  STARTER_RELICS,
  cardsByRarity,
  characterStartingMaxHp,
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
  scoreClimbRound,
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

activateProductionBalance()

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

const http = createServer(async (req, res) => {
  if (await handleApi(req, res)) return
  if ((req.url ?? '').split('?')[0] === ADMIN_UI_PATH) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(adminHtml(ADMIN_API_PATH))
    return
  }
  serveStatic(req.url ?? '/', res)
})

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
  /** Chosen fighter, relayed to peers for sprites/colors. */
  char: CharId
  /** Enabled-mods fingerprint: only identical keys are matched together. */
  modsKey: string
  lastEmote: number
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
  /** Climb race only: checkpoint duel wins, from each player's perspective. */
  score: [number, number]
  /** Act whose checkpoint duel is currently running. */
  checkpointAct: number
}

/** One waiting slot per (mode, modsKey): only same-mods players ever match. */
const waiting: Record<Mode, Map<string, Client>> = { duel: new Map(), climb: new Map() }

function unqueue(c: Client) {
  for (const m of Object.values(waiting)) {
    for (const [k, v] of m) if (v === c) m.delete(k)
  }
}

/** token -> seated client, alive for the duration of a match (+grace). */
const seats = new Map<string, Client>()
const MATCH_RECONNECT_GRACE_MS = 15 * 60 * 1000
/** Durable co-op seats expire after a week without room activity. */
const COOP_RESUME_TTL_MS = 7 * 24 * 60 * 60 * 1000
/** The first player leaving a shop starts a short party-wide close window. */
const COOP_SHOP_CLOSE_GRACE_MS = Math.max(1_000, Number(process.env.COOP_SHOP_CLOSE_GRACE_MS) || 15_000)

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

/** Fixed palette; party slot i gets PLAYER_COLORS[i]. */
const PLAYER_COLORS = ['#00e5ff', '#ff2d95', '#ffd166', '#3dffa2', '#ff9e2d', '#a855f7']

interface CoopPlayer {
  client: Client
  char: CharId
  color: string
  hp: number
  maxHp: number
  deck: CardInst[]
  relics: string[]
  potions: string[]
  gold: number
  /** Pending per-node reply (reward pick / rest pick). */
  replied: boolean
}

interface CoopRoom {
  id: string
  revision: number
  updatedAt: number
  expiresAt: number
  players: CoopPlayer[]
  rng: Rng
  uid: number
  act: number
  floor: number
  pos: string | null
  /** Visited node ids this act — drives the traversed-path map display. */
  path: string[]
  map: ActMap
  combat: CoopState | null
  kind: 'normal' | 'elite' | 'boss'
  rewards: { cards: string[]; relic: string | null; gold: number }[] | null
  /** Shared shop inventory: first come, first served. */
  shop: {
    cards: { id: string; price: number; sold: boolean }[]
    relics: { id: string; price: number; sold: boolean }[]
    potions: { id: string; price: number; sold: boolean }[]
    removePrice: number
  } | null
  /** Auto-close deadline started by the first player who leaves the shop. */
  shopCloseAt: number | null
  /** Active event node: everyone picks their own way through. */
  event: { id: string; picked: (number | null)[] } | null
  /** Advisory path votes: player index -> node id. Cleared on each pick. */
  votes: Record<number, string>
  lastEncounter: string
  /** Node selected by the host while the shared travel animation plays. */
  pendingNode: string | null
  ended: boolean
}

interface CoopPlayerSnapshot extends Omit<CoopPlayer, 'client'> {
  client: {
    token: string
    name: string
    vid: string
    char: CharId
    modsKey: string
  }
}

interface CoopRoomSnapshot extends Omit<CoopRoom, 'players'> {
  players: CoopPlayerSnapshot[]
}

/** Keyed by `${size}|${modsKey}` — parties only form among same-mods players. */
const coopQueues = new Map<string, Client[]>()
const coopRooms = new Map<Client, CoopRoom>()
const coopShopTimers = new Map<string, NodeJS.Timeout>()

const coopKey = (size: number, modsKey: string) => `${size}|${modsKey}`
const coopKeySize = (key: string) => Number(key.split('|')[0]) || 2

const tagOf = (c: Client) => `${c.name}#${c.vid}`

function coopSnapshot(room: CoopRoom): CoopRoomSnapshot {
  return {
    ...room,
    players: room.players.map((p) => ({
      ...p,
      client: {
        token: p.client.token!,
        name: p.client.name,
        vid: p.client.vid,
        char: p.client.char,
        modsKey: p.client.modsKey,
      },
    })),
  }
}

function persistCoop(room: CoopRoom) {
  if (room.ended) return
  saveCoopSnapshot({
    id: room.id,
    updatedAt: room.updatedAt,
    expiresAt: room.expiresAt,
    data: coopSnapshot(room),
  })
}

/** Commit one authoritative room mutation before broadcasting it. */
function touchCoop(room: CoopRoom) {
  room.revision++
  room.updatedAt = Date.now()
  room.expiresAt = room.updatedAt + COOP_RESUME_TTL_MS
  persistCoop(room)
}

function armCoopExpiry(client: Client, room: CoopRoom) {
  if (client.dcTimer) clearTimeout(client.dcTimer)
  const delay = Math.max(1, room.expiresAt - Date.now())
  client.dcTimer = setTimeout(() => {
    client.dcTimer = null
    if (!client.online && !room.ended) {
      coopBroadcast(room, () => ({ t: 'coopend', reason: `${client.name} resume window expired` }))
      endCoop(room)
    }
  }, delay)
}

const OFFLINE_WS = { readyState: WebSocket.CLOSED, send() {} } as unknown as WebSocket

function restoreCoopRooms() {
  for (const stored of loadCoopSnapshots()) {
    try {
      const snap = stored.data as CoopRoomSnapshot
      if (!snap?.id || !Array.isArray(snap.players) || snap.players.length < 2 || snap.expiresAt <= Date.now()) {
        deleteCoopSnapshot(stored.id)
        continue
      }
      const players: CoopPlayer[] = snap.players.map((p) => {
        if (!p.client?.token) throw new Error('missing co-op resume token')
        const client: Client = {
          ws: OFFLINE_WS,
          name: p.client.name,
          room: null,
          alive: false,
          token: p.client.token,
          online: false,
          dcTimer: null,
          vid: p.client.vid,
          char: p.client.char,
          modsKey: p.client.modsKey,
          lastEmote: 0,
        }
        const player: CoopPlayer = { ...p, client }
        return player
      })
      const room: CoopRoom = {
        ...snap,
        players,
        pendingNode: snap.pendingNode ?? null,
        shopCloseAt: Number.isFinite(snap.shopCloseAt) ? snap.shopCloseAt : null,
        ended: false,
      }
      for (const p of players) {
        coopRooms.set(p.client, room)
        seats.set(p.client.token!, p.client)
        armCoopExpiry(p.client, room)
      }
      if (room.pendingNode) {
        const pending = room.pendingNode
        setTimeout(() => completeCoopTravel(room, pending), 50)
      }
      if (room.shop && room.shopCloseAt) armCoopShopClose(room)
      console.log(`restored co-op room ${room.id} at revision ${room.revision}`)
    } catch (e) {
      console.error(`discarding invalid co-op room ${stored.id}:`, e)
      deleteCoopSnapshot(stored.id)
    }
  }
}

/** Pre-run team formation: everyone sees the party and readies up. */
interface PendingParty {
  clients: Client[]
  chars: CharId[]
  ready: boolean[]
  size: number
  key: string
}
const pendingParties = new Map<Client, PendingParty>()

function broadcastLobby(key: string) {
  const size = coopKeySize(key)
  const q = (coopQueues.get(key) ?? []).filter((c) => c.ws.readyState === WebSocket.OPEN)
  if (q.length) coopQueues.set(key, q)
  else coopQueues.delete(key)
  for (const c of q) send(c.ws, { t: 'lobby', size, members: q.map(tagOf), need: size - q.length })
}

function broadcastForm(party: PendingParty) {
  for (const c of party.clients) {
    send(c.ws, {
      t: 'coopform',
      size: party.size,
      members: party.clients.map((m, i) => ({ tag: tagOf(m), char: party.chars[i], color: PLAYER_COLORS[i % PLAYER_COLORS.length], ready: party.ready[i] })),
    })
  }
}

function dissolveForm(party: PendingParty, gone: Client | null) {
  for (const c of party.clients) pendingParties.delete(c)
  // Remaining members rejoin the head of the queue and keep waiting.
  for (const c of party.clients) {
    if (c === gone || c.ws.readyState !== WebSocket.OPEN) continue
    const q = coopQueues.get(party.key) ?? []
    q.unshift(c)
    coopQueues.set(party.key, q)
  }
  broadcastLobby(party.key)
}

/** Co-op climbs now use the untouched solo map — every node type included. */
function coopMap(act: number, rng: Rng): ActMap {
  return genActMap(act, rng)
}

function coopBroadcast(room: CoopRoom, msg: (idx: number) => unknown) {
  room.players.forEach((p, i) => {
    const body = msg(i)
    send(p.client.ws, body && typeof body === 'object' ? { ...body, rev: room.revision } : body)
  })
}

function coopMapMsg(room: CoopRoom, idx: number) {
  return {
    t: 'coopmap',
    you: idx,
    host: 0,
    act: room.act,
    floor: room.floor,
    pos: room.pos,
    path: room.path,
    map: room.map,
    party: room.players.map((p) => ({
      name: tagOf(p.client), char: p.char, color: p.color, hp: p.hp, maxHp: p.maxHp, gold: p.gold, deckSize: p.deck.length,
    })),
    votes: voteList(room),
  }
}

function clearCoopShopTimer(room: CoopRoom) {
  const timer = coopShopTimers.get(room.id)
  if (timer) clearTimeout(timer)
  coopShopTimers.delete(room.id)
}

function finishCoopShop(room: CoopRoom) {
  if (!room.shop || room.ended) return
  clearCoopShopTimer(room)
  room.shop = null
  room.shopCloseAt = null
  room.players.forEach((player) => (player.replied = true))
  touchCoop(room)
  coopBroadcast(room, (i) => coopMapMsg(room, i))
}

function armCoopShopClose(room: CoopRoom) {
  clearCoopShopTimer(room)
  if (!room.shop || !room.shopCloseAt || room.ended) return
  const delay = Math.max(1, room.shopCloseAt - Date.now())
  coopShopTimers.set(room.id, setTimeout(() => {
    coopShopTimers.delete(room.id)
    finishCoopShop(room)
  }, delay))
}

/** Full current phase for reconnects and revision-gap recovery. */
function sendCoopSnapshot(room: CoopRoom, idx: number) {
  const player = room.players[idx]
  const ws = player.client.ws
  send(ws, { ...coopMapMsg(room, idx), t: 'coopstart', seed: 0, token: player.client.token, rejoin: true, rev: room.revision })
  if (room.combat) {
    send(ws, {
      t: 'coopcombat',
      you: idx,
      view: coopViewFor(room.combat),
      belt: player.potions,
      mode: getMpMode(),
      rejoin: true,
      rev: room.revision,
    })
  } else if (room.rewards) {
    if (!player.replied) send(ws, { t: 'coopreward', you: idx, ...room.rewards[idx], rejoin: true, rev: room.revision })
    else send(ws, { t: 'coopwaiting', phase: 'reward', rev: room.revision })
  } else if (room.shop) {
    if (!player.replied) {
      send(ws, {
        t: 'coopshop',
        you: idx,
        stock: room.shop,
        gold: player.gold,
        deck: player.deck,
        belt: player.potions,
        replied: room.players.filter((p) => p.replied).length,
        total: room.players.length,
        closesAt: room.shopCloseAt,
        rejoin: true,
        rev: room.revision,
      })
    } else {
      send(ws, {
        t: 'coopwaiting', phase: 'shop', replied: room.players.filter((p) => p.replied).length,
        total: room.players.length, closesAt: room.shopCloseAt, rev: room.revision,
      })
    }
  } else if (room.event) {
    if (!player.replied) send(ws, { t: 'coopevent', you: idx, id: room.event.id, gold: player.gold, rejoin: true, rev: room.revision })
    else send(ws, { t: 'coopwaiting', phase: 'event', rev: room.revision })
  } else if (room.pos && nodeById(room.map, room.pos)?.type === 'rest' && !room.players.every((p) => p.replied)) {
    if (!player.replied) send(ws, { t: 'cooprest', you: idx, deck: player.deck, rejoin: true, rev: room.revision })
    else send(ws, { t: 'coopwaiting', phase: 'rest', rev: room.revision })
  }
}

function startCoopParty(clients: Client[], chars: CharId[]) {
  const seed = randomBytes(4).readUInt32LE(0)
  const rng = rngFromSeed(seed)
  let uid = 1
  const players: CoopPlayer[] = clients.map((client, i) => ({
    client,
    char: chars[i],
    color: PLAYER_COLORS[i % PLAYER_COLORS.length],
    hp: characterStartingMaxHp(75, chars[i]),
    maxHp: characterStartingMaxHp(75, chars[i]),
    deck: STARTER_DECKS[chars[i]].map((id): CardInst => ({ uid: uid++, id, up: false })),
    relics: [STARTER_RELICS[chars[i]]],
    potions: [],
    gold: 99,
    replied: false,
  }))
  const room: CoopRoom = {
    id: randomBytes(12).toString('hex'), revision: 0, updatedAt: Date.now(), expiresAt: 0,
    players, rng, uid: uid + 1000, act: 1, floor: 0, pos: null, path: [],
    map: coopMap(1, rng), combat: null, kind: 'normal', rewards: null, shop: null, shopCloseAt: null, event: null,
    votes: {}, lastEncounter: '', pendingNode: null, ended: false,
  }
  for (const c of clients) coopRooms.set(c, room)
  for (const p of room.players) mintToken(p.client)
  touchCoop(room)
  coopBroadcast(room, (i) => ({ ...coopMapMsg(room, i), t: 'coopstart', seed, token: room.players[i].client.token }))
}

function voteList(room: CoopRoom) {
  return room.players.map((p, i) => ({ i, name: tagOf(p.client), color: p.color, id: room.votes[i] ?? null }))
}

function broadcastVotes(room: CoopRoom) {
  coopBroadcast(room, () => ({ t: 'coopvotes', votes: voteList(room) }))
}

function coopAvailable(room: CoopRoom): string[] {
  const unresolvedRest =
    room.pos !== null &&
    nodeById(room.map, room.pos)?.type === 'rest' &&
    !room.players.every((p) => p.replied)
  if (room.pendingNode || room.combat || room.rewards || room.shop || room.event || unresolvedRest) return []
  if (room.pos === null) return room.map.rows[0].map((n) => n.id)
  return nodeById(room.map, room.pos)?.next ?? []
}

/** Apply the selected node after every client has seen the party travel. */
function completeCoopTravel(room: CoopRoom, id: string) {
  if (room.ended || room.pendingNode !== id) return
  room.pendingNode = null
  const node = nodeById(room.map, id)
  if (!node) {
    touchCoop(room)
    return
  }
  room.pos = id
  room.path.push(id)
  room.floor++
  if (node.type === 'combat' || node.type === 'elite' || node.type === 'boss') {
    coopStartFight(room, node.type === 'combat' ? 'normal' : node.type)
  } else if (node.type === 'shop') {
    const stock = {
      cards: Array.from({ length: 6 }, () => {
        const who = room.players[randInt(room.rng, 0, room.players.length - 1)]
        const r = randInt(room.rng, 1, 100)
        const rarity = r <= 10 ? 'rare' : r <= 45 ? 'uncommon' : 'common'
        const def = pick(room.rng, cardsByRarity(rarity as any, who.char))
        return {
          id: def.id,
          price: randInt(
            room.rng,
            rarity === 'rare' ? 130 : rarity === 'uncommon' ? 75 : 45,
            rarity === 'rare' ? 160 : rarity === 'uncommon' ? 95 : 60,
          ),
          sold: false,
        }
      }),
      relics: Array.from({ length: 2 }, () => {
        const rpool = obtainableRelics([], false)
        const def = rpool[randInt(room.rng, 0, rpool.length - 1)]
        return { id: def.id, price: randInt(room.rng, 150, 190), sold: false }
      }),
      potions: Array.from({ length: 2 }, () => {
        const pool = Object.values(POTIONS)
        const def = pool[randInt(room.rng, 0, pool.length - 1)]
        return { id: def.id, price: randInt(room.rng, 45, 70), sold: false }
      }),
      removePrice: 80,
    }
    room.shop = stock
    room.shopCloseAt = null
    room.players.forEach((p) => (p.replied = false))
    touchCoop(room)
    coopBroadcast(room, (i) => ({
      t: 'coopshop',
      you: i,
      stock,
      gold: room.players[i].gold,
      deck: room.players[i].deck,
      belt: room.players[i].potions,
      replied: room.players.filter((p) => p.replied).length,
      total: room.players.length,
      closesAt: room.shopCloseAt,
    }))
  } else if (node.type === 'event') {
    const pool = EVENTS.filter((ev) =>
      ev.choices.every((ch) =>
        ch.outcomes.every((o) =>
          ['gold', 'damage', 'heal', 'maxhp', 'cardRandom', 'cardGlitch', 'curse', 'upgradeRandom', 'cardSpecific', 'potion'].includes(o.k),
        ),
      ),
    )
    const ev = pick(room.rng, pool)
    room.event = { id: ev.id, picked: room.players.map(() => null) }
    room.players.forEach((p) => (p.replied = false))
    touchCoop(room)
    coopBroadcast(room, (i) => ({ t: 'coopevent', you: i, id: ev.id, gold: room.players[i].gold }))
  } else if (node.type === 'treasure') {
    room.players.forEach((p) => {
      p.gold += randInt(room.rng, 22, 40)
      p.replied = true
    })
    coopMaybeAdvance(room)
  } else {
    room.players.forEach((p) => (p.replied = false))
    touchCoop(room)
    coopBroadcast(room, (i) => ({ t: 'cooprest', you: i, deck: room.players[i].deck }))
  }
}

function coopStartFight(room: CoopRoom, kind: 'normal' | 'elite' | 'boss') {
  const pool = ENCOUNTERS[room.act][kind]
  let enc = pick(room.rng, pool)
  if (pool.length > 1 && enc.join(',') === room.lastEncounter) enc = pick(room.rng, pool)
  room.lastEncounter = enc.join(',')
  room.kind = kind
  room.combat = startCoopCombat({
    players: room.players.map((p) => ({ name: p.client.name, char: p.char, hp: p.hp, maxHp: p.maxHp, deck: p.deck, relics: p.relics })),
    enemyIds: enc,
    encounterId: enc.join(','),
    seed: randInt(room.rng, 1, 0x7fffffff),
    uidStart: room.uid,
    act: room.act,
  })
  touchCoop(room)
  coopBroadcast(room, (i) => ({ t: 'coopcombat', you: i, view: coopViewFor(room.combat!), belt: room.players[i].potions, mode: getMpMode() }))
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
  touchCoop(room)
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
    room.path = []
    room.players.forEach((p) => {
      p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.25))
    })
  }
  touchCoop(room)
  coopBroadcast(room, (i) => coopMapMsg(room, i))
}

function endCoop(room: CoopRoom) {
  room.ended = true
  clearCoopShopTimer(room)
  deleteCoopSnapshot(room.id)
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

function cleanChar(raw: unknown): CharId {
  return (['runner', 'vector', 'ghost', 'array'] as CharId[]).includes(raw as CharId) ? (raw as CharId) : 'runner'
}

function cleanModsKey(raw: unknown): string {
  const s = String(raw ?? '').replace(/[^\w@.+-]/g, '').slice(0, 120)
  return s || 'vanilla'
}

/**
 * Relay an emote / quick phrase to everyone in the sender's room or party.
 * The id may come from a mod — matchmaking guarantees both sides run the
 * same mods, so unknown ids are simply dropped by clients that lack them.
 */
function handleEmote(client: Client, msg: any) {
  const now = Date.now()
  if (client.lastEmote > now - 1200) return
  client.lastEmote = now
  const id = String(msg.id ?? '').replace(/[^a-z0-9_-]/gi, '').slice(0, 24)
  const text = String(msg.text ?? '').replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40)
  if (!id && !text) return
  const target = Number.isInteger(msg.target) ? Number(msg.target) : null
  const coop = coopRooms.get(client)
  if (coop && !coop.ended) {
    const who = coop.players.findIndex((p) => p.client === client)
    const tgt = target !== null && coop.players[target] ? target : null
    // Enemy-targeted emotes (dragged onto an enemy) only mean anything in combat.
    const et = Number.isInteger(msg.etarget) && coop.combat && coop.combat.enemies[Number(msg.etarget)]
      ? Number(msg.etarget)
      : null
    coopBroadcast(coop, () => ({ t: 'emote', who, name: tagOf(client), id, text, target: tgt, etarget: et }))
    return
  }
  const room = client.room
  if (room) {
    const who = room.players.indexOf(client)
    const tgt = target === 0 || target === 1 ? target : null
    for (const p of room.players) send(p.ws, { t: 'emote', who, name: tagOf(client), id, text, target: tgt })
  }
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

function roomChars(room: Room): CharId[] {
  return room.players.map((p) => p.char)
}

function startMatch(a: Client, b: Client, mode: Mode) {
  const seed = randomBytes(4).readUInt32LE(0)
  if (mode === 'duel') {
    const state = newPvp(seed, [a.name, b.name])
    const room: Room = {
      mode,
      players: [a, b],
      state,
      seed,
      ready: [null, null],
      finished: false,
      rematch: [false, false],
      score: [0, 0],
      checkpointAct: 0,
    }
    a.room = room
    b.room = room
    room.players.forEach((p, i) => {
      send(p.ws, { t: 'match', you: i, view: viewFor(state, i as 0 | 1), token: mintToken(p), mode: getMpMode(), chars: roomChars(room) })
    })
    return
  }
  // Climb race: both players run the SAME seed solo; the duel comes later.
  const room: Room = {
    mode,
    players: [a, b],
    state: null,
    seed,
    ready: [null, null],
    finished: false,
    rematch: [false, false],
    score: [0, 0],
    checkpointAct: 0,
  }
  a.room = room
  b.room = room
  room.players.forEach((p, i) => {
    send(p.ws, {
      t: 'climbstart',
      you: i,
      seed,
      opp: room.players[1 - i].name,
      oppChar: room.players[1 - i].char,
      token: mintToken(p),
      score: room.score,
    })
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
    send(p.ws, {
      t: 'duelstart',
      you: i,
      view: viewFor(room.state!, i as 0 | 1),
      chars: roomChars(room),
      score: room.score,
      act: room.checkpointAct,
    })
  })
}

function finishClimb(room: Room, winnerIdx: 0 | 1, reason: string) {
  room.finished = true
  send(room.players[winnerIdx].ws, { t: 'climbwin', reason })
  send(room.players[1 - winnerIdx].ws, { t: 'climbloss', reason })
  // The room lingers long enough to render the result and let both clients
  // explicitly leave; unlike checkpoint rounds, a climb death is final.
}

/** A checkpoint duel only awards a point. Both original solo runs continue. */
function finishClimbRound(room: Room, winnerIdx: 0 | 1, reason: string) {
  const result = scoreClimbRound(room.score, winnerIdx, room.checkpointAct)
  room.score = result.score
  const { final } = result
  if (final) room.finished = true
  room.players.forEach((p, i) => {
    send(p.ws, {
      t: final ? 'climbfinal' : 'climbround',
      you: i,
      roundWinner: winnerIdx,
      score: room.score,
      act: room.checkpointAct,
      reason,
    })
  })
  if (!final) {
    room.state = null
    room.ready = [null, null]
    room.checkpointAct = 0
  }
}

function handleAction(client: Client, rawAction: unknown, clientSum?: number) {
  const room = client.room
  if (!room || !room.state) return send(client.ws, { t: 'err', msg: 'not in a match' })
  const idx = room.players.indexOf(client) as 0 | 1
  // Hybrid divergence check: compare the client's pre-action checksum with
  // the authoritative state (both modes validate fully regardless).
  const corrected =
    clientSum !== undefined && clientSum !== pvpChecksum(room.state)
  const a = rawAction as PvpAction
  const valid =
    a && typeof a === 'object' &&
    ((a.t === 'play' && Number.isInteger(a.hand)) || a.t === 'end')
  if (!valid) return send(client.ws, { t: 'err', msg: 'malformed action' })

  const res = pvpReduce(room.state, idx, a)
  if (res.error) return send(client.ws, { t: 'err', msg: res.error })

  room.state = res.state
  room.players.forEach((p, i) => {
    send(p.ws, {
      t: 'st', view: viewFor(room.state!, i as 0 | 1), events: res.events,
      mode: getMpMode(), by: idx, ...(corrected && i === idx ? { corrected: true } : {}),
    })
  })
  if (room.state.over) {
    if (room.mode === 'climb') finishClimbRound(room, room.state.over.winner, room.state.over.reason)
    else room.finished = true
    // duel rooms linger so both sides can hit REMATCH
  }
}

const wss = new WebSocketServer({ server: http })

wss.on('connection', (ws) => {
  let client: Client = {
    ws, name: 'RUNNER', room: null, alive: true, token: null, online: true, dcTimer: null,
    vid: randomBytes(2).toString('hex'),
    char: 'runner', modsKey: 'vanilla', lastEmote: 0,
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
        client.char = cleanChar(msg.char)
        client.modsKey = cleanModsKey(msg.modsKey)
        const mode: Mode = msg.mode === 'climb' ? 'climb' : 'duel'
        const key = client.modsKey
        if (waiting[mode].get(key) === client) return
        const opponent = waiting[mode].get(key)
        if (opponent && opponent.ws.readyState === WebSocket.OPEN) {
          waiting[mode].delete(key)
          startMatch(opponent, client, mode)
        } else {
          unqueue(client)
          waiting[mode].set(key, client)
          send(ws, { t: 'queued', mode, modsKey: key })
        }
        break
      }
      case 'cancel': {
        unqueue(client)
        send(ws, { t: 'cancelled' })
        break
      }
      case 'emote':
        handleEmote(client, msg)
        break
      case 'action':
        handleAction(client, msg.action, typeof msg.sum === 'number' ? msg.sum : undefined)
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
          if (room.mode === 'duel') {
            send(ws, { t: 'match', you: idx, view: viewFor(room.state!, idx), token: client.token, rejoin: true, mode: getMpMode(), chars: roomChars(room) })
          } else if (room.state) {
            send(ws, {
              t: 'duelstart',
              you: idx,
              view: viewFor(room.state, idx),
              token: client.token,
              rejoin: true,
              chars: roomChars(room),
              score: room.score,
              act: room.checkpointAct,
            })
          } else {
            send(ws, {
              t: 'climbstart',
              you: idx,
              seed: room.seed,
              opp: room.players[1 - idx].name,
              oppChar: room.players[1 - idx].char,
              token: client.token,
              rejoin: true,
              score: room.score,
            })
            if (room.ready[idx]) send(ws, { t: 'checkpoint', score: room.score, rejoin: true })
          }
        } else if (coop && !coop.ended) {
          const idx = coop.players.findIndex((p) => p.client === client)
          sendCoopSnapshot(coop, idx)
        } else {
          releaseSeat(client)
          send(ws, { t: 'resume-fail' })
        }
        break
      }
      case 'coopsync': {
        const room = coopRooms.get(client)
        if (!room || room.ended) return send(ws, { t: 'resume-fail' })
        const idx = room.players.findIndex((p) => p.client === client)
        sendCoopSnapshot(room, idx)
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
            send(p.ws, { t: 'match', you: i, view: viewFor(room.state!, i as 0 | 1), token: p.token, mode: getMpMode(), chars: roomChars(room) })
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
        client.char = cleanChar(msg.char)
        client.modsKey = cleanModsKey(msg.modsKey)
        const size = Math.max(2, Math.min(4, Math.floor(Number(msg.size) || 2)))
        const key = coopKey(size, client.modsKey)
        for (const [k, q] of coopQueues) {
          const at = q.indexOf(client)
          if (at >= 0) {
            q.splice(at, 1)
            if (!q.length) coopQueues.delete(k)
          }
        }
        const q = coopQueues.get(key) ?? []
        q.push(client)
        coopQueues.set(key, q)
        send(ws, { t: 'queued', mode: 'coop', size, modsKey: client.modsKey })
        broadcastLobby(key)
        if (q.length >= size) {
          const members = q.splice(0, size)
          if (!q.length) coopQueues.delete(key)
          const party: PendingParty = {
            clients: members,
            chars: members.map((c) => c.char),
            ready: members.map(() => false),
            size,
            key,
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
      case 'coopvote': {
        // Advisory path vote from any party member; captain still decides.
        const room = coopRooms.get(client)
        if (!room || room.ended || room.combat || room.rewards) break
        const idx = room.players.findIndex((p) => p.client === client)
        const id = String(msg.id ?? '')
        if (!coopAvailable(room).includes(id)) return send(ws, { t: 'err', msg: 'invalid node' })
        room.votes[idx] = id
        touchCoop(room)
        broadcastVotes(room)
        break
      }
      case 'cooppick': {
        const room = coopRooms.get(client)
        if (!room || room.ended || room.combat || room.rewards || room.pendingNode) break
        if (room.players[0].client !== client) return send(ws, { t: 'err', msg: 'only the host picks the path' })
        const id = String(msg.id ?? '')
        if (!coopAvailable(room).includes(id)) return send(ws, { t: 'err', msg: 'invalid node' })
        room.votes = {}
        room.pendingNode = id
        touchCoop(room)
        coopBroadcast(room, () => ({ t: 'cooptravel', id }))
        setTimeout(() => completeCoopTravel(room, id), 560)
        break
      }
      case 'coopaction': {
        const room = coopRooms.get(client)
        if (!room || !room.combat || room.ended) break
        const idx = room.players.findIndex((p) => p.client === client)
        const a = msg.action as CoopAction
        const valid = a && typeof a === 'object' && ((a.t === 'play' && Number.isInteger(a.hand)) || a.t === 'end')
        if (!valid) return send(ws, { t: 'err', msg: 'malformed action' })
        // Hybrid divergence check, same contract as PvP duels.
        const corrected = typeof msg.sum === 'number' && msg.sum !== coopChecksum(room.combat)
        const played =
          a.t === 'play' && room.combat.players[idx]?.hand[a.hand]
            ? { who: idx, card: room.combat.players[idx].hand[a.hand], target: a.target, ally: a.ally }
            : null
        const res = coopReduce(room.combat, idx, a)
        if (res.error) return send(ws, { t: 'err', msg: res.error })
        room.combat = res.state
        touchCoop(room)
        coopBroadcast(room, (i) => ({
          t: 'coopst', you: i, view: coopViewFor(room.combat!), events: res.events, played,
          mode: getMpMode(), by: idx, ...(corrected && i === idx ? { corrected: true } : {}),
        }))
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
        touchCoop(room)
        coopBroadcast(room, (i) => ({
          t: 'coopprogress',
          phase: 'reward',
          replied: room.players.filter((p) => p.replied).length,
          total: room.players.length,
          waiting: i === idx,
        }))
        coopMaybeAdvance(room)
        break
      }
      case 'coopbuy': {
        const room = coopRooms.get(client)
        if (!room || !room.shop || room.ended) break
        const idx = room.players.findIndex((p) => p.client === client)
        const player = room.players[idx]
        if (player.replied) return send(ws, { t: 'err', msg: 'already left the shop' })
        const kind = String(msg.kind ?? '')
        if (kind === 'card' || kind === 'relic' || kind === 'potion') {
          const list = kind === 'card' ? room.shop.cards : kind === 'relic' ? room.shop.relics : room.shop.potions
          const item = list[Math.floor(Number(msg.idx))]
          if (!item || item.sold || player.gold < item.price) return send(ws, { t: 'err', msg: 'cannot buy' })
          if (kind === 'potion' && player.potions.length >= 3) return send(ws, { t: 'err', msg: 'belt full' })
          item.sold = true
          player.gold -= item.price
          if (kind === 'card') player.deck.push({ uid: room.uid++, id: item.id, up: false })
          else if (kind === 'relic') player.relics.push(item.id)
          else player.potions.push(item.id)
          coopBroadcast(room, () => ({ t: 'coopbought', name: tagOf(client), kind, id: item.id }))
        } else if (kind === 'remove') {
          if (player.gold < room.shop.removePrice) return send(ws, { t: 'err', msg: 'cannot afford' })
          const uid = Math.floor(Number(msg.uid))
          const at = player.deck.findIndex((c) => c.uid === uid)
          if (at < 0) return send(ws, { t: 'err', msg: 'no such card' })
          player.gold -= room.shop.removePrice
          player.deck.splice(at, 1)
        }
        touchCoop(room)
        coopBroadcast(room, (i) => ({
          t: 'coopshop', you: i, stock: room.shop, gold: room.players[i].gold,
          deck: room.players[i].deck, belt: room.players[i].potions,
          replied: room.players.filter((p) => p.replied).length, total: room.players.length,
          closesAt: room.shopCloseAt,
        }))
        break
      }
      case 'coopshopdone': {
        const room = coopRooms.get(client)
        if (!room || !room.shop || room.ended) break
        const idx = room.players.findIndex((p) => p.client === client)
        room.players[idx].replied = true
        if (room.players.every((p) => p.replied)) {
          finishCoopShop(room)
        } else {
          if (!room.shopCloseAt) room.shopCloseAt = Date.now() + COOP_SHOP_CLOSE_GRACE_MS
          armCoopShopClose(room)
          touchCoop(room)
          coopBroadcast(room, (i) => ({
            t: 'coopprogress',
            phase: 'shop',
            replied: room.players.filter((p) => p.replied).length,
            total: room.players.length,
            closesAt: room.shopCloseAt,
            waiting: i === idx,
          }))
        }
        break
      }
      case 'coopeventpick': {
        const room = coopRooms.get(client)
        if (!room || !room.event || room.ended) break
        const idx = room.players.findIndex((p) => p.client === client)
        const player = room.players[idx]
        if (player.replied) break
        const ev = EVENTS.find((e) => e.id === room.event!.id)
        if (!ev) break
        const ci = Math.floor(Number(msg.choice))
        const ch = ev.choices[ci]
        if (!ch) return send(ws, { t: 'err', msg: 'bad choice' })
        if (ch.needGold && player.gold < ch.needGold) return send(ws, { t: 'err', msg: 'cannot afford' })
        // apply the supported outcome subset to this party member
        for (const o of ch.outcomes) {
          if (o.k === 'gold') player.gold = Math.max(0, player.gold + o.n)
          else if (o.k === 'damage') player.hp = Math.max(1, player.hp - o.n)
          else if (o.k === 'heal') player.hp = Math.min(player.maxHp, player.hp + o.n)
          else if (o.k === 'maxhp') { player.maxHp += o.n; player.hp = Math.min(player.maxHp, player.hp + Math.max(0, o.n)) }
          else if (o.k === 'cardRandom') player.deck.push({ uid: room.uid++, id: pick(room.rng, cardsByRarity(o.rarity, player.char)).id, up: false })
          else if (o.k === 'cardGlitch') player.deck.push({ uid: room.uid++, id: 'glitch', up: false })
          else if (o.k === 'curse') player.deck.push({ uid: room.uid++, id: 'lag', up: false })
          else if (o.k === 'cardSpecific') player.deck.push({ uid: room.uid++, id: o.id, up: false })
          else if (o.k === 'upgradeRandom') {
            const cand = player.deck.filter((c) => !c.up && CARDS[c.id]?.rarity !== 'special')
            if (cand.length) pick(room.rng, cand).up = true
          }
        }
        player.replied = true
        room.event.picked[idx] = ci
        touchCoop(room)
        coopBroadcast(room, () => ({ t: 'coopeventpicked', who: idx, choice: ci, name: tagOf(player.client) }))
        if (room.players.every((p) => p.replied)) {
          room.event = null
          touchCoop(room)
          coopBroadcast(room, (i) => coopMapMsg(room, i))
        }
        break
      }
      case 'cooppotion': {
        const room = coopRooms.get(client)
        if (!room || !room.combat || room.ended) break
        const idx = room.players.findIndex((p) => p.client === client)
        const player = room.players[idx]
        const pi = Math.floor(Number(msg.idx))
        const pid = player.potions[pi]
        if (!pid || !POTIONS[pid]) return send(ws, { t: 'err', msg: 'no such potion' })
        const res = coopUsePotion(room.combat, idx, pid, Number.isInteger(msg.target) ? Number(msg.target) : undefined)
        if (res.error) return send(ws, { t: 'err', msg: res.error })
        player.potions.splice(pi, 1)
        room.combat = res.state
        touchCoop(room)
        coopBroadcast(room, (i) => ({ t: 'coopst', you: i, view: coopViewFor(room.combat!), events: res.events, belt: i === idx ? player.potions : undefined }))
        if (room.combat.over === 'win') coopFinishFight(room)
        else if (room.combat.over === 'lose') {
          coopBroadcast(room, () => ({ t: 'coopdefeat' }))
          endCoop(room)
        }
        break
      }
      case 'coopcomm': {
        const room = coopRooms.get(client)
        if (!room || room.ended) break
        const k = String(msg.k ?? '')
        if (!['go', 'wait', 'help', 'gg'].includes(k)) break
        const now = Date.now()
        if (((client as any).lastComm ?? 0) > now - 1500) break
        ;(client as any).lastComm = now
        coopBroadcast(room, () => ({ t: 'coopcomm', k, name: tagOf(client) }))
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
        } else if (what === 'remove') {
          const uid = Math.floor(Number(msg.uid))
          const at = player.deck.findIndex((c) => c.uid === uid)
          if (at >= 0 && player.deck.length > 6) player.deck.splice(at, 1)
        } else {
          player.hp = Math.min(player.maxHp, player.hp + Math.floor(player.maxHp * 0.3))
        }
        player.replied = true
        if (room.players.every((p) => p.replied)) {
          touchCoop(room)
          coopBroadcast(room, (i) => coopMapMsg(room, i))
        } else {
          touchCoop(room)
          coopBroadcast(room, (i) => ({
            t: 'coopprogress',
            phase: 'rest',
            replied: room.players.filter((p) => p.replied).length,
            total: room.players.length,
            waiting: i === idx,
          }))
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
            pos: typeof msg.pos === 'string' ? msg.pos.slice(0, 64) : null,
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
        if (room.ready[idx]) return send(ws, { t: 'err', msg: 'checkpoint already submitted' })
        const deck = cleanDeck(msg.deck)
        if (!deck) return send(ws, { t: 'err', msg: 'invalid deck' })
        const act = Math.max(1, Math.min(3, Math.floor(Number(msg.act) || 1)))
        if (room.checkpointAct && room.checkpointAct !== act) return send(ws, { t: 'err', msg: 'checkpoint act mismatch' })
        room.checkpointAct = act
        // The duel is an isolated scoring round: both duelists start at their
        // run's maximum HP and no duel mutation is copied back to RunState.
        const duelHp = Math.max(1, Math.min(999, Math.floor(Number(msg.maxHp) || 1)))
        room.ready[idx] = { deck, hp: duelHp }
        const other = room.players.find((p) => p !== client)
        if (other) send(other.ws, { t: 'oppready' })
        send(ws, { t: 'checkpoint', score: room.score, act })
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
    unqueue(client)
    for (const [k, q] of coopQueues) {
      const at = q.indexOf(client)
      if (at >= 0) {
        q.splice(at, 1)
        broadcastLobby(k)
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
    const liveCoop = coopRooms.get(client)
    if (liveCoop && !liveCoop.ended) {
      armCoopExpiry(client, liveCoop)
      return
    }
    client.dcTimer = setTimeout(() => {
      client.dcTimer = null
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
    }, MATCH_RECONNECT_GRACE_MS)
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

let stopping = false
async function shutdown(signal: string) {
  if (stopping) return
  stopping = true
  clearInterval(heartbeat)
  let exitCode = 0
  try {
    await Promise.all([flushAccounts(), flushCoopSnapshots()])
    await closePostgres()
  } catch (error) {
    exitCode = 1
    console.error(`durable store flush failed during ${signal}:`, error)
  }
  process.exit(exitCode)
}

process.once('SIGTERM', () => void shutdown('SIGTERM'))
process.once('SIGINT', () => void shutdown('SIGINT'))

async function start() {
  await Promise.all([initializeAccounts(), initializeCoopStore()])
  restoreCoopRooms()
  http.listen(PORT, () => {
    console.log(`NEONSPIRE server listening on http://localhost:${PORT} (ws same port; persistence=${persistenceBackend})`)
  })
}

void start().catch(async (error) => {
  clearInterval(heartbeat)
  console.error('NEONSPIRE server failed to start:', error)
  await closePostgres().catch(() => undefined)
  process.exit(1)
})
