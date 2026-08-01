import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

test('cheats default off, require an admin grant, and sessions can be validated', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'neonspire-accounts-'))
  process.env.NS_DATA_FILE = join(dir, 'accounts.json')
  process.env.NS_ADMIN_KEY = 'test-admin-key'
  const { handleApi } = await import(`../src/accounts.ts?test=${Date.now()}`)
  const server = createServer((req, res) => void handleApi(req, res))
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  const base = `http://127.0.0.1:${address.port}`

  const request = async (path: string, init: RequestInit = {}) => {
    const response = await fetch(base + path, {
      ...init,
      headers: { 'content-type': 'application/json', ...init.headers },
    })
    return { status: response.status, body: await response.json() as any }
  }

  try {
    const registered = await request('/api/register', {
      method: 'POST', body: JSON.stringify({ user: 'runner', pass: 'secret1' }),
    })
    assert.equal(registered.status, 200)
    assert.equal(registered.body.cheatsEnabled, false)
    const auth = { authorization: `Bearer ${registered.body.token}` }

    const initialSession = await request('/api/session', { headers: auth })
    assert.equal(initialSession.status, 200)
    assert.equal(initialSession.body.cheatsEnabled, false)

    const granted = await request('/api/admin/cheats', {
      method: 'POST',
      headers: { 'x-admin-key': 'test-admin-key' },
      body: JSON.stringify({ user: 'runner', enabled: true }),
    })
    assert.equal(granted.status, 200)
    assert.equal(granted.body.cheatsEnabled, true)

    const updatedSession = await request('/api/session', { headers: auth })
    assert.equal(updatedSession.body.cheatsEnabled, true)

    const history = [
      { d: Date.now(), seed: 11, asc: 0, act: 2, floor: 12, win: false, sc: 220, ch: 'runner', arch: 'runner-tempo', deck: 16, up: 3, relics: 2 },
      { d: Date.now() - 1000, seed: 12, asc: 1, act: 3, floor: 24, win: true, sc: 620, ch: 'vector', arch: 'vector-vent', deck: 18, up: 5, relics: 4 },
    ]
    const cloudBlob = JSON.stringify({ savedAt: Date.now(), keys: { 'ns-history': JSON.stringify(history) } })
    assert.equal((await request('/api/sync', {
      method: 'PUT', headers: auth, body: JSON.stringify({ blob: cloudBlob }),
    })).status, 200)
    const balance = await request('/api/admin/balance', { headers: { 'x-admin-key': 'test-admin-key' } })
    assert.equal(balance.status, 200)
    assert.equal(balance.body.runs, 2)
    assert.equal(balance.body.winRate, 50)
    assert.equal(balance.body.accountsWithHistory, 1)
    assert.deepEqual(balance.body.byChar.map((r: any) => [r.id, r.runs]), [['runner', 1], ['vector', 1]])
    assert.equal(balance.body.byArchetype[0].runs, 1)

    await request('/api/admin/reset', {
      method: 'POST',
      headers: { 'x-admin-key': 'test-admin-key' },
      body: JSON.stringify({ user: 'runner', pass: 'secret2' }),
    })
    assert.equal((await request('/api/session', { headers: auth })).status, 401)
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()))
    await new Promise((resolve) => setTimeout(resolve, 300))
    rmSync(dir, { recursive: true, force: true })
  }
})
