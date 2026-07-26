import { useState } from 'preact/hooks'
import { newGame } from '../game'
import { hasSave, loadGame, screen } from '../store'
import { muted, sfx, toggleMute } from '../sfx'

export function MenuScreen() {
  const [seedText, setSeedText] = useState('')
  const canContinue = hasSave()

  const start = () => {
    sfx.click()
    const trimmed = seedText.trim()
    newGame(trimmed ? hashSeed(trimmed) : undefined)
  }

  return (
    <div class="screen menu">
      <div>
        <div class="logo">
          NEON<span>SPIRE</span>
        </div>
        <div class="tagline" style={{ textAlign: 'center', marginTop: '10px' }}>
          jack in · climb · flatline
        </div>
      </div>

      <div class="menu-buttons">
        {canContinue && (
          <button
            class="btn big"
            onClick={() => {
              sfx.click()
              if (!loadGame()) newGame()
            }}
          >
            ▶ CONTINUE RUN
          </button>
        )}
        <button class="btn big pink" onClick={start}>
          NEW RUN
        </button>
        <button
          class="btn big purple"
          onClick={() => {
            sfx.click()
            screen.value = 'pvp'
          }}
        >
          PVP DUEL
        </button>
        <div class="seedrow">
          <input
            class="neon"
            placeholder="seed (optional)"
            value={seedText}
            onInput={(e) => setSeedText((e.target as HTMLInputElement).value)}
          />
          <button class="btn ghost" onClick={toggleMute}>
            {muted.value ? '🔇' : '🔊'}
          </button>
        </div>
      </div>

      <small style={{ maxWidth: '460px', textAlign: 'center', lineHeight: 1.6 }}>
        Solo mode runs 100% in your browser — no server needed. Climb 3 acts of the
        Spire, build your deck, and delete THE ARCHITECT. PvP needs the NEONSPIRE
        relay server.
      </small>
    </div>
  )
}

function hashSeed(s: string): number {
  const asNum = Number(s)
  if (Number.isFinite(asNum) && s.length > 0 && /^\d+$/.test(s)) return asNum >>> 0
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
