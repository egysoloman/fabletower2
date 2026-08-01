/**
 * Optional account + cloud saves. Guest mode is the default — nothing here
 * runs unless the player logs in. The cloud blob is a snapshot of the local
 * meta-progression keys; merging unions codex/achievements and keeps the
 * higher ascension so two devices never lose progress.
 */
import { signal } from '@preact/signals'

const META_KEYS = ['ns-history', 'ns-ach', 'ns-codex', 'ns-pal', 'ns-ascmax', 'ns-settings'] as const

interface AccountSession {
  name: string
  token: string
}

export const account = signal<AccountSession | null>(loadSession())
/** Server-authorized, memory-only permission. Never trust a persisted flag. */
export const cheatsEnabled = signal(false)
export const syncMsg = signal('')

function loadSession(): AccountSession | null {
  try {
    const saved = JSON.parse(localStorage.getItem('ns-account') ?? 'null')
    if (typeof saved?.name !== 'string' || typeof saved?.token !== 'string') return null
    return { name: saved.name, token: saved.token }
  } catch {
    return null
  }
}

function saveSession(v: AccountSession | null) {
  account.value = v
  cheatsEnabled.value = false
  try {
    if (v) localStorage.setItem('ns-account', JSON.stringify(v))
    else localStorage.removeItem('ns-account')
  } catch {
    /* best-effort */
  }
}

/** Cloud server override (Settings ▸ Account). Blank = the hosting site. */
export const cloudUrl = signal(loadCloudUrl())

function loadCloudUrl() {
  try {
    return localStorage.getItem('ns-cloud-url') ?? ''
  } catch {
    return ''
  }
}

export function setCloudUrl(v: string) {
  let clean = v.trim().replace(/\/+$/, '')
  if (clean && !/^https?:\/\//.test(clean)) clean = 'https://' + clean
  cloudUrl.value = clean
  try {
    if (clean) localStorage.setItem('ns-cloud-url', clean)
    else localStorage.removeItem('ns-cloud-url')
  } catch {
    /* best-effort */
  }
}

export function apiBase(): string {
  if (cloudUrl.value) return cloudUrl.value
  const loc = window.location
  if (loc.port === '5173' || loc.port === '4173') return `http://${loc.hostname}:8787`
  return ''
}

async function api(path: string, method = 'GET', body?: unknown, token?: string) {
  const res = await fetch(apiBase() + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data.err ?? `http ${res.status}`, res.status)
  return data
}

class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

function acceptAuthenticatedSession(name: string, token: string, canCheat: unknown) {
  saveSession({ name, token })
  cheatsEnabled.value = canCheat === true
}

function collectBlob(): string {
  const out: Record<string, string> = {}
  for (const k of META_KEYS) {
    const v = localStorage.getItem(k)
    if (v !== null) out[k] = v
  }
  return JSON.stringify({ savedAt: Date.now(), keys: out })
}

function mergeBlob(blob: string) {
  try {
    const remote = JSON.parse(blob)?.keys ?? {}
    // union-merge dictionaries; max for ascension; remote fills local gaps
    for (const k of ['ns-ach', 'ns-codex', 'ns-pal']) {
      const r = JSON.parse(remote[k] ?? '{}')
      const l = JSON.parse(localStorage.getItem(k) ?? '{}')
      const merged = k === 'ns-codex' ? mergeCodex(l, r) : { ...r, ...l }
      localStorage.setItem(k, JSON.stringify(merged))
    }
    const asc = Math.max(Number(localStorage.getItem('ns-ascmax') ?? 0), Number(remote['ns-ascmax'] ?? 0))
    if (asc > 0) localStorage.setItem('ns-ascmax', String(asc))
    // Run history is a bounded union, so switching devices does not silently
    // discard telemetry from either side.
    try {
      const localHistory = JSON.parse(localStorage.getItem('ns-history') ?? '[]')
      const remoteHistory = JSON.parse(remote['ns-history'] ?? '[]')
      const merged = [...localHistory, ...remoteHistory]
        .filter((r: any) => Number.isFinite(r?.d) && Number.isFinite(r?.seed))
        .filter((r: any, i: number, all: any[]) => all.findIndex((x) => x.d === r.d && x.seed === r.seed) === i)
        .sort((a: any, b: any) => b.d - a.d)
        .slice(0, 100)
      if (merged.length) localStorage.setItem('ns-history', JSON.stringify(merged))
    } catch { /* malformed remote history is ignored */ }
    if (!localStorage.getItem('ns-settings') && remote['ns-settings']) localStorage.setItem('ns-settings', remote['ns-settings'])
  } catch {
    /* a bad blob never breaks local state */
  }
}

function mergeCodex(a: any, b: any) {
  const out: any = {}
  for (const sect of ['cards', 'relics', 'enemies', 'potions', 'events']) out[sect] = { ...(b?.[sect] ?? {}), ...(a?.[sect] ?? {}) }
  return out
}

export async function register(user: string, pass: string) {
  const r = await api('/api/register', 'POST', { user, pass })
  acceptAuthenticatedSession(r.name, r.token, r.cheatsEnabled)
  await syncUp()
}

export async function login(user: string, pass: string) {
  const r = await api('/api/login', 'POST', { user, pass })
  acceptAuthenticatedSession(r.name, r.token, r.cheatsEnabled)
  await syncDown()
  await syncUp()
}

/** Validate a restored token and refresh server-controlled account permissions. */
export async function validateSession(): Promise<boolean> {
  const saved = account.value
  if (!saved) {
    cheatsEnabled.value = false
    return false
  }
  try {
    const r = await api('/api/session', 'GET', undefined, saved.token)
    // Ignore a late response if the player logged out or switched accounts.
    if (account.value?.token !== saved.token) return false
    acceptAuthenticatedSession(r.name, saved.token, r.cheatsEnabled)
    return true
  } catch (e) {
    cheatsEnabled.value = false
    if (e instanceof ApiError && (e.status === 401 || e.status === 403) && account.value?.token === saved.token) {
      saveSession(null)
      syncMsg.value = ''
    }
    return false
  }
}

export function logout() {
  const token = account.value?.token
  if (token) void api('/api/session', 'DELETE', undefined, token).catch(() => undefined)
  saveSession(null)
  syncMsg.value = ''
}

export async function syncUp() {
  const a = account.value
  if (!a) return
  try {
    await api('/api/sync', 'PUT', { blob: collectBlob() }, a.token)
    syncMsg.value = 'synced ✓'
  } catch (e) {
    syncMsg.value = String((e as Error).message)
  }
}

export async function syncDown() {
  const a = account.value
  if (!a) return
  try {
    const r = await api('/api/sync', 'GET', undefined, a.token)
    if (r.blob) mergeBlob(r.blob)
    syncMsg.value = 'synced ✓'
  } catch (e) {
    syncMsg.value = String((e as Error).message)
  }
}

/** Debounced push after meta changes (awards, run records). */
let pushTimer = 0
export function schedulePush() {
  if (!account.value) return
  clearTimeout(pushTimer)
  pushTimer = window.setTimeout(() => void syncUp(), 1500)
}

/** Submit a daily-run score (no-op in guest mode). */
export async function submitDailyScore(score: number, seed: number, char: string) {
  const a = account.value
  if (!a) return
  try {
    await api('/api/daily/score', 'POST', { score, seed, char }, a.token)
  } catch {
    /* leaderboard is best-effort */
  }
}

export interface GlobalBoard {
  date: string
  top: { rank: number; name: string; score: number; char: string }[]
  you: number | null
}

export async function fetchGlobalBoard(): Promise<GlobalBoard | null> {
  try {
    return await api('/api/daily/leaderboard', 'GET', undefined, account.value?.token)
  } catch {
    return null
  }
}

// --- Optional game entry gate (GAME_ENTRY_PASSWORD server-side) -------------

/** 'checking' -> 'open' | 'locked'. Static/offline hosting always opens. */
export const gate = signal<'checking' | 'open' | 'locked'>('checking')

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function checkGate() {
  try {
    const r = await api('/api/gate')
    if (!r.required) {
      gate.value = 'open'
      return
    }
    const stored = localStorage.getItem('ns-gate') ?? ''
    if (stored) {
      try {
        await api('/api/gate', 'POST', { hash: stored })
        gate.value = 'open'
        return
      } catch {
        localStorage.removeItem('ns-gate')
      }
    }
    gate.value = 'locked'
  } catch {
    // no server (static hosting / offline solo) — the gate cannot apply
    gate.value = 'open'
  }
}

export async function tryGate(pass: string): Promise<boolean> {
  try {
    await api('/api/gate', 'POST', { pass })
    localStorage.setItem('ns-gate', await sha256(pass))
    gate.value = 'open'
    return true
  } catch {
    return false
  }
}
