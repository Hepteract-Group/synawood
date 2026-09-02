import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ProductExtract } from '../extract/product-extract-schema'
import { productExtractContextBlock } from './product-extract-context'

const extract = (overrides: Partial<ProductExtract>): ProductExtract => ({
  id: '11111111-1111-4111-8111-111111111111',
  productId: 'acme',
  kind: 'still',
  sourceUrl: 'https://acme.example/pricing',
  blobKey: 'local/marketing-os/acme/extract/11111111-1111-4111-8111-111111111111/still.png',
  quality: 'usable',
  createdAt: '2026-08-31T00:00:00.000Z',
  updatedAt: '2026-08-31T00:00:00.000Z',
  ...overrides,
})

describe('productExtractContextBlock (#1097)', () => {
  it('includes usable and weak extract ids for this Product', () => {
    const block = productExtractContextBlock([
      extract({ quality: 'usable' }),
      extract({
        id: '22222222-2222-4222-8222-222222222222',
        quality: 'weak',
        sourceUrl: 'https://acme.example/about',
      }),
    ])
    expect(block).toMatch(/11111111-1111-4111-8111-111111111111/)
    expect(block).toMatch(/22222222-2222-4222-8222-222222222222/)
    expect(block).toMatch(/quality=usable/)
    expect(block).toMatch(/quality=weak/)
  })

  it('omits rejected extracts and returns empty when none are injectable', () => {
    const rejected = productExtractContextBlock([
      extract({ quality: 'reject', id: '33333333-3333-4333-8333-333333333333' }),
    ])
    expect(rejected).toBe('')
    expect(rejected).not.toMatch(/33333333-3333-4333-8333-333333333333/)
    expect(productExtractContextBlock([])).toBe('')
  })

  it('does not list another Product’s extracts (caller must already scope)', () => {
    const block = productExtractContextBlock([
      extract({ productId: 'acme', id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }),
    ])
    expect(block).toMatch(/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/)
    expect(block).not.toMatch(/other-product/)
    expect(block).toMatch(/this Product/)
  })

  it('runTurn lists only this Product’s usable and weak extracts', () => {
    const source = readFileSync(join(__dirname, 'run-turn.ts'), 'utf8')
    expect(source).toMatch(/listProductExtracts/)
    expect(source).toMatch(/quality: \['usable', 'weak'\]/)
    expect(source).toMatch(/productId: input\.productId/)
    expect(source).toMatch(/productExtractContextBlock/)
  })
})
