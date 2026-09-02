import { describe, expect, it } from 'vitest'
import { sessionGbpFromCostsPayload } from './session-spend'

describe('sessionGbpFromCostsPayload', () => {
  it('reads this project’s ledger total', () => {
    expect(sessionGbpFromCostsPayload({ spent: { projectGbp: 0.61, monthGbp: 2 } })).toBe(0.61)
  })

  it('treats missing or invalid spend as zero', () => {
    expect(sessionGbpFromCostsPayload(null)).toBe(0)
    expect(sessionGbpFromCostsPayload({})).toBe(0)
    expect(sessionGbpFromCostsPayload({ spent: { projectGbp: -1 } })).toBe(0)
  })
})
