/** Shared presentational pieces. */
import type { JSX } from 'preact'
import {
  CARDS,
  RELICS,
  STATUS_INFO,
  cardCost,
  cardName,
  describeCard,
  type CardInst,
  type Statuses,
  type StatusId,
} from '@neonspire/engine'
import { picker, pileView, run } from './store'
import { muted, sfx, toggleMute } from './sfx'
import { abandonRun } from './game'

export function CardView(props: {
  card: CardInst
  onClick?: () => void
  cls?: string
  style?: JSX.CSSProperties
}) {
  const { card } = props
  const def = CARDS[card.id]
  return (
    <div
      class={`card ${def.type} ${def.rarity === 'special' ? 'special' : ''} ${props.cls ?? ''}`}
      style={props.style}
      onClick={props.onClick}
    >
      {!def.unplayable && <div class="cost">{card.up && def.upCost !== undefined ? def.upCost : cardCost(card)}</div>}
      <div class={`cname ${card.up ? 'upgraded' : ''}`}>{cardName(card)}</div>
      <div class="ctype">{def.type}</div>
      <div class="cdesc">{describeCard(card)}</div>
      {def.flavor && <div class="cflavor">{def.flavor}</div>}
    </div>
  )
}

export function CardById(props: { id: string; up?: boolean; onClick?: () => void; cls?: string }) {
  return <CardView card={{ uid: 0, id: props.id, up: props.up ?? false }} onClick={props.onClick} cls={props.cls} />
}

export function HpBar(props: { hp: number; maxHp: number; mine?: boolean }) {
  const frac = Math.max(0, Math.min(1, props.hp / props.maxHp))
  return (
    <div class={`hpbar ${props.mine ? 'mine' : ''}`}>
      <div class="fill" style={{ transform: `scaleX(${frac})` }} />
      <div class="num">
        {props.hp}/{props.maxHp}
      </div>
    </div>
  )
}

export function BlockChip(props: { block: number }) {
  if (props.block <= 0) return null
  return <div class="blockchip">{props.block}</div>
}

export function StatusRow(props: { statuses: Statuses }) {
  const entries = Object.entries(props.statuses).filter(([, v]) => (v ?? 0) !== 0)
  return (
    <div class="statusrow">
      {entries.map(([id, v]) => {
        const info = STATUS_INFO[id as StatusId]
        return (
          <span
            key={id}
            class={`status ${info.bad ? 'bad' : ''}`}
            data-tip={`${info.name}: ${info.desc.replaceAll('{n}', String(v))}`}
          >
            {info.sym}
            {v}
          </span>
        )
      })}
    </div>
  )
}

export function RelicBar(props: { relics: string[] }) {
  return (
    <div class="relicbar">
      {props.relics.map((id) => {
        const def = RELICS[id]
        if (!def) return null
        return (
          <div key={id} class="relic" data-tip={`${def.name}\n${def.desc}`}>
            {def.sym}
          </div>
        )
      })}
    </div>
  )
}

/** Standard header for all run screens. */
export function TopBar(props: { showAbandon?: boolean }) {
  const r = run.value
  if (!r) return null
  return (
    <div class="topbar">
      <span class="stat hp-txt" data-tip="Hit points">
        ♥ <b>{r.hp}/{r.maxHp}</b>
      </span>
      <span class="stat gold-txt" data-tip="Credits">
        ¤ <b>{r.gold}</b>
      </span>
      <span class="stat floor-txt">
        ACT {r.act} · FLOOR {r.floor}
      </span>
      <RelicBar relics={r.relics} />
      <span class="spacer" />
      <span
        class="stat linkish"
        style={{ color: 'var(--purple)' }}
        onClick={() => {
          sfx.click()
          pileView.value = { title: `DECK · ${r.deck.length} CARDS`, cards: [...r.deck].sort(byName) }
        }}
      >
        ▤ DECK {r.deck.length}
      </span>
      <span class="stat linkish" onClick={toggleMute} style={{ color: 'var(--dim)' }}>
        {muted.value ? '🔇' : '🔊'}
      </span>
      {props.showAbandon && (
        <span
          class="stat linkish"
          style={{ color: 'var(--dim)' }}
          onClick={() => {
            if (window.confirm('Abandon this run?')) abandonRun()
          }}
        >
          ✕ ABANDON
        </span>
      )}
    </div>
  )
}

export function byName(a: CardInst, b: CardInst): number {
  return CARDS[a.id].name.localeCompare(CARDS[b.id].name) || a.uid - b.uid
}

/** Read-only card pile browser (deck / draw / discard / exhaust). */
export function PileModal() {
  const view = pileView.value
  if (!view) return null
  return (
    <div class="overlay" onClick={() => (pileView.value = null)}>
      <div class="panel" onClick={(e) => e.stopPropagation()}>
        <h2>{view.title}</h2>
        <div class="gridcards">
          {view.cards.map((c) => (
            <CardView key={c.uid} card={c} />
          ))}
          {view.cards.length === 0 && <div class="sub">— empty —</div>}
        </div>
        <button class="btn ghost" onClick={() => (pileView.value = null)}>
          CLOSE
        </button>
      </div>
    </div>
  )
}

/** Pick-a-card-from-your-deck modal (upgrade / remove services). */
export function PickerModal() {
  const req = picker.value
  const r = run.value
  if (!req || !r) return null
  const cards = [...r.deck].filter(req.filter ?? (() => true)).sort(byName)
  return (
    <div class="overlay">
      <div class="panel">
        <h2 class="pink">{req.title}</h2>
        <div class="gridcards">
          {cards.map((c) => (
            <CardView key={c.uid} card={c} onClick={() => req.onPick(c.uid)} />
          ))}
          {cards.length === 0 && <div class="sub">No eligible cards.</div>}
        </div>
        {req.cancellable && (
          <button class="btn ghost" onClick={() => (picker.value = null)}>
            CANCEL
          </button>
        )}
      </div>
    </div>
  )
}
