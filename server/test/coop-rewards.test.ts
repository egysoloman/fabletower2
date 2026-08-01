import assert from 'node:assert/strict'
import test from 'node:test'
import { RELICS, rngFromSeed } from '@neonspire/engine'
import { rollCoopReward } from '../src/coop-rewards'

test('co-op bosses offer real ascension-aware relic choices', () => {
  const a0 = rollCoopReward({ rng: rngFromSeed(5), char: 'runner', relics: [], kind: 'boss', asc: 0, act: 1 })
  const a9 = rollCoopReward({ rng: rngFromSeed(5), char: 'runner', relics: [], kind: 'boss', asc: 9, act: 1 })
  assert.equal(a0.relics.length, 3)
  assert.equal(a9.relics.length, 2)
  assert.equal(new Set(a0.relics).size, a0.relics.length)
  assert.ok(a0.relics.every((id) => RELICS[id]?.rarity === 'boss' || RELICS[id]?.rarity === 'rare'))
})

test('co-op A15 narrows card rewards and ascension reduces gold', () => {
  const a0 = rollCoopReward({ rng: rngFromSeed(9), char: 'array', relics: [], kind: 'normal', asc: 0, act: 2 })
  const a15 = rollCoopReward({ rng: rngFromSeed(9), char: 'array', relics: [], kind: 'normal', asc: 15, act: 2 })
  assert.equal(a0.cards.length, 3)
  assert.equal(a15.cards.length, 2)
  assert.ok(a15.gold < a0.gold)
})
