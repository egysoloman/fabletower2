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
  /** Stable animation epoch used to join rotating and travelling formations. */
  at?: number
  /** Optional formation radii when travelling between differently sized nodes. */
  fr?: number
  tr?: number
}

const PARTY_ORBIT_MS = 3_600
const PARTY_TRAVEL_MS = 620
const PARTY_TRAVEL_STAGGER_MS = 70
/** Matches the server's co-op travel window (up to four staggered motes). */
const PARTY_TRAVEL_WINDOW_MS = 900

function partyAngle(index: number, count: number, at: number): number {
  return (Math.PI * 2 * index) / count - Math.PI / 2 + ((at % PARTY_ORBIT_MS) / PARTY_ORBIT_MS) * Math.PI * 2
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
  /** Party members shown as colored motes at the current node (co-op). */
  markerColors?: string[]
  /** Advisory votes: node id -> voter colors (co-op). */
  votes?: Record<string, string[]>
  /** Rival's exact node in a climb race. */
  rival?: { pos: string; color: string; label: string }
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
  const rival = props.rival ? byId.get(props.rival.pos) : null
  const orbitAt = Date.now()

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
      {cur && !props.travel && props.markerColors && props.markerColors.length > 0 && (
        <g class="party-marker" transform={`translate(${cx(cur)} ${cy(cur)})`}>
          <g
            class="party-marker-orbit"
            style={{ animationDelay: `${-(orbitAt % PARTY_ORBIT_MS)}ms` }}
          >
            {props.markerColors.map((color, i) => {
              const angle = (Math.PI * 2 * i) / props.markerColors!.length - Math.PI / 2
              const radius = cur.type === 'boss' ? 33 : 23
              return (
                <circle
                  key={i}
                  class="party-marker-dot"
                  cx={Math.cos(angle) * radius}
                  cy={Math.sin(angle) * radius}
                  r={5}
                  style={{ '--tc': color, '--mote-delay': `${(-0.58 * i) / props.markerColors!.length}s` } as never}
                />
              )
            })}
          </g>
        </g>
      )}
      {rival && props.rival && (
        <g
          class="rival-marker"
          style={{
            '--rival-color': props.rival.color,
            // Keep the marker anchored to the exact authoritative node.
            // The old diagonal offset made synchronized maps look misaligned.
            transform: `translate(${cx(rival)}px, ${cy(rival)}px)`,
          } as never}
        >
          <title>{props.rival.label}</title>
          <circle class="rival-marker-ring" r={10} />
          <circle class="rival-marker-dot" r={6} />
        </g>
      )}
      {props.travel && props.travelColors && props.travelColors.length > 0 ? (
        <g class="travel-party">
          {props.travelColors.map((color, i) => {
            const count = props.travelColors!.length
            const startedAt = props.travel!.at ?? orbitAt
            const startRadius = props.travel!.fr ?? (cur?.type === 'boss' ? 33 : 23)
            const endRadius = props.travel!.tr ?? startRadius
            const startAngle = partyAngle(i, count, startedAt)
            const endAngle = partyAngle(i, count, startedAt + PARTY_TRAVEL_WINDOW_MS)
            const sx = props.travel!.fx + Math.cos(startAngle) * startRadius
            const sy = props.travel!.fy + Math.sin(startAngle) * startRadius
            const ex = props.travel!.tx + Math.cos(endAngle) * endRadius
            const ey = props.travel!.ty + Math.sin(endAngle) * endRadius
            // Relative motion path: each mote gathers into the same node,
            // follows the actual curved edge, then fans back into the orbit.
            const path = [
              'M 0 0',
              `Q ${(props.travel!.fx - sx) * 0.55} ${(props.travel!.fy - sy) * 0.55} ${props.travel!.fx - sx} ${props.travel!.fy - sy}`,
              `C ${props.travel!.fx - sx} ${props.travel!.fy - rowH / 2 - sy}, ${props.travel!.tx - sx} ${props.travel!.ty + rowH / 2 - sy}, ${props.travel!.tx - sx} ${props.travel!.ty - sy}`,
              `Q ${((props.travel!.tx + ex) / 2) - sx} ${((props.travel!.ty + ey) / 2) - sy} ${ex - sx} ${ey - sy}`,
            ].join(' ')
            const pathId = `party-travel-path-${i}`
            return (
              <g key={i}>
                <path id={pathId} d={path} fill="none" stroke="none" />
                <circle
                  class="travel-party-dot"
                  r={5}
                  cx={sx}
                  cy={sy}
                  style={{ '--tc': color, '--mote-delay': `${(-0.58 * i) / count}s` } as never}
                >
                  {props.travel!.go && (
                    <animateMotion
                      begin="indefinite"
                      dur={`${PARTY_TRAVEL_MS}ms`}
                      calcMode="paced"
                      fill="freeze"
                      ref={(animation) => {
                        if (!animation || animation.dataset.started) return
                        animation.dataset.started = 'true'
                        window.setTimeout(() => {
                          if (animation.isConnected) animation.beginElement()
                        }, i * PARTY_TRAVEL_STAGGER_MS)
                      }}
                    >
                      <mpath href={`#${pathId}`} />
                    </animateMotion>
                  )}
                </circle>
              </g>
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
