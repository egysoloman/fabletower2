import { MAP_COLS, MAP_ROWS, allNodes, availableNodeIds, type MapNode, type NodeType } from '@neonspire/engine'
import { TopBar } from '../components'
import { clickNode } from '../game'
import { run } from '../store'
import { t, tf } from '../i18n'

const ICONS: Record<NodeType, string> = {
  combat: '⚔',
  elite: '☠',
  rest: '♨',
  shop: '¤',
  treasure: '◆',
  event: '?',
  boss: '👁',
}

function nodeName(type: NodeType): string {
  switch (type) {
    case 'combat': return t('nodeCombat')
    case 'elite': return t('nodeElite')
    case 'rest': return t('nodeRest')
    case 'shop': return t('nodeShop')
    case 'treasure': return t('nodeTreasure')
    case 'event': return t('nodeEvent')
    case 'boss': return t('nodeBoss')
  }
}

/** Deterministic per-node x jitter so the map looks hand-drawn. */
function jitter(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return ((h >>> 3) % 15) - 7
}

export function MapScreen() {
  const r = run.value
  if (!r) return null
  const open = new Set(availableNodeIds(r))
  const done = new Set(r.path)
  const nodes = allNodes(r.map)

  const W = 640
  const rowH = 76
  const pad = 42
  const H = pad * 2 + (MAP_ROWS - 1) * rowH
  const colW = (W - pad * 2) / (MAP_COLS - 1)
  const cx = (n: MapNode) => pad + n.col * colW + (n.type === 'boss' ? 0 : jitter(n.id))
  const cy = (n: MapNode) => H - pad - n.row * rowH

  const byId = new Map(nodes.map((n) => [n.id, n]))

  return (
    <div class="screen">
      <TopBar showAbandon />
      <div class="act-title">{tf('actTitle', { act: r.act })}</div>
      <div class="map-wrap">
        <svg class="mapsvg" viewBox={`0 0 ${W} ${H}`}>
          {nodes.flatMap((n) =>
            n.next.map((id) => {
              const m = byId.get(id)
              if (!m) return null
              const lit = (n.id === r.pos && open.has(id)) || (done.has(n.id) && done.has(id))
              return (
                <path
                  key={n.id + id}
                  class={`map-edge ${lit ? 'lit' : ''}`}
                  d={`M ${cx(n)} ${cy(n)} C ${cx(n)} ${cy(n) - rowH / 2}, ${cx(m)} ${cy(m) + rowH / 2}, ${cx(m)} ${cy(m)}`}
                />
              )
            }),
          )}
          {nodes.map((n) => {
            const cls = [
              'map-node',
              n.type === 'boss' ? 'boss' : '',
              n.id === r.pos ? 'current' : done.has(n.id) ? 'done' : open.has(n.id) ? 'open' : '',
            ].join(' ')
            const rad = n.type === 'boss' ? 26 : 16
            return (
              <g key={n.id} class={cls} onClick={() => open.has(n.id) && clickNode(n.id)}>
                <title>{nodeName(n.type)}</title>
                <circle cx={cx(n)} cy={cy(n)} r={rad} />
                <text x={cx(n)} y={cy(n)} style={n.type === 'boss' ? 'font-size:22px' : ''}>
                  {ICONS[n.type]}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
