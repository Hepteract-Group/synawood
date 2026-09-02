import { describe, expect, it } from 'vitest'
import { isGenericAudience } from './generic-audience'

describe('isGenericAudience (#1221)', () => {
  it('flags everyone and empty persona', () => {
    expect(isGenericAudience({ persona: 'everyone' })).toBe(true)
    expect(isGenericAudience({ persona: '  Everybody  ' })).toBe(true)
    expect(isGenericAudience({ persona: '' })).toBe(true)
  })

  it('flags transform-your-business-with-AI copy', () => {
    expect(
      isGenericAudience({ persona: 'Ops leads', copy: 'Transform your business with AI' }),
    ).toBe(true)
    expect(
      isGenericAudience({ persona: 'Ops leads', language: 'Transform your business with AI' }),
    ).toBe(true)
    expect(
      isGenericAudience({ persona: 'Ops leads', primaryPain: 'transform your business with AI' }),
    ).toBe(true)
  })

  it('passes a specific persona', () => {
    expect(isGenericAudience({ persona: 'Ops leads drowning in PDFs' })).toBe(false)
  })
})
