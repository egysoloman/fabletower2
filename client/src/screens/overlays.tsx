/** Post-combat rewards, shop, rest site, and map events. */
import {
  RELICS,
  eventChoiceDetail,
  eventChoiceLabel,
  eventName,
  eventText,
  relicDesc,
  relicName,
  restHealAmount,
} from '@neonspire/engine'
import { CardById, TopBar } from '../components'
import { burst, flyToDeck, uiRipple } from '../fx'
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
  leaveNode,
  restHeal,
  restUpgrade,
  shopBuyCard,
  shopBuyRelic,
  shopRemoveService,
  takeCardReward,
  takeRelicReward,
} from '../game'
import { currentEvent, eventLines, restUsed, reward, run, shop } from '../store'

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
          {b.relic && !b.relicTaken && (
            <RelicOffer id={b.relic} note={t('takeNote')} onClick={() => takeRelicReward('relic')} />
          )}
          {b.bossRelic && !b.bossRelicTaken && (
            <RelicOffer id={b.bossRelic} note={t('bossCache')} onClick={() => takeRelicReward('bossRelic')} />
          )}
          {b.cards && !b.cardTaken && (
            <>
              <div class="sub">{t('pickCard')}</div>
              <div class="cardrow">
                {b.cards.map((id, i) => (
                  <div
                    key={id}
                    onClick={(e) => {
                      const p = evCenter(e)
                      flyToDeck(p, '#00e5ff')
                      burst(p.x, p.y, '#ffd166', 14, 3)
                      sfx.thunk()
                      takeCardReward(id)
                    }}
                  >
                    <CardById id={id} cls="reveal" style={{ '--reveal': `${i * 110}ms` } as never} />
                  </div>
                ))}
              </div>
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
              class={`bigchoice ${used ? 'disabled' : ''}`}
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
            <div class={`bigchoice pink ${used ? 'disabled' : ''}`} onClick={restUpgrade}>
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
                  <div key={i} class={`bigchoice ${i % 2 ? 'pink' : ''} ${blocked ? 'disabled' : ''}`} onClick={() => chooseEventOption(i)}>
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
                  <div key={i}>▸ {l}</div>
                ))}
              </div>
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
