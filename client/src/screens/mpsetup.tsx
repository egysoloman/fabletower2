/**
 * Shared multiplayer widgets: the CLOUD/LAN connection block used by every
 * battle-entry screen, and the emote / quick-phrase panel used inside them.
 */
import { useEffect, useState } from 'preact/hooks'
import { emoteList, type CharId } from '@neonspire/engine'
import { account } from '../account'
import { anchorBox } from '../fx'
import { cloudLabel, emoteText, guestName, lanUrl, mpTarget, setGuestName, setLanUrl, setMpTarget } from '../mp'
import { mods, modsKey } from '../mods'
import { t, tf } from '../i18n'
import { sfx } from '../sfx'
import { Sprite } from '../sprites'
import { CharSelect, charColor, setLastChar } from './charselect'

/**
 * Dedicated character-selection page for multiplayer modes: the same full
 * selector as solo (lore, difficulty, starter relic, palettes), opened from
 * a compact button on the battle-entry screens.
 */
export function CharSelectPage(props: { value: CharId; onChange: (c: CharId) => void; onDone: () => void }) {
  return (
    <div class="screen menu">
      <div class="logo" style={{ fontSize: 'clamp(26px,5vw,44px)' }}>
        SELECT<span>UNIT</span>
      </div>
      <CharSelect
        value={props.value}
        onChange={(c) => {
          setLastChar(c)
          props.onChange(c)
        }}
        onStart={props.onDone}
      />
      <div class="menu-buttons">
        <button class="btn big pink" onClick={() => (sfx.click(), props.onDone())}>
          {t('charConfirm')}
        </button>
      </div>
    </div>
  )
}

/** Compact "current character" button that opens the selection page. */
export function CharPickButton(props: { char: CharId; onOpen: () => void }) {
  const col = charColor(props.char)
  const label = t(('char' + props.char[0].toUpperCase() + props.char.slice(1)) as Parameters<typeof t>[0])
  return (
    <button class="btn charpickbtn" style={{ borderColor: col, color: col }} onClick={() => (sfx.click(), props.onOpen())}>
      <Sprite id={props.char} size={26} />
      <b>{label}</b>
      <span class="cp-change">▸ {t('charChange')}</span>
    </button>
  )
}

/** CLOUD/LAN toggle + the inputs each target actually needs. */
export function MpConnect() {
  const target = mpTarget.value
  const acc = account.value
  const enabledMods = mods.value.filter((m) => m.enabled)
  return (
    <div class="mpconnect">
      <div class="mp-row" style={{ justifyContent: 'center' }}>
        <button class={`btn ghost ${target === 'cloud' ? 'on' : ''}`} onClick={() => (sfx.click(), setMpTarget('cloud'))}>
          ◍ {t('mpCloud')}
        </button>
        <button class={`btn ghost ${target === 'lan' ? 'on' : ''}`} onClick={() => (sfx.click(), setMpTarget('lan'))}>
          ⌂ {t('mpLan')}
        </button>
      </div>
      {target === 'cloud' ? (
        <>
          <div class="sub mp-serverline">{tf('mpServerLine', { host: cloudLabel() })}</div>
          {acc ? (
            <div class="sub" style={{ color: 'var(--green)' }}>{tf('mpPlayingAs', { name: acc.name })}</div>
          ) : (
            <>
              <input
                class="neon"
                style={{ width: '300px' }}
                value={guestName.value}
                maxLength={16}
                onInput={(e) => setGuestName((e.target as HTMLInputElement).value)}
                placeholder={t('handlePlaceholder')}
              />
              <div class="sub mp-hint">{t('mpCloudGuestHint')}</div>
            </>
          )}
        </>
      ) : (
        <>
          <input
            class="neon"
            style={{ width: '300px' }}
            value={lanUrl.value}
            onInput={(e) => setLanUrl((e.target as HTMLInputElement).value)}
            placeholder="ws://192.168.x.x:8787"
          />
          <input
            class="neon"
            style={{ width: '300px' }}
            value={guestName.value}
            maxLength={16}
            onInput={(e) => setGuestName((e.target as HTMLInputElement).value)}
            placeholder={t('handlePlaceholder')}
          />
          <div class="sub mp-hint">{t('mpLanHint')}</div>
        </>
      )}
      {enabledMods.length > 0 && (
        <div class="sub mp-hint" style={{ color: 'var(--gold)' }} data-tip={t('mpModsMatchHint')}>
          {tf('mpModsLine', { mods: enabledMods.map((m) => m.manifest.name).join(' + ') })}
        </div>
      )}
    </div>
  )
}

/** Payload sent with every queue message so the server can gate by mods. */
export function queueIdentity() {
  return { modsKey: modsKey() }
}

/**
 * Compact emote / quick-phrase sender. Emotes fire directly, at a chosen
 * target, or — when dropZones are supplied — by dragging one onto an
 * ally/enemy head. The input row sends free-typed phrases. Mods extend the
 * emote grid through their `emotes` section.
 */
export function EmotePanel(props: {
  send: (m: { id?: string; text?: string; target?: number; etarget?: number }) => void
  targets?: { idx: number; name: string }[]
  /** Drop targets for drag-to-head emotes: fighter anchors + payload patch. */
  dropZones?: { anchor: string; payload: Record<string, number> }[]
}) {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState('')
  const [target, setTarget] = useState<number | null>(null)
  const [drag, setDrag] = useState<{ id: string; sym: string; x: number; y: number; moved: boolean } | null>(null)
  const fire = (m: { id?: string; text?: string; target?: number; etarget?: number }) => {
    props.send({ ...(target !== null && m.target === undefined && m.etarget === undefined ? { target } : {}), ...m })
    sfx.click()
    setOpen(false)
  }
  // outline the drop candidates while an emote is being dragged
  useEffect(() => {
    document.body.classList.toggle('emote-dragging', !!drag?.moved)
    return () => document.body.classList.remove('emote-dragging')
  }, [!!drag?.moved])
  const draggable = (props.dropZones?.length ?? 0) > 0
  const onDown = (e: { id: string; sym: string }) => (ev: PointerEvent) => {
    if (!draggable) return
    ;(ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId)
    setDrag({ id: e.id, sym: e.sym, x: ev.clientX, y: ev.clientY, moved: false })
  }
  const onMove = (ev: PointerEvent) => {
    setDrag((d) => {
      if (!d) return d
      const moved = d.moved || Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > 10
      return { ...d, x: ev.clientX, y: ev.clientY, moved }
    })
  }
  const onUp = (ev: PointerEvent) => {
    setDrag((d) => {
      if (!d) return null
      if (!d.moved) {
        fire({ id: d.id })
        return null
      }
      for (const z of props.dropZones ?? []) {
        const box = anchorBox(z.anchor)
        if (box && ev.clientX >= box.left && ev.clientX <= box.right && ev.clientY >= box.top && ev.clientY <= box.bottom) {
          fire({ id: d.id, ...z.payload })
          break
        }
      }
      return null
    })
  }
  return (
    <div class="emotewrap">
      {open && (
        <div class="emotepanel popin">
          {props.targets && props.targets.length > 0 && (
            <div class="emotetargets">
              <button class={`btn ghost ${target === null ? 'on' : ''}`} onClick={() => setTarget(null)}>
                {t('emoteAll')}
              </button>
              {props.targets.map((tg) => (
                <button key={tg.idx} class={`btn ghost ${target === tg.idx ? 'on' : ''}`} onClick={() => setTarget(tg.idx)}>
                  ▸ {tg.name}
                </button>
              ))}
            </div>
          )}
          {draggable && <div class="sub" style={{ fontSize: '10px' }}>{t('emoteDragHint')}</div>}
          <div class="emotegrid">
            {emoteList().map((e) => (
              <button
                key={e.id}
                class="emotebtn"
                onClick={draggable ? undefined : () => fire({ id: e.id })}
                onPointerDown={draggable ? (onDown(e) as never) : undefined}
                onPointerMove={draggable ? (onMove as never) : undefined}
                onPointerUp={draggable ? (onUp as never) : undefined}
              >
                <b>{e.sym}</b>
                <small>{emoteText(e)}</small>
              </button>
            ))}
          </div>
          {drag?.moved && (
            <div class="emote-ghost" style={{ left: drag.x + 'px', top: drag.y + 'px' }}>
              {drag.sym}
            </div>
          )}
          <form
            class="emoterow"
            onSubmit={(ev) => {
              ev.preventDefault()
              const txt = custom.trim().slice(0, 40)
              if (txt) {
                fire({ text: txt })
                setCustom('')
              }
            }}
          >
            <input
              class="neon"
              value={custom}
              maxLength={40}
              placeholder={t('emoteTypePh')}
              onInput={(e) => setCustom((e.target as HTMLInputElement).value)}
            />
            <button class="btn" type="submit">
              {t('emoteSend')}
            </button>
          </form>
        </div>
      )}
      <button class="btn ghost emotetoggle" onClick={() => (sfx.click(), setOpen(!open))}>
        ❝ {t('emoteBtn')}
      </button>
    </div>
  )
}

export { showIncomingEmote } from '../mp'
