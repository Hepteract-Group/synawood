import { describe, expect, it } from 'vitest'
import { inkOn, pickPathCChromeLayout } from './path-c-chrome'

describe('pickPathCChromeLayout', () => {
  it('is stable for the same seed', () => {
    expect(pickPathCChromeLayout('the private example|#1a5c3a|#c45c26')).toBe(
      pickPathCChromeLayout('the private example|#1a5c3a|#c45c26'),
    )
  })

  it('varies across different brand seeds', () => {
    const a = pickPathCChromeLayout('the private example|#1a5c3a|#c45c26')
    const b = pickPathCChromeLayout('Okiki Alaso|#0f3d2e|#d4af37')
    const c = pickPathCChromeLayout('Acme|#112233|#445566')
    const set = new Set([a, b, c])
    expect(set.size).toBeGreaterThan(1)
  })
})

describe('inkOn', () => {
  it('picks dark ink on light fills', () => {
    expect(inkOn('#f5f5f5')).toBe('#141414')
  })

  it('picks light ink on dark fills', () => {
    expect(inkOn('#1a5c3a')).toBe('#f4f1ea')
  })
})
