/** Player settings, persisted locally and applied app-wide. */
import { signal } from '@preact/signals'

export interface Settings {
  master: number // 0..1
  sfx: number // 0..1
  quality: 'high' | 'medium' | 'low'
  shake: boolean
  /** Lock browser zoom (pinch / double-tap) — handy on touch screens. */
  zoomLock: boolean
  /** Colorblind-friendly presentation: shapes + shifted hues, not just color. */
  colorblind: boolean
}

const DEFAULTS: Settings = { master: 1, sfx: 1, quality: 'high', shake: true, zoomLock: true, colorblind: false }

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
  if (k === 'zoomLock') applyZoomLock()
  if (k === 'colorblind') applyColorblind()
}

/** Toggle the colorblind presentation class on <html>. */
export function applyColorblind() {
  document.documentElement.classList.toggle('cb', settings.value.colorblind)
}

// Apply persisted settings on startup.
applyZoomLock()
applyColorblind()

/**
 * Apply the zoom-lock setting: rewrite the viewport meta (mobile browsers)
 * and set touch-action so pinch/double-tap zoom stops reaching the page.
 */
export function applyZoomLock() {
  const lock = settings.value.zoomLock
  const meta = document.querySelector('meta[name="viewport"]')
  if (meta) {
    meta.setAttribute(
      'content',
      lock ? 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no' : 'width=device-width, initial-scale=1.0',
    )
  }
  document.documentElement.style.touchAction = lock ? 'pan-x pan-y' : ''
}

/** Particle budget multiplier for the fx layer. */
export function qualityFactor(): number {
  const q = settings.value.quality
  return q === 'high' ? 1 : q === 'medium' ? 0.5 : 0.2
}

/** PWA install prompt captured from beforeinstallprompt (null = unavailable). */
export const installPrompt = signal<{ prompt: () => Promise<unknown> } | null>(null)
/** Live connectivity for the offline indicator. */
export const netOnline = signal(typeof navigator === 'undefined' ? true : navigator.onLine)
