import { describe, expect, it } from 'vitest'
import { buildMentionRows } from './chatMentions'

describe('buildMentionRows', () => {
  const assets = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      kind: 'image',
      source: 'upload',
      blobKey: 'x/hero.png',
      probe: { name: 'hero.png' },
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      kind: 'video',
      source: 'upload',
      blobKey: 'x/cut.mp4',
      probe: { name: 'cut.mp4' },
    },
  ]
  const scenes = [{ id: 'sc_aaaaaaaa', role: 'hook', label: 'Cold open' }]

  it('lists named items then category browse rows', () => {
    const rows = buildMentionRows({
      assets,
      slides: [],
      scenes,
      query: '',
      browse: null,
    })
    const items = rows.filter((row) => row.type === 'item')
    const cats = rows.filter((row) => row.type === 'category')
    expect(items.some((row) => row.type === 'item' && row.item.label === 'hero.png')).toBe(true)
    expect(cats.map((row) => (row.type === 'category' ? row.category.label : ''))).toEqual([
      'Images',
      'Videos',
      'Scenes',
    ])
  })

  it('drills into a category', () => {
    const rows = buildMentionRows({
      assets,
      slides: [],
      scenes,
      query: '',
      browse: 'images',
    })
    expect(rows[0]?.type).toBe('back')
    expect(rows.filter((row) => row.type === 'item')).toHaveLength(1)
    expect(rows.some((row) => row.type === 'item' && row.item.label === 'hero.png')).toBe(true)
  })
})
