import { useEffect, useRef, useState } from 'preact/hooks'
import { allNodes, availableNodeIds, type MapNode } from '@neonspire/engine'
import { TopBar } from '../components'
import { clickNode } from '../game'
import { burst, uiRipple } from '../fx'
import { climbActive, climbEmote, climbOpp, climbOppProgress } from '../climb'
import { completedNode, run } from '../store'
import { sfx } from '../sfx'
import { tf } from '../i18n'
import { charColor } from './charselect'
import { MapView, mapGeometry, type MapTravel } from './mapview'

export function MapScreen() {
  const r = run.value
  const [travel, setTravel] = useState<MapTravel | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  const geom = r ? mapGeometry(r.map) : null

  /** SVG user units → screen pixels (for particle effects). */
  const toScreen = (x: number, y: number) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || !geom) return null
    return { x: rect.left + (x / geom.W) * rect.width, y: rect.top + (y / geom.H) * rect.height }
  }

  const nodes = r ? allNodes(r.map) : []
  const byId = new Map(nodes.map((n) => [n.id, n]))

  // Celebrate the node just completed: gold burst + ripple on its marker.
  useEffect(() => {
    const id = completedNode.value
    if (!id || !r || !geom) return
    completedNode.value = null
    const n = byId.get(id)
    if (!n) return
    const timer = setTimeout(() => {
      const p = toScreen(geom.cx(n), geom.cy(n))
      if (p) {
        burst(p.x, p.y, '#ffd166', 20, 3.6)
        uiRipple(p.x, p.y, '#ffd166')
      }
    }, 260)
    return () => clearTimeout(timer)
  }, [])

  if (!r || !geom) return null
  const open = new Set(availableNodeIds(r))
  const pc = charColor(r.char)

  // Slide a glowing marker along the path, then actually enter the node.
  const startTravel = (n: MapNode) => {
    if (travel) return
    sfx.click()
    const from = r.pos ? byId.get(r.pos) : null
    if (!from) {
      clickNode(n.id)
      return
    }
    const tr: MapTravel = { fx: geom.cx(from), fy: geom.cy(from), tx: geom.cx(n), ty: geom.cy(n), go: false }
    setTravel(tr)
    requestAnimationFrame(() => requestAnimationFrame(() => setTravel((v) => (v ? { ...v, go: true } : v))))
    let step = 0
    const trail = setInterval(() => {
      step++
      const k = step / 5
      const p = toScreen(tr.fx + (tr.tx - tr.fx) * k, tr.fy + (tr.ty - tr.fy) * k)
      if (p) burst(p.x, p.y, pc, 4, 1.5)
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
          {climbEmote.value && (
            <div class="rivalemote">
              {climbEmote.value.sym} {climbEmote.value.name}: {climbEmote.value.text}
            </div>
          )}
        </div>
      )}
      <div class="act-title">{tf('actTitle', { act: r.act })}</div>
      <div class="map-wrap">
        <MapView
          map={r.map}
          pos={r.pos}
          path={r.path}
          open={open}
          onNode={startTravel}
          pc={pc}
          travel={travel}
          svgRef={(el) => (svgRef.current = el)}
        />
      </div>
    </div>
  )
}
