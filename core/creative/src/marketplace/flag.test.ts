import { afterEach, describe, expect, it } from 'vitest'
import {
  getMarketplaceAdapter,
  isMarketplaceAdaptersEnabled,
  listMarketplaceAdapters,
  MarketplaceDisabledError,
  MarketplaceNotImplementedError,
  requireMarketplaceAdapters,
} from './index'

const withEnv = (value: string | undefined): NodeJS.ProcessEnv => {
  const env = { ...process.env }
  if (value === undefined) delete env.MARKETPLACE_ADAPTERS
  else env.MARKETPLACE_ADAPTERS = value
  return env
}

afterEach(() => {
  delete process.env.MARKETPLACE_ADAPTERS
})

describe('isMarketplaceAdaptersEnabled', () => {
  it('is off by default', () => {
    expect(isMarketplaceAdaptersEnabled(withEnv(undefined))).toBe(false)
    expect(isMarketplaceAdaptersEnabled(withEnv(''))).toBe(false)
    expect(isMarketplaceAdaptersEnabled(withEnv('false'))).toBe(false)
  })

  it('enables only for true / 1 / yes', () => {
    expect(isMarketplaceAdaptersEnabled(withEnv('true'))).toBe(true)
    expect(isMarketplaceAdaptersEnabled(withEnv('TRUE'))).toBe(true)
    expect(isMarketplaceAdaptersEnabled(withEnv('1'))).toBe(true)
    expect(isMarketplaceAdaptersEnabled(withEnv('yes'))).toBe(true)
  })
})

describe('listMarketplaceAdapters', () => {
  it('returns no adapters when the flag is off', () => {
    expect(listMarketplaceAdapters(withEnv(undefined))).toEqual([])
  })

  it('returns stubs when the flag is on (no network)', () => {
    const adapters = listMarketplaceAdapters(withEnv('true'))
    expect(adapters.map((adapter) => adapter.providerId)).toEqual([
      'envato',
      'artlist',
      'adobe_stock',
    ])
  })
})

describe('requireMarketplaceAdapters', () => {
  it('throws when disabled', () => {
    expect(() => requireMarketplaceAdapters(withEnv('false'))).toThrow(MarketplaceDisabledError)
  })
})

describe('stub adapters', () => {
  it('refuse search and purchase even when enabled', async () => {
    const adapter = getMarketplaceAdapter('envato', withEnv('true'))
    expect(adapter).not.toBeNull()
    await expect(adapter!.search({ kind: 'stock_image', query: 'office' })).rejects.toBeInstanceOf(
      MarketplaceNotImplementedError,
    )
    await expect(
      adapter!.purchase({
        providerId: 'envato',
        assetId: 'stub-1',
        projectId: '11111111-1111-4111-8111-111111111111',
      }),
    ).rejects.toBeInstanceOf(MarketplaceNotImplementedError)
  })
})
