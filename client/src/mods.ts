/**
 * Client mod loader: fetches mods/index.json, validates each manifest through
 * the engine's applyMod, and persists per-mod enable state. JSON only — mods
 * can never execute code.
 */
import { signal } from '@preact/signals'
import { applyMod, removeMod, type ModManifest, type ModReport } from '@neonspire/engine'

export interface ModEntry {
  manifest: ModManifest
  enabled: boolean
  report: ModReport | null
}

export const mods = signal<ModEntry[]>([])

function enabledSet(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem('ns-mods-on') ?? '{}')
  } catch {
    return {}
  }
}

function saveEnabled() {
  const out: Record<string, boolean> = {}
  for (const m of mods.value) out[m.manifest.id] = m.enabled
  try {
    localStorage.setItem('ns-mods-on', JSON.stringify(out))
  } catch {
    /* best-effort */
  }
}

/** Fetch the mods directory and (re)apply everything enabled. */
export async function loadMods() {
  let list: string[] = []
  try {
    list = await fetch('mods/index.json').then((r) => (r.ok ? r.json() : []))
  } catch {
    return // no mods directory — fine
  }
  if (!Array.isArray(list)) return
  const on = enabledSet()
  const entries: ModEntry[] = []
  for (const file of list.slice(0, 32)) {
    try {
      const manifest = (await fetch('mods/' + String(file)).then((r) => r.json())) as ModManifest
      if (!manifest?.id || !manifest?.name) throw new Error('missing id/name')
      const enabled = on[manifest.id] ?? false
      let report: ModReport | null = null
      if (enabled) {
        report = applyMod(manifest)
        for (const w of report.warnings) console.warn('[mods]', w)
      }
      entries.push({ manifest, enabled, report })
    } catch (e) {
      console.warn('[mods] ignored malformed mod', file, e)
    }
  }
  mods.value = entries
}

export function setModEnabled(id: string, enabled: boolean) {
  mods.value = mods.value.map((m) => {
    if (m.manifest.id !== id) return m
    let report = m.report
    if (enabled) {
      report = applyMod(m.manifest)
      for (const w of report.warnings) console.warn('[mods]', w)
    } else {
      removeMod(id)
      report = null
    }
    return { ...m, enabled, report }
  })
  saveEnabled()
}
