import { describe, expect, it } from 'vitest'
import { pickActiveProductId } from './resolve-client-product-id'

describe('pickActiveProductId', () => {
  it('keeps the cookie when the user still belongs to that Product', () => {
    expect(
      pickActiveProductId([{ productId: 'okiki-alaso' }, { productId: 'other' }], 'okiki-alaso'),
    ).toBe('okiki-alaso')
  })

  it('falls back to the first membership when the cookie is a Product they cannot access', () => {
    expect(pickActiveProductId([{ productId: 'okiki-alaso' }], 'demo')).toBe('okiki-alaso')
  })

  it('returns null when there are no memberships', () => {
    expect(pickActiveProductId([], 'demo')).toBeNull()
  })
})
