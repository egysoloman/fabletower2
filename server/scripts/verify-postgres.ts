import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import {
  closePostgres,
  deleteState,
  initializePostgres,
  loadCoopRooms,
  loadState,
  persistenceBackend,
  saveState,
  writeCoopChanges,
} from '../src/postgres-store'

if (persistenceBackend !== 'postgres') {
  throw new Error('Set PERSISTENCE_BACKEND=postgres and DATABASE_URL before running this check')
}

const suffix = randomUUID()
const stateKey = `integration-check-${suffix}`
const roomId = `integration-check-${suffix}`
const payload = { check: suffix, at: Date.now() }

try {
  await initializePostgres()
  await saveState(stateKey, payload)
  assert.deepEqual(await loadState(stateKey), payload)

  await writeCoopChanges([{
    id: roomId,
    updatedAt: Date.now(),
    expiresAt: Date.now() + 60_000,
    data: payload,
  }], [])
  const room = (await loadCoopRooms()).find((entry) => entry.id === roomId)
  assert.deepEqual(room?.data, payload)

  await writeCoopChanges([], [roomId])
  await deleteState(stateKey)
  assert.equal((await loadCoopRooms()).some((entry) => entry.id === roomId), false)
  assert.equal(await loadState(stateKey), null)
  console.log('PostgreSQL persistence check passed; temporary records were removed.')
} finally {
  await writeCoopChanges([], [roomId]).catch(() => undefined)
  await deleteState(stateKey).catch(() => undefined)
  await closePostgres()
}
