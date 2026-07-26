import { useEffect, useRef, useState } from 'preact/hooks'
import { MAP_COLS, MAP_ROWS, allNodes, availableNodeIds, type MapNode, type NodeType } from '@neonspire/engine'
import { TopBar } from '../components'
import { clickNode } from '../game'
import { burst, uiRipple } from '../fx'
import { climbActive, climbOpp, climbOppProgress } from '../climb'
import { completedNode, run } from '../store'
import { Sprite } from '../sprites'
import { charColor } from './charselect'
import { sfx } from '../sfx'
import { t, tf } from '../i18n'

const ICONS: Record<NodeType, string> = {
  combat: '⚔',
  elite: '☠',
  rest: '♨',
  shop: '¤',
  treasure: '◆',
  event: '?',
  boss: '◉',
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

interface Travel {
  fx: number
  fy: number
  tx: number
  ty: number
  go: boolean
}

export function MapScreen() {
  const r = run.value
  const [travel, setTravel] = useState<Travel | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const W = 640
  const rowH = 76
  const pad = 42
  // Height follows the act's actual floor count (Act 4 is a short gauntlet).
  const actRows = r ? r.map.rows.length : MAP_ROWS
  const H = pad * 2 + (actRows - 1) * rowH
  const colW = (W - pad * 2) / (MAP_COLS - 1)
  const cx = (n: MapNode) => pad + n.col * colW + (n.type === 'boss' ? 0 : jitter(n.id))
  const cy = (n: MapNode) => H - pad - n.row * rowH

  /** SVG user units → screen pixels (for particle effects). */
  const toScreen = (x: number, y: number) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return null
    return { x: rect.left + (x / W) * rect.width, y: rect.top + (y / H) * rect.height }
  }

  const curNode = r?.pos ? allNodes(r.map).find((n) => n.id === r.pos) : null
  const nodes = r ? allNodes(r.map) : []
  const byId = new Map(nodes.map((n) => [n.id, n]))

  // Celebrate the node just completed: gold burst + ripple on its marker.
  useEffect(() => {
    const id = completedNode.value
    if (!id || !r) return
    completedNode.value = null
    const n = byId.get(id)
    if (!n) return
    const timer = setTimeout(() => {
      const p = toScreen(cx(n), cy(n))
      if (p) {
        burst(p.x, p.y, '#ffd166', 20, 3.6)
        uiRipple(p.x, p.y, '#ffd166')
      }
    }, 260)
    return () => clearTimeout(timer)
  }, [])

  if (!r) return null
  const open = new Set(availableNodeIds(r))
  const done = new Set(r.path)

  // Slide a glowing marker along the path, then actually enter the node.
  const startTravel = (n: MapNode) => {
    if (travel) return
    sfx.click()
    const from = r.pos ? byId.get(r.pos) : null
    if (!from) {
      clickNode(n.id)
      return
    }
    const tr: Travel = { fx: cx(from), fy: cy(from), tx: cx(n), ty: cy(n), go: false }
    setTravel(tr)
    requestAnimationFrame(() => requestAnimationFrame(() => setTravel((v) => (v ? { ...v, go: true } : v))))
    let step = 0
    const trail = setInterval(() => {
      step++
      const k = step / 5
      const p = toScreen(tr.fx + (tr.tx - tr.fx) * k, tr.fy + (tr.ty - tr.fy) * k)
      if (p) burst(p.x, p.y, '#00e5ff', 4, 1.5)
      if (step >= 5) clearInterval(trail)
    }, 80)
    setTimeout(() => clickNode(n.id), 500)
  }

  return (
    <div class="screen">
      <TopBar showAbandon />
      {climbActive() && (
        <div class="rivalhud">
          {climbOppProgress.value
            ? tf('rivalAt', {
                name: climbOpp.value,
                act: climbOppProgress.value.act,
                floor: climbOppProgress.value.floor,
                hp: climbOppProgress.value.hp,
              })
            : tf('rivalClimbing', { name: climbOpp.value })}
        </div>
      )}
      <div class="act-title">{tf('actTitle', { act: r.act })}</div>
      <div class="map-wrap">
        <svg class="mapsvg" viewBox={`0 0 ${W} ${H}`} ref={svgRef}>
          {nodes.flatMap((n) =>
            n.next.map((id) => {
              const m = byId.get(id)
              if (!m) return null
              const lit = (n.id === r.pos && open.has(id)) || (done.has(n.id) && done.has(id))
              return (
                <path
                  key={n.id + id}
                  class={`map-edge ${lit ? 'lit' : ''}`}
                  pathLength={1}
                  style={{ '--row-delay': `${n.row * 70}ms` } as never}
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
              <g key={n.id} class={cls} onClick={() => open.has(n.id) && startTravel(n)}>
                <title>{nodeName(n.type)}</title>
                <circle cx={cx(n)} cy={cy(n)} r={rad} />
                <text x={cx(n)} y={cy(n)} style={n.type === 'boss' ? 'font-size:22px' : ''}>
                  {ICONS[n.type]}
                </text>
              </g>
            )
          })}
          {travel && (
            <circle
              class="travel-dot"
              r={7}
              cx={0}
              cy={0}
              style={{ transform: `translate(${travel.go ? travel.tx : travel.fx}px, ${travel.go ? travel.ty : travel.fy}px)` }}
            />
          )}
        </svg>
        {curNode && !travel && (
          <div
            class="char-token"
            style={{
              left: `${(cx(curNode) / W) * 100}%`,
              top: `${(cy(curNode) / H) * 100}%`,
              color: charColor(r.char),
            }}
            data-tip={t(('char' + r.char[0].toUpperCase() + r.char.slice(1)) as Parameters<typeof t>[0])}
          >
            <Sprite id={r.char} size={30} />
          </div>
        )}
      </div>
    </div>
  )
}
