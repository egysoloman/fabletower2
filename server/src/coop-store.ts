/**
 * Durable co-op room snapshots.
 *
 * The multiplayer server keeps hot rooms in memory, but every accepted room
 * mutation is mirrored here.  A small atomic JSON store fits the project's
 * current single-process deployment and survives restarts/redeploys when the
 * data directory is mounted.  NS_COOP_DATA_FILE can point at that volume.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export interface StoredCoopSnapshot {
  id: string
  updatedAt: number
  expiresAt: number
  data: unknown
}

const DATA_FILE = process.env.NS_COOP_DATA_FILE ?? join(process.cwd(), 'data', 'coop-rooms.json')

let snapshots = new Map<string, StoredCoopSnapshot>()
try {
  const raw = JSON.parse(readFileSync(DATA_FILE, 'utf8'))
  if (Array.isArray(raw?.rooms)) {
    snapshots = new Map(
      raw.rooms
        .filter((entry: StoredCoopSnapshot) => entry?.id && entry.expiresAt > Date.now())
        .map((entry: StoredCoopSnapshot) => [entry.id, entry]),
    )
  }
} catch {
  /* fresh store */
}

let saveTimer: NodeJS.Timeout | null = null

function flush() {
  saveTimer = null
  try {
    mkdirSync(dirname(DATA_FILE), { recursive: true })
    const tmp = `${DATA_FILE}.tmp`
    writeFileSync(tmp, JSON.stringify({ version: 1, rooms: [...snapshots.values()] }))
    renameSync(tmp, DATA_FILE)
  } catch (e) {
    console.error('co-op room store write failed:', e)
  }
}

function scheduleFlush() {
  if (saveTimer) return
  saveTimer = setTimeout(flush, 100)
}

export function loadCoopSnapshots(): StoredCoopSnapshot[] {
  return [...snapshots.values()]
}

export function saveCoopSnapshot(snapshot: StoredCoopSnapshot) {
  snapshots.set(snapshot.id, snapshot)
  scheduleFlush()
}

export function deleteCoopSnapshot(id: string) {
  if (!snapshots.delete(id)) return
  scheduleFlush()
}

/** Test/shutdown hook: make the latest mutation durable immediately. */
export function flushCoopSnapshots() {
  if (saveTimer) clearTimeout(saveTimer)
  flush()
}
