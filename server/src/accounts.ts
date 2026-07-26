/**
 * Accounts + cloud saves + admin tools. JSON-file store (no external DB),
 * scrypt-hashed credentials, bearer-token sessions, and env-key-protected
 * admin endpoints. Guest mode is simply "never call these" — the game is
 * fully playable without an account.
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
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

interface Db {
  accounts: Record<string, Account>
  registrationsOpen: boolean
  dailyScores: Record<string, DailyScore[]>
}

const DATA_FILE = process.env.NS_DATA_FILE ?? join(process.cwd(), 'data', 'accounts.json')
const ADMIN_KEY = process.env.NS_ADMIN_KEY ?? ''
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

function isAdmin(req: IncomingMessage): boolean {
  return ADMIN_KEY.length >= 8 && String(req.headers['x-admin-key'] ?? '') === ADMIN_KEY
}

/** Returns true if the request was handled as an API route. */
export async function handleApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = (req.url ?? '').split('?')[0]
  if (!url.startsWith('/api/')) return false
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type,authorization,x-admin-key',
      'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
    })
    res.end()
    return true
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
    return json(res, 200, { token, name: user }), true
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
    return json(res, 200, { token, name: acc.name, updated: acc.blobUpdated ?? 0 }), true
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
  if (url.startsWith('/api/admin/')) {
    if (!isAdmin(req)) return json(res, 403, { err: 'admin key required' }), true
    if (url === '/api/admin/accounts' && req.method === 'GET') {
      const list = Object.values(db.accounts).map((a) => ({
        user: a.user, name: a.name, created: a.created, banned: !!a.banned, blobUpdated: a.blobUpdated ?? 0,
      }))
      return json(res, 200, { registrationsOpen: db.registrationsOpen, accounts: list }), true
    }
    const delMatch = /^\/api\/admin\/accounts\/([\w\-]+)$/.exec(url)
    if (delMatch && req.method === 'DELETE') {
      const key = keyOf(delMatch[1])
      if (!db.accounts[key]) return json(res, 404, { err: 'no such account' }), true
      delete db.accounts[key]
      for (const [tok, u] of sessions) if (u === key) sessions.delete(tok)
      persist()
      return json(res, 200, { ok: true }), true
    }
    if (url === '/api/admin/reset' && req.method === 'POST') {
      const b = await readBody(req)
      const acc = db.accounts[keyOf(String(b?.user ?? ''))]
      const pass = String(b?.pass ?? '')
      if (!acc) return json(res, 404, { err: 'no such account' }), true
      if (pass.length < 6) return json(res, 400, { err: 'password too short' }), true
      acc.salt = randomBytes(12).toString('hex')
      acc.hash = hashPass(pass, acc.salt)
      persist()
      return json(res, 200, { ok: true }), true
    }
    if (url === '/api/admin/ban' && req.method === 'POST') {
      const b = await readBody(req)
      const acc = db.accounts[keyOf(String(b?.user ?? ''))]
      if (!acc) return json(res, 404, { err: 'no such account' }), true
      acc.banned = !!b?.banned
      persist()
      return json(res, 200, { ok: true, banned: acc.banned }), true
    }
    if (url === '/api/admin/registrations' && req.method === 'POST') {
      const b = await readBody(req)
      db.registrationsOpen = !!b?.open
      persist()
      return json(res, 200, { registrationsOpen: db.registrationsOpen }), true
    }
    if (url === '/api/admin/export' && req.method === 'GET') {
      return json(res, 200, db), true
    }
    if (url === '/api/admin/import' && req.method === 'POST') {
      const b = await readBody(req)
      if (!b || typeof b.accounts !== 'object') return json(res, 400, { err: 'bad import payload' }), true
      db = { registrationsOpen: b.registrationsOpen !== false, accounts: b.accounts, dailyScores: b.dailyScores ?? {} }
      persist()
      return json(res, 200, { ok: true, count: Object.keys(db.accounts).length }), true
    }
  }
  return json(res, 404, { err: 'unknown api route' }), true
}
