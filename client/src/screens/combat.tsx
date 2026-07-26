import { useEffect, useState } from 'preact/hooks'
import {
  CARDS,
  enemyName,
  moveName,
  playableCards,
  type EnemyC,
  type Intent,
} from '@neonspire/engine'
import { BlockChip, CardView, HpBar, StatusRow, TopBar } from '../components'
import { doCombat, playCardWithFx, resolveCombatIfOver } from '../game'
import { fxPulses, fxRemainingMs, localWho, registerAnchor, useShake } from '../fx'
import { combat, pileView } from '../store'
import { byName } from '../components'
import { t, tf } from '../i18n'
import { DraggableHand, dragHoverWho, dragMode } from './hand'

function intentText(intent: Intent): string {
  switch (intent.kind) {
    case 'attack':
      return `${t('intentAtk')} ${intent.dmg}${intent.times ? '×' + intent.times : ''}`
    case 'defend':
      return t('intentDef')
    case 'buff':
      return t('intentBuf')
    case 'debuff':
      return t('intentHex')
    case 'mixed':
      return `${t('intentAtk')} ${intent.dmg ?? '?'}${intent.times ? '×' + intent.times : ''} +`
  }
}

type Highlight = 'none' | 'candidate' | 'snap'

function EnemyBox(props: { e: EnemyC; idx: number; highlight: Highlight; onTarget: () => void }) {
  const { e, idx } = props
  const boss = e.maxHp >= 100
  const hl = props.highlight
  // No impact pulses on a corpse: the recoil animation would override the
  // .dead fade transform and pop the fading panel back to full size.
  const pulseCls = e.dead ? '' : (fxPulses.value['e' + idx] ?? '')
  return (
    <div
      class={`enemy ${e.dead ? 'dead' : ''} ${boss ? 'boss' : ''} ${hl !== 'none' ? 'targetable' : ''} ${hl === 'snap' ? 'snap' : ''} ${pulseCls}`}
      onClick={() => hl !== 'none' && props.onTarget()}
      ref={(el) => registerAnchor('e' + idx, el)}
    >
      <BlockChip block={e.block} />
      {e.intent && !e.dead ? (
        <div class={`intent ${e.intent.kind}`} data-tip={moveName(e.defId, e.intent.moveId)}>
          {intentText(e.intent)}
        </div>
      ) : (
        <div class="intent" style={{ opacity: 0.25 }}>
          ·
        </div>
      )}
      <div class="glyph">{e.glyph}</div>
      <div class="ename">{enemyName(e.defId)}</div>
      <HpBar hp={e.hp} maxHp={e.maxHp} />
      <StatusRow statuses={e.statuses} />
    </div>
  )
}

export function CombatScreen() {
  const cs = combat.value
  const [selected, setSelected] = useState<number | null>(null)
  const shakeCls = useShake()

  useEffect(() => {
    localWho.value = 'p'
  }, [])

  const over = cs?.over ?? null
  useEffect(() => {
    if (over) {
      // Wait out any still-playing event beats (a long enemy phase can run
      // past a fixed delay) plus a beat for the death animation.
      const timer = setTimeout(() => resolveCombatIfOver(), Math.max(1000, fxRemainingMs() + 450))
      return () => clearTimeout(timer)
    }
  }, [over])

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
    if (selected === null) return
    const hand = selected
    setSelected(null)
    playCardWithFx(hand, 'e' + idx)
  }

  const dm = dragMode.value
  const dh = dragHoverWho.value
  const highlightOf = (i: number, e: EnemyC): Highlight => {
    if (e.dead) return 'none'
    if (dm === 'target') return dh === 'e' + i ? 'snap' : 'candidate'
    return selected !== null ? 'candidate' : 'none'
  }

  return (
    <div
      class={`combat screen ${shakeCls}`}
      onContextMenu={(e) => {
        e.preventDefault()
        setSelected(null)
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
        <div class={`player-zone ${fxPulses.value['p'] ?? ''}`} ref={(el) => registerAnchor('p', el)}>
          <div class="energy-orb" data-tip={t('energyTip')}>
            {p.energy}/{p.energyMax}
          </div>
          <BlockChip block={p.block} />
          <div class="glyph">👤</div>
          <div class="pname">{p.name}</div>
          <HpBar hp={p.hp} maxHp={p.maxHp} mine />
          <StatusRow statuses={p.statuses} />
        </div>

        <div class="enemies">
          {cs.enemies.map((e, i) => (
            <EnemyBox key={i} e={e} idx={i} highlight={highlightOf(i, e)} onTarget={() => clickEnemy(i)} />
          ))}
        </div>
      </div>

      {selected !== null && (
        <div class="turnbanner" style={{ top: '62%', fontSize: '15px', animation: 'none', opacity: 0.9 }}>
          {t('selectTarget')}
        </div>
      )}

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
        <button class="btn pink endturn" disabled={!!cs.over} onClick={() => (setSelected(null), doCombat({ t: 'end' }))}>
          {t('endTurn')}
        </button>
      </div>
    </div>
  )
}
