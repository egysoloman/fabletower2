import { useEffect, useRef, useState } from 'preact/hooks'
import {
  CARDS,
  cardName,
  cardRetains,
  enemyName,
  moveName,
  playableCards,
  potionName,
  previewCard,
  previewEnemyIntent,
  type DeckSide,
  type EnemyC,
} from '@neonspire/engine'
import { BlockChip, CardView, HpBar, MinionCard, PotionBelt, StatusRow, TopBar } from '../components'
import { POTIONS } from '@neonspire/engine'
import { discardPotion, doCombat, playCardWithFx, resolveCombatIfOver, usePotion } from '../game'
import { defeatFx, flyMini, fxPulses, fxRemainingMs, localWho, registerAnchor, useShake, victoryFx } from '../fx'
import { combat, pileView, run } from '../store'
import { byName } from '../components'
import { t, tf } from '../i18n'
import { Sprite } from '../sprites'
import { enemyMove, intentText } from '../intent'
import { DraggableHand, dragHoverWho, dragMode } from './hand'
import { charColor } from './charselect'
import { isTouch } from '../touch'

type Highlight = 'none' | 'candidate' | 'snap'

function EnemyBox(props: {
  e: EnemyC
  idx: number
  defender: DeckSide
  asc: number
  act: number
  highlight: Highlight
  onTarget: () => void
  onHover: (idx: number | null) => void
}) {
  const { e, idx } = props
  const boss = e.maxHp >= 100
  const hl = props.highlight
  const liveIntent = previewEnemyIntent(e, props.defender, props.asc, props.act)
  const move = enemyMove(e)
  // Materialize animation only right after mount (combat start / summon).
  const [justIn, setJustIn] = useState(true)
  useEffect(() => {
    // Summons play the longer portal animation; everyone else gets the quick entrance.
    const timer = setTimeout(() => setJustIn(false), e.summoned ? 780 : 560)
    return () => clearTimeout(timer)
  }, [e.summoned])
  // No impact pulses on a corpse: the recoil animation would override the
  // .dead fade transform and pop the fading panel back to full size.
  const pulseCls = e.dead ? '' : (fxPulses.value['e' + idx] ?? '')
  return (
    <div
      class={`enemy ${e.dead ? 'dead' : ''} ${boss ? 'boss' : ''} ${e.summoned ? 'summon' : ''} ${justIn ? 'spawn-in' : ''} ${hl !== 'none' ? 'targetable' : ''} ${hl === 'snap' ? 'snap' : ''} ${pulseCls}`}
      onClick={() => hl !== 'none' && props.onTarget()}
      onMouseEnter={() => props.onHover(idx)}
      onMouseLeave={() => props.onHover(null)}
      ref={(el) => registerAnchor('e' + idx, el)}
    >
      <BlockChip block={e.block} />
      {liveIntent && !e.dead ? (
        <div class={`intent ${liveIntent.kind}`} data-tip={moveName(e.defId, liveIntent.moveId)}>
          {intentText(liveIntent, move)}
        </div>
      ) : (
        <div class="intent" style={{ opacity: 0.25 }}>
          ·
        </div>
      )}
      <div class="glyph">
        <Sprite id={e.defId} size={boss ? 62 : e.summoned ? 34 : 52} />
      </div>
      {e.summoned && <div class="summon-tag">{t('summonTag')}</div>}
      <div class="ename">{enemyName(e.defId)}</div>
      <HpBar hp={e.hp} maxHp={e.maxHp} />
      <StatusRow statuses={e.statuses} />
    </div>
  )
}

export function CombatScreen() {
  const cs = combat.value
  const [selected, setSelected] = useState<number | null>(null)
  const [potionSel, setPotionSel] = useState<number | null>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const shakeCls = useShake()

  useEffect(() => {
    localWho.value = 'p'
  }, [])

  const over = cs?.over ?? null
  useEffect(() => {
    if (over) {
      // Dramatic close-out, timed to land after the final event beats.
      const fxTimer = setTimeout(() => (over === 'win' ? victoryFx() : defeatFx()), Math.max(350, fxRemainingMs()))
      // Wait out any still-playing event beats (a long enemy phase can run
      // past a fixed delay) plus a beat for the death animation.
      const timer = setTimeout(() => resolveCombatIfOver(), Math.max(1300, fxRemainingMs() + 700))
      return () => {
        clearTimeout(fxTimer)
        clearTimeout(timer)
      }
    }
  }, [over])

  // End-turn flourish: the hand visibly sweeps into the discard pile.
  // Retained cards stay put, so they don't get a departure streak.
  const sweepDiscard = () => {
    const dest = document.querySelector('.pilebtn.right')?.getBoundingClientRect()
    if (!dest) return
    const to = { x: dest.left + dest.width / 2, y: dest.top + dest.height / 2 }
    const hand = combat.value?.player.hand ?? []
    document.querySelectorAll('.hand .card').forEach((el, i) => {
      if (i >= 6) return
      if (hand[i] && cardRetains(hand[i])) return
      const r = el.getBoundingClientRect()
      setTimeout(() => flyMini({ x: r.left + r.width / 2, y: r.top + r.height / 2 }, to, '#00e5ff'), i * 36)
    })
  }

  if (!cs) return null
  const playable = new Set(playableCards(cs))
  const aliveWhos = cs.enemies.map((e, i) => (e.dead ? null : 'e' + i)).filter((w): w is string => w !== null)
  const p = cs.player

  // Classic tap fallback: select targeted cards (multi-enemy), play the rest.
  const clickCard = (i: number) => {
    if (cs.over || !playable.has(i)) return
    if (selected === i) {
      setSelected(null)
      return
    }
    const def = CARDS[p.hand[i].id]
    if (def.target === 'enemy' && aliveWhos.length > 1) {
      setSelected(i)
    } else {
      setSelected(null)
      playCardWithFx(i)
    }
  }

  const clickEnemy = (idx: number) => {
    if (potionSel !== null) {
      const belt = potionSel
      setPotionSel(null)
      usePotion(belt, 'e' + idx)
      return
    }
    if (selected === null) return
    const hand = selected
    setSelected(null)
    playCardWithFx(hand, 'e' + idx)
  }

  const clickPotion = (i: number) => {
    if (cs.over) return
    const id = run.value?.potions[i]
    const def = id ? POTIONS[id] : null
    if (!def) return
    if (potionSel === i) {
      setPotionSel(null)
      return
    }
    if (def.target === 'enemy' && aliveWhos.length > 1) {
      setSelected(null)
      setPotionSel(i)
    } else {
      setPotionSel(null)
      usePotion(i)
    }
  }

  // --- Keyboard shortcuts: 1-9 play hand cards, E end turn, T potion, Esc cancel ---
  const clickCardRef = useRef(clickCard)
  clickCardRef.current = clickCard
  const clickPotionRef = useRef(clickPotion)
  clickPotionRef.current = clickPotion
  const sweepRef = useRef(sweepDiscard)
  sweepRef.current = sweepDiscard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Leave modal surfaces (pile view, cheat console, pickers) alone.
      if (document.querySelector('.overlay')) return
      const cs = combat.value
      if (!cs || cs.over) return
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
      if (e.key === 'Escape') {
        setSelected(null)
        setPotionSel(null)
        return
      }
      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault()
        setSelected(null)
        sweepRef.current()
        doCombat({ t: 'end' })
        return
      }
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault()
        const belt = run.value?.potions ?? []
        if (belt.length > 0) clickPotionRef.current(0)
        return
      }
      const d = Number(e.key)
      if (d >= 1 && d <= 9) {
        const i = d - 1
        if (i < cs.player.hand.length) clickCardRef.current(i)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const dm = dragMode.value
  const dh = dragHoverWho.value
  const hoveredEnemy = dh?.startsWith('e') ? cs.enemies[Number(dh.slice(1))] : undefined
  const previewTargets =
    hoveredEnemy && !hoveredEnemy.dead
      ? [hoveredEnemy]
      : hoverIdx !== null && !cs.enemies[hoverIdx]?.dead
        ? [cs.enemies[hoverIdx]]
        : cs.enemies.filter((e) => !e.dead)
  const highlightOf = (i: number, e: EnemyC): Highlight => {
    if (e.dead) return 'none'
    if (dm === 'target') return dh === 'e' + i ? 'snap' : 'candidate'
    return selected !== null || potionSel !== null ? 'candidate' : 'none'
  }

  return (
    <div
      class={`combat screen ${shakeCls}`}
      onContextMenu={(e) => {
        e.preventDefault()
        setSelected(null)
        setPotionSel(null)
      }}
    >
      <TopBar />
      <div key={cs.turn} class="turnbanner">
        {tf('turnBanner', { n: cs.turn })}
      </div>
      {cs.over && (
        <div class={`turnbanner ${cs.over === 'lose' ? 'enemy' : ''}`} style={{ animationDuration: '2s' }}>
          {cs.over === 'win' ? t('threatDeleted') : t('flatlined')}
        </div>
      )}

      <div class="arena">
        <div
          class={`player-zone ${run.value?.char ?? ''} ${fxPulses.value['p'] ?? ''}`}
          ref={(el) => registerAnchor('p', el)}
        >
          <div
            class={`energy-orb ${fxPulses.value['orb'] ?? ''}`}
            data-tip={t('energyTip')}
            ref={(el) => registerAnchor('orb', el)}
          >
            {p.energy}/{p.energyMax}
          </div>
          <BlockChip block={p.block} />
          <div class="glyph" style={{ color: charColor(run.value?.char ?? 'runner') }}>
            <Sprite id={run.value?.char ?? 'runner'} size={58} />
          </div>
          <div class="pname">
            {run.value?.char && run.value.char !== 'runner' ? run.value.char.toUpperCase() : p.name}
          </div>
          <HpBar hp={p.hp} maxHp={p.maxHp} mine />
          <StatusRow statuses={p.statuses} />
          {p.minions.length > 0 && (
            <div class="minionrow">
              {p.minions.map((m, i) => (
                <MinionCard key={i} m={m} />
              ))}
            </div>
          )}
        </div>

        <div class="enemies">
          {cs.enemies.map((e, i) => (
            <EnemyBox
              key={i}
              e={e}
              idx={i}
              defender={p}
              asc={cs.asc}
              act={cs.act}
              highlight={highlightOf(i, e)}
              onTarget={() => clickEnemy(i)}
              onHover={setHoverIdx}
            />
          ))}
        </div>
      </div>

      {(selected !== null || potionSel !== null) && (
        <div
          class="turnbanner bare"
          style={{ top: '62%', fontSize: '15px', animation: 'none', opacity: 0.9, pointerEvents: 'auto', cursor: 'pointer' }}
          onClick={() => {
            setSelected(null)
            setPotionSel(null)
          }}
        >
          {(() => {
            const name =
              selected !== null
                ? cardName(p.hand[selected])
                : potionSel !== null && run.value
                  ? potionName(run.value.potions[potionSel])
                  : ''
            return tf(isTouch() ? 'selectTargetCardTouch' : 'selectTargetCard', { name })
          })()}
        </div>
      )}

      <PotionBelt cls="incombat" onUse={clickPotion} onDrop={discardPotion} selected={potionSel} />

      <div class="dock">
        <div
          class="pilebtn left"
          onClick={() =>
            (pileView.value = { title: tf('drawPileTitle', { n: p.draw.length }), cards: [...p.draw].sort(byName) })
          }
        >
          {tf('drawBtn', { n: p.draw.length })}
        </div>
        <DraggableHand
          cards={p.hand}
          playable={playable}
          targets={aliveWhos}
          disabled={!!cs.over}
          selected={selected}
          previewCard={(card) =>
            previewCard(card, p, previewTargets, {
              relics: cs.relics,
              firstCardFree: cs.firstCardFree,
            })
          }
          onCardClick={clickCard}
          onPlay={(idx, who, from) => {
            setSelected(null)
            playCardWithFx(idx, who, from)
          }}
        />
        <div
          class="pilebtn right"
          onClick={() =>
            (pileView.value = {
              title: tf('discardPileTitle', { a: p.discard.length, b: p.exhausted.length }),
              cards: [...p.discard].sort(byName).concat([...p.exhausted].sort(byName)),
            })
          }
        >
          {tf('discardBtn', { n: p.discard.length })}
        </div>
        <button
          class="btn pink endturn"
          disabled={!!cs.over}
          onClick={() => {
            setSelected(null)
            sweepDiscard()
            doCombat({ t: 'end' })
          }}
        >
          {t('endTurn')}
        </button>
      </div>
    </div>
  )
}
