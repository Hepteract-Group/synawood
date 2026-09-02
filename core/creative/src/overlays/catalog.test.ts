import { describe, expect, it } from 'vitest'
import { listStylePacks } from '../effects/packs'
import { listTreatments } from '../effects/treatments'
import { FIRST_PARTY_STICKERS } from './stickers'

describe('first-party overlay catalog (#848)', () => {
  it('ships at least 30 extra stickers, looks, and treatments beyond the original 11', () => {
    const stickers = FIRST_PARTY_STICKERS.length
    const looks = listStylePacks().length
    const treatments = listTreatments().length
    expect(stickers + looks + treatments).toBeGreaterThanOrEqual(41)
    expect(stickers).toBeGreaterThanOrEqual(20)
    expect(looks).toBeGreaterThanOrEqual(10)
    expect(treatments).toBe(4)
  })
})
