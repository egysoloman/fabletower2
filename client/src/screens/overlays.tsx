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
import { t, tf } from '../i18n'
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

function RelicOffer(props: { id: string; note?: string; onClick?: () => void; dim?: boolean }) {
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
                {b.cards.map((id) => (
                  <CardById key={id} id={id} onClick={() => takeCardReward(id)} />
                ))}
              </div>
            </>
          )}
          {b.cards && b.cardTaken && <div class="result-lines">{t('cardIntegrated')}</div>}
          <button class="btn" onClick={continueFromReward}>
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
              <div key={i} class={`shopitem ${item.sold ? 'sold' : ''}`}>
                <CardById id={item.id} onClick={() => shopBuyCard(i)} />
                <div class="pricetag" style={r.gold < item.price ? { color: 'var(--red)' } : {}}>
                  {item.sold ? t('sold') : `${item.price}¤`}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {s.relics.map((item, i) => (
              <div key={i} class={item.sold ? 'sold' : ''} style={item.sold ? { opacity: 0.3, pointerEvents: 'none' } : {}}>
                <RelicOffer id={item.id} note={item.sold ? t('sold') : `${item.price}¤`} onClick={() => shopBuyRelic(i)} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '14px' }}>
            <button class="btn purple" disabled={r.gold < s.removePrice} onClick={shopRemoveService}>
              {tf('purgeBtn', { n: s.removePrice })}
            </button>
            <button class="btn ghost" onClick={leaveNode}>
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
            <div class={`bigchoice ${used ? 'disabled' : ''}`} onClick={restHeal}>
              <div class="t">{t('recharge')}</div>
              <div class="d">{tf('rechargeDesc', { n: restHealAmount(r) })}</div>
            </div>
            <div class={`bigchoice pink ${used ? 'disabled' : ''}`} onClick={restUpgrade}>
              <div class="t">{t('patch')}</div>
              <div class="d">{t('patchDesc')}</div>
            </div>
          </div>
          <button class="btn" onClick={leaveNode}>
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
          <div class="event-glyph">{ev.glyph}</div>
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
              <button class="btn" onClick={leaveNode}>
                {t('continueBtn')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
