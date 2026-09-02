import { describe, expect, it } from 'vitest'
import type { AssetRefLike } from './asset-token'
import {
  clipTokenFor,
  formatTimeChipLabel,
  formatTimeToken,
  groundingReferenceBlock,
  implicitGroundedLabel,
  listGroundingChips,
  overlayTokenFor,
  removeGroundingToken,
  resolveChatGrounding,
  stripGroundingTokens,
  type ClipRefLike,
  type OverlayRefLike,
} from './grounding-token'

const asset = (id: string, name: string): AssetRefLike => ({
  id,
  kind: 'video',
  source: 'upload',
  probe: { name },
})

const clip: ClipRefLike = {
  id: 'clip_aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  assetId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
}
const overlay: OverlayRefLike = {
  id: 'overlay_11111111-2222-4333-8444-555555555555',
  kind: 'hook_title',
  text: 'Stuck on a PDF?',
}
const assets = [asset(clip.assetId, 'Hook take')]

describe('formatTimeToken', () => {
  it('pads minutes and seconds for the playhead insert', () => {
    expect(formatTimeToken(12)).toBe('@t:00:12')
    expect(formatTimeToken(72)).toBe('@t:01:12')
  })

  it('keeps one decimal for sub-minute fractional seconds', () => {
    expect(formatTimeToken(12.4)).toBe('@t:12.4')
  })
})

describe('formatTimeChipLabel', () => {
  it('is readable, not a raw token', () => {
    expect(formatTimeChipLabel(12)).toBe('@ 0:12')
    expect(formatTimeChipLabel(72)).toBe('@ 1:12')
  })
})

describe('resolveChatGrounding', () => {
  it('resolves @t mm:ss and decimal seconds', () => {
    expect(
      resolveChatGrounding({ text: 'cut here @t:00:12', clips: [], overlays: [] }).payload.tSeconds,
    ).toBe(12)
    expect(
      resolveChatGrounding({ text: 'from @t:12.4', clips: [], overlays: [] }).payload.tSeconds,
    ).toBe(12.4)
  })

  it('resolves @clip by slug-id8 and by raw id', () => {
    const token = clipTokenFor(clip, assets)
    expect(token).toBe('@clip:hook-take-aaaaaaaa')
    expect(
      resolveChatGrounding({
        text: `swap b-roll ${token}`,
        clips: [clip],
        overlays: [],
        assets,
      }).payload.clipId,
    ).toBe(clip.id)
    expect(
      resolveChatGrounding({
        text: `swap @clip:${clip.id}`,
        clips: [clip],
        overlays: [],
        assets,
      }).payload.clipId,
    ).toBe(clip.id)
  })

  it('resolves @overlay by text slug', () => {
    const token = overlayTokenFor(overlay)
    expect(token).toBe('@overlay:stuck-on-a-pdf-11111111')
    expect(
      resolveChatGrounding({
        text: `shorten ${token}`,
        clips: [],
        overlays: [overlay],
      }).payload.overlayId,
    ).toBe(overlay.id)
  })

  it('fails closed when a typed clip token is gone', () => {
    const result = resolveChatGrounding({
      text: 'swap @clip:missing-deadbeef',
      clips: [clip],
      overlays: [],
      assets,
    })
    expect(result.error).toBe('That clip is gone — pick another.')
    expect(result.payload.clipId).toBeUndefined()
  })

  it('fails closed for a time past the cut', () => {
    const result = resolveChatGrounding({
      text: 'jump @t:01:30',
      clips: [],
      overlays: [],
      durationSeconds: 20,
    })
    expect(result.error).toBe('That time isn’t on this cut.')
  })

  it('uses implicit selection when the message has no token', () => {
    const result = resolveChatGrounding({
      text: 'swap B-roll here',
      clips: [clip],
      overlays: [overlay],
      assets,
      implicit: { clipId: clip.id, overlayId: overlay.id },
    })
    expect(result.payload).toEqual({ clipId: clip.id, overlayId: overlay.id })
    expect(result.error).toBeUndefined()
  })

  it('lets typed tokens win over implicit selection', () => {
    const other: ClipRefLike = {
      id: 'clip_bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      assetId: 'bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    }
    const result = resolveChatGrounding({
      text: `trim @clip:${other.id}`,
      clips: [clip, other],
      overlays: [overlay],
      assets: [...assets, asset(other.assetId, 'Proof')],
      implicit: { clipId: clip.id, overlayId: overlay.id },
    })
    expect(result.payload.clipId).toBe(other.id)
    expect(result.payload.overlayId).toBe(overlay.id)
  })

  it('does not invent implicit time from the playhead', () => {
    const result = resolveChatGrounding({
      text: 'make this louder',
      clips: [clip],
      overlays: [],
      implicit: { clipId: clip.id },
    })
    expect(result.payload.tSeconds).toBeUndefined()
  })
})

describe('listGroundingChips', () => {
  it('renders readable labels, not raw ids', () => {
    const chips = listGroundingChips({
      text: `at @t:00:12 use ${clipTokenFor(clip, assets)} and ${overlayTokenFor(overlay)}`,
      clips: [clip],
      overlays: [overlay],
      assets,
    })
    expect(chips.map((item) => item.label)).toEqual(['@ 0:12', '@ Hook take', '@ Stuck on a PDF?'])
  })
})

describe('removeGroundingToken', () => {
  it('drops one chip occurrence from the draft', () => {
    const text = `cut ${clipTokenFor(clip, assets)} now`
    const [chip] = listGroundingChips({ text, clips: [clip], overlays: [], assets })
    expect(removeGroundingToken(text, chip!).replace(/\s+/g, ' ').trim()).toBe('cut now')
  })
})

describe('stripGroundingTokens', () => {
  it('leaves the instruction when tokens are removed', () => {
    expect(stripGroundingTokens(`swap B-roll ${clipTokenFor(clip, assets)} here`)).toBe(
      'swap B-roll here',
    )
  })
})

describe('implicitGroundedLabel', () => {
  it('names the selected clip when no @clip token is present', () => {
    expect(
      implicitGroundedLabel({
        text: 'swap B-roll here',
        clips: [clip],
        overlays: [],
        assets,
        implicit: { clipId: clip.id },
      }),
    ).toBe('Hook take')
  })

  it('hides when a clip token already names the target', () => {
    expect(
      implicitGroundedLabel({
        text: `swap ${clipTokenFor(clip, assets)}`,
        clips: [clip],
        overlays: [],
        assets,
        implicit: { clipId: clip.id },
      }),
    ).toBeNull()
  })
})

describe('groundingReferenceBlock', () => {
  it('is empty when nothing is grounded', () => {
    expect(groundingReferenceBlock({})).toBe('')
  })

  it('lists ids for the agent without inventing a new tool language', () => {
    const block = groundingReferenceBlock({
      tSeconds: 12,
      clipId: clip.id,
    })
    expect(block).toMatch(/## Grounding \(this turn\)/)
    expect(block).toMatch(/clipId=clip_aaaaaaaa/)
    expect(block).toMatch(/tSeconds=12/)
    expect(block).toMatch(/still call a tool/)
  })
})
