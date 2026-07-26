/** Solo-run flow controller: connects the shared engine to the UI signals. */
import {
  addCardToDeck,
  addRelic,
  advanceAct,
  applyCombatResult,
  applyOutcomes,
  applyPotion,
  bossRelicChoices,
  combatFor,
  combatReduce,
  genShop,
  goldReward,
  moveTo,
  newRun,
  pickEvent,
  randomPotionId,
  randomRelicId,
  removeCard,
  restHealAmount,
  rollCardRewards,
  rollPotionDrop,
  scoreRun,
  upgradeCard,
  withGoldBonus,
  BOOT_EVENT,
  CARDS,
  FINAL_ACT,
  MAX_ASC,
  MAX_POTIONS,
  POTIONS,
  cardName,
  drawCards,
  firstAliveEnemy,
  type CombatAction,
  type CombatState,
} from '@neonspire/engine'
import {
  cheatOpen,
  clearSave,
  dailyResult,
  prefightHp,
  combat,
  completedNode,
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
import { anchorCenter, codeBurstPt, energyRipple, flyCard, glyphSplash, processEvents, screenWipe } from './fx'
import { climbActive, climbBossKill, climbDied, climbLeave, climbReport } from './climb'
import { checkCombat, checkRun, discoverEnemies, discoverRun, recordDaily, dailyRank } from './meta'
import { sfx } from './sfx'
import { t, tf } from './i18n'

// --- Ascension unlock + run history (device-local meta-progression) ---------

export function dailySeed(date = new Date()): number {
  const str = 'daily-' + date.toISOString().slice(0, 10)
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function ascUnlocked(): number {
  try {
    return Math.min(MAX_ASC, Number(localStorage.getItem('ns-ascmax') ?? 0) || 0)
  } catch {
    return 0
  }
}

export interface RunRecord {
  d: number
  seed: number
  asc: number
  act: number
  floor: number
  win: boolean
  sc?: number
  ch?: import('@neonspire/engine').CharId
}

export function runHistory(): RunRecord[] {
  try {
    return JSON.parse(localStorage.getItem('ns-history') ?? '[]')
  } catch {
    return []
  }
}

function recordRun(win: boolean) {
  const r = run.value
  if (!r) return
  try {
    const list = runHistory()
    const rec = {
      d: Date.now(),
      seed: r.seed,
      asc: r.asc,
      act: r.act,
      floor: r.floor,
      win,
      sc: scoreRun(r, win).total,
      ch: r.char,
    }
    list.unshift(rec)
    localStorage.setItem('ns-history', JSON.stringify(list.slice(0, 10)))
    checkRun(rec, r, dailySeed())
    if (r.seed === dailySeed()) {
      recordDaily({ score: rec.sc ?? 0, ch: r.char, win, d: Date.now() })
      dailyResult.value = { score: rec.sc ?? 0, rank: dailyRank((rec.sc ?? 0) + 1) }
    }
    if (win && r.asc >= ascUnlocked() && ascUnlocked() < MAX_ASC) {
      localStorage.setItem('ns-ascmax', String(r.asc + 1))
    }
  } catch {
    /* stats are best-effort */
  }
}

export function newGame(seed?: number, asc = 0, char: import('@neonspire/engine').CharId = 'runner') {
  const s = seed ?? ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0)
  run.value = newRun(s, asc, char)
  combat.value = null
  reward.value = null
  shop.value = null
  eventLines.value = null
  // Neow-style boot bonus before the climb starts.
  currentEvent.value = BOOT_EVENT
  screen.value = 'event'
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
  prefightHp.value = combat.value.player.hp
  discoverEnemies(combat.value)
  const label = kind === 'boss' ? t('nodeBoss') : kind === 'elite' ? t('nodeElite') : t('nodeCombat')
  const color = kind === 'boss' ? 'var(--pink)' : kind === 'elite' ? 'var(--gold)' : 'var(--cyan)'
  screenWipe(label, color, () => (screen.value = 'combat'))
}

export function clickNode(id: string) {
  const r = run.value
  if (!r) return
  const type = moveTo(r, id)
  if (!type) return
  sfx.click()
  climbReport(r)
  discoverRun(r)
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
        bossChoices: [],
        bossChoiceTaken: false,
        potion: null,
        potionTaken: false,
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
  if (action.t === 'end') setTimeout(() => sfx.draw(), 600)
  combat.value = res.state
  checkCombat(res.state)
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
    // terminal readout + code-glyph shrapnel when the card "executes"
    const ext = def.type === 'attack' ? '.sh' : def.type === 'power' ? '.sys' : '.cfg'
    const d = dest
    setTimeout(() => {
      codeBurstPt(d, [`> exec ${card.id}${ext}`, '[ok]'])
      glyphSplash(d.x, d.y, def.type === 'attack' ? '#00e5ff' : '#7dffa8', 9)
    }, 230)
  }
  energyRipple()
  sfx.play(def.type)
  combat.value = res.state
  checkCombat(res.state)
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
  cheatOpen.value = false
  applyCombatResult(r, cs)
  combat.value = null
  climbReport(r)
  if (cs.over === 'lose') {
    if (climbActive()) climbDied()
    recordRun(false)
    sfx.lose()
    clearSave()
    screen.value = 'gameover'
    touch()
    return
  }
  sfx.win()
  const kind = combatKind.value
  discoverEnemies(cs)
  discoverRun(r)
  if (kind === 'boss' && cs.player.hp >= prefightHp.value) {
    import('./meta').then((mm) => mm.award('untouchable'))
  }
  // Felling THE ROOT ends the run outright — no loot screen after the finale.
  if (kind === 'boss' && r.act >= 4) {
    recordRun(true)
    clearSave()
    screen.value = 'victory'
    touch()
    return
  }
  const gold = goldReward(r, kind)
  r.gold += gold
  const afterBoss = kind === 'boss'
  reward.value = {
    gold,
    cards: rollCardRewards(r, kind),
    cardTaken: false,
    relic: kind === 'elite' ? randomRelicId(r) : null,
    relicTaken: false,
    bossChoices: afterBoss ? bossRelicChoices(r) : [],
    bossChoiceTaken: false,
    potion: rollPotionDrop(r),
    potionTaken: false,
    afterBoss,
  }
  screenWipe(t('spoils'), 'var(--gold)', () => (screen.value = 'reward'))
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

export function takeRelicReward() {
  const b = reward.value
  const r = run.value
  if (!b || !r || !b.relic || b.relicTaken) return
  addRelic(r, b.relic)
  b.relicTaken = true
  reward.value = { ...b }
  sfx.buy()
  touch()
  saveGame()
}

/** Boss rewards offer a choice — taking one forfeits the others. */
export function takeBossRelic(id: string) {
  const b = reward.value
  const r = run.value
  if (!b || !r || b.bossChoiceTaken || !b.bossChoices.includes(id)) return
  addRelic(r, id)
  b.bossChoiceTaken = true
  reward.value = { ...b }
  sfx.buy()
  touch()
  saveGame()
}

export function takePotionReward() {
  const b = reward.value
  const r = run.value
  if (!b || !r || !b.potion || b.potionTaken || r.potions.length >= MAX_POTIONS) return
  r.potions.push(b.potion)
  b.potionTaken = true
  reward.value = { ...b }
  sfx.buy()
  touch()
  saveGame()
}

/** Drink a potion mid-combat (the only place potions can be used). */
export function usePotion(beltIdx: number, targetWho?: string) {
  const r = run.value
  const cs = combat.value
  if (!r || !cs || cs.over) return
  const id = r.potions[beltIdx]
  if (!id) return
  const target = targetWho ? Number(targetWho.slice(1)) : undefined
  const res = applyPotion(cs, id, target)
  if (res.error) {
    sfx.click()
    return
  }
  r.potions.splice(beltIdx, 1)
  combat.value = res.state
  processEvents(res.events, { delay: 120 })
  sfx.heal()
  touch()
  saveGame()
}

export function continueFromReward() {
  const b = reward.value
  const r = run.value
  if (!b || !r) return
  reward.value = null
  if (b.afterBoss) {
    // Climb race: an act boss IS the checkpoint — submit the run deck and
    // wait for the rival instead of advancing.
    if (climbActive()) {
      climbBossKill(r)
      touch()
      return
    }
    // Beating Act 3 opens the way down: the player chooses whether to jack
    // out with the win or descend into THE ROOT for the true finale.
    if (r.act === FINAL_ACT) {
      screen.value = 'descend'
      touch()
      saveGame()
      return
    }
    if (advanceAct(r) === 'victory') {
      recordRun(true)
      clearSave()
      screen.value = 'victory'
      sfx.win()
      touch()
      return
    }
  } else {
    completedNode.value = r.pos
  }
  screen.value = 'map'
  touch()
  saveGame()
}

/** Toss a potion to free belt space (any screen). */
export function discardPotion(i: number) {
  const r = run.value
  if (!r || r.potions[i] === undefined) return
  r.potions.splice(i, 1)
  sfx.click()
  touch()
  saveGame()
}

// --- Climb race --------------------------------------------------------------

/** Both racers climb the SAME seed; character is chosen at queue time. */
export function startClimbRun(seed: number, char: import('@neonspire/engine').CharId) {
  newGame(seed, 0, char)
}

/** Checkpoint duel won: the rival is out — keep climbing. */
export function continueClimbAfterWin() {
  const r = run.value
  climbLeave()
  if (!r) {
    screen.value = 'menu'
    return
  }
  if (advanceAct(r) === 'victory') {
    clearSave()
    screen.value = 'victory'
    sfx.win()
    touch()
    return
  }
  screen.value = 'map'
  sfx.win()
  touch()
  saveGame()
}

/** Checkpoint duel lost (or rival won the race): the run is over. */
export function loseClimb() {
  climbLeave()
  run.value = null
  combat.value = null
  clearSave()
  screen.value = 'menu'
  touch()
}

/** Take the win at the surface: Act 3 cleared, run over. */
export function jackOut() {
  const r = run.value
  if (!r) return
  recordRun(true)
  clearSave()
  screen.value = 'victory'
  sfx.win()
  touch()
}

/** Descend into THE ROOT: the optional Act 4 gauntlet. */
export function descendToRoot() {
  const r = run.value
  if (!r) return
  advanceAct(r, true)
  screen.value = 'map'
  sfx.click()
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

export function shopBuyPotion(i: number) {
  const s = shop.value
  const r = run.value
  if (!s || !r) return
  const item = s.potions[i]
  if (!item || item.sold || r.gold < item.price || r.potions.length >= MAX_POTIONS) return
  r.gold -= item.price
  item.sold = true
  r.potions.push(item.id)
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
  completedNode.value = run.value?.pos ?? null
  screen.value = 'map'
  saveGame()
}

// --- Cheat console (solo mode only) ------------------------------------------
// Cheats mutate the run directly and clone the combat state like any reducer
// step would, so saves/replays stay consistent. PvP never sees any of this —
// the server validates every move against the shared engine.

/**
 * Apply a cheat to the live combat state (on a clone, like any reducer step).
 * `allowOver` lets HP cheats work during the end-of-combat banner — otherwise
 * applyCombatResult would overwrite them with the stale combat HP.
 */
function withCombat(fn: (cs: CombatState) => void, allowOver = false): boolean {
  const cs = combat.value
  if (!cs || (cs.over && !allowOver)) return false
  const clone = structuredClone(cs)
  fn(clone)
  combat.value = clone
  return true
}

export function cheatFullHeal() {
  const r = run.value
  if (!r) return
  let healed = 0
  const inCombat = withCombat((cs) => {
    healed = cs.player.maxHp - cs.player.hp
    cs.player.hp = cs.player.maxHp
  }, true)
  if (!inCombat) healed = r.maxHp - r.hp
  r.hp = r.maxHp
  // The 'heal' event handler plays the sfx — don't double it here.
  if (healed > 0) processEvents([{ e: 'heal', who: 'p', n: healed }])
  else sfx.click()
  touch()
  saveGame()
}

export function cheatGold() {
  const r = run.value
  if (!r) return
  r.gold += 100
  sfx.buy()
  touch()
  saveGame()
}

export function cheatMaxHp() {
  const r = run.value
  if (!r) return
  r.maxHp += 10
  r.hp += 10
  withCombat((cs) => {
    cs.player.maxHp += 10
    cs.player.hp += 10
  }, true)
  sfx.heal()
  touch()
  saveGame()
}

export function cheatUpgradeAll() {
  const r = run.value
  if (!r) return
  for (const c of r.deck) if (!c.up && CARDS[c.id].rarity !== 'special') c.up = true
  withCombat((cs) => {
    for (const pile of [cs.player.hand, cs.player.draw, cs.player.discard, cs.player.exhausted]) {
      for (const c of pile) if (!c.up && CARDS[c.id].rarity !== 'special') c.up = true
    }
  })
  sfx.buy()
  touch()
  saveGame()
}

export function cheatAddCard(id: string) {
  const r = run.value
  if (!r || !CARDS[id]) return
  addCardToDeck(r, id)
  // Mid-fight, also shuffle a copy into the live discard pile (mirroring the
  // engine's own addCard effect) so the cheat takes effect immediately.
  withCombat((cs) => {
    cs.player.discard.push({ uid: cs.uid++, id, up: false })
  })
  sfx.buy()
  touch()
  saveGame()
}

export function cheatAddRelic(id: string) {
  const r = run.value
  if (!r || r.relics.includes(id)) return
  const hpBefore = r.hp
  const maxBefore = r.maxHp
  addRelic(r, id)
  const dHp = r.hp - hpBefore
  const dMax = r.maxHp - maxBefore
  // Mirror into the live combat: HP grants would otherwise be reverted by
  // applyCombatResult, and per-turn hooks read the combat's relic snapshot.
  withCombat((cs) => {
    cs.player.maxHp += dMax
    cs.player.hp += dHp
    if (!cs.relics.includes(id)) cs.relics.push(id)
  }, true)
  sfx.buy()
  touch()
  saveGame()
}

export function cheatRemoveCard() {
  const r = run.value
  if (!r) return
  cheatOpen.value = false
  picker.value = {
    title: t('removeTitle'),
    cancellable: true,
    onPick: (uid) => {
      removeCard(r, uid)
      picker.value = null
      sfx.buy()
      touch()
      saveGame()
    },
  }
}

export function cheatAddPotion() {
  const r = run.value
  if (!r || r.potions.length >= MAX_POTIONS) return
  r.potions.push(randomPotionId(r))
  sfx.buy()
  touch()
  saveGame()
}

export function cheatKillAll() {
  const evs: { e: 'die'; who: string }[] = []
  const done = withCombat((cs) => {
    cs.enemies.forEach((e, i) => {
      if (!e.dead) {
        e.hp = 0
        e.dead = true
        e.intent = null
        evs.push({ e: 'die', who: 'e' + i })
      }
    })
    cs.over = 'win'
  })
  if (!done) return
  cheatOpen.value = false
  processEvents(evs, { step: 130 })
  saveGame()
}

export function cheatEnergy() {
  withCombat((cs) => {
    cs.player.energy += 3
  })
  sfx.buy()
  saveGame()
}

export function cheatDraw() {
  const evs: import('@neonspire/engine').GameEvent[] = []
  const done = withCombat((cs) => {
    drawCards(cs.player, 3, cs, 'p', evs)
  })
  if (!done) return
  processEvents(evs)
  sfx.play()
  saveGame()
}
