import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyProject } from '../project'
import { setEndCard, setHookTitle } from '../project/operations'
import { parseVariantSpec } from './schema'
import { saveVariantChildOverrides } from './overrides'

const loadProject = vi.fn()
const saveProject = vi.fn()

vi.mock('../project/load', () => ({
  loadProject: (...args: unknown[]) => loadProject(...args),
}))

vi.mock('../project/save', () => ({
  saveProject: (...args: unknown[]) => saveProject(...args),
}))

describe('saveVariantChildOverrides', () => {
  beforeEach(() => {
    loadProject.mockReset()
    saveProject.mockReset()
  })

  it('writes hook/CTA overlays and mirrors overrides onto variant_spec', async () => {
    let child = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    child = setHookTitle(child, 'Old hook')
    child = setEndCard(child, 'Old CTA')
    child = { ...child, revision: 3 }

    const previousSpec = parseVariantSpec({
      platform: 'tiktok',
      hookIndex: 0,
      ctaIndex: 0,
      aspect: '9:16',
      label: 'TikTok · Hook 1 · CTA 1',
    })

    loadProject.mockResolvedValue({
      project: child,
      row: {
        id: child.id,
        parent_project_id: '11111111-1111-4111-8111-111111111111',
        variant_spec: previousSpec,
      },
    })
    saveProject.mockImplementation(async (_sb, project, expectedRevision: number) => ({
      project: { ...project, revision: expectedRevision + 1 },
    }))

    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn().mockReturnValue({ eq: updateEq })
    const supabase = { from: vi.fn().mockReturnValue({ update }) }

    const result = await saveVariantChildOverrides({
      supabase: supabase as never,
      parentProjectId: '11111111-1111-4111-8111-111111111111',
      childProjectId: child.id,
      hookText: '  Winning hook  ',
      ctaText: '  Winning CTA  ',
      expectedRevision: child.revision,
    })

    expect(result.revision).toBe(child.revision + 1)
    expect(result.variantSpec.hookOverride).toBe('Winning hook')
    expect(result.variantSpec.ctaOverride).toBe('Winning CTA')
    expect(result.variantSpec.hookIndex).toBe(-1)
    expect(saveProject).toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        variant_spec: expect.objectContaining({ hookOverride: 'Winning hook' }),
      }),
    )
  })

  it('rejects revision conflicts and variant_spec update failures', async () => {
    let child = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    child = { ...child, revision: 2 }
    loadProject.mockResolvedValue({
      project: child,
      row: {
        id: child.id,
        parent_project_id: '11111111-1111-4111-8111-111111111111',
        variant_spec: parseVariantSpec({
          platform: 'tiktok',
          hookIndex: 0,
          ctaIndex: 0,
          aspect: '9:16',
          label: 'TikTok · Hook 1 · CTA 1',
        }),
      },
    })
    await expect(
      saveVariantChildOverrides({
        supabase: {} as never,
        parentProjectId: '11111111-1111-4111-8111-111111111111',
        childProjectId: child.id,
        hookText: 'Hook',
        ctaText: 'CTA',
        expectedRevision: 9,
      }),
    ).rejects.toThrow(/revision conflict/)

    loadProject.mockResolvedValue({
      project: child,
      row: {
        id: child.id,
        parent_project_id: '11111111-1111-4111-8111-111111111111',
        variant_spec: parseVariantSpec({
          platform: 'tiktok',
          hookIndex: 0,
          ctaIndex: 0,
          aspect: '9:16',
          label: 'TikTok · Hook 1 · CTA 1',
        }),
      },
    })
    saveProject.mockResolvedValue({ project: { ...child, revision: 3 } })
    const updateEq = vi.fn().mockResolvedValue({ error: { message: 'db down' } })
    const update = vi.fn().mockReturnValue({ eq: updateEq })
    const supabase = { from: vi.fn().mockReturnValue({ update }) }
    await expect(
      saveVariantChildOverrides({
        supabase: supabase as never,
        parentProjectId: '11111111-1111-4111-8111-111111111111',
        childProjectId: child.id,
        hookText: 'Hook',
        ctaText: 'CTA',
        expectedRevision: 2,
      }),
    ).rejects.toThrow(/variant_spec/)
  })

  it('rejects empty hook/cta and wrong parent', async () => {
    await expect(
      saveVariantChildOverrides({
        supabase: {} as never,
        parentProjectId: 'p',
        childProjectId: 'c',
        hookText: ' ',
        ctaText: 'CTA',
        expectedRevision: 1,
      }),
    ).rejects.toThrow(/hookText/)

    loadProject.mockResolvedValue({
      project: createEmptyProject({
        id: '22222222-2222-4222-8222-222222222222',
        productId: 'demo',
      }),
      row: { parent_project_id: 'other', variant_spec: null },
    })
    await expect(
      saveVariantChildOverrides({
        supabase: {} as never,
        parentProjectId: '11111111-1111-4111-8111-111111111111',
        childProjectId: '22222222-2222-4222-8222-222222222222',
        hookText: 'Hook',
        ctaText: 'CTA',
        expectedRevision: 1,
      }),
    ).rejects.toThrow(/does not belong/)
  })
})
