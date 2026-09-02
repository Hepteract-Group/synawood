import { describe, expect, it } from 'vitest'
import { buildProjectTree } from './project-tree'

const item = (id: string, parentProjectId?: string, variantLabel?: string) => ({
  id,
  parentProjectId: parentProjectId ?? null,
  variantLabel: variantLabel ?? null,
})

describe('buildProjectTree', () => {
  it('nests ad versions under their main cut', () => {
    const tree = buildProjectTree([
      item('parent'),
      item('child-a', 'parent', 'TikTok · Hook 1'),
      item('child-b', 'parent', 'Reels · Hook 2'),
      item('standalone'),
    ])
    expect(tree.map((node) => node.project.id)).toEqual(['parent', 'standalone'])
    expect(tree[0].versions.map((v) => v.id)).toEqual(['child-a', 'child-b'])
    expect(tree[1].versions).toEqual([])
  })

  it('keeps orphan versions visible at top level', () => {
    const tree = buildProjectTree([item('child', 'missing-parent', 'TikTok · Hook 1')])
    expect(tree.map((node) => node.project.id)).toEqual(['child'])
  })
})
