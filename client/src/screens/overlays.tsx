/** Post-combat rewards, shop, rest site, and map events. */
import { RELICS, restHealAmount } from '@neonspire/engine'
import { CardById, TopBar } from '../components'
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
          {def.name} {props.note && <span style={{ color: 'var(--dim)' }}>· {props.note}</span>}
        </div>
        <div class="rdesc">{def.desc}</div>
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
          <h2>▚ SPOILS ▞</h2>
          <div class="sub" style={{ color: 'var(--gold)' }}>
            +{b.gold}¤ recovered
          </div>
          {b.relic && !b.relicTaken && <RelicOffer id={b.relic} note="take" onClick={() => takeRelicReward('relic')} />}
          {b.bossRelic && !b.bossRelicTaken && (
            <RelicOffer id={b.bossRelic} note="boss cache" onClick={() => takeRelicReward('bossRelic')} />
          )}
          {b.cards && !b.cardTaken && (
            <>
              <div class="sub">Add one card to your deck:</div>
              <div class="cardrow">
                {b.cards.map((id) => (
                  <CardById key={id} id={id} onClick={() => takeCardReward(id)} />
                ))}
              </div>
            </>
          )}
          {b.cards && b.cardTaken && <div class="result-lines">Card integrated.</div>}
          <button class="btn" onClick={continueFromReward}>
            {b.afterBoss ? 'DESCEND DEEPER ▶' : 'CONTINUE ▶'}
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
          <h2 class="pink">▚ BLACK MARKET ▞</h2>
          <div class="cardrow">
            {s.cards.map((item, i) => (
              <div key={i} class={`shopitem ${item.sold ? 'sold' : ''}`}>
                <CardById id={item.id} onClick={() => shopBuyCard(i)} />
                <div class="pricetag" style={r.gold < item.price ? { color: 'var(--red)' } : {}}>
                  {item.sold ? 'SOLD' : `${item.price}¤`}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {s.relics.map((item, i) => (
              <div key={i} class={item.sold ? 'sold' : ''} style={item.sold ? { opacity: 0.3, pointerEvents: 'none' } : {}}>
                <RelicOffer id={item.id} note={item.sold ? 'SOLD' : `${item.price}¤`} onClick={() => shopBuyRelic(i)} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '14px' }}>
            <button class="btn purple" disabled={r.gold < s.removePrice} onClick={shopRemoveService}>
              PURGE A CARD · {s.removePrice}¤
            </button>
            <button class="btn ghost" onClick={leaveNode}>
              LEAVE ▶
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
          <h2>▚ SAFEHOUSE ▞</h2>
          <div class="sub">The hum of the city fades. For one moment, nothing is hunting you.</div>
          <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <div class={`bigchoice ${used ? 'disabled' : ''}`} onClick={restHeal}>
              <div class="t">♨ RECHARGE</div>
              <div class="d">Restore {restHealAmount(r)} HP.</div>
            </div>
            <div class={`bigchoice pink ${used ? 'disabled' : ''}`} onClick={restUpgrade}>
              <div class="t">⚙ PATCH</div>
              <div class="d">Upgrade a card in your deck permanently.</div>
            </div>
          </div>
          <button class="btn" onClick={leaveNode}>
            {used ? 'CONTINUE ▶' : 'SKIP ▶'}
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
          <h2 class="pink">{ev.name}</h2>
          <div class="sub">{ev.text}</div>
          {!lines && (
            <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {ev.choices.map((c, i) => {
                const blocked = !!c.needGold && r.gold < c.needGold
                return (
                  <div key={i} class={`bigchoice ${i % 2 ? 'pink' : ''} ${blocked ? 'disabled' : ''}`} onClick={() => chooseEventOption(i)}>
                    <div class="t">{c.label}</div>
                    <div class="d">{c.detail}</div>
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
                CONTINUE ▶
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
