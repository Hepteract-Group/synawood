import { describe, expect, it } from 'vitest'
import { formatStructuralDiffLines, structuralDiffLines } from './structural'

describe('structural intent diffs', () => {
  it('diffs structural fields only', () => {
    const lines = structuralDiffLines(
      { keywords: ['a'], emotion: 'exciting', cta: 'Old' },
      { keywords: ['b'], emotion: 'emotional', cta: 'New' },
    )
    expect(lines).toEqual([{ key: 'emotion', from: 'exciting', to: 'emotional' }])
  })

  it('formats lines for the rebuild banner', () => {
    expect(
      formatStructuralDiffLines([{ key: 'platform', from: 'tiktok', to: 'linkedin' }]),
    ).toEqual(['platform: tiktok → linkedin'])
  })
})
