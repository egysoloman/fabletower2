/**
 * Multiplayer connection profile — the CLOUD / LAN split.
 *
 * CLOUD play targets the cloud server configured in Settings ▸ Account (the
 * same server that holds accounts, saves and leaderboards). Logged-in players
 * are identified automatically: their account nickname plus the
 * server-assigned visitor id (name#vid) — nothing to type. Guests keep a
 * persisted handle.
 *
 * LAN play is fully manual and lives in the battle screens: a ws:// address
 * for a local-network server plus a typed handle.
 */
import { signal } from '@preact/signals'
import { EMOTES, type EmoteDef } from '@neonspire/engine'
import { account, apiBase, cloudUrl } from './account'
import { pingAnchor, showEmoteAt } from './fx'
import { lang } from './i18n'
import { sfx } from './sfx'

export type MpTarget = 'cloud' | 'lan'

function stored(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

export const mpTarget = signal<MpTarget>(stored('ns-mp-target', 'cloud') === 'lan' ? 'lan' : 'cloud')
export const lanUrl = signal(stored('ns-lan-url', 'ws://localhost:8787'))
export const guestName = signal(stored('ns-nick', 'RUNNER'))

function persist(key: string, v: string) {
  try {
    localStorage.setItem(key, v)
  } catch {
    /* best-effort */
  }
}

export function setMpTarget(v: MpTarget) {
  mpTarget.value = v
  persist('ns-mp-target', v)
}

export function setLanUrl(v: string) {
  lanUrl.value = v
  persist('ns-lan-url', v)
}

export function setGuestName(v: string) {
  guestName.value = v
  persist('ns-nick', v)
}

/** ws endpoint for the chosen target. */
export function mpWsUrl(): string {
  if (mpTarget.value === 'lan') return lanUrl.value.trim() || 'ws://localhost:8787'
  const base = apiBase()
  if (base) return base.replace(/^http/, 'ws')
  const loc = window.location
  return `${loc.protocol === 'https:' ? 'wss:' : 'ws:'}//${loc.host}`
}

/** Handle sent to the server: account nickname on cloud, typed handle on LAN. */
export function mpName(): string {
  if (mpTarget.value === 'cloud' && account.value) return account.value.name
  return guestName.value.trim() || 'RUNNER'
}

/** Human-readable label of where CLOUD play connects. */
export function cloudLabel(): string {
  const c = cloudUrl.value || apiBase()
  if (c) return c.replace(/^(https?|wss?):\/\//, '')
  return window.location.host || 'this site'
}

// --- Emotes ------------------------------------------------------------------

export function emoteText(def: EmoteDef): string {
  return lang.value === 'zh' && def.zh ? def.zh : def.text
}

/**
 * Render an incoming emote. Untargeted: bubble over the sender's zone.
 * Targeted (clicked target or dragged onto a head): the bubble lands on the
 * TARGET — ally/opponent zone or enemy — credited to the sender, with a ping.
 * Unknown modded ids fall back to raw text.
 */
export function showIncomingEmote(
  data: { who: number; name: string; id?: string; text?: string; target?: number | null; etarget?: number | null },
  anchorOf: (idx: number) => string,
  enemyAnchorOf?: (idx: number) => string,
) {
  const def = data.id ? EMOTES[data.id] : undefined
  const sym = def?.sym ?? '❝'
  const text = def ? emoteText(def) : String(data.text ?? '')
  if (!def && !text) return
  if (data.etarget != null && enemyAnchorOf) {
    const at = enemyAnchorOf(data.etarget)
    showEmoteAt(at, sym, text, data.name)
    pingAnchor(at, '#ff3b5b')
  } else if (data.target != null && data.target !== data.who) {
    const at = anchorOf(data.target)
    showEmoteAt(at, sym, text, data.name)
    pingAnchor(at, '#ffd166')
  } else {
    showEmoteAt(anchorOf(data.who), sym, text, data.name)
  }
  sfx.click()
}
