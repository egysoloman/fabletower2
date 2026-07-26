/** Deterministic seeded PRNG (mulberry32). State is a plain number so game
 * states serialize to JSON and replay identically on client and server. */
export interface Rng {
  s: number
}

export function rngFromSeed(seed: number): Rng {
  return { s: seed >>> 0 }
}

/** Advances the rng state in place, returns a float in [0, 1). */
export function rand(r: Rng): number {
  r.s = (r.s + 0x6d2b79f5) >>> 0
  let t = r.s
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** Integer in [lo, hi] inclusive. */
export function randInt(r: Rng, lo: number, hi: number): number {
  return lo + Math.floor(rand(r) * (hi - lo + 1))
}

export function pick<T>(r: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rand(r) * arr.length)]
}

export function shuffle<T>(r: Rng, arr: readonly T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand(r) * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function weightedPick<T>(r: Rng, items: readonly T[], weightOf: (t: T) => number): T {
  const total = items.reduce((s, it) => s + Math.max(0, weightOf(it)), 0)
  let roll = rand(r) * total
  for (const it of items) {
    roll -= Math.max(0, weightOf(it))
    if (roll <= 0) return it
  }
  return items[items.length - 1]
}

/** Derive a fresh seed from an rng stream. */
export function deriveSeed(r: Rng): number {
  return Math.floor(rand(r) * 0xffffffff) >>> 0
}
