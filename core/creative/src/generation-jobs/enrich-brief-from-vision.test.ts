import { describe, expect, it, vi } from 'vitest'
import { BRIEF_LOW_CONFIDENCE_THRESHOLD, parseExtractedBrief } from '../brief/extracted-brief'
import {
  EXTRACT_VISION_FALLBACK_MODEL_ID,
  enrichBriefFromVision,
  markEnrichmentSkipped,
  mergeEnrichmentIntoBrief,
  parseEnrichmentPatch,
  resolveEnrichmentVisionModelId,
} from './enrich-brief-from-vision'

const baseBrief = () =>
  parseExtractedBrief({
    id: '11111111-1111-4111-8111-111111111111',
    source: {
      kind: 'url',
      uri: 'https://example.com/',
      fetchedAt: '2026-08-02T12:00:00.000Z',
    },
    brandCandidates: {
      displayName: 'Acme',
      stillAssetIds: [],
      defaultCta: 'Learn more',
    },
    product: {
      name: 'Acme',
      oneLiner: 'Widgets for teams',
      benefits: [],
      socialProof: [],
    },
    messaging: {
      hookCandidates: ['Try Acme today'],
      ctaCandidates: ['Learn more'],
      audienceHints: [],
      tone: 'direct',
    },
    confidence: {
      overall: 0.55,
      fields: { 'messaging.hookCandidates': 0.6 },
    },
  })

describe('parseEnrichmentPatch', () => {
  it('clips overlong styleNote instead of failing', () => {
    const longNote = 'x'.repeat(950)
    const patch = parseEnrichmentPatch({
      hookCandidates: ['Stop shipping blind'],
      ctaCandidates: ['Try Acme'],
      styleNote: longNote,
    })
    expect(patch.styleNote).toHaveLength(800)
    expect(patch.styleNote).toBe(longNote.slice(0, 800))
  })

  it('accepts brand hex colors and drops slate UI chrome', () => {
    const patch = parseEnrichmentPatch({
      hookCandidates: ['Stop shipping blind'],
      ctaCandidates: ['Try Acme'],
      primaryColor: '#E85A9B',
      accentColor: '#101828',
    })
    expect(patch.primaryColor).toBe('#e85a9b')
    expect(patch.accentColor).toBeUndefined()
  })
})

describe('mergeEnrichmentIntoBrief', () => {
  it('replaces hooks/CTAs/colors and raises confidence', () => {
    const next = mergeEnrichmentIntoBrief(baseBrief(), {
      displayName: 'Acme Co',
      tone: 'bold',
      oneLiner: 'Ship faster with Acme',
      hookCandidates: ['Stop shipping blind', 'Clarity for every launch'],
      ctaCandidates: ['Try Acme', 'Book a demo'],
      styleNote: 'High contrast pink on cream',
      primaryColor: '#e85a9b',
      accentColor: '#1a5c3a',
    })
    expect(next.brandCandidates.displayName).toBe('Acme Co')
    expect(next.brandCandidates.primaryColor).toBe('#e85a9b')
    expect(next.brandCandidates.accentColor).toBe('#1a5c3a')
    expect(next.messaging.hookCandidates[0]).toBe('Stop shipping blind')
    expect(next.messaging.ctaCandidates[0]).toBe('Try Acme')
    expect(next.confidence.fields?.['messaging.hookCandidates']).toBeGreaterThan(0.8)
    expect(next.confidence.fields?.['brandCandidates.primaryColor']).toBeGreaterThan(0.85)
  })
})

describe('markEnrichmentSkipped', () => {
  it('lowers messaging confidence below the brief threshold', () => {
    const next = markEnrichmentSkipped(baseBrief(), 'screenshot timed out')
    expect(next.confidence.fields?.['messaging.hookCandidates']).toBeLessThan(
      BRIEF_LOW_CONFIDENCE_THRESHOLD,
    )
    expect(next.raw).toMatch(/enrichmentSkipped/)
  })
})

describe('resolveEnrichmentVisionModelId', () => {
  it('keeps GPT-4.1 and Gemini reasoners that already accept images', () => {
    expect(resolveEnrichmentVisionModelId('openai/gpt-4.1')).toBe('openai/gpt-4.1')
    expect(resolveEnrichmentVisionModelId('openai/gpt-4.1-mini')).toBe('openai/gpt-4.1-mini')
    expect(resolveEnrichmentVisionModelId('google/gemini-3.1-flash-lite')).toBe(
      'google/gemini-3.1-flash-lite',
    )
  })

  it('routes Qwen and other text-only reasoners to the caption VLM', () => {
    expect(resolveEnrichmentVisionModelId('alibaba/qwen3.7-max')).toBe(
      EXTRACT_VISION_FALLBACK_MODEL_ID,
    )
    expect(resolveEnrichmentVisionModelId('alibaba/qwen3.7-plus')).toBe(
      EXTRACT_VISION_FALLBACK_MODEL_ID,
    )
    expect(resolveEnrichmentVisionModelId('minimax/minimax-m3')).toBe(
      EXTRACT_VISION_FALLBACK_MODEL_ID,
    )
    expect(resolveEnrichmentVisionModelId('meta/muse-spark-1.1')).toBe(
      EXTRACT_VISION_FALLBACK_MODEL_ID,
    )
    expect(EXTRACT_VISION_FALLBACK_MODEL_ID).toBe('openai/gpt-4.1-mini')
  })
})

describe('enrichBriefFromVision', () => {
  it('does not send screenshot file parts to a Qwen chat model', async () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', 'test')
    try {
      const generateText = vi.fn(async () => ({
        text: JSON.stringify({
          hookCandidates: ['Ace the interview on camera'],
          ctaCandidates: ['Get started free'],
        }),
      }))
      await enrichBriefFromVision({
        brief: baseBrief(),
        reasonerModelId: 'alibaba/qwen3.7-max',
        digestText: 'Povotra is AI interview prep with live avatars.',
        colorGuesses: ['#22c55e'],
        screenshotPng: Buffer.from('png-bytes'),
        generateText: generateText as never,
      })
      expect(generateText).toHaveBeenCalledOnce()
      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'openai/gpt-4.1-mini',
          messages: [
            expect.objectContaining({
              content: expect.arrayContaining([expect.objectContaining({ type: 'file' })]),
            }),
          ],
        }),
      )
      expect(generateText).not.toHaveBeenCalledWith(
        expect.objectContaining({ model: 'alibaba/qwen3.7-max' }),
      )
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
