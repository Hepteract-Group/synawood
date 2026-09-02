import { describe, expect, it, vi } from 'vitest'
import { createEmptyProject } from '../project'
import { setEndCard, setHookTitle, trimClip } from '../project/operations'
import { updateProjectBrand } from '../brand/brand-ops'
import { applyPromoteFields, promoteVariantFieldsToParent } from './promote'
import type { StudioProject } from '../project/schema'

const loadProject = vi.fn()
const saveProject = vi.fn()

vi.mock('../project/load', () => ({
  loadProject: (...args: unknown[]) => loadProject(...args),
}))

vi.mock('../project/save', () => ({
  saveProject: (...args: unknown[]) => saveProject(...args),
}))

const parentBase = (): StudioProject => {
  let project = createEmptyProject({
    id: '11111111-1111-4111-8111-111111111111',
    productId: 'demo',
  })
  project = setHookTitle(project, 'Parent hook')
  project = setEndCard(project, 'Parent CTA')
  project = updateProjectBrand(project, { defaultCta: 'Parent CTA' })
  return project
}

const childWithCopy = (): StudioProject => {
  let project = createEmptyProject({
    id: '22222222-2222-4222-8222-222222222222',
    productId: 'demo',
  })
  project = setHookTitle(project, 'Winning hook')
  project = setEndCard(project, 'Winning CTA')
  project = updateProjectBrand(project, { defaultCta: 'Brand win' })
  return project
}

describe('applyPromoteFields', () => {
  it('promotes hook and end card onto parent without wiping other brand fields', () => {
    const parent = updateProjectBrand(parentBase(), {
      displayName: 'Acme',
      primaryColor: '#112233',
    })
    const child = childWithCopy()
    const result = applyPromoteFields({
      parent,
      child,
      fields: ['hook', 'end_card'],
    })
    expect(result.applied).toEqual(['hook', 'end_card'])
    expect(result.project.overlays.find((o) => o.kind === 'hook_title')?.text).toBe('Winning hook')
    expect(result.project.overlays.find((o) => o.kind === 'end_card')?.text).toBe('Winning CTA')
    expect(result.project.brand?.displayName).toBe('Acme')
    expect(result.project.brand?.primaryColor).toBe('#112233')
  })

  it('promotes brand CTA from child', () => {
    const result = applyPromoteFields({
      parent: parentBase(),
      child: childWithCopy(),
      fields: ['brand_cta'],
    })
    expect(result.project.brand?.defaultCta).toBe('Brand win')
  })

  it('promotes shared clip trims by asset id', () => {
    const assetId = '33333333-3333-4333-8333-333333333333'
    let parent = parentBase()
    parent = {
      ...parent,
      assets: [
        {
          id: assetId,
          kind: 'video',
          blobKey: 'local/test/a.mp4',
          source: 'upload',
          probe: { durationSeconds: 10 },
        },
      ],
      clips: [
        {
          id: '44444444-4444-4444-8444-444444444444',
          assetId,
          trackId: parent.tracks[0]?.id ?? 'video',
          from: 0,
          durationInFrames: 120,
          trim: { startFrames: 0 },
        },
      ],
      revision: parent.revision,
    }

    let child = childWithCopy()
    child = {
      ...child,
      assets: parent.assets,
      tracks: parent.tracks,
      clips: [
        {
          id: '55555555-5555-4555-8555-555555555555',
          assetId,
          trackId: parent.tracks[0]?.id ?? 'video',
          from: 30,
          durationInFrames: 60,
          trim: { startFrames: 15 },
        },
      ],
    }
    child = trimClip(child, child.clips[0].id, {
      from: 30,
      durationInFrames: 60,
      trimStartFrames: 15,
    })

    // Use the manually placed clip state (trimClip may have already been applied above)
    const childReady: StudioProject = {
      ...child,
      clips: [
        {
          id: '55555555-5555-4555-8555-555555555555',
          assetId,
          trackId: parent.tracks[0]?.id ?? 'video',
          from: 30,
          durationInFrames: 60,
          trim: { startFrames: 15 },
        },
      ],
    }

    const result = applyPromoteFields({
      parent,
      child: childReady,
      fields: ['clip_trim'],
    })
    expect(result.applied).toEqual(['clip_trim'])
    expect(result.project.clips[0]?.from).toBe(30)
    expect(result.project.clips[0]?.durationInFrames).toBe(60)
    expect(result.project.clips[0]?.trim.startFrames).toBe(15)
  })

  it('rejects empty field list', () => {
    expect(() =>
      applyPromoteFields({ parent: parentBase(), child: childWithCopy(), fields: [] }),
    ).toThrow(/at least one field/i)
  })
})

describe('promoteVariantFieldsToParent', () => {
  it('loads child/parent, applies fields, and saves', async () => {
    const parent = parentBase()
    const child = childWithCopy()
    loadProject.mockImplementation(async (_sb, id: string) => {
      if (id === child.id) {
        return {
          project: child,
          row: { parent_project_id: parent.id },
        }
      }
      return {
        project: parent,
        row: { parent_project_id: null },
      }
    })
    saveProject.mockImplementation(async (_sb, project) => ({ project }))

    const result = await promoteVariantFieldsToParent({
      supabase: {} as never,
      parentProjectId: parent.id,
      childProjectId: child.id,
      fields: ['hook'],
      expectedRevision: parent.revision,
    })
    expect(result.applied).toEqual(['hook'])
    expect(result.parent.overlays.find((o) => o.kind === 'hook_title')?.text).toBe('Winning hook')
    expect(saveProject).toHaveBeenCalled()
  })

  it('rejects promote into a non-parent cut', async () => {
    const parent = parentBase()
    const child = childWithCopy()
    loadProject.mockImplementation(async (_sb, id: string) => {
      if (id === child.id) {
        return { project: child, row: { parent_project_id: parent.id } }
      }
      return { project: parent, row: { parent_project_id: 'someone-else' } }
    })
    await expect(
      promoteVariantFieldsToParent({
        supabase: {} as never,
        parentProjectId: parent.id,
        childProjectId: child.id,
        fields: ['hook'],
        expectedRevision: parent.revision,
      }),
    ).rejects.toThrow(/only promote into a parent/)
  })

  it('rejects when child belongs to a different parent', async () => {
    const parent = parentBase()
    const child = childWithCopy()
    loadProject.mockResolvedValueOnce({
      project: child,
      row: { parent_project_id: 'other-parent' },
    })
    await expect(
      promoteVariantFieldsToParent({
        supabase: {} as never,
        parentProjectId: parent.id,
        childProjectId: child.id,
        fields: ['hook'],
        expectedRevision: parent.revision,
      }),
    ).rejects.toThrow(/does not belong/)
  })

  it('rejects revision conflicts on the parent', async () => {
    const parent = parentBase()
    const child = childWithCopy()
    loadProject.mockImplementation(async (_sb, id: string) => {
      if (id === child.id) {
        return { project: child, row: { parent_project_id: parent.id } }
      }
      return { project: { ...parent, revision: 99 }, row: { parent_project_id: null } }
    })
    await expect(
      promoteVariantFieldsToParent({
        supabase: {} as never,
        parentProjectId: parent.id,
        childProjectId: child.id,
        fields: ['hook'],
        expectedRevision: 1,
      }),
    ).rejects.toThrow(/revision conflict/)
  })
})
