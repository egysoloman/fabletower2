/** Tiny WebAudio synth for UI feedback — no audio assets needed. */
import { signal } from '@preact/signals'

export const muted = signal(localStorage.getItem('ns-mute') === '1')

export function toggleMute() {
  muted.value = !muted.value
  localStorage.setItem('ns-mute', muted.value ? '1' : '0')
}

let ctx: AudioContext | null = null

function ac(): AudioContext | null {
  try {
    if (!ctx) ctx = new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function blip(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.04, slide = 0) {
  if (muted.value) return
  const a = ac()
  if (!a) return
  try {
    const o = a.createOscillator()
    const g = a.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, a.currentTime)
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), a.currentTime + dur)
    g.gain.setValueAtTime(vol, a.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur)
    o.connect(g).connect(a.destination)
    o.start()
    o.stop(a.currentTime + dur + 0.02)
  } catch {
    /* audio is never load-bearing */
  }
}

export const sfx = {
  click: () => blip(880, 0.05, 'square', 0.02),
  play: () => blip(480, 0.12, 'sawtooth', 0.03, 320),
  hit: () => blip(170, 0.16, 'sawtooth', 0.05, -90),
  block: () => blip(300, 0.1, 'triangle', 0.05, -60),
  heal: () => blip(620, 0.16, 'sine', 0.04, 240),
  buy: () => {
    blip(700, 0.07, 'square', 0.03)
    setTimeout(() => blip(1050, 0.09, 'square', 0.03), 70)
  },
  win: () => {
    blip(523, 0.12, 'square', 0.035)
    setTimeout(() => blip(659, 0.12, 'square', 0.035), 110)
    setTimeout(() => blip(784, 0.22, 'square', 0.035), 220)
  },
  lose: () => {
    blip(330, 0.22, 'sawtooth', 0.05, -140)
    setTimeout(() => blip(210, 0.35, 'sawtooth', 0.05, -110), 220)
  },
}
