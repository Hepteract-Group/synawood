import { describe, expect, it, vi } from 'vitest'
import { addCaptions, addClip } from '../project/operations'
import { createEmptyProject, parseStudioProject } from '../project/schema'
import { MAIN_VIDEO_TRACK_ID } from '../project/tracks'
import { createStudioTools } from './studio-tools'
import type { StudioToolContext } from './types'

const baseProject = () => {
  let project = createEmptyProject({
    id: '22222222-2222-4222-8222-222222222222',
    productId: 'demo',
  })
  project = {
    ...project,
    assets: [
      {
        id: '11111111-1111-4111-8111-111111111111',
        kind: 'video',
        blobKey: 'local/marketing-os/demo/uploads/a.mp4',
        source: 'upload',
        probe: { durationFrames: 300 },
      },
      {
        id: '44444444-4444-4444-8444-444444444444',
        kind: 'audio',
        blobKey: 'local/bed.mp3',
        source: 'generator',
        probe: { durationFrames: 900, role: 'music_bed' },
      },
    ],
    revision: 1,
  }
  return project
}

const makeCtx = (): StudioToolContext => {
  const project = baseProject()
  return {
    productId: 'demo',
    projectId: project.id,
    project,
    expectedRevision: project.revision,
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

describe('studio tools (in-memory)', () => {
  it('tells create_project to link the sibling cut (#1010)', () => {
    const tools = createStudioTools(makeCtx())
    expect(String(tools.create_project.description)).toMatch(/plan_slideshow on THIS project/)
    expect(String(tools.create_project.description)).toMatch(/markdown Open link/)
  })

  it('refuses add_clip on MAIN for an authored motion project (#1263)', async () => {
    const ctx = makeCtx()
    ctx.project = parseStudioProject({
      ...ctx.project,
      compositionId: 'authored',
      compositionSource: {
        source: 'export default () => null',
        motionSeed: 'seed-clip-1',
        compileError: null,
      },
    })
    const tools = createStudioTools(ctx)
    const outcome = await tools.add_clip.execute!(
      { assetId: '11111111-1111-4111-8111-111111111111', from: 0 },
      { toolCallId: '1', messages: [] } as never,
    )
    expect(outcome).toMatchObject({ ok: false })
    expect((outcome as { error: string }).error).toMatch(/motion-graphics|authored TSX|MAIN/i)
  })

  it('refuses remove_clip of generator music on authored unless allowRemoveAuthoredAudio (#1329)', async () => {
    const ctx = makeCtx()
    ctx.project = parseStudioProject({
      ...ctx.project,
      compositionId: 'authored',
      compositionSource: {
        source: 'export default () => null',
        motionSeed: 'seed-audio-1',
        compileError: null,
      },
    })
    ctx.project = addClip(ctx.project, {
      assetId: '44444444-4444-4444-8444-444444444444',
      trackId: 'track_audio',
      from: 0,
      durationInFrames: 900,
    })
    ctx.expectedRevision = ctx.project.revision
    const clipId = ctx.project.clips[0]!.id
    const tools = createStudioTools(ctx)
    const blocked = await tools.remove_clip.execute!({ clipId }, {
      toolCallId: 'rm1',
      messages: [],
    } as never)
    expect(blocked).toMatchObject({ ok: false })
    expect((blocked as { error: string }).error).toMatch(/do not remove_clip speech or music/i)

    ctx.allowRemoveAuthoredAudio = true
    const toolsAllowed = createStudioTools(ctx)
    const allowed = await toolsAllowed.remove_clip.execute!({ clipId }, {
      toolCallId: 'rm2',
      messages: [],
    } as never)
    expect(allowed).toMatchObject({ ok: true })
  })

  it('mutates overlays via set_hook_title, add_captions, set_end_card', async () => {
    const ctx = makeCtx()
    const tools = createStudioTools(ctx)

    await tools.set_hook_title.execute!({ text: 'Stuck on a PDF?' }, {
      toolCallId: '1',
      messages: [],
    } as never)
    await tools.add_captions.execute!({ text: 'Edit without Adobe' }, {
      toolCallId: '2',
      messages: [],
    } as never)
    await tools.set_end_card.execute!({ text: 'example.com' }, {
      toolCallId: '3',
      messages: [],
    } as never)

    expect(ctx.project.overlays.map((o) => o.kind).sort()).toEqual([
      'caption',
      'end_card',
      'hook_title',
    ])
    expect(ctx.toolTrace).toHaveLength(3)
    expect(ctx.toolTrace.every((entry) => entry.outcome.ok)).toBe(true)

    const summary = (await tools.get_project_summary.execute!({}, {
      toolCallId: '4',
      messages: [],
    } as never)) as {
      ok: true
      data?: { overlays?: Array<{ kind: string; from: number; end: number }> }
    }
    const card = summary.data?.overlays?.find((overlay) => overlay.kind === 'end_card')
    expect(card).toMatchObject({
      kind: 'end_card',
      from: expect.any(Number),
      end: expect.any(Number),
    })
  })

  it('set_end_card defaults text from intent.cta (#1220)', async () => {
    const ctx = makeCtx()
    ctx.project = {
      ...ctx.project,
      intent: { ...ctx.project.intent, cta: 'Start a trial' },
    }
    const tools = createStudioTools(ctx)
    await tools.set_end_card.execute!({}, { toolCallId: 'ec1', messages: [] } as never)
    const card = ctx.project.overlays.find((overlay) => overlay.kind === 'end_card')
    expect(card?.text).toBe('Start a trial')
  })

  it('adds and updates text overlays via add_text / update_overlay', async () => {
    const ctx = makeCtx()
    const tools = createStudioTools(ctx)

    const added = (await tools.add_text.execute!({ text: 'Free title', kind: 'title' }, {
      toolCallId: 't1',
      messages: [],
    } as never)) as { ok: true; data?: { overlayId?: string } }
    expect(added.ok).toBe(true)
    const overlayId = added.data?.overlayId
    expect(overlayId).toBeTruthy()
    expect(ctx.project.overlays.some((overlay) => overlay.kind === 'title')).toBe(true)

    const updated = (await tools.update_overlay.execute!(
      { overlayId: overlayId!, text: 'Revised title' },
      { toolCallId: 't2', messages: [] } as never,
    )) as { ok: true }
    expect(updated.ok).toBe(true)
    expect(ctx.project.overlays.find((overlay) => overlay.id === overlayId)?.text).toBe(
      'Revised title',
    )
  })

  it('places a first-party sticker without adding a MAIN clip', async () => {
    const ctx = makeCtx()
    const tools = createStudioTools(ctx)
    const placed = (await tools.place_sticker.execute!({ stickerId: 'circle', from: 45 }, {
      toolCallId: 's1',
      messages: [],
    } as never)) as { ok: true; data?: { overlayId?: string } }
    expect(placed.ok).toBe(true)
    expect(ctx.project.overlays.some((overlay) => overlay.kind === 'sticker')).toBe(true)
    expect(ctx.project.clips.filter((clip) => clip.trackId === MAIN_VIDEO_TRACK_ID)).toHaveLength(0)
  })

  it('builds captions from clip transcript word timings', async () => {
    const ctx = makeCtx()
    ctx.project = {
      ...ctx.project,
      assets: ctx.project.assets.map((asset) =>
        asset.id === '11111111-1111-4111-8111-111111111111'
          ? {
              ...asset,
              probe: {
                ...asset.probe,
                transcriptSegments: [
                  { startMs: 0, endMs: 400, text: 'Edit' },
                  { startMs: 400, endMs: 900, text: 'PDFs' },
                ],
              },
            }
          : asset,
      ),
    }
    const tools = createStudioTools(ctx)
    await tools.add_clip.execute!(
      {
        assetId: '11111111-1111-4111-8111-111111111111',
        from: 0,
        durationInFrames: 90,
      },
      { toolCallId: 'cap-1', messages: [] } as never,
    )
    const clipId = ctx.project.clips[0]?.id
    expect(clipId).toBeTruthy()
    const outcome = (await tools.captions_from_transcript.execute!({ clipId: clipId! }, {
      toolCallId: 'cap-2',
      messages: [],
    } as never)) as { ok: boolean; error?: string }
    expect(outcome.ok).toBe(true)
    expect(ctx.project.overlays.some((overlay) => overlay.kind === 'caption')).toBe(true)
  })

  it('apply_brief seeds brand and Path C overlays (minimal)', async () => {
    const ctx = makeCtx()
    const tools = createStudioTools(ctx)
    const outcome = await tools.apply_brief.execute!(
      {
        firstCutMode: 'minimal',
        brief: {
          id: '33333333-3333-4333-8333-333333333333',
          source: {
            kind: 'url',
            uri: 'https://example.com/',
            fetchedAt: '2026-08-02T12:00:00.000Z',
          },
          brandCandidates: {
            displayName: 'the private example',
            primaryColor: '#1a5c3a',
            defaultCta: 'Try the private example',
            stillAssetIds: [],
          },
          product: { name: 'the private example', oneLiner: 'Focus PDF reader.', benefits: [], socialProof: [] },
          messaging: {
            hookCandidates: ['Stop drowning in PDFs'],
            ctaCandidates: ['Try the private example'],
            audienceHints: [],
          },
          confidence: { overall: 0.6 },
        },
      },
      { toolCallId: 'apply', messages: [] } as never,
    )
    expect(outcome).toMatchObject({ ok: true })
    expect(ctx.project.brand?.displayName).toBe('the private example')
    expect(ctx.project.brand?.primaryColor).toBe('#1a5c3a')
    expect(ctx.project.brief?.id).toBe('33333333-3333-4333-8333-333333333333')
    expect(ctx.project.overlays.find((o) => o.kind === 'hook_title')?.text).toBe(
      'Stop drowning in PDFs',
    )
  })

  it('adds, places, trims, splits, and ripple deletes a clip', async () => {
    const ctx = makeCtx()
    const tools = createStudioTools(ctx)
    await tools.add_clip.execute!(
      { assetId: '11111111-1111-4111-8111-111111111111', from: 0, durationInFrames: 120 },
      { toolCallId: '1', messages: [] } as never,
    )
    const clipId = ctx.project.clips[0]?.id
    expect(clipId).toBeTruthy()
    await tools.trim_clip.execute!({ clipId: clipId!, durationInFrames: 60 }, {
      toolCallId: '2',
      messages: [],
    } as never)
    expect(ctx.project.clips[0]?.durationInFrames).toBe(60)

    await tools.place_clip.execute!({ clipId: clipId!, from: 30 }, {
      toolCallId: '3',
      messages: [],
    } as never)
    expect(ctx.project.clips[0]?.from).toBe(30)

    await tools.split_clip.execute!({ clipId: clipId!, atFrame: 60 }, {
      toolCallId: '4',
      messages: [],
    } as never)
    expect(ctx.project.clips).toHaveLength(2)

    await tools.ripple_delete_clip.execute!({ clipId: clipId! }, {
      toolCallId: '5',
      messages: [],
    } as never)
    expect(ctx.project.clips).toHaveLength(1)
    expect(ctx.project.clips[0]?.from).toBe(30)

    const missing = await tools.add_clip.execute!(
      { assetId: '99999999-9999-4999-8999-999999999999' },
      { toolCallId: '6', messages: [] } as never,
    )
    expect(missing).toMatchObject({ ok: false })
    expect(ctx.toolTrace.map((entry) => entry.toolName)).toEqual([
      'add_clip',
      'trim_clip',
      'place_clip',
      'split_clip',
      'ripple_delete_clip',
      'add_clip',
    ])
  })

  it('rejects place_clip no-op (same from) instead of reporting success', async () => {
    const ctx = makeCtx()
    const tools = createStudioTools(ctx)
    await tools.add_clip.execute!(
      { assetId: '11111111-1111-4111-8111-111111111111', from: 0, durationInFrames: 90 },
      { toolCallId: '1', messages: [] } as never,
    )
    const clipId = ctx.project.clips[0]!.id
    const noop = await tools.place_clip.execute!({ clipId, from: 0 }, {
      toolCallId: '2',
      messages: [],
    } as never)
    expect(noop).toMatchObject({ ok: false })
    expect(String((noop as { error?: string }).error ?? '')).toMatch(
      /nothing new to apply|no change/i,
    )
  })

  it('imports product brand tokens and generates mock image/voiceover', async () => {
    const ctx = makeCtx()
    const tools = createStudioTools(ctx)
    const blocked = await tools.generate_image.execute!({ prompt: 'calm conceptual workspace' }, {
      toolCallId: '0',
      messages: [],
    } as never)
    expect(blocked).toMatchObject({ ok: false })

    const brand = await tools.import_product_brand.execute!({}, {
      toolCallId: '1',
      messages: [],
    } as never)
    expect(brand).toMatchObject({ ok: true })
    expect(ctx.project.brand?.primaryColor).toBe('#2563EB')

    const image = await tools.generate_image.execute!({ prompt: 'calm conceptual workspace' }, {
      toolCallId: '2',
      messages: [],
    } as never)
    expect(image).toMatchObject({ ok: true })
    expect(ctx.project.assets.some((a) => a.source === 'generator' && a.kind === 'image')).toBe(
      true,
    )

    const video = await tools.generate_video_clip.execute!(
      { prompt: 'Okiki street motion', durationSeconds: 4, confirmSpend: true },
      { toolCallId: '2b', messages: [] } as never,
    )
    expect(video).toMatchObject({ ok: true })
    expect(ctx.project.clips.some((clip) => clip.trackId === MAIN_VIDEO_TRACK_ID)).toBe(true)
    expect(
      ctx.project.assets.some((asset) => asset.kind === 'video' && asset.source === 'generator'),
    ).toBe(true)

    const profile = await tools.set_model_profile.execute!({ profileId: 'founder-edit' }, {
      toolCallId: '3',
      messages: [],
    } as never)
    expect(profile).toMatchObject({ ok: true })
    const videoBlocked = await tools.generate_video_clip.execute!(
      { prompt: 'broll', confirmSpend: true },
      { toolCallId: '4', messages: [] } as never,
    )
    expect(videoBlocked).toMatchObject({ ok: false })
  })

  it('plans and edits slides on a slideshow project', async () => {
    const ctx = makeCtx()
    ctx.project = createEmptyProject({
      id: ctx.project.id,
      productId: 'demo',
      compositionId: 'social-carousel',
      slideshowPresetId: 'ig_carousel_1080',
    })
    ctx.expectedRevision = ctx.project.revision
    const tools = createStudioTools(ctx)

    const planned = await tools.plan_slideshow.execute!(
      { headlines: ['Hook', 'Problem', 'Proof', 'Product', 'CTA'] },
      { toolCallId: 's1', messages: [] } as never,
    )
    expect(planned).toMatchObject({ ok: true })
    expect(ctx.project.slideshow?.slides).toHaveLength(5)

    const slideId = ctx.project.slideshow!.slides[0]!.id
    const updated = await tools.set_slide.execute!(
      { slideId, headline: 'Stronger hook', body: 'Edit PDFs without Adobe' },
      { toolCallId: 's2', messages: [] } as never,
    )
    expect(updated).toMatchObject({ ok: true })
    expect(ctx.project.slideshow!.slides[0]?.headline).toBe('Stronger hook')

    const ids = ctx.project.slideshow!.slides.map((slide) => slide.id)
    const reordered = await tools.reorder_slides.execute!(
      { orderedIds: [ids[4]!, ids[0]!, ids[1]!, ids[2]!, ids[3]!] },
      { toolCallId: 's3', messages: [] } as never,
    )
    expect(reordered).toMatchObject({ ok: true })
    expect(ctx.project.slideshow!.slides.map((s) => s.order)).toEqual([0, 1, 2, 3, 4])
    expect(ctx.project.slideshow!.slides[0]?.headline).toBe('CTA')
  })

  it('plans slides on a Video Suite project so they appear on this player', async () => {
    const ctx = makeCtx()
    ctx.project = createEmptyProject({
      id: ctx.project.id,
      productId: 'demo',
      compositionId: 'talking-head-60',
    })
    ctx.expectedRevision = ctx.project.revision
    const tools = createStudioTools(ctx)
    const planned = await tools.plan_slideshow.execute!({ headlines: ['Hook', 'Problem', 'CTA'] }, {
      toolCallId: 'th-slides',
      messages: [],
    } as never)
    expect(planned).toMatchObject({ ok: true })
    expect(ctx.project.compositionId).toBe('vertical-slideshow')
    expect(ctx.project.slideshow?.slides).toHaveLength(3)
    expect(String((planned as { summary?: string }).summary ?? '')).toMatch(
      /this player \(1080×1920\)/i,
    )
    expect(String((planned as { summary?: string }).summary ?? '')).toMatch(/Converted this cut/)
  })

  it('refuses plan_slideshow on a Campaign Pack', async () => {
    const ctx = makeCtx()
    ctx.project = createEmptyProject({
      id: ctx.project.id,
      productId: 'demo',
      compositionId: 'campaign-pack-still',
    })
    ctx.expectedRevision = ctx.project.revision
    const tools = createStudioTools(ctx)
    const refused = await tools.plan_slideshow.execute!({ count: 5 }, {
      toolCallId: 'pack-slides',
      messages: [],
    } as never)
    expect(refused).toMatchObject({ ok: false })
    expect(String((refused as { error?: string }).error ?? '')).toMatch(/Campaign Pack/)
  })

  it('saves campaign brief and batch-generates mock creatives', async () => {
    const ctx = makeCtx()
    ctx.project = createEmptyProject({
      id: ctx.project.id,
      productId: 'demo',
      compositionId: 'campaign-pack-still',
    })
    ctx.expectedRevision = ctx.project.revision
    const tools = createStudioTools(ctx)

    await tools.import_product_brand.execute!({}, {
      toolCallId: 'c0',
      messages: [],
    } as never)

    const brief = await tools.set_campaign_brief.execute!(
      {
        prompt: 'Calm focus for PDF readers',
        aspect: '1:1',
        productId: 'demo',
      },
      { toolCallId: 'c1', messages: [] } as never,
    )
    expect(brief).toMatchObject({ ok: true })
    expect(ctx.project.campaignPack?.brief.prompt).toMatch(/Calm focus/)

    const estimate = await tools.generate_campaign_creatives.execute!(
      { count: 2, estimateOnly: true },
      { toolCallId: 'c2', messages: [] } as never,
    )
    expect(estimate).toMatchObject({ ok: true })
    expect((estimate as { data?: { estimatedGbp?: number } }).data?.estimatedGbp).toBe(0)

    const generated = await tools.generate_campaign_creatives.execute!(
      { count: 2, headlines: ['Hook', 'CTA'] },
      { toolCallId: 'c3', messages: [] } as never,
    )
    expect(generated).toMatchObject({ ok: true })
    expect(ctx.project.campaignPack?.creatives).toHaveLength(2)
    expect(ctx.project.campaignPack?.creatives.every((c) => Boolean(c.backgroundAssetId))).toBe(
      true,
    )

    const creativeId = ctx.project.campaignPack!.creatives[0]!.id
    const patched = await tools.set_campaign_creative.execute!(
      { creativeId, headline: 'Stronger hook' },
      { toolCallId: 'c4', messages: [] } as never,
    )
    expect(patched).toMatchObject({ ok: true })
    expect(ctx.project.campaignPack!.creatives[0]!.headline).toBe('Stronger hook')

    ctx.modelProfileId = 'seedream-lite'
    const blocked = await tools.generate_campaign_creatives.execute!({ count: 2 }, {
      toolCallId: 'c5',
      messages: [],
    } as never)
    expect(blocked).toMatchObject({ ok: false })
    expect(String((blocked as { error?: string }).error ?? '')).toMatch(/confirmSpend/)
  })

  it('set_intent, plan_scenes, apply_scene_plan, and assign_clip_to_scene', async () => {
    const ctx = makeCtx()
    const tools = createStudioTools(ctx)

    await tools.add_clip.execute!({ assetId: '11111111-1111-4111-8111-111111111111', from: 0 }, {
      toolCallId: 'i0',
      messages: [],
    } as never)
    const clipId = ctx.project.clips[0]!.id

    const intentOut = await tools.set_intent.execute!(
      {
        goal: 'signup',
        platform: 'tiktok',
        emotion: 'emotional',
        lengthSeconds: 15,
        cta: 'Download today',
        funnelStage: 'mof',
        kpi: 'trial starts',
        desiredBehaviour: 'start a 14-day trial',
        audience: {
          persona: 'Ops leads',
          awarenessStage: 'problem-aware',
          language: 'I spend evenings merging files',
          primaryPain: 'uneditable scans',
        },
        primaryMessage: 'Stop hunting 14 tender portals',
        supportingPoints: ['One inbox'],
      },
      { toolCallId: 'i1', messages: [] } as never,
    )
    expect(intentOut).toMatchObject({ ok: true })
    expect(ctx.project.intent.platform).toBe('tiktok')
    expect(ctx.project.intent.funnelStage).toBe('mof')
    expect(ctx.project.intent.kpi).toBe('trial starts')
    expect(ctx.project.intent.desiredBehaviour).toBe('start a 14-day trial')
    expect(ctx.project.intent.audience?.awarenessStage).toBe('problem-aware')
    expect(ctx.project.intent.audience?.primaryPain).toBe('uneditable scans')
    expect(ctx.project.intent.primaryMessage).toBe('Stop hunting 14 tender portals')
    expect(ctx.project.intent.supportingPoints).toEqual(['One inbox'])
    expect(ctx.project.intent.cta).toBe('Download today')

    const surplusSpend = await tools.set_intent.execute!(
      { emotion: 'urgent', confirmSpend: true } as never,
      { toolCallId: 'i1b', messages: [] } as never,
    )
    expect(surplusSpend).toMatchObject({ ok: true })
    expect(ctx.project.intent.emotion).toBe('urgent')
    expect(ctx.project.intent).not.toHaveProperty('confirmSpend')
    expect(ctx.project.directorRebuildPrompt?.diffs.some((line) => line.includes('emotion'))).toBe(
      true,
    )

    const planned = await tools.plan_scenes.execute!({ preserveClipOrder: true }, {
      toolCallId: 'i2',
      messages: [],
    } as never)
    expect(planned).toMatchObject({ ok: true })
    const scenes = (planned as { ok: true; data?: { scenes?: Record<string, unknown>[] } }).data
      ?.scenes
    expect(scenes?.length).toBeGreaterThan(0)

    const applied = await tools.apply_scene_plan.execute!({ scenes: scenes! }, {
      toolCallId: 'i3',
      messages: [],
    } as never)
    expect(applied).toMatchObject({ ok: true })
    expect(ctx.project.scenes.length).toBeGreaterThan(0)

    const sceneId = ctx.project.scenes[0]!.id
    await tools.assign_clip_to_scene.execute!({ clipId, sceneId }, {
      toolCallId: 'i4',
      messages: [],
    } as never)
    expect(ctx.project.scenes[0]?.clipIds).toContain(clipId)

    const again = await tools.assign_clip_to_scene.execute!({ clipId, sceneId }, {
      toolCallId: 'i4b',
      messages: [],
    } as never)
    expect(again).toMatchObject({ ok: true })
    expect((again as { ok: true; summary: string }).summary).toMatch(/already on that scene/i)

    await tools.remove_clip.execute!({ clipId }, { toolCallId: 'i5', messages: [] } as never)
    expect(ctx.project.scenes.every((scene) => !scene.clipIds.includes(clipId))).toBe(true)
  })

  it('direct_project dryRun does not mutate; commit applies edits', async () => {
    const ctx = makeCtx()
    const tools = createStudioTools(ctx)
    await tools.add_clip.execute!(
      { assetId: '11111111-1111-4111-8111-111111111111', from: 0, durationInFrames: 120 },
      { toolCallId: 'd0', messages: [] } as never,
    )
    // second clip so pack_clips is proposed
    ctx.project = {
      ...ctx.project,
      assets: [
        ...ctx.project.assets,
        {
          id: '11111111-1111-4111-8111-111111111112',
          kind: 'video',
          blobKey: 'local/b.mp4',
          source: 'upload',
          probe: { durationFrames: 90 },
        },
      ],
    }
    await tools.add_clip.execute!(
      { assetId: '11111111-1111-4111-8111-111111111112', from: 200, durationInFrames: 90 },
      { toolCallId: 'd1', messages: [] } as never,
    )
    await tools.set_intent.execute!({ emotion: 'urgent', lengthSeconds: 5 }, {
      toolCallId: 'd2',
      messages: [],
    } as never)
    expect(ctx.project.directorRebuildPrompt).toBeTruthy()

    const clipsBefore = JSON.stringify(ctx.project.clips)
    const drafted = await tools.direct_project.execute!({ style: 'urgent', dryRun: true }, {
      toolCallId: 'd3',
      messages: [],
    } as never)
    expect(drafted).toMatchObject({ ok: true })
    expect(JSON.stringify(ctx.project.clips)).toBe(clipsBefore)
    const plan = (drafted as { ok: true; data?: { plan?: { id: string; edits: unknown[] } } }).data
      ?.plan
    expect(plan?.id).toBeTruthy()
    expect((plan?.edits?.length ?? 0) > 0).toBe(true)

    const committed = await tools.commit_director_plan.execute!({ planId: plan!.id }, {
      toolCallId: 'd4',
      messages: [],
    } as never)
    expect(committed).toMatchObject({ ok: true })
    expect(JSON.stringify(ctx.project.clips)).not.toBe(clipsBefore)
    expect(ctx.project.directorRebuildPrompt).toBeNull()
  })

  it('reject_director_plan persists rejected and clears mirror', async () => {
    const ctx = makeCtx()
    const tools = createStudioTools(ctx)
    await tools.add_clip.execute!(
      { assetId: '11111111-1111-4111-8111-111111111111', from: 0, durationInFrames: 120 },
      { toolCallId: 'r0', messages: [] } as never,
    )
    ctx.project = {
      ...ctx.project,
      assets: [
        ...ctx.project.assets,
        {
          id: '11111111-1111-4111-8111-111111111112',
          kind: 'video',
          blobKey: 'local/b.mp4',
          source: 'upload',
          probe: { durationFrames: 90 },
        },
      ],
    }
    await tools.add_clip.execute!(
      { assetId: '11111111-1111-4111-8111-111111111112', from: 200, durationInFrames: 90 },
      { toolCallId: 'r1', messages: [] } as never,
    )
    await tools.set_intent.execute!({ emotion: 'urgent', lengthSeconds: 5 }, {
      toolCallId: 'r2',
      messages: [],
    } as never)
    const drafted = await tools.direct_project.execute!({ style: 'urgent', dryRun: true }, {
      toolCallId: 'r3',
      messages: [],
    } as never)
    const plan = (drafted as { ok: true; data?: { plan?: { id: string } } }).data?.plan
    expect(plan?.id).toBeTruthy()

    const rejected = await tools.reject_director_plan.execute!({ planId: plan!.id }, {
      toolCallId: 'r4',
      messages: [],
    } as never)
    expect(rejected).toMatchObject({ ok: true })
    expect(ctx.project.directorPlan).toBeUndefined()
    expect(ctx.project.directorRebuildPrompt).toBeNull()
    expect(
      (rejected as { ok: true; data?: { plan?: { status: string } } }).data?.plan?.status,
    ).toBe('rejected')

    const cleared = await tools.clear_director_rebuild_prompt.execute!({}, {
      toolCallId: 'r5',
      messages: [],
    } as never)
    expect(cleared).toMatchObject({ ok: true })
  })

  it('suggest_for_clip returns heuristic suggestions without mutating', async () => {
    const ctx = makeCtx()
    const tools = createStudioTools(ctx)
    await tools.add_clip.execute!(
      { assetId: '11111111-1111-4111-8111-111111111111', from: 0, durationInFrames: 180 },
      { toolCallId: 'sg0', messages: [] } as never,
    )
    const clipId = ctx.project.clips[0]!.id
    const before = JSON.stringify(ctx.project.clips)
    const out = await tools.suggest_for_clip.execute!({ clipId }, {
      toolCallId: 'sg1',
      messages: [],
    } as never)
    expect(out).toMatchObject({ ok: true })
    expect(JSON.stringify(ctx.project.clips)).toBe(before)
    const suggestions = (out as { ok: true; data?: { suggestions?: Array<{ tool: string }> } }).data
      ?.suggestions
    expect((suggestions?.length ?? 0) > 0).toBe(true)
    expect(
      suggestions?.some((s) => ['trim_clip', 'add_captions', 'split_clip'].includes(s.tool)),
    ).toBe(true)
  })

  it('branch tools require persistence in offline eval ctx', async () => {
    const ctx = makeCtx()
    const tools = createStudioTools(ctx)
    const listed = await tools.list_branches.execute!({}, {
      toolCallId: 'b1',
      messages: [],
    } as never)
    expect(listed).toMatchObject({ ok: false })
    expect((listed as { ok: false; error: string }).error).toMatch(/persisted/i)

    const saveAs = await tools.save_director_plan_as_branch.execute!(
      {
        planId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        branchName: 'Funny',
      },
      { toolCallId: 'b2', messages: [] } as never,
    )
    expect(saveAs).toMatchObject({ ok: false })
    expect((saveAs as { ok: false; error: string }).error).toMatch(/persisted/i)
  })

  it('exposes asset intelligence retrieval tools', async () => {
    const ctx = makeCtx()
    const tools = createStudioTools(ctx)
    expect(typeof tools.find_assets.execute).toBe('function')
    expect(typeof tools.list_assets_by_tag.execute).toBe('function')
    expect(typeof tools.describe_asset.execute).toBe('function')
    expect(typeof tools.analyze_asset.execute).toBe('function')
  })

  it('switches locale and applies money on the CTA', async () => {
    const ctx = makeCtx()
    const tools = createStudioTools(ctx)
    await tools.set_hook_title.execute!({ text: 'Read PDFs faster' }, {
      toolCallId: 'loc-1',
      messages: [],
    } as never)
    const switched = await tools.set_active_locale.execute!({ locale: 'fr' }, {
      toolCallId: 'loc-2',
      messages: [],
    } as never)
    expect(switched).toMatchObject({ ok: true })
    expect(ctx.project.localization.activeLocale).toBe('fr')
    const money = await tools.apply_locale_money.execute!(
      { currency: 'EUR', amountMinor: 999, applyToCta: true },
      { toolCallId: 'loc-3', messages: [] } as never,
    )
    expect(money).toMatchObject({ ok: true })
    expect(ctx.project.localization.money?.currency).toBe('EUR')
    expect(ctx.project.intent.cta).toMatch(/9[.,]99/)
  })

  it('lists first-party overlay library items without hitting the table', async () => {
    const ctx = makeCtx()
    const tools = createStudioTools(ctx)
    const listed = await tools.list_library.execute!({ kind: 'sticker' }, {
      toolCallId: 'lib-1',
      messages: [],
    } as never)
    expect(listed).toMatchObject({ ok: true })
    expect(listed).toMatchObject({
      data: { items: expect.arrayContaining([expect.objectContaining({ id: 'arrow-right' })]) },
    })
    expect(ctx.supabase.from).not.toHaveBeenCalled()
  })

  it('creates a grade token library filter in memory', async () => {
    const ctx = makeCtx()
    const tools = createStudioTools(ctx)
    const created = await tools.create_library_item.execute!(
      {
        kind: 'filter',
        label: 'Warmer',
        recipe: { contrast: 1.05, saturate: 1.1, hueRotate: 6, sepia: 0.08, vignette: 0.1 },
      },
      { toolCallId: 'lib-2', messages: [] } as never,
    )
    expect(created).toMatchObject({ ok: true })
    expect(created).toMatchObject({
      data: { item: { kind: 'filter', licenseStatus: 'unknown', commercialUseAllowed: false } },
    })
  })

  it('imports a JSON grade and rejects an NLE filename', async () => {
    const ctx = makeCtx()
    const tools = createStudioTools(ctx)
    const imported = await tools.import_library_item.execute!(
      {
        fileName: 'warmer.json',
        contentType: 'application/json',
        jsonText: JSON.stringify({
          contrast: 1.1,
          saturate: 1.05,
          hueRotate: 4,
          sepia: 0.05,
          vignette: 0.1,
        }),
      },
      { toolCallId: 'lib-3', messages: [] } as never,
    )
    expect(imported).toMatchObject({ ok: true })
    const rejected = await tools.import_library_item.execute!(
      { fileName: 'cut.prproj', bytesBase64: Buffer.from('nope').toString('base64') },
      { toolCallId: 'lib-4', messages: [] } as never,
    )
    expect(rejected).toMatchObject({ ok: false })
    expect(String((rejected as { error?: string }).error)).toMatch(/NLE/)
  })

  it('lists and applies a first-party style pack', async () => {
    const ctx = makeCtx()
    const tools = createStudioTools(ctx)
    const listed = await tools.list_style_packs.execute!({}, {
      toolCallId: 'fx-1',
      messages: [],
    } as never)
    expect(listed).toMatchObject({ ok: true })
    const set = await tools.set_style_pack.execute!({ packId: 'vhs' }, {
      toolCallId: 'fx-2',
      messages: [],
    } as never)
    expect(set).toMatchObject({ ok: true })
    expect(ctx.project.stylePackId).toBe('vhs')
    const cleared = await tools.set_style_pack.execute!({ packId: null }, {
      toolCallId: 'fx-3',
      messages: [],
    } as never)
    expect(cleared).toMatchObject({ ok: true })
    expect(ctx.project.stylePackId).toBeNull()
  })

  it('applies a clip filter and leaves the cut pack alone', async () => {
    const ctx = makeCtx()
    ctx.project = addClip(ctx.project, {
      assetId: '11111111-1111-4111-8111-111111111111',
      from: 0,
    })
    const tools = createStudioTools(ctx)
    const clipId = ctx.project.clips[0]!.id
    const applied = await tools.apply_filter.execute!({ clipId, filterId: 'vhs', intensity: 0.7 }, {
      toolCallId: 'fl-1',
      messages: [],
    } as never)
    expect(applied).toMatchObject({ ok: true })
    expect(ctx.project.clips[0]?.filterId).toBe('vhs')
    expect(ctx.project.stylePackId ?? null).toBeNull()
    const cleared = await tools.clear_filter.execute!({ clipId }, {
      toolCallId: 'fl-2',
      messages: [],
    } as never)
    expect(cleared).toMatchObject({ ok: true })
    expect(ctx.project.clips[0]?.filterId ?? null).toBeNull()
  })

  it('apply_filter without clipId grades the cut', async () => {
    const ctx = makeCtx()
    const tools = createStudioTools(ctx)
    const applied = await tools.apply_filter.execute!({ filterId: 'luxury-perfume' }, {
      toolCallId: 'fl-3',
      messages: [],
    } as never)
    expect(applied).toMatchObject({ ok: true })
    expect(ctx.project.stylePackId).toBe('luxury-perfume')
  })

  it('applies and clears a clip treatment', async () => {
    const ctx = makeCtx()
    ctx.project = addClip(ctx.project, {
      assetId: '11111111-1111-4111-8111-111111111111',
      from: 0,
    })
    const tools = createStudioTools(ctx)
    const clipId = ctx.project.clips[0]!.id
    const applied = await tools.apply_effect.execute!(
      { clipId, effectId: 'shake', intensity: 0.5 },
      { toolCallId: 'fx-1', messages: [] } as never,
    )
    expect(applied).toMatchObject({ ok: true })
    expect(ctx.project.clips[0]?.treatments).toEqual([{ id: 'shake', intensity: 0.5 }])
    const cleared = await tools.clear_effect.execute!({ clipId, effectId: 'shake' }, {
      toolCallId: 'fx-2',
      messages: [],
    } as never)
    expect(cleared).toMatchObject({ ok: true })
    expect(ctx.project.clips[0]?.treatments ?? []).toEqual([])
  })

  it('regenerates one clip treatment', async () => {
    const ctx = makeCtx()
    ctx.project = addClip(ctx.project, {
      assetId: '11111111-1111-4111-8111-111111111111',
      from: 0,
    })
    const tools = createStudioTools(ctx)
    const clipId = ctx.project.clips[0]!.id
    await tools.apply_effect.execute!({ clipId, effectId: 'shake', intensity: 0.6 }, {
      toolCallId: 'fx-r1',
      messages: [],
    } as never)
    const regenerated = await tools.regen_effect.execute!({ clipId, effectId: 'shake' }, {
      toolCallId: 'fx-r2',
      messages: [],
    } as never)
    expect(regenerated).toMatchObject({ ok: true })
    expect(ctx.project.clips[0]?.treatments).toEqual([{ id: 'shake', intensity: 1 }])
    expect(ctx.project.whyLog?.at(-1)?.reason).toMatch(/Shake/)
  })

  it('applies a news split pip layout', async () => {
    const ctx = makeCtx()
    const tools = createStudioTools(ctx)
    const outcome = await tools.set_pip_layout.execute!({ preset: 'news' }, {
      toolCallId: 'pip-1',
      messages: [],
    } as never)
    expect(outcome).toMatchObject({ ok: true })
    expect(ctx.project.pipLayout?.mode).toBe('split')
    expect(ctx.project.pipLayout?.mainPct).toBeCloseTo(0.58)
    const swapped = await tools.set_pip_layout.execute!({ swap: true }, {
      toolCallId: 'pip-2',
      messages: [],
    } as never)
    expect(swapped).toMatchObject({ ok: true })
    expect(ctx.project.pipLayout?.mainSide).toBe('end')
  })

  it('synthesizes voice, lists fillers, and applies a cut list', async () => {
    const ctx = makeCtx()
    ctx.project = {
      ...ctx.project,
      assets: [
        ...ctx.project.assets,
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          kind: 'audio',
          blobKey: 'local/vo.mp3',
          source: 'upload',
          probe: {
            durationFrames: 90,
            transcriptSegments: [
              { startMs: 0, endMs: 333, text: 'um' },
              { startMs: 333, endMs: 3000, text: 'Edit PDFs' },
            ],
          },
        },
      ],
    }
    const tools = createStudioTools(ctx)
    const synth = await tools.synthesize_voice.execute!({ text: 'Hello from Voice Studio' }, {
      toolCallId: 'vs-1',
      messages: [],
    } as never)
    expect(synth).toMatchObject({ ok: true })
    const voiced = ctx.project.assets.find((asset) => asset.probe?.voiceProvenance)
    expect(voiced?.probe?.voiceProvenance).toMatchObject({ kind: 'synth', modelId: 'mock-speech' })

    await tools.add_clip.execute!(
      {
        assetId: '11111111-1111-4111-8111-111111111111',
        from: 0,
        durationInFrames: 90,
      },
      { toolCallId: 'vs-1b', messages: [] } as never,
    )
    await tools.add_clip.execute!(
      {
        assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        from: 0,
        durationInFrames: 90,
      },
      { toolCallId: 'vs-2', messages: [] } as never,
    )
    const videoClipId = ctx.project.clips.find(
      (clip) => clip.assetId === '11111111-1111-4111-8111-111111111111',
    )!.id
    const clipId = ctx.project.clips.find(
      (clip) => clip.assetId === 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    )!.id
    const lipsync = await tools.lipsync_clip.execute!({ videoClipId, audioClipId: clipId }, {
      toolCallId: 'vs-ls',
      messages: [],
    } as never)
    expect(lipsync).toMatchObject({ ok: true })
    expect(
      ctx.project.assets.find((asset) => asset.id === '11111111-1111-4111-8111-111111111111')?.probe
        ?.voiceProvenance,
    ).toMatchObject({ kind: 'lipsync', stub: true })

    const fillers = await tools.remove_fillers.execute!({ clipId }, {
      toolCallId: 'vs-3',
      messages: [],
    } as never)
    expect(fillers).toMatchObject({ ok: true })
    const cuts = (
      fillers as { data?: { cuts?: Array<{ from: number; durationInFrames: number }> } }
    ).data?.cuts
    expect(cuts?.length).toBeGreaterThan(0)
    expect(cuts?.[0]?.from).toBe(
      ctx.project.clips.find((clip) => clip.assetId === 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
        ?.from,
    )

    const applied = await tools.apply_cut_list.execute!({ clipId, cuts: cuts! }, {
      toolCallId: 'vs-4',
      messages: [],
    } as never)
    expect(applied).toMatchObject({ ok: true })
    const remaining = ctx.project.clips.filter(
      (clip) => clip.assetId === 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    )
    const total = remaining.reduce((sum, clip) => sum + clip.durationInFrames, 0)
    expect(total).toBeLessThan(90)
  })

  it('proposes a cut list without editing, then applies millisecond cuts (#871)', async () => {
    const ctx = makeCtx()
    ctx.project = {
      ...ctx.project,
      assets: [
        ...ctx.project.assets,
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          kind: 'audio',
          blobKey: 'local/vo.mp3',
          source: 'upload',
          probe: {
            durationFrames: 90,
            transcriptSegments: [
              { startMs: 0, endMs: 400, text: 'um' },
              { startMs: 400, endMs: 800, text: 'Hello' },
              { startMs: 2000, endMs: 3000, text: 'there' },
            ],
          },
        },
      ],
    }
    const tools = createStudioTools(ctx)
    await tools.add_clip.execute!(
      {
        assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        from: 0,
        durationInFrames: 90,
      },
      { toolCallId: 'cl-1', messages: [] } as never,
    )
    const clipId = ctx.project.clips.find(
      (clip) => clip.assetId === 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    )!.id

    const proposed = (await tools.build_cut_list.execute!({ clipId }, {
      toolCallId: 'cl-2',
      messages: [],
    } as never)) as {
      ok: boolean
      data?: {
        dryRun?: boolean
        cuts?: Array<{
          startMs: number
          endMs: number
          reason: 'filler' | 'pause' | 'retake' | 'clarity'
        }>
      }
    }
    expect(proposed).toMatchObject({ ok: true, data: { dryRun: true } })
    expect(proposed.data?.cuts?.some((cut) => cut.reason === 'filler')).toBe(true)
    expect(proposed.data?.cuts?.some((cut) => cut.reason === 'pause')).toBe(true)
    expect(ctx.project.clips.find((clip) => clip.id === clipId)?.durationInFrames).toBe(90)

    const applied = await tools.apply_cut_list.execute!({ clipId, cuts: proposed.data!.cuts! }, {
      toolCallId: 'cl-3',
      messages: [],
    } as never)
    expect(applied).toMatchObject({ ok: true })
    const remaining = ctx.project.clips.filter(
      (clip) => clip.assetId === 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    )
    const total = remaining.reduce((sum, clip) => sum + clip.durationInFrames, 0)
    expect(total).toBeLessThan(90)
  })

  it('proposes rambling cuts from the brief without editing (#875)', async () => {
    const ctx = makeCtx()
    ctx.project = {
      ...ctx.project,
      brief: {
        id: '33333333-3333-4333-8333-333333333333',
        source: {
          kind: 'url',
          uri: 'https://example.com',
          fetchedAt: '2026-08-02T10:00:00.000Z',
        },
        product: {
          name: 'the private example',
          oneLiner: 'Edit PDFs in the browser',
          benefits: [],
          socialProof: [],
        },
        messaging: {
          hookCandidates: [],
          ctaCandidates: [],
          audienceHints: [],
        },
        brandCandidates: { stillAssetIds: [] },
        confidence: { overall: 0.8 },
      },
      assets: [
        ...ctx.project.assets,
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          kind: 'video',
          blobKey: 'local/take.mp4',
          source: 'upload',
          probe: {
            durationFrames: 120,
            transcriptSegments: [
              { startMs: 0, endMs: 2000, text: 'A long ramble about lunch' },
              { startMs: 2000, endMs: 4000, text: 'Edit PDFs in the browser' },
            ],
          },
        },
      ],
    }
    const tools = createStudioTools(ctx)
    await tools.add_clip.execute!(
      {
        assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        from: 0,
        durationInFrames: 120,
      },
      { toolCallId: 'cl-c1', messages: [] } as never,
    )
    const clipId = ctx.project.clips.find(
      (clip) => clip.assetId === 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    )!.id
    const proposed = (await tools.edit_for_clarity.execute!({ clipId }, {
      toolCallId: 'cl-c2',
      messages: [],
    } as never)) as {
      ok: boolean
      message?: string
      data?: { cuts?: Array<{ reason: string; startMs: number; endMs: number }>; dryRun?: boolean }
    }
    expect(proposed.ok).toBe(true)
    expect(proposed.data?.dryRun).toBe(true)
    expect(proposed.data?.cuts).toEqual([{ startMs: 0, endMs: 2000, reason: 'clarity' }])
    expect(ctx.project.clips.find((clip) => clip.id === clipId)?.durationInFrames).toBe(120)
  })

  it('adds a zoom punch on filler jumps after the cut list (#884)', async () => {
    const ctx = makeCtx()
    ctx.project = {
      ...ctx.project,
      assets: [
        ...ctx.project.assets,
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          kind: 'video',
          blobKey: 'local/take.mp4',
          source: 'upload',
          probe: { durationFrames: 180 },
        },
      ],
    }
    const tools = createStudioTools(ctx)
    await tools.add_clip.execute!(
      {
        assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        from: 0,
        durationInFrames: 180,
      },
      { toolCallId: 'jz-1', messages: [] } as never,
    )
    const clipId = ctx.project.clips.find(
      (clip) => clip.assetId === 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    )!.id
    const cuts = [{ startMs: 0, endMs: 400, reason: 'filler' as const }]
    await tools.apply_cut_list.execute!({ clipId, cuts }, {
      toolCallId: 'jz-2',
      messages: [],
    } as never)
    expect(
      ctx.project.clips.some((clip) => clip.treatments?.some((item) => item.id === 'zoom_punch')),
    ).toBe(true)
    const zoomed = (await tools.apply_jump_cut_zooms.execute!({ clipId, cuts, clipFrom: 0 }, {
      toolCallId: 'jz-3',
      messages: [],
    } as never)) as { ok: boolean }
    expect(zoomed).toMatchObject({ ok: true })
    expect(
      ctx.project.clips.some((clip) => clip.treatments?.some((item) => item.id === 'zoom_punch')),
    ).toBe(true)
  })

  it('places jump zooms from the original clip start, not zero (#884)', async () => {
    const ctx = makeCtx()
    ctx.project = {
      ...ctx.project,
      assets: [
        ...ctx.project.assets,
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          kind: 'video',
          blobKey: 'local/take.mp4',
          source: 'upload',
          probe: { durationFrames: 180 },
        },
      ],
    }
    const tools = createStudioTools(ctx)
    await tools.add_clip.execute!(
      {
        assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        from: 90,
        durationInFrames: 180,
      },
      { toolCallId: 'jz-4', messages: [] } as never,
    )
    const clipId = ctx.project.clips.find(
      (clip) => clip.assetId === 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    )!.id
    const cuts = [{ startMs: 1000, endMs: 1333, reason: 'filler' as const }]
    await tools.apply_cut_list.execute!({ clipId, cuts }, {
      toolCallId: 'jz-5',
      messages: [],
    } as never)
    const result = (await tools.apply_jump_cut_zooms.execute!({ clipId, cuts, clipFrom: 90 }, {
      toolCallId: 'jz-6',
      messages: [],
    } as never)) as { ok: boolean }
    expect(result).toMatchObject({ ok: true })
    const zoomed = ctx.project.clips.find((clip) =>
      clip.treatments?.some((item) => item.id === 'zoom_punch'),
    )
    expect(zoomed?.from).toBe(120)
  })

  it('places a whoosh on the Sounds lane (#885)', async () => {
    const ctx = makeCtx()
    const tools = createStudioTools(ctx)
    const placed = (await tools.place_sfx.execute!({ packId: 'whoosh', from: 0 }, {
      toolCallId: 'sfx-1',
      messages: [],
    } as never)) as { ok: boolean; summary?: string }
    expect(placed).toMatchObject({ ok: true })
    expect(placed.summary).toBe('Added a whoosh.')
    expect(ctx.project.clips.some((clip) => clip.trackId === 'track_sfx')).toBe(true)
  })

  it('applies hook punch treatments (#885)', async () => {
    const ctx = makeCtx()
    ctx.project = {
      ...ctx.project,
      assets: [
        ...ctx.project.assets,
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          kind: 'video',
          blobKey: 'local/take.mp4',
          source: 'upload',
          probe: { durationFrames: 90 },
        },
      ],
    }
    const tools = createStudioTools(ctx)
    await tools.add_clip.execute!(
      {
        assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        from: 0,
        durationInFrames: 90,
      },
      { toolCallId: 'mp-1', messages: [] } as never,
    )
    const clipId = ctx.project.clips[0]!.id
    const punched = (await tools.apply_motion_preset.execute!({ clipId, presetId: 'hook_punch' }, {
      toolCallId: 'mp-2',
      messages: [],
    } as never)) as { ok: boolean }
    expect(punched).toMatchObject({ ok: true })
    expect(ctx.project.clips[0]?.treatments?.map((item) => item.id).sort()).toEqual([
      'flash',
      'zoom_punch',
    ])
  })

  it('clears caption marks (#891)', async () => {
    const ctx = makeCtx()
    ctx.project = addCaptions(ctx.project, {
      text: 'Try now',
      style: {
        presetId: 'karaoke',
        emoji: [{ wordIndex: 1, stickerId: 'bolt' }],
        emphasis: [{ wordIndex: 1 }],
      },
      words: [
        { text: 'Try', startMs: 0, endMs: 200 },
        { text: 'now', startMs: 200, endMs: 500 },
      ],
    })
    const tools = createStudioTools(ctx)
    const cleared = (await tools.set_caption_style.execute!({ emoji: false }, {
      toolCallId: 'cap-1',
      messages: [],
    } as never)) as { ok: boolean; summary?: string }
    expect(cleared).toMatchObject({ ok: true })
    expect(cleared.summary).toBe('Cleared caption marks.')
    const caption = ctx.project.overlays.find((overlay) => overlay.kind === 'caption')
    expect(caption?.style?.emoji).toEqual([])
    expect(caption?.style?.emphasis).toEqual([{ wordIndex: 1 }])
  })

  it('derives creative structure from scenes (#230)', async () => {
    const ctx = makeCtx()
    ctx.project = {
      ...ctx.project,
      scenes: [
        {
          id: 'sc_hook',
          role: 'hook',
          label: 'Hook',
          clipIds: [],
          overlayIds: [],
          locked: false,
        },
      ],
    }
    const tools = createStudioTools(ctx)
    const derived = await tools.derive_creative_structure.execute!({}, {
      toolCallId: 'st-1',
      messages: [],
    } as never)
    expect(derived).toMatchObject({ ok: true })
    expect(ctx.project.creativeStructure.source).toBe('intent_scenes')
    expect(ctx.project.creativeStructure.beats[0]?.kind).toBe('hook')
  })

  it('set_creative_structure writes manual beats (#230)', async () => {
    const ctx = makeCtx()
    const tools = createStudioTools(ctx)
    const set = await tools.set_creative_structure.execute!(
      { beats: [{ kind: 'offer', from: 30, durationInFrames: 60 }] },
      { toolCallId: 'st-set', messages: [] } as never,
    )
    expect(set).toMatchObject({ ok: true })
    expect(ctx.project.creativeStructure.source).toBe('manual')
    expect(ctx.project.creativeStructure.beats).toEqual([
      { kind: 'offer', from: 30, durationInFrames: 60 },
    ])
  })

  it('assemble_broll dryRun does not mutate clips and returns a durable plan id', async () => {
    const ctx = makeCtx()
    ctx.project = {
      ...ctx.project,
      scenes: [
        {
          id: 'sc_hook',
          role: 'hook',
          label: 'Hook',
          clipIds: [],
          overlayIds: [],
          locked: false,
          targetDurationFrames: 90,
        },
        {
          id: 'sc_proof',
          role: 'proof',
          label: 'Proof',
          clipIds: [],
          overlayIds: [],
          locked: false,
          targetDurationFrames: 120,
        },
      ],
    }
    const tools = createStudioTools(ctx)
    const clipsBefore = JSON.stringify(ctx.project.clips)
    const drafted = await tools.assemble_broll.execute!({}, {
      toolCallId: 'ab1',
      messages: [],
    } as never)
    expect(drafted).toMatchObject({ ok: true })
    expect(JSON.stringify(ctx.project.clips)).toBe(clipsBefore)
    const plan = (
      drafted as { ok: true; data?: { plan?: { id: string; rows: Array<{ kind: string }> } } }
    ).data?.plan
    expect(plan?.id).toBeTruthy()
    expect(plan?.rows.some((row) => row.kind === 'generate')).toBe(true)
    expect(ctx.project.brollPlan?.id).toBe(plan?.id)
  })

  it('reject_broll_plan clears the project mirror', async () => {
    const ctx = makeCtx()
    ctx.project = {
      ...ctx.project,
      scenes: [
        {
          id: 'sc_proof',
          role: 'proof',
          label: 'Proof',
          clipIds: [],
          overlayIds: [],
          locked: false,
          targetDurationFrames: 120,
        },
      ],
    }
    const tools = createStudioTools(ctx)
    const drafted = await tools.assemble_broll.execute!({}, {
      toolCallId: 'ab-rej',
      messages: [],
    } as never)
    const planId = (drafted as { ok: true; data?: { planId?: string } }).data?.planId
    expect(planId).toBeTruthy()
    if (!planId) throw new Error('expected assemble_broll planId')
    const rejected = await tools.reject_broll_plan.execute!({ planId }, {
      toolCallId: 'ab-rej-2',
      messages: [],
    } as never)
    expect(rejected).toMatchObject({ ok: true })
    expect(ctx.project.brollPlan?.status).toBe('rejected')
  })

  it('inspect_preview fails when main is empty', async () => {
    const ctx = makeCtx()
    const tools = createStudioTools(ctx)
    const review = await tools.inspect_preview.execute!({}, {
      toolCallId: 'rev1',
      messages: [],
    } as never)
    expect(review).toMatchObject({ ok: false })
    expect(String((review as { error?: string }).error ?? '')).toMatch(/picture completeness/i)
  })

  it('blocks render_export until cut review is fresh on a video cut', async () => {
    const ctx = makeCtx()
    const tools = createStudioTools(ctx)
    const outcome = await tools.render_export.execute!({}, {
      toolCallId: 'ex1',
      messages: [],
    } as never)
    expect(outcome).toMatchObject({ ok: false })
    expect(String((outcome as { error?: string }).error ?? '')).toMatch(/cut review/i)
  })

  it('inspect_preview passes on ci-stub when main covers the cut', async () => {
    const ctx = makeCtx()
    const musicId = ctx.project.assets[1]!.id
    ctx.project = {
      ...addClip(
        addClip(ctx.project, {
          assetId: ctx.project.assets[0]!.id,
          trackId: MAIN_VIDEO_TRACK_ID,
          from: 0,
          durationInFrames: 900,
        }),
        {
          assetId: musicId,
          from: 0,
          durationInFrames: 900,
        },
      ),
      intent: { ...ctx.project.intent, lengthSeconds: 30 },
      brand: {
        productId: 'demo',
        primaryColor: '#0B1F33',
        logoAssetId: '66666666-6666-4666-8666-666666666666',
      },
      assets: [
        ...ctx.project.assets,
        {
          id: '66666666-6666-4666-8666-666666666666',
          kind: 'image',
          blobKey: 'local/logo.png',
          source: 'upload',
          probe: {},
        },
      ],
    }
    ctx.expectedRevision = ctx.project.revision
    const tools = createStudioTools(ctx)
    const review = await tools.inspect_preview.execute!({}, {
      toolCallId: 'rev2',
      messages: [],
    } as never)
    expect(review).toMatchObject({ ok: true })
    expect(ctx.project.cutReview?.passed).toBe(true)
    expect(ctx.project.cutReview?.rubric?.brief).toBe('pass')
  })

  it('inspect_preview trims still padding to the brief (#601)', async () => {
    const ctx = makeCtx()
    const stillId = '33333333-3333-4333-8333-333333333333'
    ctx.project = {
      ...ctx.project,
      intent: { ...ctx.project.intent, lengthSeconds: 25 },
      durationFrames: 1650,
      brand: {
        productId: 'demo',
        primaryColor: '#0B1F33',
        logoAssetId: '66666666-6666-4666-8666-666666666666',
      },
      assets: [
        ...ctx.project.assets,
        {
          id: '66666666-6666-4666-8666-666666666666',
          kind: 'image',
          blobKey: 'local/logo.png',
          source: 'upload',
          probe: {},
        },
        {
          id: stillId,
          kind: 'image',
          blobKey: 'local/still.jpg',
          source: 'upload',
          probe: {},
        },
      ],
      clips: [
        {
          id: 'clip_v',
          trackId: MAIN_VIDEO_TRACK_ID,
          assetId: ctx.project.assets[0]!.id,
          from: 0,
          durationInFrames: 750,
          trim: { startFrames: 0 },
        },
        {
          id: 'clip_pad',
          trackId: MAIN_VIDEO_TRACK_ID,
          assetId: stillId,
          from: 750,
          durationInFrames: 750,
          trim: { startFrames: 0 },
        },
        {
          id: 'clip_music',
          trackId: 'track_audio',
          assetId: ctx.project.assets[1]!.id,
          from: 0,
          durationInFrames: 750,
          trim: { startFrames: 0 },
        },
      ],
    }
    ctx.expectedRevision = ctx.project.revision
    const tools = createStudioTools(ctx)
    const review = await tools.inspect_preview.execute!({}, {
      toolCallId: 'rev3',
      messages: [],
    } as never)
    expect(review).toMatchObject({ ok: true })
    expect(ctx.project.clips.some((clip) => clip.id === 'clip_pad')).toBe(false)
    expect(ctx.project.clips[0]?.durationInFrames).toBe(750)
  })

  it('refuses generate_video_clip when video generation is off', async () => {
    const ctx = makeCtx()
    ctx.modelProfileId = 'founder-edit'
    const tools = createStudioTools(ctx)
    const outcome = await tools.generate_video_clip.execute!({ prompt: 'Make a 4s the private example clip' }, {
      toolCallId: 'gv1',
      messages: [],
    } as never)
    expect(outcome).toMatchObject({ ok: false })
    expect(String((outcome as { error?: string }).error ?? '')).toMatch(/will not fake an ad/i)
    expect(String((outcome as { error?: string }).error ?? '')).not.toMatch(/Live clips/)
  })

  it('enhance_speech swaps a talking-head clip onto a stub enhanced asset', async () => {
    const ctx = makeCtx()
    ctx.project = addClip(ctx.project, {
      assetId: '11111111-1111-4111-8111-111111111111',
      from: 0,
    })
    const clipId = ctx.project.clips[0]!.id
    const tools = createStudioTools(ctx)
    const outcome = await tools.enhance_speech.execute!({ clipId }, {
      toolCallId: 'en1',
      messages: [],
    } as never)
    expect(outcome).toMatchObject({ ok: true })
    expect(ctx.project.clips[0]?.assetId).not.toBe('11111111-1111-4111-8111-111111111111')
    const next = ctx.project.assets.find((asset) => asset.id === ctx.project.clips[0]?.assetId)
    expect(next?.probe.speechEnhanced).toBe(true)
    expect(ctx.project.whyLog[0]?.action).toBe('enhance')
    const again = await tools.enhance_speech.execute!({ clipId }, {
      toolCallId: 'en2',
      messages: [],
    } as never)
    expect(again).toMatchObject({ ok: true })
    expect(String((again as { summary?: string }).summary ?? '')).toMatch(/already enhanced/i)
  })

  it('reframe_clip writes a 9:16 pan/scan window on a talking-head take', async () => {
    const ctx = makeCtx()
    ctx.project = addClip(ctx.project, {
      assetId: '11111111-1111-4111-8111-111111111111',
      from: 0,
    })
    const clipId = ctx.project.clips[0]!.id
    const tools = createStudioTools(ctx)
    const outcome = await tools.reframe_clip.execute!({ clipId, aspect: '9:16' }, {
      toolCallId: 'rf1',
      messages: [],
    } as never)
    expect(outcome).toMatchObject({ ok: true })
    expect(ctx.project.clips[0]?.reframe?.aspect).toBe('9:16')
    expect(ctx.project.clips[0]?.reframe?.tracking[0]?.h).toBe(1)
    const again = await tools.reframe_clip.execute!({ clipId, aspect: '9:16' }, {
      toolCallId: 'rf2',
      messages: [],
    } as never)
    expect(again).toMatchObject({ ok: true })
    expect(String((again as { summary?: string }).summary ?? '')).toMatch(/already framed/i)
  })

  it('enhance_speech accepts a voice-over audio clip', async () => {
    const ctx = makeCtx()
    const voId = '55555555-5555-4555-8555-555555555555'
    ctx.project = {
      ...ctx.project,
      assets: [
        ...ctx.project.assets,
        {
          id: voId,
          kind: 'audio',
          blobKey: 'local/vo.mp3',
          source: 'upload',
          probe: { durationFrames: 300 },
        },
      ],
    }
    ctx.project = addClip(ctx.project, { assetId: voId, from: 0 })
    const clipId = ctx.project.clips[0]!.id
    const tools = createStudioTools(ctx)
    const outcome = await tools.enhance_speech.execute!({ clipId }, {
      toolCallId: 'en-audio',
      messages: [],
    } as never)
    expect(outcome).toMatchObject({ ok: true })
    const next = ctx.project.assets.find((asset) => asset.id === ctx.project.clips[0]?.assetId)
    expect(next?.kind).toBe('audio')
    expect(next?.probe.speechEnhanced).toBe(true)
  })

  it('duck_music writes a volume envelope onto the music bed', async () => {
    const ctx = makeCtx()
    ctx.project = addClip(ctx.project, {
      assetId: '11111111-1111-4111-8111-111111111111',
      from: 0,
    })
    ctx.project = addClip(ctx.project, {
      assetId: '44444444-4444-4444-8444-444444444444',
      from: 0,
    })
    const tools = createStudioTools(ctx)
    const outcome = await tools.duck_music.execute!({}, {
      toolCallId: 'dk1',
      messages: [],
    } as never)
    expect(outcome).toMatchObject({ ok: true })
    const music = ctx.project.clips.find(
      (clip) => clip.assetId === '44444444-4444-4444-8444-444444444444',
    )
    expect(music?.volumeEnvelope?.length).toBeGreaterThan(1)
    const again = await tools.duck_music.execute!({}, {
      toolCallId: 'dk2',
      messages: [],
    } as never)
    expect(again).toMatchObject({ ok: true })
    expect(String((again as { summary?: string }).summary ?? '')).toMatch(/already ducks/i)
  })
})
