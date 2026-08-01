import { Pool, type PoolClient } from 'pg'

export type PersistenceBackend = 'file' | 'postgres'

function readBackend(): PersistenceBackend {
  const value = (process.env.PERSISTENCE_BACKEND ?? 'file').trim().toLowerCase()
  if (value === 'file' || value === 'postgres') return value
  throw new Error('PERSISTENCE_BACKEND must be either "file" or "postgres"')
}

function positiveInteger(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`)
  return value
}

export const persistenceBackend = readBackend()

let pool: Pool | null = null
let initialization: Promise<void> | null = null

function databaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim()
  if (!value) throw new Error('DATABASE_URL is required when PERSISTENCE_BACKEND=postgres')
  return value
}

function newPool(connectionString: string, max: number): Pool {
  return new Pool({
    connectionString,
    max,
    min: 0,
    idleTimeoutMillis: positiveInteger('DB_IDLE_CLOSE_MS', 60_000),
    connectionTimeoutMillis: positiveInteger('DB_CONNECTION_TIMEOUT_MS', 20_000),
    allowExitOnIdle: true,
  })
}

function runtimePool(): Pool {
  if (persistenceBackend !== 'postgres') throw new Error('PostgreSQL persistence is not enabled')
  if (!pool) pool = newPool(databaseUrl(), positiveInteger('DB_POOL_MAX', 3))
  return pool
}

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS neonspire_state (
    state_key text PRIMARY KEY,
    payload jsonb NOT NULL,
    updated_at bigint NOT NULL
  );
  CREATE TABLE IF NOT EXISTS neonspire_coop_rooms (
    id text PRIMARY KEY,
    updated_at bigint NOT NULL,
    expires_at bigint NOT NULL,
    snapshot jsonb NOT NULL
  );
  CREATE INDEX IF NOT EXISTS neonspire_coop_rooms_expires_at_idx
    ON neonspire_coop_rooms (expires_at);
`

/** Validate the connection and create the small compatibility schema. */
export async function initializePostgres(): Promise<void> {
  if (persistenceBackend !== 'postgres') return
  if (initialization) return initialization
  initialization = (async () => {
    const main = runtimePool()
    const directUrl = process.env.DATABASE_DIRECT_URL?.trim()
    const migrations = directUrl && directUrl !== databaseUrl() ? newPool(directUrl, 1) : main
    try {
      await migrations.query(SCHEMA_SQL)
      if (migrations !== main) await main.query('SELECT 1')
    } finally {
      if (migrations !== main) await migrations.end()
    }
  })()
  try {
    await initialization
  } catch (error) {
    initialization = null
    throw error
  }
}

export async function loadState<T>(key: string): Promise<T | null> {
  const result = await runtimePool().query<{ payload: T }>(
    'SELECT payload FROM neonspire_state WHERE state_key = $1',
    [key],
  )
  return result.rows[0]?.payload ?? null
}

export async function saveState(key: string, payload: unknown): Promise<void> {
  await runtimePool().query(
    `INSERT INTO neonspire_state (state_key, payload, updated_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (state_key) DO UPDATE
       SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at`,
    [key, payload, Date.now()],
  )
}

export async function deleteState(key: string): Promise<void> {
  await runtimePool().query('DELETE FROM neonspire_state WHERE state_key = $1', [key])
}

export interface PostgresCoopSnapshot {
  id: string
  updatedAt: number
  expiresAt: number
  data: unknown
}

export async function loadCoopRooms(): Promise<PostgresCoopSnapshot[]> {
  const db = runtimePool()
  await db.query('DELETE FROM neonspire_coop_rooms WHERE expires_at <= $1', [Date.now()])
  const result = await db.query<{
    id: string
    updated_at: string
    expires_at: string
    snapshot: unknown
  }>('SELECT id, updated_at, expires_at, snapshot FROM neonspire_coop_rooms')
  return result.rows.map((row) => ({
    id: row.id,
    updatedAt: Number(row.updated_at),
    expiresAt: Number(row.expires_at),
    data: row.snapshot,
  }))
}

async function writeCoopChangesInTransaction(
  client: PoolClient,
  upserts: PostgresCoopSnapshot[],
  deletes: string[],
): Promise<void> {
  for (const id of deletes) {
    await client.query('DELETE FROM neonspire_coop_rooms WHERE id = $1', [id])
  }
  for (const room of upserts) {
    await client.query(
      `INSERT INTO neonspire_coop_rooms (id, updated_at, expires_at, snapshot)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET
         updated_at = EXCLUDED.updated_at,
         expires_at = EXCLUDED.expires_at,
         snapshot = EXCLUDED.snapshot`,
      [room.id, room.updatedAt, room.expiresAt, room.data],
    )
  }
}

export async function writeCoopChanges(
  upserts: PostgresCoopSnapshot[],
  deletes: string[],
): Promise<void> {
  if (!upserts.length && !deletes.length) return
  const client = await runtimePool().connect()
  try {
    await client.query('BEGIN')
    await writeCoopChangesInTransaction(client, upserts, deletes)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

export async function closePostgres(): Promise<void> {
  if (!pool) return
  const current = pool
  pool = null
  initialization = null
  await current.end()
}
