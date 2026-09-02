import { describe, expect, it } from 'vitest'
import { publicHttpUrlsFromText } from './urls-from-text'

describe('publicHttpUrlsFromText (#1365)', () => {
  it('picks https URLs and drops trailing punctuation', () => {
    expect(
      publicHttpUrlsFromText(
        'Extract this product page and keep usable stills in the Extracts bin: https://povotra.com.',
      ),
    ).toEqual(['https://povotra.com'])
  })
})
