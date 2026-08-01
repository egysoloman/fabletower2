/**
 * Durable co-op room snapshots.
 *
 * File storage remains the zero-configuration default. PostgreSQL persistence
 * is opt-in for hosts (such as Render) without a durable local filesystem.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  initializePostgres,
  loadCoopRooms,
  persistenceBackend,
  writeCoopChanges,
} from './postgres-store'

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
const dirty = new Map<string, StoredCoopSnapshot>()
const deleted = new Set<string>()
let postgresWriteChain: Promise<void> = Promise.resolve()

function flushFile() {
  mkdirSync(dirname(DATA_FILE), { recursive: true })
  const tmp = `${DATA_FILE}.tmp`
  writeFileSync(tmp, JSON.stringify({ version: 1, rooms: [...snapshots.values()] }))
  renameSync(tmp, DATA_FILE)
}

function queuePostgresFlush(): Promise<void> {
  const upserts = [...dirty.values()]
  const deletes = [...deleted]
  dirty.clear()
  deleted.clear()
  const operation = postgresWriteChain.then(() => writeCoopChanges(upserts, deletes))
  postgresWriteChain = operation.catch((error) => {
    // Retry the latest desired value, not a stale captured value.
    for (const id of [...upserts.map((entry) => entry.id), ...deletes]) {
      const current = snapshots.get(id)
      if (current) {
        dirty.set(id, current)
        deleted.delete(id)
      } else {
        dirty.delete(id)
        deleted.add(id)
      }
    }
    console.error('co-op room store write failed:', error)
  })
  return operation
}

function scheduleFlush() {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    if (persistenceBackend === 'postgres') {
      void queuePostgresFlush().catch(() => undefined)
    } else {
      try {
        flushFile()
      } catch (error) {
        console.error('co-op room store write failed:', error)
      }
    }
  }, 100)
}

/** Load remote rooms (or seed an empty database from an existing local file). */
export async function initializeCoopStore(): Promise<void> {
  if (persistenceBackend === 'file') return
  await initializePostgres()
  const stored = await loadCoopRooms()
  if (stored.length) {
    snapshots = new Map(stored.map((entry) => [entry.id, entry]))
  } else if (snapshots.size) {
    await writeCoopChanges([...snapshots.values()], [])
  }
  dirty.clear()
  deleted.clear()
}

export function loadCoopSnapshots(): StoredCoopSnapshot[] {
  return [...snapshots.values()]
}

export function saveCoopSnapshot(snapshot: StoredCoopSnapshot) {
  snapshots.set(snapshot.id, snapshot)
  if (persistenceBackend === 'postgres') {
    dirty.set(snapshot.id, snapshot)
    deleted.delete(snapshot.id)
  }
  scheduleFlush()
}

export function deleteCoopSnapshot(id: string) {
  if (!snapshots.delete(id)) return
  if (persistenceBackend === 'postgres') {
    dirty.delete(id)
    deleted.add(id)
  }
  scheduleFlush()
}

/** Test/shutdown hook: make the latest mutation durable immediately. */
export async function flushCoopSnapshots(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (persistenceBackend === 'file') {
    flushFile()
    return
  }
  await postgresWriteChain
  while (dirty.size || deleted.size) await queuePostgresFlush()
}
