import { describe, expect, it } from 'vitest'
import { PRODUCT_MARK, PRODUCT_NAME } from './product-name'

describe('product name (#1332)', () => {
  it('is Synawood with an S mark', () => {
    expect(PRODUCT_NAME).toBe('Synawood')
    expect(PRODUCT_MARK).toBe('S')
  })
})
