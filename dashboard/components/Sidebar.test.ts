import { describe, expect, it } from 'vitest'
import { SHELL_ACCOUNT_HREFS, SHELL_NAV_HREFS, SHELL_PHONE_MAX_PX } from './Sidebar'

describe('Synawood shell phone breakpoint (#819)', () => {
  it('keeps every Synawood destination in the Menu', () => {
    expect(SHELL_PHONE_MAX_PX).toBe(760)
    expect(SHELL_NAV_HREFS).toEqual([
      '/home',
      '/products',
      '/studio',
      '/campaigns',
      '/goals',
      '/approvals',
      '/content',
      '/insights',
      '/ai-media',
      '/usage',
      '/settings',
    ])
  })
})

describe('Synawood shell account exit (#1138)', () => {
  it('keeps Marketing site on the public landing', () => {
    expect(SHELL_ACCOUNT_HREFS).toEqual(['/'])
  })
})
