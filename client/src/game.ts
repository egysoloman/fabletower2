/** Solo-run flow controller: connects the shared engine to the UI signals. */
import {
  addCardToDeck,
  addRelic,
  advanceAct,
  applyCombatResult,
  applyOutcomes,
  bossRelicId,
  combatFor,
  combatReduce,
  genShop,
  goldReward,
  moveTo,
  newRun,
  pickEvent,
  randomRelicId,
  removeCard,
  restHealAmount,
  rollCardRewards,
  upgradeCard,
  withGoldBonus,
  CARDS,
  cardName,
  firstAliveEnemy,
  type CombatAction,
  type CombatState,
} from '@neonspire/engine'
import {
  clearSave,
  combat,
  combatKind,
  currentEvent,
  eventLines,
  picker,
  restUsed,
  reward,
  run,
  saveGame,
  screen,
  shop,
  touch,
} from './store'
import { anchorCenter, flyCard, processEvents } from './fx'
import { sfx } from './sfx'
import { t, tf } from './i18n'

export function newGame(seed?: number) {
  const s = seed ?? ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0)
  run.value = newRun(s)
  combat.value = null
  reward.value = null
  shop.value = null
  currentEvent.value = null
  eventLines.value = null
  screen.value = 'map'
  saveGame()
}

export function backToMenu() {
  screen.value = 'menu'
}

export function abandonRun() {
  run.value = null
  combat.value = null
  clearSave()
  screen.value = 'menu'
}

function startFight(kind: 'normal' | 'elite' | 'boss') {
  combatKind.value = kind
  combat.value = combatFor(run.value!, kind)
  screen.value = 'combat'
}

export function clickNode(id: string) {
  const r = run.value
  if (!r) return
  const type = moveTo(r, id)
  if (!type) return
  sfx.click()
  switch (type) {
    case 'combat':
      startFight('normal')
      break
    case 'elite':
      startFight('elite')
      break
    case 'boss':
      startFight('boss')
      break
    case 'rest':
      restUsed.value = false
      screen.value = 'rest'
      break
    case 'shop':
      shop.value = genShop(r)
      screen.value = 'shop'
      break
    case 'treasure': {
      const gold = withGoldBonus(r, 25)
      r.gold += gold
      reward.value = {
        gold,
        cards: null,
        cardTaken: false,
        relic: randomRelicId(r),
        relicTaken: false,
        bossRelic: null,
        bossRelicTaken: false,
        afterBoss: false,
      }
      screen.value = 'reward'
      break
    }
    case 'event':
      currentEvent.value = pickEvent(r)
      eventLines.value = null
      screen.value = 'event'
      break
  }
  touch()
  saveGame()
}

export function doCombat(action: CombatAction) {
  const cs = combat.value
  if (!cs || cs.over) return
  const res = combatReduce(cs, action)
  if (res.error) {
    sfx.click()
    return
  }
  if (action.t === 'play') sfx.play()
  combat.value = res.state
  // End-turn resolves the whole enemy phase at once — pace the beats so each
  // enemy's move reads as its own action.
  processEvents(res.events, action.t === 'end' ? { delay: 80, step: 150 } : {})
  saveGame()
}

/**
 * Play a card with full presentation: a card ghost flies from the release
 * point (or the hand) to its destination, and the engine's impact events are
 * delayed to land exactly when it arrives.
 */
export function playCardWithFx(handIdx: number, targetWho?: string, from?: { x: number; y: number }) {
  const cs = combat.value
  if (!cs || cs.over) return
  const card = cs.player.hand[handIdx]
  if (!card) return
  const def = CARDS[card.id]
  const target = targetWho ? Number(targetWho.slice(1)) : undefined

  const res = combatReduce(cs, { t: 'play', hand: handIdx, target })
  if (res.error) {
    sfx.click()
    return
  }

  let dest: { x: number; y: number } | null = null
  if (def.target === 'enemy') {
    const idx = target ?? firstAliveEnemy(cs)
    if (idx !== undefined) dest = anchorCenter('e' + idx)
  } else if (def.effects.some((e) => e.k === 'dmgAll' || (e.k === 'status' && e.to === 'all'))) {
    const pts = cs.enemies
      .map((en, i) => (en.dead ? null : anchorCenter('e' + i)))
      .filter((p): p is { x: number; y: number } => p !== null)
    if (pts.length > 0) {
      dest = {
        x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
        y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
      }
    }
  } else {
    dest = anchorCenter('p')
  }

  const src = from ?? anchorCenter('p') ?? { x: window.innerWidth / 2, y: window.innerHeight - 200 }
  if (dest) {
    flyCard(src, dest, def.type, cardName(card))
    sfx.whoosh()
  }
  sfx.play()
  combat.value = res.state
  processEvents(res.events, { delay: dest ? 250 : 60 })
  saveGame()
}

/**
 * Called by the combat screen (after a short beat for the death animation)
 * whenever it sees a finished combat — including one restored from a save.
 */
export function resolveCombatIfOver() {
  const cs = combat.value
  if (cs?.over) finishCombat(cs)
}

function finishCombat(cs: CombatState) {
  const r = run.value
  if (!r || combat.value !== cs) return
  applyCombatResult(r, cs)
  combat.value = null
  if (cs.over === 'lose') {
    sfx.lose()
    clearSave()
    screen.value = 'gameover'
    touch()
    return
  }
  sfx.win()
  const kind = combatKind.value
  const gold = goldReward(r, kind)
  r.gold += gold
  const afterBoss = kind === 'boss'
  reward.value = {
    gold,
    cards: rollCardRewards(r, kind),
    cardTaken: false,
    relic: kind === 'elite' ? randomRelicId(r) : null,
    relicTaken: false,
    bossRelic: afterBoss ? bossRelicId(r) : null,
    bossRelicTaken: false,
    afterBoss,
  }
  screen.value = 'reward'
  touch()
  saveGame()
}

export function takeCardReward(id: string) {
  const b = reward.value
  const r = run.value
  if (!b || !r || b.cardTaken) return
  addCardToDeck(r, id)
  b.cardTaken = true
  reward.value = { ...b }
  sfx.buy()
  touch()
  saveGame()
}

export function takeRelicReward(which: 'relic' | 'bossRelic') {
  const b = reward.value
  const r = run.value
  if (!b || !r) return
  const id = which === 'relic' ? b.relic : b.bossRelic
  const taken = which === 'relic' ? b.relicTaken : b.bossRelicTaken
  if (!id || taken) return
  addRelic(r, id)
  if (which === 'relic') b.relicTaken = true
  else b.bossRelicTaken = true
  reward.value = { ...b }
  sfx.buy()
  touch()
  saveGame()
}

export function continueFromReward() {
  const b = reward.value
  const r = run.value
  if (!b || !r) return
  reward.value = null
  if (b.afterBoss) {
    if (advanceAct(r) === 'victory') {
      clearSave()
      screen.value = 'victory'
      sfx.win()
      touch()
      return
    }
  }
  screen.value = 'map'
  touch()
  saveGame()
}

// --- Shop --------------------------------------------------------------------

export function shopBuyCard(i: number) {
  const s = shop.value
  const r = run.value
  if (!s || !r) return
  const item = s.cards[i]
  if (!item || item.sold || r.gold < item.price) return
  r.gold -= item.price
  item.sold = true
  addCardToDeck(r, item.id)
  shop.value = { ...s }
  sfx.buy()
  touch()
  saveGame()
}

export function shopBuyRelic(i: number) {
  const s = shop.value
  const r = run.value
  if (!s || !r) return
  const item = s.relics[i]
  if (!item || item.sold || r.gold < item.price) return
  r.gold -= item.price
  item.sold = true
  addRelic(r, item.id)
  shop.value = { ...s }
  sfx.buy()
  touch()
  saveGame()
}

export function shopRemoveService() {
  const s = shop.value
  const r = run.value
  if (!s || !r || r.gold < s.removePrice) return
  picker.value = {
    title: tf('purgeTitle', { n: s.removePrice }),
    cancellable: true,
    onPick: (uid) => {
      if (!removeCard(r, uid)) return
      r.gold -= s.removePrice
      r.removesBought++
      s.removePrice = 75 + 25 * r.removesBought
      picker.value = null
      shop.value = { ...s }
      sfx.buy()
      touch()
      saveGame()
    },
  }
}

// --- Rest --------------------------------------------------------------------

export function restHeal() {
  const r = run.value
  if (!r || restUsed.value) return
  r.hp = Math.min(r.maxHp, r.hp + restHealAmount(r))
  restUsed.value = true
  sfx.heal()
  touch()
  saveGame()
}

export function restUpgrade() {
  const r = run.value
  if (!r || restUsed.value) return
  picker.value = {
    title: t('upgradeTitle'),
    cancellable: true,
    filter: (c) => !c.up && CARDS[c.id].rarity !== 'special',
    onPick: (uid) => {
      if (upgradeCard(r, uid)) {
        restUsed.value = true
        sfx.buy()
      }
      picker.value = null
      touch()
      saveGame()
    },
  }
}

// --- Events ------------------------------------------------------------------

export function chooseEventOption(idx: number) {
  const ev = currentEvent.value
  const r = run.value
  if (!ev || !r || eventLines.value) return
  const choice = ev.choices[idx]
  if (!choice || (choice.needGold && r.gold < choice.needGold)) return
  const { lines, removeChoose } = applyOutcomes(r, choice.outcomes)
  eventLines.value = lines.length > 0 ? lines : [t('nothingHappened')]
  if (removeChoose) {
    picker.value = {
      title: t('removeTitle'),
      cancellable: false,
      onPick: (uid) => {
        if (removeCard(r, uid)) {
          eventLines.value = [...(eventLines.value ?? []), t('cardDeleted')]
          picker.value = null
          touch()
          saveGame()
        }
      },
    }
  }
  sfx.click()
  touch()
  saveGame()
}

export function leaveNode() {
  shop.value = null
  currentEvent.value = null
  eventLines.value = null
  screen.value = 'map'
  saveGame()
}
