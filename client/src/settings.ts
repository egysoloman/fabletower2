/** Player settings, persisted locally and applied app-wide. */
import { signal } from '@preact/signals'

export interface Settings {
  master: number // 0..1
  sfx: number // 0..1
  quality: 'high' | 'medium' | 'low'
  shake: boolean
}

const DEFAULTS: Settings = { master: 1, sfx: 1, quality: 'high', shake: true }

function load(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('ns-settings') ?? '{}') }
  } catch {
    return { ...DEFAULTS }
  }
}

export const settings = signal<Settings>(load())

export function setSetting<K extends keyof Settings>(k: K, v: Settings[K]) {
  settings.value = { ...settings.value, [k]: v }
  try {
    localStorage.setItem('ns-settings', JSON.stringify(settings.value))
  } catch {
    /* best-effort */
  }
}

/** Particle budget multiplier for the fx layer. */
export function qualityFactor(): number {
  const q = settings.value.quality
  return q === 'high' ? 1 : q === 'medium' ? 0.5 : 0.2
}
