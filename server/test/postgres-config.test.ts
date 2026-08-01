import assert from 'node:assert/strict'
import test from 'node:test'

test('explicit PostgreSQL mode refuses to start without DATABASE_URL', async () => {
  const previousBackend = process.env.PERSISTENCE_BACKEND
  const previousUrl = process.env.DATABASE_URL
  process.env.PERSISTENCE_BACKEND = 'postgres'
  delete process.env.DATABASE_URL
  try {
    const store = await import(`../src/postgres-store.ts?missing-url=${Date.now()}`)
    await assert.rejects(
      store.initializePostgres(),
      /DATABASE_URL is required when PERSISTENCE_BACKEND=postgres/,
    )
  } finally {
    if (previousBackend === undefined) delete process.env.PERSISTENCE_BACKEND
    else process.env.PERSISTENCE_BACKEND = previousBackend
    if (previousUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = previousUrl
  }
})
