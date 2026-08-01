/** Post-combat rewards, shop, rest site, and map events. */
import {
  POTIONS,
  RELICS,
  eventChoiceDetail,
  eventChoiceLabel,
  eventName,
  eventText,
  potionDesc,
  potionName,
  relicDesc,
  relicName,
  restHealAmount,
} from '@neonspire/engine'
import { CardById, DeckSummary, TopBar } from '../components'
import { useEffect } from 'preact/hooks'
import { anchorCenter, burst, flyGoldTo, flyMini, flyToDeck, uiRipple } from '../fx'
import { sfx } from '../sfx'
import { Sprite } from '../sprites'
import { t, tf } from '../i18n'

/** Center of the clicked element (for swoop/burst effects). */
function evCenter(e: MouseEvent): { x: number; y: number } {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

function rippleFrom(e: MouseEvent, color = '#00e5ff') {
  const p = evCenter(e)
  uiRipple(p.x, p.y, color)
}
import {
  chooseEventOption,
  continueFromReward,
  descendToRoot,
  jackOut,
  leaveNode,
  restHeal,
  restUpgrade,
  shopBuyCard,
  shopBuyPotion,
  shopBuyRelic,
  shopRemoveService,
  takeBossRelic,
  takeCardReward,
  takePotionReward,
  takeRelicReward,
} from '../game'
import { currentEvent, eventLines, eventRelic, restUsed, reward, run, shop } from '../store'

function RelicOffer(props: { id: string; note?: string; onClick?: (e?: MouseEvent) => void; dim?: boolean }) {
  const def = RELICS[props.id]
  if (!def) return null
  return (
    <div class={`relic-offer ${props.dim ? 'sold' : ''}`} onClick={props.onClick}>
      <div class="rsym">{def.sym}</div>
      <div>
        <div class="rname">
          {relicName(props.id)} {props.note && <span style={{ color: 'var(--dim)' }}>· {props.note}</span>}
        </div>
        <div class="rdesc">{relicDesc(props.id)}</div>
      </div>
    </div>
  )
}

export function RewardScreen() {
  const b = reward.value
  // Coins stream from the spoils panel into the topbar counter on entry.
  useEffect(() => {
    if (!b || b.gold <= 0) return
    const timer = setTimeout(() => {
      flyGoldTo({ x: window.innerWidth / 2, y: window.innerHeight * 0.32 }, b.gold)
    }, 350)
    return () => clearTimeout(timer)
  }, [])

  // Number keys take rewards in display order: boss relics → relic → potion → cards.
  useEffect(() => {
    const cur = reward.value
    if (!cur) return
    const actions: (() => void)[] = []
    if (cur.bossChoices.length > 0 && !cur.bossChoiceTaken) {
      for (const id of cur.bossChoices) actions.push(() => takeBossRelic(id))
    } else if (cur.relic && !cur.relicTaken) {
      actions.push(() => takeRelicReward())
    }
    if (cur.potion && !cur.potionTaken) actions.push(() => takePotionReward())
    if (cur.cards && !cur.cardTaken) for (const id of cur.cards) actions.push(() => takeCardReward(id))
    const onKey = (e: KeyboardEvent) => {
      if (!reward.value) return
      const d = Number(e.key)
      if (d >= 1 && d <= 9 && actions[d - 1]) {
        e.preventDefault()
        actions[d - 1]()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [reward.value])
  if (!b) return null
  return (
    <div class="screen">
      <TopBar />
      <div class="overlay" style={{ position: 'relative', background: 'transparent', flex: 1 }}>
        <div class="panel">
          <h2>{t('spoils')}</h2>
          <div class="sub" style={{ color: 'var(--gold)' }}>
            {tf('recovered', { n: b.gold })}
          </div>
          {b.relic && !b.relicTaken && <RelicOffer
              id={b.relic}
              note={t('takeNote')}
              onClick={(e) => {
                if (e) {
                  const p = evCenter(e)
                  const dest = anchorCenter('relics')
                  if (dest) flyMini(p, dest, '#ffd166')
                  burst(p.x, p.y, '#ffd166', 12, 2.6)
                }
                takeRelicReward()
              }}
            />}
          {b.bossChoices.length > 0 && !b.bossChoiceTaken && (
            <>
              <div class="sub">{t('bossCachePick')}</div>
              {b.bossChoices.map((id) => (
                <RelicOffer
                  key={id}
                  id={id}
                  note={t('bossCache')}
                  onClick={(e) => {
                    if (e) {
                      const p = evCenter(e)
                      const dest = anchorCenter('relics')
                      if (dest) flyMini(p, dest, '#ffd166')
                    }
                    takeBossRelic(id)
                  }}
                />
              ))}
            </>
          )}
          {b.potion && !b.potionTaken && (
            <div
              class="potion-offer"
              onClick={(e) => {
                const p = evCenter(e)
                burst(p.x, p.y, '#3dffa2', 12, 2.8)
                const dest = anchorCenter('belt')
                if (dest) flyMini(p, dest, '#3dffa2')
                takePotionReward()
              }}
            >
              <span class={`potion ${POTIONS[b.potion]?.rarity ?? 'common'}`}>{POTIONS[b.potion]?.sym}</span>
              <span>
                <span class="rname">{potionName(b.potion)}</span>
                <span class="rdesc" style={{ display: 'block' }}>{potionDesc(b.potion)}</span>
              </span>
            </div>
          )}
          {b.cards && !b.cardTaken && (
            <>
              <div class="sub">{t('pickCard')}</div>
              <div class="cardrow">
                {b.cards.map((id, i) => (
                  <div
                    key={id}
                    class="reward-choice"
                    onClick={(e) => {
                      const p = evCenter(e)
                      flyToDeck(p, '#00e5ff')
                      burst(p.x, p.y, '#ffd166', 14, 3)
                      sfx.thunk()
                      takeCardReward(id)
                    }}
                  >
                    <CardById id={id} cls="reveal reward-card" style={{ '--reveal': `${i * 110}ms` } as never} />
                  </div>
                ))}
              </div>
              <DeckSummary deck={run.value?.deck ?? []} />
            </>
          )}
          {b.cards && b.cardTaken && <div class="result-lines">{t('cardIntegrated')}</div>}
          <button
            class="btn"
            onClick={(e) => {
              rippleFrom(e)
              continueFromReward()
            }}
          >
            {b.afterBoss ? t('descend') : t('continueBtn')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ShopScreen() {
  const s = shop.value
  const r = run.value

  // Number keys quick-buy: 1-5 cards, 6-7 relics, 8-9 potions, R = remove service.
  useEffect(() => {
    const cur = shop.value
    const run2 = run.value
    if (!cur || !run2) return
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return
      const d = Number(e.key)
      const tryBuy = (sold: boolean, price: number, fn: () => void) => {
        if (!sold && run2.gold >= price) {
          e.preventDefault()
          fn()
        }
      }
      if (d >= 1 && d <= 5 && cur.cards[d - 1]) {
        const it = cur.cards[d - 1]
        tryBuy(it.sold, it.price, () => shopBuyCard(d - 1))
      } else if (d === 6 || d === 7) {
        const it = cur.relics[d - 6]
        if (it) tryBuy(it.sold, it.price, () => shopBuyRelic(d - 6))
      } else if (d === 8 || d === 9) {
        const it = cur.potions[d - 8]
        if (it) tryBuy(it.sold, it.price, () => shopBuyPotion(d - 8))
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        shopRemoveService()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shop.value])
  if (!s || !r) return null
  return (
    <div class="screen">
      <TopBar />
      <div class="overlay" style={{ position: 'relative', background: 'transparent', flex: 1 }}>
        <div class="panel">
          <h2 class="pink">{t('blackMarket')}</h2>
          <div class="cardrow">
            {s.cards.map((item, i) => (
              <div
                key={i}
                class={`shopitem ${item.sold ? 'sold' : ''}`}
                style={{ '--reveal': `${i * 70}ms` } as never}
                onClick={(e) => {
                  if (item.sold || r.gold < item.price) return
                  const p = evCenter(e)
                  burst(p.x, p.y, '#ffd166', 16, 3.2)
                  flyToDeck(p, '#ffd166')
                  shopBuyCard(i)
                }}
              >
                <CardById id={item.id} />
                <div class="pricetag" style={r.gold < item.price ? { color: 'var(--red)' } : {}}>
                  {item.sold ? t('sold') : `${item.price}¤`}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {s.relics.map((item, i) => (
              <div key={i} class={item.sold ? 'sold' : ''} style={item.sold ? { opacity: 0.3, pointerEvents: 'none' } : {}}>
                <RelicOffer
                  id={item.id}
                  note={item.sold ? t('sold') : `${item.price}¤`}
                  onClick={(e) => {
                    if (item.sold || r.gold < item.price) return
                    if (e) {
                      const p = evCenter(e)
                      burst(p.x, p.y, '#ffd166', 16, 3.2)
                    }
                    shopBuyRelic(i)
                  }}
                />
              </div>
            ))}
          </div>
          {s.potions.length > 0 && (
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {s.potions.map((item, i) => (
                <div
                  key={i}
                  class={`potion-offer ${item.sold ? 'sold' : ''}`}
                  onClick={(e) => {
                    if (item.sold || r.gold < item.price) return
                    const p = evCenter(e)
                    burst(p.x, p.y, '#3dffa2', 12, 2.8)
                    shopBuyPotion(i)
                  }}
                >
                  <span class={`potion ${POTIONS[item.id]?.rarity ?? 'common'}`}>{POTIONS[item.id]?.sym}</span>
                  <span>
                    <span class="rname">
                      {potionName(item.id)}{' '}
                      <span style={{ color: r.gold < item.price ? 'var(--red)' : 'var(--dim)' }}>
                        · {item.sold ? t('sold') : `${item.price}¤`}
                      </span>
                    </span>
                    <span class="rdesc" style={{ display: 'block' }}>{potionDesc(item.id)}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: '14px' }}>
            <button class="btn purple" disabled={r.gold < s.removePrice} onClick={shopRemoveService}>
              {tf('purgeBtn', { n: s.removePrice })}
            </button>
            <button
              class="btn ghost"
              onClick={(e) => {
                rippleFrom(e)
                leaveNode()
              }}
            >
              {t('leave')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function RestScreen() {
  const r = run.value
  if (!r) return null
  const used = restUsed.value
  return (
    <div class="screen">
      <TopBar />
      <div class="overlay" style={{ position: 'relative', background: 'transparent', flex: 1 }}>
        <div class="panel">
          <h2>{t('safehouse')}</h2>
          <div class="sub">{t('safehouseText')}</div>
          <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <div
              class={`bigchoice pop-in ${used ? 'disabled' : ''}`}
              style={{ '--i': 0 } as never}
              onClick={(e) => {
                const p = evCenter(e)
                burst(p.x, p.y, '#3dffa2', 18, 3)
                uiRipple(p.x, p.y, '#3dffa2')
                restHeal()
              }}
            >
              <div class="t">{t('recharge')}</div>
              <div class="d">{tf('rechargeDesc', { n: restHealAmount(r) })}</div>
            </div>
            <div class={`bigchoice pop-in pink ${used ? 'disabled' : ''}`} style={{ '--i': 1 } as never} onClick={restUpgrade}>
              <div class="t">{t('patch')}</div>
              <div class="d">{t('patchDesc')}</div>
            </div>
          </div>
          <button
            class="btn"
            onClick={(e) => {
              rippleFrom(e)
              leaveNode()
            }}
          >
            {used ? t('continueBtn') : t('skip')}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Post-Act-3 crossroads: take the win, or descend into THE ROOT. */
export function DescendScreen() {
  const r = run.value
  if (!r) return null
  return (
    <div class="screen">
      <TopBar />
      <div class="overlay" style={{ position: 'relative', background: 'transparent', flex: 1 }}>
        <div class="panel">
          <div class="event-glyph descend-glyph">
            <Sprite id="ev-descend" size={68} />
          </div>
          <h2 class="pink">{t('descendTitle')}</h2>
          <div class="sub">{t('descendText')}</div>
          <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <div class="bigchoice pop-in pink" style={{ '--i': 0 } as never} onClick={() => descendToRoot()}>
              <div class="t">{t('descendGo')}</div>
              <div class="d">{t('descendGoDetail')}</div>
            </div>
            <div class="bigchoice pop-in" style={{ '--i': 1 } as never} onClick={() => jackOut()}>
              <div class="t">{t('descendLeave')}</div>
              <div class="d">{t('descendLeaveDetail')}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function EventScreen() {
  const ev = currentEvent.value
  const r = run.value
  if (!ev || !r) return null
  const lines = eventLines.value
  return (
    <div class="screen">
      <TopBar />
      <div class="overlay" style={{ position: 'relative', background: 'transparent', flex: 1 }}>
        <div class="panel">
          <div class="event-glyph">
            <Sprite id={'ev-' + ev.id} size={68} />
          </div>
          <h2 class="pink">{eventName(ev)}</h2>
          <div class="sub">{eventText(ev)}</div>
          {!lines && (
            <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {ev.choices.map((c, i) => {
                const blocked = !!c.needGold && r.gold < c.needGold
                return (
                  <div key={i} class={`bigchoice pop-in ${i % 2 ? 'pink' : ''} ${blocked ? 'disabled' : ''}`} style={{ '--i': i } as never} onClick={() => chooseEventOption(i)}>
                    <div class="t">{eventChoiceLabel(ev, i)}</div>
                    <div class="d">{eventChoiceDetail(ev, i)}</div>
                  </div>
                )
              })}
            </div>
          )}
          {lines && (
            <>
              <div class="result-lines">
                {lines.map((l, i) => (
                  <div key={i} style={{ '--i': i } as never}>▸ {l}</div>
                ))}
              </div>
              {eventRelic.value && (
                <div style={{ marginTop: '6px' }}>
                  <RelicOffer id={eventRelic.value} />
                </div>
              )}
              <button
                class="btn"
                onClick={(e) => {
                  rippleFrom(e)
                  leaveNode()
                }}
              >
                {t('continueBtn')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
