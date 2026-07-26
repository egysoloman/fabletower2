import { randInt, rand, pick, type Rng } from './rng'
import type { ActMap, MapNode, NodeType } from './types'

export const MAP_COLS = 5
/** Rows 0..6 are regular floors, row 7 is the act boss. */
export const MAP_ROWS = 8

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Slay-the-Spire style act map: several random walks from the bottom row up,
 * unioned into a DAG. Every node lies on at least one full path, so every
 * route reaches the boss.
 */
export function genActMap(act: number, rng: Rng): ActMap {
  if (act >= 4) return genRootMap(act)
  const nodes = new Map<string, MapNode>()
  const key = (row: number, col: number) => `a${act}r${row}c${col}`
  const ensure = (row: number, col: number): MapNode => {
    const id = key(row, col)
    let n = nodes.get(id)
    if (!n) {
      n = { id, row, col, type: 'combat', next: [] }
      nodes.set(id, n)
    }
    return n
  }

  const lastRow = MAP_ROWS - 2 // 6
  for (let w = 0; w < 4; w++) {
    let col = randInt(rng, 0, MAP_COLS - 1)
    ensure(0, col)
    for (let row = 0; row < lastRow; row++) {
      const nextCol = clamp(col + randInt(rng, -1, 1), 0, MAP_COLS - 1)
      const from = ensure(row, col)
      const to = ensure(row + 1, nextCol)
      if (!from.next.includes(to.id)) from.next.push(to.id)
      col = nextCol
    }
  }

  const boss = ensure(MAP_ROWS - 1, Math.floor(MAP_COLS / 2))
  boss.type = 'boss'
  for (const n of nodes.values()) {
    if (n.row === lastRow && !n.next.includes(boss.id)) n.next.push(boss.id)
  }

  // --- Assign node types ----------------------------------------------------
  const rows: MapNode[][] = Array.from({ length: MAP_ROWS }, () => [])
  for (const n of nodes.values()) rows[n.row].push(n)
  for (const r of rows) r.sort((a, b) => a.col - b.col)

  for (const n of nodes.values()) {
    if (n.row === 0) n.type = 'combat'
    else if (n.row === lastRow) n.type = 'rest'
    else if (n.type !== 'boss') n.type = rollType(n.row, rng)
  }
  // Guaranteed loot floor.
  if (rows[3].length > 0) pick(rng, rows[3]).type = 'treasure'
  // Guarantee a shop somewhere in the middle of the act.
  if (![...nodes.values()].some((n) => n.type === 'shop')) {
    const mid = [...nodes.values()].filter((n) => n.row >= 2 && n.row <= 5 && n.type === 'combat')
    if (mid.length > 0) pick(rng, mid).type = 'shop'
  }

  return { act, rows }
}

/**
 * Act 4 — THE ROOT. A fixed four-floor gauntlet, no branches: one last rest,
 * one last shop, the Warden pair, then the true finale.
 */
function genRootMap(act: number): ActMap {
  const col = Math.floor(MAP_COLS / 2)
  const key = (row: number) => `a${act}r${row}c${col}`
  const mk = (row: number, type: NodeType): MapNode => ({
    id: key(row),
    row,
    col,
    type,
    next: type === 'boss' ? [] : [key(row + 1)],
  })
  return { act, rows: [[mk(0, 'rest')], [mk(1, 'shop')], [mk(2, 'elite')], [mk(3, 'boss')]] }
}

function rollType(row: number, rng: Rng): NodeType {
  const r = rand(rng)
  if (r < 0.5) return 'combat'
  if (r < 0.68) return 'event'
  if (r < 0.8) return row >= 2 ? 'elite' : 'combat'
  if (r < 0.9) return 'shop'
  return row >= 3 ? 'rest' : 'combat'
}

export function nodeById(map: ActMap, id: string): MapNode | undefined {
  for (const row of map.rows) for (const n of row) if (n.id === id) return n
  return undefined
}

export function allNodes(map: ActMap): MapNode[] {
  return map.rows.flat()
}
