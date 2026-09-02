import { describe, expect, it } from 'vitest'
import { studioLayoutModeForWidth } from './studio-layout'

describe('studioLayoutModeForWidth', () => {
  it('stacks at the 1100px Studio contract', () => {
    expect(studioLayoutModeForWidth(390)).toBe('stack')
    expect(studioLayoutModeForWidth(768)).toBe('stack')
    expect(studioLayoutModeForWidth(1100)).toBe('stack')
    expect(studioLayoutModeForWidth(1101)).toBe('wide')
    expect(studioLayoutModeForWidth(1440)).toBe('wide')
  })
})
