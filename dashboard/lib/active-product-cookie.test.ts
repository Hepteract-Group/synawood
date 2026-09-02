import { describe, expect, it } from 'vitest'
import { ACTIVE_PRODUCT_COOKIE } from './active-product-cookie'
import { ACTIVE_PRODUCT_EVENT } from './use-active-product'

describe('active product cookie (#1378)', () => {
  it('does not use a Synawood cookie or event name', () => {
    expect(ACTIVE_PRODUCT_COOKIE).toBe('synawood-active-product')
    expect(ACTIVE_PRODUCT_COOKIE).not.toMatch(/mos/i)
    expect(ACTIVE_PRODUCT_EVENT).toBe('synawood-active-product')
    expect(ACTIVE_PRODUCT_EVENT).not.toMatch(/mos/i)
  })
})
