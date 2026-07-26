/**
 * Optional account + cloud saves. Guest mode is the default — nothing here
 * runs unless the player logs in. The cloud blob is a snapshot of the local
 * meta-progression keys; merging unions codex/achievements and keeps the
 * higher ascension so two devices never lose progress.
 */
import { signal } from '@preact/signals'

const META_KEYS = ['ns-history', 'ns-ach', 'ns-codex', 'ns-pal', 'ns-ascmax', 'ns-settings'] as const

export const account = signal<{ name: string; token: string } | null>(loadSession())
export const syncMsg = signal('')

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem('ns-account') ?? 'null')
  } catch {
    return null
  }
}

function saveSession(v: { name: string; token: string } | null) {
  account.value = v
  try {
    if (v) localStorage.setItem('ns-account', JSON.stringify(v))
    else localStorage.removeItem('ns-account')
  } catch {
    /* best-effort */
  }
}

export function apiBase(): string {
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
  if (!res.ok) throw new Error(data.err ?? `http ${res.status}`)
  return data
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
    for (const k of ['ns-history', 'ns-settings']) {
      if (!localStorage.getItem(k) && remote[k]) localStorage.setItem(k, remote[k])
    }
  } catch {
    /* a bad blob never breaks local state */
  }
}

function mergeCodex(a: any, b: any) {
  const out: any = {}
  for (const sect of ['cards', 'relics', 'enemies']) out[sect] = { ...(b?.[sect] ?? {}), ...(a?.[sect] ?? {}) }
  return out
}

export async function register(user: string, pass: string) {
  const r = await api('/api/register', 'POST', { user, pass })
  saveSession({ name: r.name, token: r.token })
  await syncUp()
}

export async function login(user: string, pass: string) {
  const r = await api('/api/login', 'POST', { user, pass })
  saveSession({ name: r.name, token: r.token })
  await syncDown()
  await syncUp()
}

export function logout() {
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
