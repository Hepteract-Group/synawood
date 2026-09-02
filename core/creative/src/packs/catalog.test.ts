import { describe, expect, it } from 'vitest'
import { allowUnsignedPacksFromEnv } from './catalog'

describe('allowUnsignedPacksFromEnv', () => {
  it('is true when ALLOW_UNSIGNED_PACKS=true', () => {
    expect(allowUnsignedPacksFromEnv({ ALLOW_UNSIGNED_PACKS: 'true' })).toBe(true)
  })

  it('is true in local development', () => {
    expect(allowUnsignedPacksFromEnv({ NODE_ENV: 'development' })).toBe(true)
  })

  it('is false when unset in production-like env', () => {
    expect(allowUnsignedPacksFromEnv({ NODE_ENV: 'production' })).toBe(false)
  })
})
