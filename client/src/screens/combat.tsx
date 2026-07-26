import { useEffect, useRef, useState } from 'preact/hooks'
import {
  CARDS,
  enemyName,
  moveName,
  playableCards,
  type CombatState,
  type EnemyC,
  type Intent,
} from '@neonspire/engine'
import { BlockChip, CardView, HpBar, StatusRow, TopBar } from '../components'
import { doCombat, resolveCombatIfOver } from '../game'
import { registerAnchor, shakeTick } from '../fx'
import { combat, pileView } from '../store'
import { byName } from '../components'
import { t, tf } from '../i18n'

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

function EnemyBox(props: { e: EnemyC; idx: number; targetable: boolean; onTarget: () => void }) {
  const { e, idx } = props
  const boss = e.maxHp >= 100
  return (
    <div
      class={`enemy ${e.dead ? 'dead' : ''} ${boss ? 'boss' : ''} ${props.targetable ? 'targetable' : ''}`}
      onClick={() => props.targetable && props.onTarget()}
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
  const [shaking, setShaking] = useState(false)
  const lastShake = useRef(shakeTick.value)
  const tick = shakeTick.value

  useEffect(() => {
    if (tick !== lastShake.current) {
      lastShake.current = tick
      setShaking(true)
      const t = setTimeout(() => setShaking(false), 400)
      return () => clearTimeout(t)
    }
  }, [tick])

  const over = cs?.over ?? null
  useEffect(() => {
    if (over) {
      const t = setTimeout(() => resolveCombatIfOver(), 1000)
      return () => clearTimeout(t)
    }
  }, [over])

  if (!cs) return null
  const playable = new Set(playableCards(cs))
  const aliveIdxs = cs.enemies.map((e, i) => (e.dead ? -1 : i)).filter((i) => i >= 0)
  const p = cs.player

  const clickCard = (i: number) => {
    if (cs.over || !playable.has(i)) return
    if (selected === i) {
      setSelected(null)
      return
    }
    const def = CARDS[p.hand[i].id]
    if (def.target === 'enemy' && aliveIdxs.length > 1) {
      setSelected(i)
    } else {
      setSelected(null)
      doCombat({ t: 'play', hand: i })
    }
  }

  const clickEnemy = (idx: number) => {
    if (selected === null) return
    const hand = selected
    setSelected(null)
    doCombat({ t: 'play', hand, target: idx })
  }

  const n = p.hand.length
  return (
    <div
      class={`combat screen ${shaking ? 'shake' : ''}`}
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
        <div class="player-zone" ref={(el) => registerAnchor('p', el)}>
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
            <EnemyBox key={i} e={e} idx={i} targetable={selected !== null && !e.dead} onTarget={() => clickEnemy(i)} />
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
        <div class="hand">
          {p.hand.map((c, i) => {
            const mid = (n - 1) / 2
            const rot = (i - mid) * 3.5
            const lift = Math.abs(i - mid) * 6
            return (
              <CardView
                key={c.uid}
                card={c}
                cls={`${playable.has(i) ? '' : 'unplayable'} ${selected === i ? 'selected' : ''}`}
                style={{ '--rot': `${rot}deg`, '--lift': `${lift}px`, zIndex: i }}
                onClick={() => clickCard(i)}
              />
            )
          })}
        </div>
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
