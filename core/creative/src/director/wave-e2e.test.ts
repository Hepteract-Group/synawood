import { describe, expect, it, vi } from 'vitest'
import { createEmptyProject } from '../project/schema'
import { createStudioTools } from '../tools/studio-tools'
import type { StudioToolContext } from '../tools/types'

/**
 * Wave 2A mock-reasoner E2E — mirrors plan 08 local verification under ci-stub:
 * Intent → Infer/apply scenes → Director preview/commit → clip suggestions (no live LLM).
 */
const makeCtx = (): StudioToolContext => {
  const project = createEmptyProject({
    id: '22222222-2222-4222-8222-222222222222',
    productId: 'demo',
    compositionId: 'talking-head-60',
  })
  return {
    productId: 'demo',
    projectId: project.id,
    project: {
      ...project,
      assets: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          kind: 'video',
          blobKey: 'local/a.mp4',
          source: 'upload',
          probe: { durationFrames: 180 },
        },
        {
          id: '11111111-1111-4111-8111-111111111112',
          kind: 'video',
          blobKey: 'local/b.mp4',
          source: 'upload',
          probe: { durationFrames: 120 },
        },
      ],
      revision: 1,
    },
    expectedRevision: 1,
    supabase: { from: vi.fn() } as never,
    blobEnv: {
      connectionString: 'x',
      containerName: 'marketing-os',
      useLocalPrefix: true,
      accountName: 'a',
      accountKey: 'k',
    },
    modelProfileId: 'ci-stub',
    persist: false,
    toolTrace: [],
  }
}

describe('Wave 2A mock-reasoner E2E', () => {
  it('intent → scenes → director commit → suggest (ci-stub heuristic)', async () => {
    const ctx = makeCtx()
    const tools = createStudioTools(ctx)
    const exec = { toolCallId: 'e2e', messages: [] } as never

    await tools.add_clip.execute!(
      { assetId: '11111111-1111-4111-8111-111111111111', from: 0, durationInFrames: 180 },
      exec,
    )
    await tools.add_clip.execute!(
      { assetId: '11111111-1111-4111-8111-111111111112', from: 220, durationInFrames: 120 },
      exec,
    )

    const intentOut = await tools.set_intent.execute!(
      {
        goal: 'signup',
        platform: 'tiktok',
        emotion: 'exciting',
        lengthSeconds: 15,
        cta: 'Try the private example',
        keywords: ['Stop scrolling'],
      },
      exec,
    )
    expect(intentOut).toMatchObject({ ok: true })
    expect(ctx.project.intent.platform).toBe('tiktok')
    expect(ctx.project.directorRebuildPrompt).toBeTruthy()

    const planned = await tools.plan_scenes.execute!({ preserveClipOrder: true }, exec)
    expect(planned).toMatchObject({ ok: true })
    const scenes = (planned as { ok: true; data?: { scenes?: Record<string, unknown>[] } }).data
      ?.scenes
    expect((scenes?.length ?? 0) > 0).toBe(true)

    const appliedScenes = await tools.apply_scene_plan.execute!({ scenes: scenes! }, exec)
    expect(appliedScenes).toMatchObject({ ok: true })
    expect(ctx.project.scenes.length).toBeGreaterThan(0)

    const clipsBeforeDirector = JSON.stringify(ctx.project.clips)
    const drafted = await tools.direct_project.execute!({ style: 'energetic', dryRun: true }, exec)
    expect(drafted).toMatchObject({ ok: true })
    expect(JSON.stringify(ctx.project.clips)).toBe(clipsBeforeDirector)

    const plan = (
      drafted as {
        ok: true
        data?: {
          plan?: { id: string; edits: Array<{ status: string }>; costEstimateGbp: number }
          source?: string
        }
      }
    ).data
    expect(plan?.plan?.id).toBeTruthy()
    expect(plan?.source).toBe('heuristic')
    expect(plan?.plan?.costEstimateGbp).toBe(0)
    const proposed = (plan?.plan?.edits ?? []).filter((edit) => edit.status === 'proposed')
    expect(proposed.length).toBeGreaterThanOrEqual(2)

    const committed = await tools.commit_director_plan.execute!({ planId: plan!.plan!.id }, exec)
    expect(committed).toMatchObject({ ok: true })
    expect(JSON.stringify(ctx.project.clips)).not.toBe(clipsBeforeDirector)
    expect(ctx.project.directorRebuildPrompt).toBeNull()
    expect(ctx.project.revision).toBeGreaterThan(1)

    const clipId = ctx.project.clips[0]!.id
    const beforeSuggest = JSON.stringify(ctx.project)
    const suggested = await tools.suggest_for_clip.execute!({ clipId }, exec)
    expect(suggested).toMatchObject({ ok: true })
    expect(JSON.stringify(ctx.project)).toBe(beforeSuggest)
    const suggestions = (
      suggested as {
        ok: true
        data?: { suggestions?: Array<{ tool: string; requiresGenerator?: boolean }> }
      }
    ).data?.suggestions
    expect((suggestions?.length ?? 0) > 0).toBe(true)
    expect(suggestions?.every((row) => row.requiresGenerator !== true)).toBe(true)
  })
})
