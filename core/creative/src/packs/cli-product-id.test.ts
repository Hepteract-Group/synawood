import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { readRequiredProductId } from './cli-product-id'

const here = path.dirname(fileURLToPath(import.meta.url))

describe('readRequiredProductId (#901)', () => {
  it('reads --product-id from argv', () => {
    expect(readRequiredProductId(['node', 'seed.ts', '--product-id', 'acme'], {})).toBe('acme')
  })

  it('reads PRODUCT_ID from env when the flag is absent', () => {
    expect(readRequiredProductId(['node', 'seed.ts'], { PRODUCT_ID: 'acme' })).toBe('acme')
  })

  it('prefers the flag over env', () => {
    expect(
      readRequiredProductId(['node', 'seed.ts', '--product-id', 'flagged'], { PRODUCT_ID: 'env' }),
    ).toBe('flagged')
  })

  it('throws when neither flag nor env is set', () => {
    expect(() => readRequiredProductId(['node', 'seed.ts'], {})).toThrow(
      /Pass --product-id <id> or PRODUCT_ID/,
    )
  })
})

describe('seed-starter-packs CLI (#901)', () => {
  it('does not hardcode a demo product id', () => {
    const script = readFileSync(
      path.resolve(here, '../../../../scripts/seed-starter-packs.ts'),
      'utf8',
    )
    expect(script).not.toMatch(/productId:\s*['"]demo['"]/)
  })
})
