import { describe, expect, it } from 'vitest'
import {
  FIRST_PARTY_STICKERS,
  getFirstPartySticker,
  parseStickerDrag,
  stickerDataUrl,
} from './stickers'

describe('first-party sticker pack', () => {
  it('ships arrows, circles, check, a New badge, and a wider first-party pack', () => {
    const ids = FIRST_PARTY_STICKERS.map((sticker) => sticker.id)
    expect(ids).toEqual(expect.arrayContaining(['arrow-right', 'circle', 'check', 'badge-new']))
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBeGreaterThanOrEqual(20)
    expect(FIRST_PARTY_STICKERS.every((sticker) => sticker.license === 'first-party')).toBe(true)
    expect(getFirstPartySticker('check')?.svg).toContain('svg')
    expect(stickerDataUrl(FIRST_PARTY_STICKERS[0]!)).toMatch(/^data:image\/svg\+xml/)
    expect(parseStickerDrag('circle')).toBe('circle')
    expect(parseStickerDrag('emoji-font')).toBeNull()
  })
})
