/**
 * Accounts + cloud saves + admin tools. JSON-file store (no external DB),
 * scrypt-hashed credentials, bearer-token sessions, and env-key-protected
 * admin endpoints. Guest mode is simply "never call these" — the game is
 * fully playable without an account.
 */
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'

interface Account {
  user: string
  name: string
  salt: string
  hash: string
  created: number
  banned?: boolean
  /** Cheat console access is opt-in and can only be changed by an admin. */
  cheatsEnabled?: boolean
  blob?: string
  blobUpdated?: number
}

interface DailyScore {
  user: string
  name: string
  score: number
  char: string
  seed: number
  at: number
}

interface TelemetryRun {
  d: number
  asc: number
  act: number
  floor: number
  win: boolean
  sc: number
  ch: 'runner' | 'vector' | 'ghost' | 'array'
  arch: string | null
  deck: number | null
  up: number | null
  relics: number | null
}

interface Db {
  accounts: Record<string, Account>
  registrationsOpen: boolean
  dailyScores: Record<string, DailyScore[]>
  /** Multiplayer combat mode; env MULTIPLAYER_MODE overrides when set. */
  mpMode?: 'strict' | 'hybrid'
}

const DATA_FILE = process.env.NS_DATA_FILE ?? join(process.cwd(), 'data', 'accounts.json')
const ADMIN_KEY = process.env.NS_ADMIN_KEY ?? ''
/** Obfuscatable admin API prefix, e.g. ADMIN_API_PATH=/sadasd/admin */
export const ADMIN_API_PATH = (process.env.ADMIN_API_PATH ?? '/api/admin').replace(/\/$/, '')
const ENV_MP_MODE = process.env.MULTIPLAYER_MODE === 'strict' || process.env.MULTIPLAYER_MODE === 'hybrid'
  ? (process.env.MULTIPLAYER_MODE as 'strict' | 'hybrid')
  : null

/** Effective multiplayer mode: env override > admin setting > hybrid. */
export function getMpMode(): 'strict' | 'hybrid' {
  return ENV_MP_MODE ?? db.mpMode ?? 'hybrid'
}

/** Optional game entry password (empty = gate disabled). */
const GATE_HASH = process.env.GAME_ENTRY_PASSWORD
  ? createHash('sha256').update(process.env.GAME_ENTRY_PASSWORD).digest('hex')
  : ''
const MAX_BLOB = 128 * 1024

let db: Db = { accounts: {}, registrationsOpen: true, dailyScores: {} }
try {
  db = { registrationsOpen: true, dailyScores: {}, ...JSON.parse(readFileSync(DATA_FILE, 'utf8')) }
} catch {
  /* fresh store */
}

let saveTimer: NodeJS.Timeout | null = null
function persist() {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    try {
      mkdirSync(dirname(DATA_FILE), { recursive: true })
      writeFileSync(DATA_FILE, JSON.stringify(db))
    } catch (e) {
      console.error('account store write failed:', e)
    }
  }, 250)
}

const sessions = new Map<string, string>() // token -> user key

function hashPass(pass: string, salt: string): string {
  return scryptSync(pass, salt, 32).toString('hex')
}

function keyOf(user: string): string {
  return user.trim().toLowerCase()
}

function validName(user: string): boolean {
  return /^[\w\-]{3,16}$/.test(user)
}

function json(res: ServerResponse, code: number, body: unknown) {
  res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*' })
  res.end(JSON.stringify(body))
}

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let buf = ''
    req.on('data', (c) => {
      buf += c
      if (buf.length > MAX_BLOB * 2) req.destroy()
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(buf || '{}'))
      } catch {
        resolve(null)
      }
    })
  })
}

function authed(req: IncomingMessage): Account | null {
  const m = /^Bearer (\w+)$/.exec(String(req.headers.authorization ?? ''))
  const user = m ? sessions.get(m[1]) : undefined
  const acc = user ? db.accounts[user] : undefined
  return acc && !acc.banned ? acc : null
}

function revokeSessions(user: string) {
  for (const [token, sessionUser] of sessions) {
    if (sessionUser === user) sessions.delete(token)
  }
}

function isAdmin(req: IncomingMessage): boolean {
  return ADMIN_KEY.length >= 8 && String(req.headers['x-admin-key'] ?? '') === ADMIN_KEY
}

function accountRuns(account: Account): TelemetryRun[] {
  if (!account.blob) return []
  try {
    const keys = JSON.parse(account.blob)?.keys
    const history = JSON.parse(keys?.['ns-history'] ?? '[]')
    if (!Array.isArray(history)) return []
    return history.slice(0, 100).flatMap((run): TelemetryRun[] => {
      const ch = run?.ch ?? 'runner'
      if (!['runner', 'vector', 'ghost', 'array'].includes(ch)) return []
      const d = Number(run?.d)
      const floor = Number(run?.floor)
      const act = Number(run?.act)
      const asc = Number(run?.asc)
      if (![d, floor, act, asc].every(Number.isFinite) || floor < 0 || act < 1 || asc < 0) return []
      const optional = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : null
      return [{
        d, floor, act, asc, ch, win: run?.win === true,
        sc: Number.isFinite(Number(run?.sc)) ? Number(run.sc) : 0,
        arch: typeof run?.arch === 'string' ? run.arch.slice(0, 40) : null,
        deck: optional(run?.deck), up: optional(run?.up), relics: optional(run?.relics),
      }]
    })
  } catch {
    return []
  }
}

function telemetrySummary(runs: TelemetryRun[]) {
  const floors = runs.map((r) => r.floor).sort((a, b) => a - b)
  const avg = (values: number[]) => values.length ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)) : 0
  const percentile = (p: number) => {
    if (!floors.length) return 0
    const index = Math.round((floors.length - 1) * p)
    return floors[index]
  }
  const wins = runs.filter((r) => r.win).length
  return {
    runs: runs.length,
    wins,
    winRate: runs.length ? Number((wins / runs.length * 100).toFixed(1)) : 0,
    avgFloor: avg(floors),
    p25Floor: percentile(0.25),
    medianFloor: percentile(0.5),
    p75Floor: percentile(0.75),
    avgScore: avg(runs.map((r) => r.sc)),
    avgDeck: avg(runs.flatMap((r) => r.deck === null ? [] : [r.deck])),
    avgUpgrades: avg(runs.flatMap((r) => r.up === null ? [] : [r.up])),
    avgRelics: avg(runs.flatMap((r) => r.relics === null ? [] : [r.relics])),
    deathByAct: Object.fromEntries([1, 2, 3, 4].map((act) => [act, runs.filter((r) => !r.win && r.act === act).length])),
  }
}

function balanceTelemetry() {
  const accounts = Object.values(db.accounts)
  const perAccount = accounts.map((account) => accountRuns(account))
  const runs = perAccount.flat()
  const group = <K extends string | number>(key: (run: TelemetryRun) => K) => {
    const grouped = new Map<K, TelemetryRun[]>()
    for (const run of runs) grouped.set(key(run), [...(grouped.get(key(run)) ?? []), run])
    return [...grouped.entries()].map(([id, list]) => ({ id, ...telemetrySummary(list) }))
  }
  return {
    generatedAt: Date.now(),
    accountsWithHistory: perAccount.filter((list) => list.length > 0).length,
    ...telemetrySummary(runs),
    recent30d: telemetrySummary(runs.filter((r) => r.d >= Date.now() - 30 * 864e5)),
    byChar: group((r) => r.ch).sort((a, b) => String(a.id).localeCompare(String(b.id))),
    byArchetype: group((r) => r.arch ?? 'unclassified').sort((a, b) => b.runs - a.runs),
    byAscension: group((r) => r.asc).sort((a, b) => Number(a.id) - Number(b.id)),
  }
}

/** Returns true if the request was handled as an API route. */
export async function handleApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = (req.url ?? '').split('?')[0]
  if (!url.startsWith('/api/') && !url.startsWith(ADMIN_API_PATH + '/')) return false
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type,authorization,x-admin-key',
      'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
    })
    res.end()
    return true
  }

  // --- entry gate ------------------------------------------------------
  if (url === '/api/gate') {
    if (req.method === 'GET') return json(res, 200, { required: GATE_HASH.length > 0 }), true
    if (req.method === 'POST') {
      const b = await readBody(req)
      const given = b?.hash ? String(b.hash) : createHash('sha256').update(String(b?.pass ?? '')).digest('hex')
      const ok = GATE_HASH === '' || (given.length === GATE_HASH.length &&
        timingSafeEqual(Buffer.from(given), Buffer.from(GATE_HASH)))
      return json(res, ok ? 200 : 401, ok ? { ok: true, hash: GATE_HASH || undefined } : { err: 'wrong password' }), true
    }
  }

  if (url === '/api/mpmode' && req.method === 'GET') {
    return json(res, 200, { mode: getMpMode(), envLocked: ENV_MP_MODE !== null }), true
  }

  // --- auth ------------------------------------------------------------
  if (url === '/api/register' && req.method === 'POST') {
    const b = await readBody(req)
    const user = String(b?.user ?? '')
    const pass = String(b?.pass ?? '')
    if (!db.registrationsOpen) return json(res, 403, { err: 'registrations closed' }), true
    if (!validName(user)) return json(res, 400, { err: 'name must be 3-16 word chars' }), true
    if (pass.length < 6) return json(res, 400, { err: 'password too short (6+)' }), true
    const key = keyOf(user)
    if (db.accounts[key]) return json(res, 409, { err: 'name taken' }), true
    const salt = randomBytes(12).toString('hex')
    db.accounts[key] = { user: key, name: user, salt, hash: hashPass(pass, salt), created: Date.now() }
    persist()
    const token = randomBytes(16).toString('hex')
    sessions.set(token, key)
    return json(res, 200, { token, name: user, cheatsEnabled: false }), true
  }
  if (url === '/api/login' && req.method === 'POST') {
    const b = await readBody(req)
    const acc = db.accounts[keyOf(String(b?.user ?? ''))]
    const pass = String(b?.pass ?? '')
    const ok =
      acc &&
      !acc.banned &&
      timingSafeEqual(Buffer.from(acc.hash, 'hex'), Buffer.from(hashPass(pass, acc.salt), 'hex'))
    if (!ok) return json(res, 401, { err: 'bad credentials' }), true
    const token = randomBytes(16).toString('hex')
    sessions.set(token, acc.user)
    return json(res, 200, {
      token, name: acc.name, updated: acc.blobUpdated ?? 0, cheatsEnabled: !!acc.cheatsEnabled,
    }), true
  }
  if (url === '/api/session' && req.method === 'GET') {
    const acc = authed(req)
    if (!acc) return json(res, 401, { err: 'not logged in' }), true
    return json(res, 200, { name: acc.name, cheatsEnabled: !!acc.cheatsEnabled }), true
  }

  // --- cloud save ------------------------------------------------------
  if (url === '/api/sync') {
    const acc = authed(req)
    if (!acc) return json(res, 401, { err: 'not logged in' }), true
    if (req.method === 'GET') {
      return json(res, 200, { blob: acc.blob ?? null, updated: acc.blobUpdated ?? 0 }), true
    }
    if (req.method === 'PUT') {
      const b = await readBody(req)
      const blob = String(b?.blob ?? '')
      if (blob.length > MAX_BLOB) return json(res, 413, { err: 'save too large' }), true
      acc.blob = blob
      acc.blobUpdated = Date.now()
      persist()
      return json(res, 200, { ok: true, updated: acc.blobUpdated }), true
    }
  }

  // --- global daily leaderboard ---------------------------------------
  const today = new Date().toISOString().slice(0, 10)
  if (url === '/api/daily/score' && req.method === 'POST') {
    const acc = authed(req)
    if (!acc) return json(res, 401, { err: 'not logged in' }), true
    const b = await readBody(req)
    const score = Math.floor(Number(b?.score))
    if (!Number.isFinite(score) || score < 0 || score > 100000) return json(res, 400, { err: 'bad score' }), true
    const entry: DailyScore = {
      user: acc.user, name: acc.name, score,
      char: String(b?.char ?? 'runner').slice(0, 12),
      seed: Math.floor(Number(b?.seed)) >>> 0, at: Date.now(),
    }
    const list = (db.dailyScores[today] ??= [])
    const mine = list.findIndex((e) => e.user === acc.user)
    // only the highest score per account per day counts
    if (mine >= 0) {
      if (list[mine].score >= score) return json(res, 200, { ok: true, kept: list[mine].score }), true
      list[mine] = entry
    } else {
      list.push(entry)
    }
    list.sort((a, b2) => b2.score - a.score)
    db.dailyScores[today] = list.slice(0, 500)
    // retire boards older than two weeks
    for (const k of Object.keys(db.dailyScores)) {
      if (k < new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10)) delete db.dailyScores[k]
    }
    persist()
    return json(res, 200, { ok: true, rank: list.findIndex((e) => e.user === acc.user) + 1 }), true
  }
  if (url === '/api/daily/leaderboard' && req.method === 'GET') {
    const list = (db.dailyScores[today] ?? []).slice(0, 100).map((e, i) => ({
      rank: i + 1, name: e.name, score: e.score, char: e.char,
    }))
    const acc = authed(req)
    const mine = acc ? (db.dailyScores[today] ?? []).findIndex((e) => e.user === acc.user) : -1
    return json(res, 200, { date: today, top: list, you: mine >= 0 ? mine + 1 : null }), true
  }

  // --- admin -----------------------------------------------------------
  if (url.startsWith(ADMIN_API_PATH + '/')) {
    const sub = url.slice(ADMIN_API_PATH.length)
    if (!isAdmin(req)) return json(res, 403, { err: 'admin key required' }), true
    if (sub === '/balance' && req.method === 'GET') {
      return json(res, 200, balanceTelemetry()), true
    }
    if (sub === '/accounts' && req.method === 'GET') {
      const list = Object.values(db.accounts).map((a) => ({
        user: a.user, name: a.name, created: a.created, banned: !!a.banned,
        cheatsEnabled: !!a.cheatsEnabled, blobUpdated: a.blobUpdated ?? 0,
      }))
      return json(res, 200, { registrationsOpen: db.registrationsOpen, mpMode: getMpMode(), mpEnvLocked: ENV_MP_MODE !== null, accounts: list }), true
    }
    const delMatch = /^\/accounts\/([\w\-]+)$/.exec(sub)
    if (delMatch && req.method === 'DELETE') {
      const key = keyOf(delMatch[1])
      if (!db.accounts[key]) return json(res, 404, { err: 'no such account' }), true
      delete db.accounts[key]
      revokeSessions(key)
      persist()
      return json(res, 200, { ok: true }), true
    }
    if (sub === '/reset' && req.method === 'POST') {
      const b = await readBody(req)
      const acc = db.accounts[keyOf(String(b?.user ?? ''))]
      const pass = String(b?.pass ?? '')
      if (!acc) return json(res, 404, { err: 'no such account' }), true
      if (pass.length < 6) return json(res, 400, { err: 'password too short' }), true
      acc.salt = randomBytes(12).toString('hex')
      acc.hash = hashPass(pass, acc.salt)
      revokeSessions(acc.user)
      persist()
      return json(res, 200, { ok: true }), true
    }
    if (sub === '/ban' && req.method === 'POST') {
      const b = await readBody(req)
      const acc = db.accounts[keyOf(String(b?.user ?? ''))]
      if (!acc) return json(res, 404, { err: 'no such account' }), true
      acc.banned = !!b?.banned
      if (acc.banned) revokeSessions(acc.user)
      persist()
      return json(res, 200, { ok: true, banned: acc.banned }), true
    }
    if (sub === '/cheats' && req.method === 'POST') {
      const b = await readBody(req)
      const acc = db.accounts[keyOf(String(b?.user ?? ''))]
      if (!acc) return json(res, 404, { err: 'no such account' }), true
      acc.cheatsEnabled = b?.enabled === true
      persist()
      return json(res, 200, { ok: true, cheatsEnabled: acc.cheatsEnabled }), true
    }
    if (sub === '/mpmode' && req.method === 'POST') {
      const b = await readBody(req)
      const mode = b?.mode === 'strict' ? 'strict' : b?.mode === 'hybrid' ? 'hybrid' : null
      if (!mode) return json(res, 400, { err: 'mode must be strict|hybrid' }), true
      db.mpMode = mode
      persist()
      return json(res, 200, { mode: getMpMode(), envLocked: ENV_MP_MODE !== null }), true
    }
    if (sub === '/registrations' && req.method === 'POST') {
      const b = await readBody(req)
      db.registrationsOpen = !!b?.open
      persist()
      return json(res, 200, { registrationsOpen: db.registrationsOpen }), true
    }
    if (sub === '/export' && req.method === 'GET') {
      return json(res, 200, db), true
    }
    if (sub === '/import' && req.method === 'POST') {
      const b = await readBody(req)
      if (!b || typeof b.accounts !== 'object') return json(res, 400, { err: 'bad import payload' }), true
      db = { registrationsOpen: b.registrationsOpen !== false, accounts: b.accounts, dailyScores: b.dailyScores ?? {} }
      sessions.clear()
      persist()
      return json(res, 200, { ok: true, count: Object.keys(db.accounts).length }), true
    }
  }
  return json(res, 404, { err: 'unknown api route' }), true
}
