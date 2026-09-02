import { describe, expect, it } from 'vitest'
import { resolveSlideReferences, slideLabel, slideTokenFor, type SlideRefLike } from './slide-token'

const slide = (
  partial: Partial<SlideRefLike> & Pick<SlideRefLike, 'id' | 'order'>,
): SlideRefLike => ({
  headline: '',
  layout: 'point',
  ...partial,
})

describe('slideTokenFor / slideLabel', () => {
  it('builds a numbered slug token and label', () => {
    const s = slide({ id: 'slide_1', order: 0, headline: 'Stop editing PDFs the hard way' })
    expect(slideTokenFor(s)).toBe('@slide:1-stop-editing-pdfs-the-hard-way')
    expect(slideLabel(s)).toBe('Slide 1: Stop editing PDFs the hard way')
  })

  it('falls back to index-only token when headline is empty', () => {
    expect(slideTokenFor(slide({ id: 'slide_2', order: 1 }))).toBe('@slide:2')
  })
})

describe('resolveSlideReferences', () => {
  const pack = [
    slide({ id: 'slide_1', order: 0, headline: 'Hook', layout: 'hero' }),
    slide({ id: 'slide_2', order: 1, headline: '3× faster', layout: 'stat' }),
    slide({ id: 'slide_3', order: 2, headline: 'Get started', layout: 'cta' }),
  ]

  it('resolves canonical tokens', () => {
    const refs = resolveSlideReferences(`rewrite ${slideTokenFor(pack[1]!)} body`, pack)
    expect(refs).toHaveLength(1)
    expect(refs[0]?.slideId).toBe('slide_2')
    expect(refs[0]?.layout).toBe('stat')
  })

  it('resolves @slide:slide_N ids and bare indexes', () => {
    const refs = resolveSlideReferences('fix @slide:slide_1 and shorten @slide:3', pack)
    expect(refs.map((r) => r.slideId)).toEqual(['slide_1', 'slide_3'])
  })

  it('dedupes repeated mentions', () => {
    const token = slideTokenFor(pack[0]!)
    const refs = resolveSlideReferences(`${token} then ${token}`, pack)
    expect(refs).toHaveLength(1)
  })

  it('ignores unknown tokens', () => {
    expect(resolveSlideReferences('see @slide:99-nope', pack)).toEqual([])
  })
})
