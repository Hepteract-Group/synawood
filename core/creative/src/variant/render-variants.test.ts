import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadBriefFixture } from '../brief/fixtures/load-fixture'
import { applyBriefMinimal } from '../brief/apply-brief'
import { createEmptyProject } from '../project'
import { attachAsset } from '../project/operations'
import {
  createVariantChildProject,
  listVariantChildren,
  planVariantsForParent,
  renderVariantsForParent,
} from './render-variants'
import { makeVariantSpec } from './plan'

const loadProject = vi.fn()
const seedCurrentRevision = vi.fn()
const sumCostEventsGbp = vi.fn()
const recordCostEvent = vi.fn()
const enqueueRenderJob = vi.fn()
const gateSpend = vi.fn()
const readCreativeBudgets = vi.fn()

vi.mock('../project/load', () => ({
  loadProject: (...args: unknown[]) => loadProject(...args),
}))

vi.mock('../project/history', () => ({
  seedCurrentRevision: (...args: unknown[]) => seedCurrentRevision(...args),
}))

vi.mock('../pricing/ledger', () => ({
  sumCostEventsGbp: (...args: unknown[]) => sumCostEventsGbp(...args),
  recordCostEvent: (...args: unknown[]) => recordCostEvent(...args),
}))

vi.mock('../pricing/limits', () => ({
  gateSpend: (...args: unknown[]) => gateSpend(...args),
  readCreativeBudgets: (...args: unknown[]) => readCreativeBudgets(...args),
}))

vi.mock('../render/enqueue', () => ({
  enqueueRenderJob: (...args: unknown[]) => enqueueRenderJob(...args),
}))

const parentWithBrief = () => {
  let parent = createEmptyProject({
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    productId: 'demo',
    name: 'Parent cut',
  })
  parent = attachAsset(parent, {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    kind: 'image',
    blobKey: 'products/demo/uploads/logo.png',
    source: 'upload',
    probe: {},
  })
  const applied = applyBriefMinimal({ project: parent, brief: loadBriefFixture('acme-url-brief') })
  return applied.project
}

describe('planVariantsForParent', () => {
  it('builds a create-only plan from parent brief indexes', () => {
    const parent = parentWithBrief()
    const plan = planVariantsForParent({
      parent,
      platforms: ['tiktok', 'meta_feed'],
      hookIndexes: [0],
      ctaIndexes: [0, 1],
    })
    expect(plan.items).toHaveLength(4)
    expect(plan.estimatedGbp).toBe(0)
    expect(plan.items.some((item) => item.aspect === '1:1')).toBe(true)
  })

  it('rejects out-of-range indexes', () => {
    const parent = parentWithBrief()
    expect(() =>
      planVariantsForParent({
        parent,
        platforms: ['tiktok'],
        hookIndexes: [9],
        ctaIndexes: [0],
      }),
    ).toThrow(/hookIndexes/)
  })
})

describe('createVariantChildProject', () => {
  it('inserts a child that shares parent blob keys', async () => {
    const parent = parentWithBrief()
    const spec = makeVariantSpec({ platform: 'tiktok', hookIndex: 0, ctaIndex: 0 })
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        parent_project_id: parent.id,
        variant_spec: spec,
      },
      error: null,
    })
    const select = vi.fn().mockReturnValue({ single })
    const insert = vi.fn().mockReturnValue({ select })
    const supabase = { from: vi.fn().mockReturnValue({ insert }) }

    const result = await createVariantChildProject({
      supabase: supabase as never,
      parentRow: {
        id: parent.id,
        product_id: parent.productId,
        model_profile_id: 'founder-edit',
      } as never,
      parent,
      spec,
      brief: loadBriefFixture('acme-url-brief'),
      modelProfileId: 'founder-edit',
    })

    expect(result.project.assets[0]?.blobKey).toBe('products/demo/uploads/logo.png')
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        parent_project_id: parent.id,
        variant_spec: spec,
      }),
    )
    expect(seedCurrentRevision).toHaveBeenCalled()
  })
})

describe('listVariantChildren', () => {
  it('returns rows ordered by created_at', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{ id: 'child-1' }, { id: 'child-2' }],
      error: null,
    })
    const eq = vi.fn().mockReturnValue({ order })
    const select = vi.fn().mockReturnValue({ eq })
    const supabase = { from: vi.fn().mockReturnValue({ select }) }
    const rows = await listVariantChildren(supabase as never, 'parent-1')
    expect(rows).toHaveLength(2)
    expect(eq).toHaveBeenCalledWith('parent_project_id', 'parent-1')
  })

  it('throws when supabase errors', async () => {
    const order = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } })
    const eq = vi.fn().mockReturnValue({ order })
    const select = vi.fn().mockReturnValue({ eq })
    const supabase = { from: vi.fn().mockReturnValue({ select }) }
    await expect(listVariantChildren(supabase as never, 'parent-1')).rejects.toThrow(/boom/)
  })
})

describe('renderVariantsForParent', () => {
  beforeEach(() => {
    loadProject.mockReset()
    seedCurrentRevision.mockReset()
    sumCostEventsGbp.mockResolvedValue(0)
    recordCostEvent.mockResolvedValue(undefined)
    enqueueRenderJob.mockResolvedValue({ id: 'render-1' })
    gateSpend.mockReturnValue({ ok: true })
    readCreativeBudgets.mockReturnValue({
      monthlyCapGbp: 100,
      weeklySoftCapGbp: 25,
      perProjectWarnGbp: 5,
    })
    delete process.env.STUDIO_RENDER_API
  })

  it('creates children with shared media and can skip render enqueue', async () => {
    const parent = parentWithBrief()
    const activeBranchId = '33333333-3333-4333-8333-333333333333'
    loadProject.mockResolvedValue({
      project: parent,
      row: {
        id: parent.id,
        parent_project_id: null,
        model_profile_id: 'founder-edit',
        product_id: parent.productId,
        active_branch_id: activeBranchId,
      },
    })

    const single = vi.fn().mockImplementation(async () => ({
      data: {
        id: crypto.randomUUID(),
        parent_project_id: parent.id,
      },
      error: null,
    }))
    const select = vi.fn().mockReturnValue({ single })
    const insert = vi.fn().mockReturnValue({ select })
    const supabase = { from: vi.fn().mockReturnValue({ insert }) }

    const result = await renderVariantsForParent({
      supabase: supabase as never,
      parentProjectId: parent.id,
      items: [makeVariantSpec({ platform: 'tiktok', hookIndex: 0, ctaIndex: 0 })],
      enqueueRenders: false,
    })

    expect(result.children).toHaveLength(1)
    expect(result.children[0]?.variantSpec.sourceBranchId).toBe(activeBranchId)
    expect(result.estimatedGbp).toBe(0)
    expect(enqueueRenderJob).not.toHaveBeenCalled()
    expect(result.plan.warnings[0]).toMatch(/free/i)
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        variant_spec: expect.objectContaining({ sourceBranchId: activeBranchId }),
      }),
    )
  })

  it('enqueues renders when confirmSpend is true', async () => {
    const parent = parentWithBrief()
    loadProject.mockResolvedValue({
      project: parent,
      row: {
        id: parent.id,
        parent_project_id: null,
        model_profile_id: 'founder-edit',
        product_id: parent.productId,
      },
    })
    const single = vi.fn().mockResolvedValue({
      data: { id: crypto.randomUUID(), parent_project_id: parent.id },
      error: null,
    })
    const select = vi.fn().mockReturnValue({ single })
    const insert = vi.fn().mockReturnValue({ select })
    const supabase = { from: vi.fn().mockReturnValue({ insert }) }

    const result = await renderVariantsForParent({
      supabase: supabase as never,
      parentProjectId: parent.id,
      items: [makeVariantSpec({ platform: 'tiktok', hookIndex: 0, ctaIndex: 0 })],
      enqueueRenders: true,
      confirmSpend: true,
    })

    expect(result.children[0]?.renderJobId).toBe('render-1')
    expect(enqueueRenderJob).toHaveBeenCalled()
    expect(recordCostEvent).toHaveBeenCalled()
    expect(result.estimatedGbp).toBeGreaterThan(0)
  })

  it('requires confirmSpend before enqueueing paid exports', async () => {
    const parent = parentWithBrief()
    loadProject.mockResolvedValue({
      project: parent,
      row: { id: parent.id, parent_project_id: null, model_profile_id: 'founder-edit' },
    })
    await expect(
      renderVariantsForParent({
        supabase: {} as never,
        parentProjectId: parent.id,
        items: [makeVariantSpec({ platform: 'tiktok', hookIndex: 0, ctaIndex: 0 })],
        enqueueRenders: true,
      }),
    ).rejects.toThrow(/confirmSpend/)
  })

  it('rejects fan-out from a child project', async () => {
    loadProject.mockResolvedValue({
      project: parentWithBrief(),
      row: { id: 'child', parent_project_id: 'parent' },
    })
    await expect(
      renderVariantsForParent({
        supabase: {} as never,
        parentProjectId: 'child',
        items: [makeVariantSpec({ platform: 'tiktok', hookIndex: 0, ctaIndex: 0 })],
        enqueueRenders: false,
      }),
    ).rejects.toThrow(/parent cut/)
  })
})
