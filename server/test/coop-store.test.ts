import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

test('co-op snapshots survive an atomic flush and can be deleted', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'neonspire-coop-'))
  const file = join(dir, 'rooms.json')
  process.env.NS_COOP_DATA_FILE = file
  const store = await import(`../src/coop-store.ts?test=${Date.now()}`)
  try {
    store.saveCoopSnapshot({
      id: 'room-1',
      updatedAt: 10,
      expiresAt: Date.now() + 60_000,
      data: { revision: 4, combat: { turn: 2 } },
    })
    store.flushCoopSnapshots()
    const saved = JSON.parse(readFileSync(file, 'utf8'))
    assert.equal(saved.version, 1)
    assert.equal(saved.rooms[0].id, 'room-1')
    assert.equal(saved.rooms[0].data.revision, 4)

    store.deleteCoopSnapshot('room-1')
    store.flushCoopSnapshots()
    assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')).rooms, [])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
