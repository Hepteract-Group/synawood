import { describe, expect, it } from 'vitest'
import {
  loadConfirmSpendPreference,
  persistConfirmSpendPreference,
} from './confirm-spend-preference'

const memory = (): Map<string, string> => new Map()

const kv = (map: Map<string, string>) => ({
  getItem: (key: string) => map.get(key) ?? null,
  setItem: (key: string, value: string) => {
    map.set(key, value)
  },
})

describe('confirm spend preference', () => {
  it('defaults to on when unset', () => {
    const store = memory()
    expect(loadConfirmSpendPreference('proj-a', kv(store))).toBe(true)
  })

  it('persists off and on per project', () => {
    const store = memory()
    const storage = kv(store)
    persistConfirmSpendPreference('proj-a', false, storage)
    expect(loadConfirmSpendPreference('proj-a', storage)).toBe(false)
    expect(loadConfirmSpendPreference('proj-b', storage)).toBe(true)
    persistConfirmSpendPreference('proj-a', true, storage)
    expect(loadConfirmSpendPreference('proj-a', storage)).toBe(true)
  })
})
