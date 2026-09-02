import { describe, expect, it } from 'vitest'
import { resolveSlideReferences, slideTokenFor } from '../project/slide-token'
import { slideReferenceBlock } from './slide-references'

describe('slideReferenceBlock', () => {
  it('is empty when no refs', () => {
    expect(slideReferenceBlock([])).toBe('')
  })

  it('grounds slideIds for the agent', () => {
    const slides = [
      { id: 'slide_1', order: 0, headline: 'Hook', layout: 'hero' as const },
      { id: 'slide_2', order: 1, headline: 'Proof', layout: 'point' as const },
    ]
    const refs = resolveSlideReferences(`edit ${slideTokenFor(slides[0]!)}`, slides)
    const block = slideReferenceBlock(refs)
    expect(block).toContain('Referenced slides')
    expect(block).toContain('slideId=slide_1')
    expect(block).toContain('layout=hero')
  })
})
