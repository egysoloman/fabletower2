import assert from 'node:assert/strict'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createServer } from 'node:net'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import { WebSocket } from 'ws'

const ROOT = resolve(import.meta.dirname, '../..')
const TSX = join(ROOT, 'node_modules/.bin/tsx')

async function freePort(): Promise<number> {
  return await new Promise((resolvePort, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close((error) => (error ? reject(error) : resolvePort(port)))
    })
  })
}

async function startServer(port: number, dataFile: string): Promise<ChildProcessWithoutNullStreams> {
  const child = spawn(TSX, ['server/src/index.ts'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), NS_COOP_DATA_FILE: dataFile },
    stdio: 'pipe',
  })
  await new Promise<void>((resolveStart, reject) => {
    const timer = setTimeout(() => reject(new Error('server start timed out')), 10_000)
    child.once('exit', (code) => reject(new Error(`server exited early (${code})`)))
    child.stderr.on('data', (chunk) => {
      const text = String(chunk)
      if (text.trim()) process.stderr.write(text)
    })
    child.stdout.on('data', (chunk) => {
      if (String(chunk).includes('server listening')) {
        clearTimeout(timer)
        resolveStart()
      }
    })
  })
  return child
}

async function stopServer(child: ChildProcessWithoutNullStreams) {
  if (child.exitCode !== null) return
  child.kill('SIGTERM')
  await new Promise<void>((resolveExit) => child.once('exit', () => resolveExit()))
}

interface TestSocket {
  ws: WebSocket
  next: (type: string) => Promise<any>
}

async function connect(port: number): Promise<TestSocket> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`)
  const buffered: any[] = []
  const waiters = new Map<string, ((msg: any) => void)[]>()
  ws.on('message', (raw) => {
    const msg = JSON.parse(String(raw))
    const waiter = waiters.get(msg.t)?.shift()
    if (waiter) waiter(msg)
    else buffered.push(msg)
  })
  await new Promise<void>((resolveOpen, reject) => {
    ws.once('open', resolveOpen)
    ws.once('error', reject)
  })
  return {
    ws,
    next(type) {
      const at = buffered.findIndex((m) => m.t === type)
      if (at >= 0) return Promise.resolve(buffered.splice(at, 1)[0])
      return new Promise((resolveMsg, reject) => {
        const timer = setTimeout(() => reject(new Error(`timed out waiting for ${type}`)), 8_000)
        const list = waiters.get(type) ?? []
        list.push((msg) => {
          clearTimeout(timer)
          resolveMsg(msg)
        })
        waiters.set(type, list)
      })
    },
  }
}

test('a co-op room resumes for every client after a server restart', { timeout: 30_000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'neonspire-coop-restart-'))
  const dataFile = join(dir, 'coop.json')
  const port = await freePort()
  let server = await startServer(port, dataFile)
  let a: TestSocket | null = null
  let b: TestSocket | null = null
  try {
    a = await connect(port)
    b = await connect(port)
    a.ws.send(JSON.stringify({ t: 'coopqueue', name: 'alpha', char: 'runner', size: 2, modsKey: 'vanilla' }))
    b.ws.send(JSON.stringify({ t: 'coopqueue', name: 'beta', char: 'vector', size: 2, modsKey: 'vanilla' }))
    await Promise.all([a.next('coopform'), b.next('coopform')])
    a.ws.send(JSON.stringify({ t: 'coopready' }))
    b.ws.send(JSON.stringify({ t: 'coopready' }))
    const [startA, startB] = await Promise.all([a.next('coopstart'), b.next('coopstart')])
    assert.equal(startA.rev, 1)
    assert.equal(startB.rev, 1)
    assert.ok(startA.token)
    assert.ok(startB.token)
    const target = startA.map.rows[0][0].id
    a.ws.send(JSON.stringify({ t: 'cooppick', id: target }))
    const [travelA, travelB] = await Promise.all([a.next('cooptravel'), b.next('cooptravel')])
    assert.equal(travelA.id, target)
    assert.equal(travelB.id, target)

    a.ws.close()
    b.ws.close()
    await stopServer(server)

    server = await startServer(port, dataFile)
    await new Promise((resolveWait) => setTimeout(resolveWait, 100))
    const resumedA = await connect(port)
    const resumedB = await connect(port)
    resumedA.ws.send(JSON.stringify({ t: 'resume', token: startA.token }))
    resumedB.ws.send(JSON.stringify({ t: 'resume', token: startB.token }))
    const [rejoinA, rejoinB] = await Promise.all([resumedA.next('coopstart'), resumedB.next('coopstart')])
    assert.equal(rejoinA.rejoin, true)
    assert.equal(rejoinB.rejoin, true)
    assert.ok(rejoinA.rev >= 2)
    assert.equal(rejoinA.rev, rejoinB.rev)
    assert.equal(rejoinA.pos, target)
    assert.equal(rejoinB.pos, target)
    assert.ok(rejoinA.path.includes(target))
    assert.deepEqual(rejoinA.path, rejoinB.path)
    resumedA.ws.close()
    resumedB.ws.close()
  } finally {
    a?.ws.close()
    b?.ws.close()
    await stopServer(server)
    rmSync(dir, { recursive: true, force: true })
  }
})

test('checkpoint duels award points and keep both racers for the next act', { timeout: 30_000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'neonspire-climb-score-'))
  const port = await freePort()
  const server = await startServer(port, join(dir, 'coop.json'))
  const a = await connect(port)
  const b = await connect(port)
  try {
    a.ws.send(JSON.stringify({ t: 'queue', name: 'alpha', char: 'runner', mode: 'climb', modsKey: 'vanilla' }))
    b.ws.send(JSON.stringify({ t: 'queue', name: 'beta', char: 'vector', mode: 'climb', modsKey: 'vanilla' }))
    const [startA, startB] = await Promise.all([a.next('climbstart'), b.next('climbstart')])
    assert.deepEqual(startA.score, [0, 0])
    assert.deepEqual(startB.score, [0, 0])

    a.ws.send(JSON.stringify({ t: 'progress', act: 1, floor: 2, hp: 61, pos: 'test-node' }))
    const relayed = await b.next('opp')
    assert.equal(relayed.pos, 'test-node')

    const deck = Array.from({ length: 5 }, () => ({ id: 'killswitch', up: false }))
    for (let act = 1; act <= 3; act++) {
      a.ws.send(JSON.stringify({ t: 'bosskill', act, deck, maxHp: 1 }))
      b.ws.send(JSON.stringify({ t: 'bosskill', act, deck, maxHp: 1 }))
      await Promise.all([a.next('checkpoint'), b.next('checkpoint')])
      const [duelA, duelB] = await Promise.all([a.next('duelstart'), b.next('duelstart')])
      assert.deepEqual(duelA.score, [act - 1, 0])
      assert.deepEqual(duelB.score, [act - 1, 0])
      const actor = duelA.view.active === duelA.you ? a : b
      const actorView = duelA.view.active === duelA.you ? duelA.view : duelB.view
      const hand = actorView.sides[actorView.you].hand
      const handIndex = hand.findIndex((card: { id: string }) => card.id === 'killswitch')
      assert.ok(handIndex >= 0)
      actor.ws.send(JSON.stringify({ t: 'action', action: { t: 'play', hand: handIndex } }))
      const resultType = act === 3 ? 'climbfinal' : 'climbround'
      const [stateA, stateB, resultA, resultB] = await Promise.all([
        a.next('st'),
        b.next('st'),
        a.next(resultType),
        b.next(resultType),
      ])
      assert.ok(stateA.view.over)
      assert.ok(stateB.view.over)
      assert.deepEqual(resultA.score, [act, 0])
      assert.deepEqual(resultB.score, [act, 0])
      assert.equal(resultA.roundWinner, 0)
      assert.equal(resultB.roundWinner, 0)
    }
  } finally {
    a.ws.close()
    b.ws.close()
    await stopServer(server)
    rmSync(dir, { recursive: true, force: true })
  }
})
