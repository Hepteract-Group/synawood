import { describe, expect, it } from 'vitest'
import { slugifyProductName, isValidProductSlug } from './product-slug'

describe('slugifyProductName', () => {
  it('derives a stable slug from a display name', () => {
    expect(slugifyProductName('demoreader')).toBe('demoreader')
    expect(slugifyProductName('the private example Reader')).toBe('demo-reader')
    expect(slugifyProductName('  Hello---World  ')).toBe('hello-world')
  })

  it('returns empty for punctuation-only input', () => {
    expect(slugifyProductName('!!!')).toBe('')
  })
})

describe('isValidProductSlug', () => {
  it('accepts hyphenated lowercase ids', () => {
    expect(isValidProductSlug('demo')).toBe(true)
    expect(isValidProductSlug('my-product')).toBe(true)
  })

  it('rejects invalid shapes', () => {
    expect(isValidProductSlug('a')).toBe(false)
    expect(isValidProductSlug('-demo')).toBe(false)
    expect(isValidProductSlug('the private example')).toBe(false)
    expect(isValidProductSlug('has space')).toBe(false)
  })
})
