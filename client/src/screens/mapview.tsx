/**
 * Shared act-map renderer: the neon node graph used by the solo map screen
 * and the co-op party map. Pure presentation — callers supply position,
 * traversed path, clickable nodes and colors; co-op adds vote dots.
 */
import { MAP_COLS, allNodes, type ActMap, type MapNode, type NodeType } from '@neonspire/engine'
import { t } from '../i18n'

export const MAP_ICONS: Record<NodeType, string> = {
  combat: '⚔',
  elite: '☠',
  rest: '♨',
  shop: '¤',
  treasure: '◆',
  event: '?',
  boss: '◉',
}

export function nodeName(type: NodeType): string {
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

/** SVG user-unit geometry for an act map (shared by renderer and callers). */
export function mapGeometry(map: ActMap) {
  const W = 640
  const rowH = 76
  const pad = 42
  const H = pad * 2 + (map.rows.length - 1) * rowH
  const colW = (W - pad * 2) / (MAP_COLS - 1)
  const cx = (n: MapNode) => pad + n.col * colW + (n.type === 'boss' ? 0 : jitter(n.id))
  const cy = (n: MapNode) => H - pad - n.row * rowH
  return { W, H, rowH, cx, cy }
}

export interface MapTravel {
  fx: number
  fy: number
  tx: number
  ty: number
  go: boolean
}

export function MapView(props: {
  map: ActMap
  pos: string | null
  /** Visited node ids (lit + pulsing path). */
  path: string[]
  /** Clickable node ids. */
  open: Set<string>
  onNode?: (n: MapNode) => void
  /** Primary glow color (character / leader color). */
  pc: string
  /** Diffusion ring colors around the current node (defaults to [pc, pc]). */
  ringColors?: string[]
  /** Advisory votes: node id -> voter colors (co-op). */
  votes?: Record<string, string[]>
  travel?: MapTravel | null
  /** Co-op travel renders one glowing party mote per member. */
  travelColors?: string[]
  svgRef?: (el: SVGSVGElement | null) => void
}) {
  const { map, pos, open } = props
  const { W, H, rowH, cx, cy } = mapGeometry(map)
  const nodes = allNodes(map)
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const done = new Set(props.path)
  const rings = props.ringColors && props.ringColors.length > 0 ? props.ringColors : [props.pc, props.pc]
  const cur = pos ? byId.get(pos) : null

  return (
    <svg class="mapsvg" viewBox={`0 0 ${W} ${H}`} ref={props.svgRef} style={{ '--pc': props.pc } as never}>
      {nodes.flatMap((n) =>
        n.next.map((id) => {
          const m = byId.get(id)
          if (!m) return null
          const lit = (n.id === pos && open.has(id)) || (done.has(n.id) && done.has(id))
          const walked = done.has(n.id) && done.has(id)
          const d = `M ${cx(n)} ${cy(n)} C ${cx(n)} ${cy(n) - rowH / 2}, ${cx(m)} ${cy(m) + rowH / 2}, ${cx(m)} ${cy(m)}`
          return (
            <g key={n.id + id}>
              <path
                class={`map-edge ${lit ? 'lit' : ''}`}
                pathLength={1}
                style={{ '--row-delay': `${n.row * 70}ms` } as never}
                d={d}
              />
              {walked && (
                <path class="map-pulse" pathLength={1} style={{ '--pd': `${(n.row * 0.408).toFixed(2)}s` } as never} d={d} />
              )}
            </g>
          )
        }),
      )}
      {nodes.map((n) => {
        const cls = [
          'map-node',
          n.type === 'boss' ? 'boss' : '',
          n.id === pos ? 'current' : done.has(n.id) ? 'done' : open.has(n.id) ? 'open' : '',
        ].join(' ')
        const rad = n.type === 'boss' ? 26 : 16
        const voters = props.votes?.[n.id] ?? []
        return (
          <g key={n.id} class={cls} onClick={() => open.has(n.id) && props.onNode?.(n)}>
            <title>{nodeName(n.type)}</title>
            <circle cx={cx(n)} cy={cy(n)} r={rad} />
            <text x={cx(n)} y={cy(n)} style={n.type === 'boss' ? 'font-size:22px' : ''}>
              {MAP_ICONS[n.type]}
            </text>
            {voters.map((color, i) => (
              <circle
                key={i}
                class="votedot-svg"
                cx={cx(n) + (i - (voters.length - 1) / 2) * 11}
                cy={cy(n) + rad + 9}
                r={4}
                fill={color}
              />
            ))}
          </g>
        )
      })}
      {cur && !props.travel &&
        rings.map((col, k) => (
          <circle
            key={'ring' + k}
            class="cur-ring"
            cx={cx(cur)}
            cy={cy(cur)}
            r={cur.type === 'boss' ? 26 : 16}
            style={{ '--rc': col, '--rd': `${(k * (2.4 / rings.length)).toFixed(2)}s` } as never}
          />
        ))}
      {props.travel && props.travelColors && props.travelColors.length > 0 ? (
        <g
          class="travel-party"
          style={{
            transform: `translate(${props.travel.go ? props.travel.tx : props.travel.fx}px, ${props.travel.go ? props.travel.ty : props.travel.fy}px)`,
          }}
        >
          {props.travelColors.map((color, i) => {
            const angle = (Math.PI * 2 * i) / props.travelColors!.length - Math.PI / 2
            const radius = props.travelColors!.length > 1 ? 7 : 0
            return (
              <circle
                key={i}
                class="travel-party-dot"
                r={5}
                cx={Math.cos(angle) * radius}
                cy={Math.sin(angle) * radius}
                style={{ '--tc': color } as never}
              />
            )
          })}
        </g>
      ) : props.travel ? (
        <circle
          class="travel-dot"
          r={7}
          cx={0}
          cy={0}
          style={{
            transform: `translate(${props.travel.go ? props.travel.tx : props.travel.fx}px, ${props.travel.go ? props.travel.ty : props.travel.fy}px)`,
          }}
        />
      ) : null}
    </svg>
  )
}
