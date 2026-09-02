import { describe, expect, it, vi } from 'vitest'
import {
  captionAssetWithVlm,
  normalizeAssetTag,
  normalizeAssetTags,
  parseCaptionVlmResult,
} from './caption'

describe('normalizeAssetTag', () => {
  it('trims, lowercases, and collapses whitespace', () => {
    expect(normalizeAssetTag('  Product Close-Up  ')).toBe('product close-up')
  })

  it('rejects empty or overlong tags', () => {
    expect(normalizeAssetTag('')).toBeNull()
    expect(normalizeAssetTag('   ')).toBeNull()
    expect(normalizeAssetTag('x'.repeat(65))).toBeNull()
  })
})

describe('normalizeAssetTags', () => {
  it('dedupes and drops invalids', () => {
    expect(normalizeAssetTags(['Funny', 'funny', '', 'Product', 'x'.repeat(65)])).toEqual([
      'funny',
      'product',
    ])
  })

  it('caps at 12 tags', () => {
    const tags = Array.from({ length: 20 }, (_, i) => `tag-${i}`)
    expect(normalizeAssetTags(tags)).toHaveLength(12)
  })
})

describe('parseCaptionVlmResult', () => {
  it('parses JSON caption + tags', () => {
    expect(
      parseCaptionVlmResult('{"caption":"A product close-up on a desk","tags":["product","desk"]}'),
    ).toEqual({
      caption: 'A product close-up on a desk',
      tags: ['product', 'desk'],
    })
  })

  it('accepts fenced JSON and normalizes tags', () => {
    expect(
      parseCaptionVlmResult(
        '```json\n{"caption":"Travel montage","tags":[" Travel ","travel"]}\n```',
      ),
    ).toEqual({
      caption: 'Travel montage',
      tags: ['travel'],
    })
  })

  it('throws when caption missing', () => {
    expect(() => parseCaptionVlmResult('{"tags":["a"]}')).toThrow(/caption/i)
  })
})

describe('captionAssetWithVlm', () => {
  it('returns deterministic mock when model is mock-caption', async () => {
    const result = await captionAssetWithVlm({
      modelId: 'mock-caption',
      kind: 'image',
      mediaType: 'image/jpeg',
      fileName: 'hero.jpg',
      bytes: Buffer.from('jpeg-bytes'),
    })
    expect(result).toEqual({
      skipped: false,
      caption: 'Mock caption for hero.jpg',
      tags: ['mock', 'image'],
    })
  })

  it('skips non-image media when no keyframe is available', async () => {
    const result = await captionAssetWithVlm({
      modelId: 'openai/gpt-4.1-mini',
      kind: 'video',
      mediaType: 'video/mp4',
      fileName: 'clip.mp4',
      bytes: Buffer.from('mp4-bytes'),
    })
    expect(result).toMatchObject({
      skipped: true,
      reason: expect.stringMatching(/keyframe|image/i),
    })
  })

  it('calls generateText with an image file part for stills', async () => {
    const generateText = vi.fn(async () => ({
      text: '{"caption":"Red sneaker on concrete","tags":["product","sneaker"]}',
    }))
    const result = await captionAssetWithVlm(
      {
        modelId: 'openai/gpt-4.1-mini',
        kind: 'image',
        mediaType: 'image/png',
        fileName: 'shoe.png',
        bytes: Buffer.from('png'),
      },
      { generateText: generateText as never },
    )
    expect(result).toEqual({
      skipped: false,
      caption: 'Red sneaker on concrete',
      tags: ['product', 'sneaker'],
    })
    expect(generateText).toHaveBeenCalledOnce()
    const calls = generateText.mock.calls as unknown as Array<[unknown]>
    const callArg = calls[0]?.[0] as
      { messages: Array<{ content: Array<{ type: string }> }> } | undefined
    expect(callArg?.messages[0]?.content.some((part) => part.type === 'file')).toBe(true)
  })
})
