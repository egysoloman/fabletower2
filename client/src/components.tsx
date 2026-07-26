/** Shared presentational pieces. */
import type { JSX } from 'preact'
import {
  CARDS,
  POTIONS,
  RELICS,
  STATUS_INFO,
  cardCost,
  potionDesc,
  potionName,
  cardFlavor,
  cardName,
  describeCard,
  relicDesc,
  relicName,
  statusDesc,
  statusName,
  type CardInst,
  type Statuses,
  type StatusId,
} from '@neonspire/engine'
import { cheatOpen, picker, pileView, run, screen } from './store'
import { muted, sfx, toggleMute } from './sfx'
import { burst, fxPulses, registerAnchor, statFlash } from './fx'
import { useEffect, useRef } from 'preact/hooks'
import { lang, t, tf, toggleLang } from './i18n'
import { SoundIcon } from './sprites'
import { abandonRun, backToMenu, discardPotion } from './game'

export function CardView(props: {
  card: CardInst
  onClick?: () => void
  cls?: string
  style?: JSX.CSSProperties
}) {
  const { card } = props
  const def = CARDS[card.id]
  const typeLabel =
    def.type === 'attack' ? t('typeAttack') : def.type === 'skill' ? t('typeSkill') : t('typePower')
  const flavor = cardFlavor(card)
  return (
    <div
      class={`card ${def.type} ${def.rarity === 'special' ? 'special' : ''} ${props.cls ?? ''}`}
      style={props.style}
      onClick={props.onClick}
    >
      {!def.unplayable && <div class="cost">{card.up && def.upCost !== undefined ? def.upCost : cardCost(card)}</div>}
      <div class={`cname ${card.up ? 'upgraded' : ''}`}>{cardName(card)}</div>
      <div class="ctype">{typeLabel}</div>
      <div class="cdesc">{describeCard(card)}</div>
      {flavor && <div class="cflavor">{flavor}</div>}
    </div>
  )
}

export function CardById(props: { id: string; up?: boolean; onClick?: () => void; cls?: string; style?: JSX.CSSProperties }) {
  return (
    <CardView card={{ uid: 0, id: props.id, up: props.up ?? false }} onClick={props.onClick} cls={props.cls} style={props.style} />
  )
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
  void lang.value // localized tooltips must re-render on language switch
  const entries = Object.entries(props.statuses).filter(([, v]) => (v ?? 0) !== 0)
  return (
    <div class="statusrow">
      {entries.map(([id, v]) => {
        const info = STATUS_INFO[id as StatusId]
        return (
          <span
            key={id}
            class={`status ${info.bad ? 'bad' : ''}`}
            data-tip={`${statusName(id as StatusId)}: ${statusDesc(id as StatusId).replaceAll('{n}', String(v))}`}
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
  void lang.value
  return (
    <div class="relicbar">
      {props.relics.map((id) => {
        const def = RELICS[id]
        if (!def) return null
        return (
          <div key={id} class="relic" data-tip={`${relicName(id)}\n${relicDesc(id)}`}>
            {def.sym}
          </div>
        )
      })}
    </div>
  )
}

/** Potion chips. Interactive in combat (onUse), read-only elsewhere. */
export function PotionBelt(props: {
  onUse?: (idx: number) => void
  onDrop?: (idx: number) => void
  selected?: number | null
  cls?: string
}) {
  void lang.value
  const r = run.value
  if (!r || r.potions.length === 0) return null
  return (
    <div class={`potionbelt ${props.cls ?? ''}`}>
      {r.potions.map((id, i) => {
        const def = POTIONS[id]
        if (!def) return null
        return (
          <div key={i} class="potionwrap">
            <div
              class={`potion ${def.rarity} ${props.onUse ? 'usable' : ''} ${props.selected === i ? 'selected' : ''}`}
              data-tip={`${potionName(id)}\n${potionDesc(id)}`}
              onClick={() => props.onUse?.(i)}
            >
              {def.sym}
            </div>
            {props.onDrop && (
              <div
                class="potdrop"
                data-tip={t('dropPotion')}
                onClick={(e) => {
                  e.stopPropagation()
                  props.onDrop!(i)
                }}
              >
                ×
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Standard header for all run screens. */
export function TopBar(props: { showAbandon?: boolean }) {
  const r = run.value
  // Deck-size pop: any acquisition/removal (rewards, shops, events, curses,
  // cheats) flashes +n/-n on the deck counter automatically.
  const prevDeck = useRef<number | null>(null)
  useEffect(() => {
    if (!r) return
    const prev = prevDeck.current
    prevDeck.current = r.deck.length
    if (prev !== null && prev !== r.deck.length) {
      const d = r.deck.length - prev
      statFlash('deck', d > 0 ? `+${d}` : `${d}`, d > 0 ? 'stat' : 'dmg')
    }
  }, [r?.deck.length])
  if (!r) return null
  return (
    <div class="topbar">
      <span class="stat hp-txt" data-tip={t('hpTip')}>
        ♥ <b>{r.hp}/{r.maxHp}</b>
      </span>
      <span class={`stat gold-txt ${fxPulses.value['gold'] ?? ''}`} data-tip={t('creditsTip')} ref={(el) => registerAnchor('gold', el)}>
        ¤ <b>{r.gold}</b>
      </span>
      <span class="stat floor-txt">
        {tf('actFloor', { act: r.act, floor: r.floor })}
        {r.asc > 0 ? ` · A${r.asc}` : ''}
      </span>
      <span class={fxPulses.value['relics'] ?? ''} ref={(el) => registerAnchor('relics', el)}>
        <RelicBar relics={r.relics} />
      </span>
      <span class={fxPulses.value['belt'] ?? ''} ref={(el) => registerAnchor('belt', el)}>
        {screen.value !== 'combat' && <PotionBelt cls="inbar" onDrop={discardPotion} />}
      </span>
      <span class="spacer" />
      <span
        class={`stat linkish ${fxPulses.value['deck'] ?? ''}`}
        style={{ color: 'var(--purple)' }}
        ref={(el) => registerAnchor('deck', el)}
        onClick={() => {
          sfx.click()
          pileView.value = { title: tf('deckTitle', { n: r.deck.length }), cards: [...r.deck].sort(byName) }
        }}
      >
        {tf('deckBtn', { n: r.deck.length })}
      </span>
      <span
        class="stat linkish"
        style={{ color: 'var(--gold)' }}
        onClick={() => {
          sfx.click()
          cheatOpen.value = true
        }}
      >
        ⌁ {t('cheats')}
      </span>
      <span class="stat linkish" onClick={toggleLang} style={{ color: 'var(--dim)' }} data-tip="EN / 中文">
        {lang.value === 'zh' ? 'EN' : '中'}
      </span>
      <span class="stat linkish" onClick={toggleMute} style={{ color: 'var(--dim)' }}>
        <SoundIcon muted={muted.value} />
      </span>
      {props.showAbandon && (
        <>
          <span
            class="stat linkish"
            style={{ color: 'var(--dim)' }}
            data-tip={t('toMenuTip')}
            onClick={() => {
              sfx.click()
              backToMenu()
            }}
          >
            ⌂ {t('menuBtn')}
          </span>
          <span
            class="stat linkish"
            style={{ color: 'var(--dim)' }}
            onClick={() => {
              if (window.confirm(t('abandonConfirm'))) abandonRun()
            }}
          >
            {t('abandon')}
          </span>
        </>
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
        <div class="gridcards fan">
          {view.cards.map((c, i) => (
            <CardView key={c.uid} card={c} style={{ '--fanidx': i, '--fan': Math.min(i, 14) } as never} />
          ))}
          {view.cards.length === 0 && <div class="sub">{t('empty')}</div>}
        </div>
        <button class="btn ghost" onClick={() => (pileView.value = null)}>
          {t('close')}
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
        <div class="gridcards fan">
          {cards.map((c, i) => (
            <div
              key={c.uid}
              style={{ '--fan': Math.min(i, 14) } as never}
              onClick={(e) => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                burst(rect.left + rect.width / 2, rect.top + rect.height / 2, '#ffd166', 16, 3.2)
                req.onPick(c.uid)
              }}
            >
              <CardView card={c} />
            </div>
          ))}
          {cards.length === 0 && <div class="sub">{t('noEligible')}</div>}
        </div>
        {req.cancellable && (
          <button class="btn ghost" onClick={() => (picker.value = null)}>
            {t('cancel')}
          </button>
        )}
      </div>
    </div>
  )
}
