/**
 * Character selection — richer than a menu row: animated portrait cards with
 * lore, archetype hints, starting-relic previews, 1-5 difficulty stars,
 * unlockable color palettes (earned by winning runs, tracked locally), a
 * weighted random pick, and full keyboard navigation (←/→ cycle, Enter
 * starts, R rolls random).
 */
import { useEffect, useRef, useState } from 'preact/hooks'
import { RELICS, relicDesc, relicName, STARTER_RELICS, type CharId } from '@neonspire/engine'
import { runHistory } from '../game'
import { sfx } from '../sfx'
import { t } from '../i18n'
import { Sprite } from '../sprites'

export const CHAR_ORDER: CharId[] = ['runner', 'vector', 'ghost', 'array']

export interface CharMeta {
  diff: number
  palettes: string[]
}

export const CHAR_META: Record<CharId, CharMeta> = {
  runner: { diff: 1, palettes: ['#00e5ff', '#3da5ff', '#b7ffe9'] },
  vector: { diff: 3, palettes: ['#ff9e2d', '#ff5d2d', '#ffd166'] },
  ghost: { diff: 4, palettes: ['#b98cff', '#7f5dff', '#ff8cf0'] },
  array: { diff: 2, palettes: ['#3dffa2', '#00c176', '#c8ff5d'] },
}

// --- Palette persistence & unlocks ------------------------------------------

function palKey() {
  return 'ns-pal'
}

function selectedPalettes(): Partial<Record<CharId, number>> {
  try {
    return JSON.parse(localStorage.getItem(palKey()) ?? '{}')
  } catch {
    return {}
  }
}

export function paletteIdx(char: CharId): number {
  return selectedPalettes()[char] ?? 0
}

function setPaletteIdx(char: CharId, idx: number) {
  try {
    const all = selectedPalettes()
    all[char] = idx
    localStorage.setItem(palKey(), JSON.stringify(all))
  } catch {
    /* best-effort */
  }
}

/** The character's current display color (their selected unlocked palette). */
export function charColor(char: CharId): string {
  const meta = CHAR_META[char]
  return meta.palettes[Math.min(paletteIdx(char), meta.palettes.length - 1)]
}

/** Palette 0 is free; 1 unlocks on any win; 2 on an A5+ win (per character). */
export function unlockedPalettes(char: CharId): number {
  const hist = runHistory()
  const wins = hist.filter((h) => h.win && (h.ch ?? 'runner') === char)
  if (wins.some((h) => h.asc >= 5)) return 3
  if (wins.length > 0) return 2
  return 1
}

/** Weighted random: characters you've played less come up more. */
export function weightedRandomChar(): CharId {
  const hist = runHistory()
  const weights = CHAR_ORDER.map((c) => 1 / (1 + hist.filter((h) => (h.ch ?? 'runner') === c).length))
  const total = weights.reduce((a, b) => a + b, 0)
  let roll = Math.random() * total
  for (let i = 0; i < CHAR_ORDER.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return CHAR_ORDER[i]
  }
  return CHAR_ORDER[CHAR_ORDER.length - 1]
}

// --- Component ---------------------------------------------------------------

export function CharSelect(props: { value: CharId; onChange: (c: CharId) => void; onStart?: () => void }) {
  const { value, onChange } = props
  const [rolling, setRolling] = useState(false)
  const [, bump] = useState(0)
  const rollTimer = useRef<number>()
  // Rapid key presses must see the freshest selection, not a stale closure.
  const live = useRef({ value, rolling, onChange, onStart: props.onStart })
  live.current = { value, rolling, onChange, onStart: props.onStart }

  const rollRandom = () => {
    if (live.current.rolling) return
    setRolling(true)
    live.current.rolling = true
    sfx.whoosh()
    const final = weightedRandomChar()
    let hops = 8 + CHAR_ORDER.indexOf(final)
    const spin = () => {
      live.current.onChange(CHAR_ORDER[(CHAR_ORDER.indexOf(live.current.value) + 1) % CHAR_ORDER.length])
      hops--
      if (hops > 0) {
        rollTimer.current = window.setTimeout(spin, 60 + (8 - Math.min(hops, 8)) * 30)
      } else {
        live.current.onChange(final)
        setRolling(false)
        sfx.win()
      }
    }
    spin()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      const cur = live.current
      const at = CHAR_ORDER.indexOf(cur.value)
      if (e.key === 'ArrowRight') cur.onChange(CHAR_ORDER[(at + 1) % CHAR_ORDER.length])
      else if (e.key === 'ArrowLeft') cur.onChange(CHAR_ORDER[(at + CHAR_ORDER.length - 1) % CHAR_ORDER.length])
      else if (e.key === 'r' || e.key === 'R') rollRandom()
      else if (e.key === 'Enter' && cur.onStart) cur.onStart()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => () => clearTimeout(rollTimer.current), [])

  const meta = CHAR_META[value]
  const relicId = STARTER_RELICS[value]
  const unlocked = unlockedPalettes(value)
  const palIdx = Math.min(paletteIdx(value), unlocked - 1)
  const color = meta.palettes[palIdx]

  return (
    <div class="charsel" style={{ '--cc': color }}>
      <div class="charrow">
        {CHAR_ORDER.map((c) => (
          <div
            key={c}
            class={`charcard ${c} ${value === c ? 'picked' : ''} ${rolling ? 'rolling' : ''}`}
            style={value === c ? { color } : undefined}
            onClick={() => (sfx.click(), onChange(c))}
          >
            <Sprite id={c} size={46} />
            <div>
              <div class="cname-h">{t(charKey(c))}</div>
              <div class="cdesc-h">{t((charKey(c) + 'Desc') as Parameters<typeof t>[0])}</div>
            </div>
          </div>
        ))}
        <button class={`btn ghost randbtn ${rolling ? 'spin' : ''}`} data-tip={t('randomTip')} onClick={rollRandom}>
          ⚄
        </button>
      </div>

      <div class="chardetail" key={value}>
        <div class="cd-left">
          <div class="cd-arch">{t(('arch_' + value) as Parameters<typeof t>[0])}</div>
          <div class="cd-diff" data-tip={t('diffTip')}>
            {'★'.repeat(meta.diff)}
            <span class="off">{'★'.repeat(5 - meta.diff)}</span>
          </div>
          <div class="cd-lore">{t(('lore_' + value) as Parameters<typeof t>[0])}</div>
        </div>
        <div class="cd-right">
          <div class="cd-relic" data-tip={relicDesc(relicId)}>
            <span class="rsym">{RELICS[relicId]?.sym}</span>
            <span>
              <b>{relicName(relicId)}</b>
              <small>{relicDesc(relicId)}</small>
            </span>
          </div>
          <div class="cd-pals">
            {meta.palettes.map((p, i) => (
              <div
                key={i}
                class={`pal ${i === palIdx ? 'on' : ''} ${i >= unlocked ? 'locked' : ''}`}
                style={{ background: p }}
                data-tip={i >= unlocked ? t(i === 1 ? 'palLockWin' : 'palLockA5') : t('palPick')}
                onClick={() => {
                  if (i < unlocked) {
                    setPaletteIdx(value, i)
                    sfx.click()
                    bump((n) => n + 1)
                  }
                }}
              >
                {i >= unlocked ? '⚿' : ''}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function charKey(c: CharId) {
  return ('char' + c[0].toUpperCase() + c.slice(1)) as Parameters<typeof t>[0]
}
