import { describe, expect, it } from 'vitest'
import { parseInline, parseMarkdown } from './simple-markdown'

describe('parseInline', () => {
  it('marks **bold** and `code` without treating them as HTML', () => {
    expect(parseInline('Open [Ad from URL](/studio/3957b733-22a9-4cc4-be23-c0855a94a283)')).toEqual(
      [
        { type: 'text', value: 'Open ' },
        {
          type: 'link',
          value: 'Ad from URL',
          href: '/studio/3957b733-22a9-4cc4-be23-c0855a94a283',
        },
      ],
    )
    expect(parseInline('[bad](javascript:alert(1))')[0]).toEqual({
      type: 'text',
      value: '[bad](javascript:alert(1))',
    })
    expect(parseInline('says *quoted* once')).toEqual([
      { type: 'text', value: 'says ' },
      { type: 'em', value: 'quoted' },
      { type: 'text', value: ' once' },
    ])
  })
})

describe('parseMarkdown', () => {
  it('splits an overlay dry-run into a lead paragraph, list, and question', () => {
    const blocks = parseMarkdown(
      [
        'The dry-run found **0 library moments** for Hook.',
        '',
        '- 1 generate-to-fill still',
        '- £0 with generation off',
        '',
        'Commit as-is, or search the library first?',
      ].join('\n'),
    )
    expect(blocks).toEqual([
      {
        type: 'p',
        inlines: [
          { type: 'text', value: 'The dry-run found ' },
          { type: 'strong', value: '0 library moments' },
          { type: 'text', value: ' for Hook.' },
        ],
      },
      {
        type: 'ul',
        items: [
          [{ type: 'text', value: '1 generate-to-fill still' }],
          [{ type: 'text', value: '£0 with generation off' }],
        ],
      },
      {
        type: 'p',
        inlines: [{ type: 'text', value: 'Commit as-is, or search the library first?' }],
      },
    ])
  })

  it('keeps numbered steps as an ordered list', () => {
    const blocks = parseMarkdown('1. Infer scenes\n2. Assemble overlay')
    expect(blocks).toEqual([
      {
        type: 'ol',
        items: [
          [{ type: 'text', value: 'Infer scenes' }],
          [{ type: 'text', value: 'Assemble overlay' }],
        ],
      },
    ])
  })

  it('parses a GFM table with bold cells', () => {
    const blocks = parseMarkdown(
      [
        'Scene-by-scene breakdown',
        '',
        '| Beat | Visual | Line |',
        '| --- | --- | --- |',
        '| Hook | Logo smash | **Open it.** |',
        '| Proof | Waveform | Hear the difference |',
      ].join('\n'),
    )
    expect(blocks).toEqual([
      { type: 'p', inlines: [{ type: 'text', value: 'Scene-by-scene breakdown' }] },
      {
        type: 'table',
        headers: [
          [{ type: 'text', value: 'Beat' }],
          [{ type: 'text', value: 'Visual' }],
          [{ type: 'text', value: 'Line' }],
        ],
        rows: [
          [
            [{ type: 'text', value: 'Hook' }],
            [{ type: 'text', value: 'Logo smash' }],
            [{ type: 'strong', value: 'Open it.' }],
          ],
          [
            [{ type: 'text', value: 'Proof' }],
            [{ type: 'text', value: 'Waveform' }],
            [{ type: 'text', value: 'Hear the difference' }],
          ],
        ],
      },
    ])
  })

  it('treats consecutive pipe rows as a table even without a separator (#1328)', () => {
    const blocks = parseMarkdown(
      [
        '| # | s | Role | Picture |',
        '| 1 | 0 | Hook | Logo smash |',
        '| 2 | 4 | Proof | Product still |',
      ].join('\n'),
    )
    expect(blocks).toEqual([
      {
        type: 'table',
        headers: [
          [{ type: 'text', value: '#' }],
          [{ type: 'text', value: 's' }],
          [{ type: 'text', value: 'Role' }],
          [{ type: 'text', value: 'Picture' }],
        ],
        rows: [
          [
            [{ type: 'text', value: '1' }],
            [{ type: 'text', value: '0' }],
            [{ type: 'text', value: 'Hook' }],
            [{ type: 'text', value: 'Logo smash' }],
          ],
          [
            [{ type: 'text', value: '2' }],
            [{ type: 'text', value: '4' }],
            [{ type: 'text', value: 'Proof' }],
            [{ type: 'text', value: 'Product still' }],
          ],
        ],
      },
    ])
  })

  it('keeps a single pipe line as a paragraph, not a one-row table', () => {
    const blocks = parseMarkdown('Use A | B as a shorthand.')
    expect(blocks).toEqual([
      { type: 'p', inlines: [{ type: 'text', value: 'Use A | B as a shorthand.' }] },
    ])
  })

  it('keeps fenced code as a pre block, not HTML', () => {
    const blocks = parseMarkdown('```tsx\nconst beat = 0\n```')
    expect(blocks).toEqual([{ type: 'pre', value: 'const beat = 0', lang: 'tsx' }])
  })
})
