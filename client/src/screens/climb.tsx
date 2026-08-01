/**
 * Climb-race screens: queue setup, checkpoint waiting room, the
 * server-validated rival duel, and the race result. The solo climb between
 * these states is the ordinary offline game with a rival HUD.
 */
import { useEffect, useState } from 'preact/hooks'
import { CARDS, MINIONS, cardName, previewCard, type CharId, type PvpAction } from '@neonspire/engine'
import { BlockChip, HpBar, MinionCard, StatusRow } from '../components'
import {
  anchorCenter,
  defeatFx,
  energyRipple,
  flyCard,
  fxPulses,
  localWho,
  registerAnchor,
  useShake,
  victoryFx,
} from '../fx'
import {
  climbChars,
  climbEmote,
  climbLeave,
  climbNotice,
  climbOpp,
  climbOppProgress,
  climbOppReady,
  climbPending,
  climbPhase,
  climbQueue,
  climbFinalWon,
  climbRoundWon,
  climbScore,
  climbSendAction,
  climbSendEmote,
  climbYou,
  climbView,
} from '../climb'
import { charColor, lastChar } from './charselect'
import { AscensionPicker, CharPickButton, CharSelectPage, EmotePanel, MpConnect } from './mpsetup'
import { mpName } from '../mp'
import { ascUnlocked, continueClimbAfterRound, continueClimbAfterWin, loseClimb, startClimbRun } from '../game'
import { screen } from '../store'
import { sfx } from '../sfx'
import { t, tf } from '../i18n'
import { Sprite } from '../sprites'
import { DraggableHand, dragHoverWho, dragMode } from './hand'

export function ClimbScreen() {
  const [char, setChar] = useState<CharId>(lastChar())
  const [asc, setAsc] = useState(0)
  const [picking, setPicking] = useState(false)
  const phase = climbPhase.value
  const view = climbView.value
  const raceScore = climbScore.value
  const shakeCls = useShake()

  const youIdx = view?.you
  useEffect(() => {
    if (phase === 'duel' && youIdx !== undefined) localWho.value = 'p' + youIdx
    return () => {
      localWho.value = 'p'
    }
  }, [phase, youIdx])

  const winner = view?.over?.winner
  useEffect(() => {
    if (winner === undefined || youIdx === undefined) return
    if (winner === youIdx) victoryFx(true)
    else defeatFx()
  }, [winner])

  // --- Duel ------------------------------------------------------------------
  if (phase === 'duel' && view) {
    const me = view.sides[view.you]
    const them = view.sides[1 - view.you]
    const myTurn = view.active === view.you && !view.over
    const hand = me.hand ?? []
    const pending = climbPending.value
    const meWho = 'p' + view.you
    const oppWho = 'p' + (1 - view.you)
    const playableSet = new Set(
      myTurn
        ? hand
            .map((c, i) => {
              const def = CARDS[c.id]
              const cost = c.up && def.upCost !== undefined ? def.upCost : def.cost
              return !def.unplayable && me.energy >= cost ? i : -1
            })
            .filter((i) => i >= 0)
        : [],
    )
    const playFromHand = (idx: number, _who: string | undefined, from?: { x: number; y: number }) => {
      if (!myTurn || pending) return
      const card = hand[idx]
      if (!card) return
      const def = CARDS[card.id]
      const dest = anchorCenter(def.target === 'enemy' ? oppWho : meWho)
      const src = from ?? anchorCenter(meWho)
      if (src && dest) {
        flyCard(src, dest, def.type, cardName(card))
        sfx.whoosh()
      }
      energyRipple()
      sfx.play()
      climbSendAction({ t: 'play', hand: idx })
    }
    const send = (a: PvpAction) => climbSendAction(a)
    const oppHl = dragMode.value === 'target' ? (dragHoverWho.value === oppWho ? 'snap' : 'targetable') : ''

    return (
      <div class={`combat screen ${shakeCls}`}>
        <div class="topbar">
          <span class="stat" style={{ color: 'var(--gold)' }}>
            {t('checkpointDuel')}
          </span>
          <span class="spacer" />
          <span class={`turn-indicator ${myTurn ? 'you' : 'them'}`}>
            {myTurn ? t('yourTurn') : tf('theirTurn', { name: them.name })}
          </span>
          <span class="spacer" />
          <span class="stat" style={{ color: 'var(--gold)' }}>
            {raceScore[view.you]} — {raceScore[1 - view.you]}
          </span>
        </div>
        <div class="arena">
          <div class={`player-zone ${fxPulses.value[meWho] ?? ''}`} ref={(el) => registerAnchor(meWho, el)}>
            <div class={`energy-orb ${fxPulses.value['orb'] ?? ''}`} ref={(el) => registerAnchor('orb', el)}>
              {me.energy}/{me.energyMax}
            </div>
            <BlockChip block={me.block} />
            <div class="glyph" style={{ color: charColor(climbChars.value[view.you] ?? char) }}>
              <Sprite id={climbChars.value[view.you] ?? char} size={58} />
            </div>
            <div class="pname">{tf('youSuffix', { name: me.name })}</div>
            <HpBar hp={me.hp} maxHp={me.maxHp} mine />
            <StatusRow statuses={me.statuses} />
            {me.minions.length > 0 && (
              <div class="minionrow">
                {me.minions.map((m, i) => (
                  <MinionCard key={i} m={m} />
                ))}
              </div>
            )}
          </div>
          <div class={`opp-zone ${oppHl} ${fxPulses.value[oppWho] ?? ''}`} ref={(el) => registerAnchor(oppWho, el)}>
            <div class="facedown-row">
              {Array.from({ length: them.handCount }).map((_, i) => (
                <div key={i} class="facedown" />
              ))}
            </div>
            <BlockChip block={them.block} />
            <div class="glyph" style={{ color: charColor(climbChars.value[1 - view.you] ?? 'runner') }}>
              <Sprite id={climbChars.value[1 - view.you] ?? 'runner'} size={54} />
            </div>
            <div class="ename" style={{ fontFamily: 'var(--font-head)', fontSize: '12px', color: '#ffb8d9' }}>
              {them.name}
            </div>
            <HpBar hp={them.hp} maxHp={them.maxHp} />
            <StatusRow statuses={them.statuses} />
            {them.minions.length > 0 && (
              <div class="minionrow">
                {them.minions.map((m, i) => (
                  <MinionCard key={i} m={m} />
                ))}
              </div>
            )}
          </div>
        </div>
        <EmotePanel
          send={climbSendEmote}
          targets={[{ idx: 1 - view.you, name: them.name }]}
          dropZones={[
            { anchor: 'p' + view.you, payload: { target: view.you } },
            { anchor: 'p' + (1 - view.you), payload: { target: 1 - view.you } },
          ]}
        />
        <div class="dock">
          <DraggableHand
            cards={hand}
            playable={playableSet}
            targets={myTurn && !pending ? [oppWho] : []}
            disabled={!myTurn || pending}
            previewCard={(card) => previewCard(card, me, [them])}
            onCardClick={(i) => playableSet.has(i) && playFromHand(i, oppWho)}
            onPlay={playFromHand}
          />
          <button class="btn pink endturn" disabled={!myTurn || pending} onClick={() => send({ t: 'end' })}>
            {t('endTurn')}
          </button>
        </div>
      </div>
    )
  }

  // --- Non-duel states -------------------------------------------------------
  if (picking && phase === 'idle') {
    return <CharSelectPage value={char} onChange={setChar} onDone={() => setPicking(false)} />
  }
  const opp = climbOppProgress.value
  return (
    <div class="screen menu">
      <div class="logo" style={{ fontSize: 'clamp(30px,6vw,54px)' }}>
        CLIMB<span>RACE</span>
      </div>
      <div class="pvp-status">
        {phase === 'idle' && (
          <>
            <div class="sub" style={{ maxWidth: '460px', textAlign: 'center', lineHeight: 1.6 }}>
              {t('climbIntro')}
            </div>
            <CharPickButton char={char} onOpen={() => setPicking(true)} />
            <AscensionPicker value={asc} max={ascUnlocked()} onChange={setAsc} />
            <MpConnect />
            <button class="btn big pink" onClick={() => climbQueue(mpName(), char, asc, (seed, matchedAsc) => startClimbRun(seed, matchedAsc, char))}>
              {t('findRival')}{asc > 0 ? ` · A${asc}` : ''}
            </button>
          </>
        )}
        {(phase === 'connecting' || phase === 'queued') && <div class="pulse">{t('scanning')}</div>}
        {phase === 'waiting' && (
          <>
            <div class="pulse" style={{ color: 'var(--gold)' }}>
              {t('checkpointWait')}
            </div>
            <div class="sub">
              {climbOppReady.value
                ? t('rivalReady')
                : opp
                  ? tf('rivalAt', { name: climbOpp.value, act: opp.act, floor: opp.floor, hp: opp.hp })
                  : tf('rivalClimbing', { name: climbOpp.value })}
            </div>
            {climbEmote.value && (
              <div class="rivalemote">
                {climbEmote.value.sym} {climbEmote.value.name}: {climbEmote.value.text}
              </div>
            )}
            <EmotePanel send={climbSendEmote} />
          </>
        )}
        {phase === 'round' && (
          <>
            <h2 class={climbRoundWon.value ? '' : 'pink'}>
              {climbRoundWon.value ? t('checkpointWon') : t('checkpointLost')}
            </h2>
            <div class="sub">{tf('raceScore', {
              you: raceScore[climbYou.value],
              them: raceScore[1 - climbYou.value],
            })}</div>
            <div class="sub">{climbNotice.value}</div>
            <button class="btn big pink" onClick={continueClimbAfterRound}>
              {t('continueClimb')}
            </button>
          </>
        )}
        {phase === 'final' && (
          <>
            <h2 class={climbFinalWon.value ? '' : 'pink'}>
              {climbFinalWon.value ? t('raceWon') : t('raceLost')}
            </h2>
            <div class="sub">{tf('raceScore', {
              you: raceScore[climbYou.value],
              them: raceScore[1 - climbYou.value],
            })}</div>
            <button class="btn big pink" onClick={continueClimbAfterWin}>
              {t('finishRun')}
            </button>
          </>
        )}
        {phase === 'won' && (
          <>
            <h2 style={{ color: 'var(--gold)' }}>{t('rivalEliminated')}</h2>
            <div class="sub">{climbNotice.value}</div>
            <button class="btn big pink" onClick={continueClimbAfterWin}>
              {t('continueClimb')}
            </button>
          </>
        )}
        {phase === 'lost' && (
          <>
            <h2 class="pink">{t('raceLost')}</h2>
            <div class="sub">{climbNotice.value}</div>
            <button class="btn" onClick={loseClimb}>
              {t('menuBtn')}
            </button>
          </>
        )}
        {phase === 'error' && (
          <>
            <div style={{ color: 'var(--red)', maxWidth: '440px', textAlign: 'center', lineHeight: 1.6 }}>{climbNotice.value}</div>
            <button class="btn" onClick={() => climbLeave()}>
              {t('retry')}
            </button>
          </>
        )}
        {(phase === 'idle' || phase === 'error' || phase === 'connecting' || phase === 'queued') && (
          <button
            class="btn ghost"
            onClick={() => {
              climbLeave()
              screen.value = 'menu'
            }}
          >
            {t('back')}
          </button>
        )}
      </div>
    </div>
  )
}
