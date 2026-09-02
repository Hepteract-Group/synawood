import { describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { addCaptions } from '../project/operations'
import { createEmptyProject } from '../project/schema'
import { applyCaptionEmphasis, planCaptionEmphasis, setCaptionStyle } from './caption-emphasis'

describe('planCaptionEmphasis (#891)', () => {
  it('highlights a campaign keyword and places one licensed mark', () => {
    const plan = planCaptionEmphasis({
      words: [{ text: 'Save' }, { text: 'hours' }, { text: 'today' }],
      keywords: ['save'],
      remainingMarks: 2,
    })
    expect(plan.emphasis.map((item) => item.wordIndex)).toEqual([0, 2])
    expect(plan.emoji).toEqual([{ wordIndex: 0, stickerId: 'sparkle' }])
  })

  it('skips stopwords and stays sparse when no marks remain', () => {
    const plan = planCaptionEmphasis({
      words: [{ text: 'the' }, { text: 'focus' }, { text: 'now' }],
      keywords: ['focus'],
      remainingMarks: 0,
    })
    expect(plan.emphasis.map((item) => item.wordIndex)).toEqual([1, 2])
    expect(plan.emoji).toEqual([])
  })
})

describe('applyCaptionEmphasis (#891)', () => {
  it('colors keywords from intent and logs why', () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    project = {
      ...project,
      intent: { ...project.intent, keywords: ['focus'] },
    }
    project = addCaptions(project, {
      text: 'Stay in focus',
      words: [
        { text: 'Stay', startMs: 0, endMs: 200 },
        { text: 'in', startMs: 200, endMs: 280 },
        { text: 'focus', startMs: 280, endMs: 700 },
      ],
    })
    const next = applyCaptionEmphasis(project)
    const caption = next.overlays.find((overlay) => overlay.kind === 'caption')
    expect(caption?.style?.emphasis?.some((item) => item.wordIndex === 2)).toBe(true)
    expect(next.whyLog.some((row) => row.reason === 'Colored a keyword.')).toBe(true)
  })

  it('colors Brand-kit default CTA words (#939)', () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    project = {
      ...project,
      brand: { productId: 'demo', defaultCta: 'Open Demo' },
      intent: { ...project.intent, keywords: [] },
    }
    project = addCaptions(project, {
      text: 'Keep Demo handy',
      words: [
        { text: 'Keep', startMs: 0, endMs: 180 },
        { text: 'Demo', startMs: 180, endMs: 520 },
        { text: 'handy', startMs: 520, endMs: 800 },
      ],
    })
    const next = applyCaptionEmphasis(project)
    const caption = next.overlays.find((overlay) => overlay.kind === 'caption')
    expect(caption?.style?.emphasis?.some((item) => item.wordIndex === 1)).toBe(true)
  })
})

describe('setCaptionStyle (#891)', () => {
  it('clears marks without dropping karaoke', () => {
    let project = createEmptyProject({
      id: randomUUID(),
      productId: 'demo',
    })
    project = addCaptions(project, {
      text: 'Try now',
      style: {
        presetId: 'karaoke',
        emoji: [{ wordIndex: 1, stickerId: 'bolt' }],
        emphasis: [{ wordIndex: 1 }],
      },
      words: [
        { text: 'Try', startMs: 0, endMs: 200 },
        { text: 'now', startMs: 200, endMs: 500 },
      ],
    })
    const next = setCaptionStyle(project, { emoji: false })
    const caption = next.overlays.find((overlay) => overlay.kind === 'caption')
    expect(caption?.style?.presetId).toBe('karaoke')
    expect(caption?.style?.emoji).toEqual([])
    expect(caption?.style?.emphasis).toEqual([{ wordIndex: 1 }])
  })

  it('turns highlights on without restoring cleared marks', () => {
    let project = createEmptyProject({
      id: randomUUID(),
      productId: 'demo',
    })
    project = {
      ...project,
      intent: { ...project.intent, keywords: ['focus'] },
    }
    project = addCaptions(project, {
      text: 'Stay in focus',
      style: { presetId: 'karaoke', emoji: [] },
      words: [
        { text: 'Stay', startMs: 0, endMs: 200 },
        { text: 'in', startMs: 200, endMs: 280 },
        { text: 'focus', startMs: 280, endMs: 700 },
      ],
    })
    const next = setCaptionStyle(project, { highlight: true })
    const caption = next.overlays.find((overlay) => overlay.kind === 'caption')
    expect(caption?.style?.emphasis?.some((item) => item.wordIndex === 2)).toBe(true)
    expect(caption?.style?.emoji).toEqual([])
  })

  it('applies highlights to one caption without rewriting the others', () => {
    let project = createEmptyProject({
      id: randomUUID(),
      productId: 'demo',
    })
    project = {
      ...project,
      intent: { ...project.intent, keywords: ['focus'] },
    }
    project = addCaptions(project, {
      text: 'Stay in focus',
      style: { presetId: 'karaoke', emoji: [{ wordIndex: 2, stickerId: 'star' }] },
      words: [
        { text: 'Stay', startMs: 0, endMs: 200 },
        { text: 'in', startMs: 200, endMs: 280 },
        { text: 'focus', startMs: 280, endMs: 700 },
      ],
    })
    const firstId = project.overlays.find((overlay) => overlay.kind === 'caption')!.id
    project = addCaptions(project, {
      text: 'Try now',
      from: 90,
      style: { presetId: 'karaoke', emoji: [] },
      words: [
        { text: 'Try', startMs: 0, endMs: 200 },
        { text: 'now', startMs: 200, endMs: 400 },
      ],
    })
    const next = setCaptionStyle(project, { overlayId: firstId, highlight: true })
    const first = next.overlays.find((overlay) => overlay.id === firstId)
    const second = next.overlays.find(
      (overlay) => overlay.id !== firstId && overlay.kind === 'caption',
    )
    expect(first?.style?.emphasis?.some((item) => item.wordIndex === 2)).toBe(true)
    expect(first?.style?.emoji).toEqual([{ wordIndex: 2, stickerId: 'star' }])
    expect(second?.style?.emphasis ?? []).toEqual([])
    expect(second?.style?.emoji).toEqual([])
  })
})
