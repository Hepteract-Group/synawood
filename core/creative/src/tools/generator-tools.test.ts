import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { addClip, attachAsset } from '../project/operations'
import { createEmptyProject, type StudioProject } from '../project/schema'
import { MAIN_VIDEO_TRACK_ID } from '../project/tracks'
import type { StudioToolContext } from './types'
import {
  pickImageToVideoSourceId,
  resolveVideoWardrobeSourceId,
  resolveVideoSourceStillIds,
  resolveVideoGenerateRefs,
  resolveGenerateVideoDurationSeconds,
  SHOT_CONTINUATION,
  LAST_FRAME_CONTINUATION,
  SOURCE_IDENTITY_LOCK,
  lastFrameJpegFromVideo,
  lastFrameSeekSeconds,
  mediaTypeForAsset,
  videoContinuationKind,
  withLastFrameContinuation,
  withShotContinuation,
  withSourceIdentityLock,
  runGenerateVideoClipTool,
  runImportProductBrandTool,
} from './generator-tools'

const LOGO_ID = '11111111-1111-4111-8111-111111111111'
const GOWN_ID = '22222222-2222-4222-8222-222222222222'
const TOP_ID = '33333333-3333-4333-8333-333333333333'
const CLIP_VIDEO_ID = '44444444-4444-4444-8444-444444444444'

const fashionProject = (): StudioProject => {
  let project = createEmptyProject({
    id: '55555555-5555-4555-8555-555555555555',
    productId: 'demo',
  })
  project = {
    ...project,
    brand: {
      productId: 'demo',
      logoAssetId: LOGO_ID,
      stillAssetIds: [GOWN_ID, TOP_ID],
    },
  }
  project = attachAsset(project, {
    id: LOGO_ID,
    kind: 'image',
    blobKey: 'local/logo.png',
    source: 'upload',
    probe: {},
  })
  project = attachAsset(project, {
    id: GOWN_ID,
    kind: 'image',
    blobKey: 'local/gown.png',
    source: 'upload',
    probe: {},
  })
  project = attachAsset(project, {
    id: TOP_ID,
    kind: 'image',
    blobKey: 'local/top.png',
    source: 'upload',
    probe: {},
  })
  return attachAsset(project, {
    id: CLIP_VIDEO_ID,
    kind: 'video',
    blobKey: 'local/clip.mp4',
    source: 'generator',
    probe: { sourceImageAssetId: GOWN_ID },
  })
}

describe('video wardrobe lock (#577, #597)', () => {
  it('prefers the first non-logo product still over the logo', () => {
    expect(pickImageToVideoSourceId(fashionProject())).toBe(GOWN_ID)
  })

  it('reuses the source still already on MAIN instead of a second outfit photo', () => {
    const withClip = addClip(fashionProject(), {
      assetId: CLIP_VIDEO_ID,
      trackId: MAIN_VIDEO_TRACK_ID,
      from: 0,
      durationInFrames: 240,
    })
    expect(resolveVideoWardrobeSourceId(withClip, TOP_ID)).toBe(GOWN_ID)
  })

  it('uses an explicit still on the first clip when MAIN has no video yet', () => {
    expect(resolveVideoWardrobeSourceId(fashionProject(), TOP_ID)).toBe(TOP_ID)
  })

  it('locks wardrobe from the earliest MAIN clip, not array order', () => {
    const later = {
      id: '66666666-6666-4666-8666-666666666666',
      kind: 'video' as const,
      blobKey: 'local/later.mp4',
      source: 'generator' as const,
      probe: { sourceImageAssetId: TOP_ID },
    }
    let project = attachAsset(fashionProject(), later)
    project = addClip(project, {
      assetId: later.id,
      trackId: MAIN_VIDEO_TRACK_ID,
      from: 240,
      durationInFrames: 240,
    })
    project = addClip(project, {
      assetId: CLIP_VIDEO_ID,
      trackId: MAIN_VIDEO_TRACK_ID,
      from: 0,
      durationInFrames: 240,
    })
    expect(resolveVideoWardrobeSourceId(project, TOP_ID)).toBe(GOWN_ID)
  })
})

describe('generate video duration and identity (#601, #602)', () => {
  it('sends 15s when the founder asked 15s even if the empty canvas is 8s (#644)', () => {
    const project = {
      ...fashionProject(),
      intent: { ...fashionProject().intent, lengthSeconds: 15 },
      durationFrames: 8 * 30,
    }
    const resolved = resolveGenerateVideoDurationSeconds({
      project,
      requestedSeconds: 15,
      modelMaxSeconds: 15,
      allowedDurations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      placeOnTimeline: true,
    })
    expect(resolved).toEqual({ durationSeconds: 15 })
  })

  it('snaps a 2s remaining hole up to Seedance’s 4s minimum instead of sending 2s', () => {
    const withVideo = addClip(fashionProject(), {
      assetId: CLIP_VIDEO_ID,
      trackId: MAIN_VIDEO_TRACK_ID,
      from: 0,
      durationInFrames: 13 * 30,
    })
    const project = {
      ...withVideo,
      intent: { ...withVideo.intent, lengthSeconds: 15 },
      durationFrames: 450,
    }
    const resolved = resolveGenerateVideoDurationSeconds({
      project,
      requestedSeconds: 2,
      modelMaxSeconds: 15,
      allowedDurations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      placeOnTimeline: true,
    })
    expect(resolved).toEqual({ durationSeconds: 4 })
  })

  it('caps clip length to the remaining brief, not the model max', () => {
    const project = {
      ...fashionProject(),
      intent: { ...fashionProject().intent, lengthSeconds: 25 },
      durationFrames: 750,
    }
    const resolved = resolveGenerateVideoDurationSeconds({
      project,
      requestedSeconds: 50,
      modelMaxSeconds: 30,
      placeOnTimeline: true,
    })
    expect(resolved).toEqual({ durationSeconds: 25 })
  })

  it('refuses another clip when moving video already covers the brief', () => {
    const covered = addClip(fashionProject(), {
      assetId: CLIP_VIDEO_ID,
      trackId: MAIN_VIDEO_TRACK_ID,
      from: 0,
      durationInFrames: 900,
    })
    const resolved = resolveGenerateVideoDurationSeconds({
      project: { ...covered, intent: { ...covered.intent, lengthSeconds: 30 } },
      requestedSeconds: 8,
      modelMaxSeconds: 30,
      placeOnTimeline: true,
    })
    expect(resolved).toMatchObject({ error: expect.stringMatching(/already covered/i) })
  })

  it('locks the source photo into the prompt, not colour-only similarity', () => {
    expect(withSourceIdentityLock('Walk down a runway.', GOWN_ID)).toContain(SOURCE_IDENTITY_LOCK)
    expect(SOURCE_IDENTITY_LOCK).toMatch(/first frame/)
    expect(SOURCE_IDENTITY_LOCK).toMatch(/colour/)
  })

  it('does not apply the one-photo lock when two collection stills are tagged (#612)', () => {
    expect(withSourceIdentityLock('Walk down a runway.', GOWN_ID, 2)).not.toContain(
      SOURCE_IDENTITY_LOCK,
    )
  })

  it('loads source still bytes for live image-to-video (#602)', () => {
    const src = readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), './generator-tools.ts'),
      'utf8',
    )
    expect(src).toMatch(/getBlobBytes/)
    expect(src).toMatch(/sourceImageBytes/)
    expect(src).toMatch(/I will not invent the product from text/)
  })
})

describe('N stills as i2v refs (#603)', () => {
  it('uses the first requested still as the first frame and keeps the rest as refs', () => {
    expect(resolveVideoSourceStillIds(fashionProject(), [GOWN_ID, TOP_ID])).toEqual([
      GOWN_ID,
      TOP_ID,
    ])
  })

  it('keeps the wardrobe lock first and does not strip extra collection stills', () => {
    const withClip = addClip(fashionProject(), {
      assetId: CLIP_VIDEO_ID,
      trackId: MAIN_VIDEO_TRACK_ID,
      from: 0,
      durationInFrames: 240,
    })
    expect(resolveVideoSourceStillIds(withClip, [TOP_ID], [TOP_ID])).toEqual([GOWN_ID, TOP_ID])
  })

  it('uses this-turn @asset stills when the tool omits sourceImageAssetIds', () => {
    expect(resolveVideoSourceStillIds(fashionProject(), undefined, [GOWN_ID, TOP_ID])).toEqual([
      GOWN_ID,
      TOP_ID,
    ])
  })

  it('falls back to usable Product Extract stills when no stills were passed (#1098)', () => {
    const extractId = '77777777-7777-4777-8777-777777777777'
    let project = createEmptyProject({
      id: '55555555-5555-4555-8555-555555555555',
      productId: 'demo',
    })
    project = attachAsset(project, {
      id: extractId,
      kind: 'image',
      blobKey: 'local/marketing-os/demo/extract/e/still.png',
      source: 'upload',
      probe: { productExtractId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', quality: 'usable' },
    })
    expect(resolveVideoSourceStillIds(project, undefined, undefined)).toEqual([extractId])
  })

  it('refuses over-cap stills before confirmSpend', async () => {
    const ids = Array.from(
      { length: 10 },
      (_, i) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(i + 1).padStart(12, '0')}`,
    )
    let project = fashionProject()
    for (const id of ids) {
      project = attachAsset(project, {
        id,
        kind: 'image',
        blobKey: `local/${id}.jpg`,
        source: 'upload',
        probe: {},
      })
    }
    const ctx: StudioToolContext = {
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
      modelProfileId: 'balanced',
      persist: false,
      toolTrace: [],
      videoModelId: 'bytedance/seedance-2.0-fast',
    }
    const outcome = await runGenerateVideoClipTool(ctx, {
      prompt: 'two collections on a runway',
      sourceImageAssetIds: ids,
    })
    expect(outcome).toMatchObject({ ok: false })
    const error = String((outcome as { error?: string }).error ?? '')
    expect(error).toMatch(/takes 9 stills; you passed 10/)
    expect(error).toMatch(/no credits used/)
    expect(error).not.toMatch(/confirmSpend/)
  })

  it('does not lock one silhouette when two collection stills are tagged (#612)', async () => {
    const project = fashionProject()
    const ctx: StudioToolContext = {
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
      referencedAssetIds: [GOWN_ID, TOP_ID],
    }
    const outcome = await runGenerateVideoClipTool(ctx, {
      prompt: 'two looks on a runway',
      confirmSpend: true,
    })
    expect(outcome).toMatchObject({ ok: true })
    const generated = ctx.project.assets.find(
      (asset) =>
        asset.kind === 'video' && asset.source === 'generator' && asset.id !== CLIP_VIDEO_ID,
    )
    const prompt = String(generated?.probe?.prompt ?? '')
    expect(prompt).not.toContain(SOURCE_IDENTITY_LOCK)
    expect(prompt).toMatch(/\[Image 2\]/)
    expect(prompt).toMatch(/must appear/)
  })

  it('classifies mentioned stills vs video clips (#610)', () => {
    expect(resolveVideoGenerateRefs(fashionProject(), undefined, [GOWN_ID, CLIP_VIDEO_ID])).toEqual(
      {
        stillIds: [GOWN_ID],
        videoIds: [CLIP_VIDEO_ID],
        audioIds: [],
        otherIds: [],
      },
    )
  })

  it('does not silently drop a mentioned video @asset on generate (#610)', async () => {
    const project = fashionProject()
    const ctx: StudioToolContext = {
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
      referencedAssetIds: [GOWN_ID, CLIP_VIDEO_ID],
    }
    const outcome = await runGenerateVideoClipTool(ctx, {
      prompt: 'Manchester streets with this collection',
      confirmSpend: true,
    })
    expect(outcome).toMatchObject({
      ok: true,
      data: expect.objectContaining({
        sourceImageAssetId: GOWN_ID,
        referenceVideoAssetIds: [CLIP_VIDEO_ID],
      }),
    })
    const generated = ctx.project.assets.find(
      (asset) =>
        asset.kind === 'video' && asset.source === 'generator' && asset.id !== CLIP_VIDEO_ID,
    )
    expect(generated?.probe?.sourceImageAssetId).toBe(GOWN_ID)
    expect(generated?.probe?.referenceVideoAssetIds).toEqual([CLIP_VIDEO_ID])
  })

  it('refuses a tagged video on Veo before spend (#610)', async () => {
    const project = fashionProject()
    const ctx: StudioToolContext = {
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
      modelProfileId: 'balanced',
      persist: false,
      toolTrace: [],
      videoModelId: 'google/veo-3.1-fast-generate-001',
      referencedAssetIds: [GOWN_ID, CLIP_VIDEO_ID],
    }
    const outcome = await runGenerateVideoClipTool(ctx, {
      prompt: 'Manchester streets with this collection',
    })
    expect(outcome).toMatchObject({ ok: false })
    const error = String((outcome as { error?: string }).error ?? '')
    expect(error).toMatch(/stills only/)
    expect(error).toMatch(/tagged a video/)
    expect(error).toMatch(/no credits used/)
    expect(error).not.toMatch(/confirmSpend/)
  })

  it('refuses a tagged audio file before spend (#608)', async () => {
    const audioId = '77777777-7777-4777-8777-777777777777'
    const project = attachAsset(fashionProject(), {
      id: audioId,
      kind: 'audio',
      blobKey: 'local/bed.mp3',
      source: 'upload',
      probe: {},
    })
    const ctx: StudioToolContext = {
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
      modelProfileId: 'balanced',
      persist: false,
      toolTrace: [],
      videoModelId: 'bytedance/seedance-2.0-fast',
      referencedAssetIds: [GOWN_ID, audioId],
    }
    const outcome = await runGenerateVideoClipTool(ctx, {
      prompt: 'Manchester streets with this collection',
    })
    expect(outcome).toMatchObject({ ok: false })
    const error = String((outcome as { error?: string }).error ?? '')
    expect(error).toMatch(/does not take audio/)
    expect(error).toMatch(/no credits used/)
    expect(error).not.toMatch(/confirmSpend/)
  })
})

describe('shot continuation (#646)', () => {
  it('writes the next beat of the same ad, not a new film', () => {
    const next = withShotContinuation('The product in use.', true)
    expect(next).toContain(SHOT_CONTINUATION)
    expect(next).toMatch(/The product in use/)
    expect(SHOT_CONTINUATION).toMatch(/same ad/)
    expect(SHOT_CONTINUATION).toMatch(/same person/)
    expect(SHOT_CONTINUATION).toMatch(/wardrobe/)
    expect(SHOT_CONTINUATION).toMatch(/do not restart/i)
    expect(SHOT_CONTINUATION).toMatch(/last beat/)
    expect(withShotContinuation('The product in use.', false)).toBe('The product in use.')
  })

  it('feeds the last MAIN clip into the next generate', async () => {
    const project = addClip(fashionProject(), {
      assetId: CLIP_VIDEO_ID,
      trackId: MAIN_VIDEO_TRACK_ID,
      from: 0,
      durationInFrames: 8 * 30,
    })
    const ctx: StudioToolContext = {
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
      confirmSpend: true,
    }
    const outcome = await runGenerateVideoClipTool(ctx, {
      prompt: 'The product in use',
      confirmSpend: true,
    })
    expect(outcome).toMatchObject({
      ok: true,
      data: expect.objectContaining({
        referenceVideoAssetIds: [CLIP_VIDEO_ID],
      }),
    })
    const generated = ctx.project.assets.find(
      (asset) =>
        asset.kind === 'video' && asset.source === 'generator' && asset.id !== CLIP_VIDEO_ID,
    )
    const prompt = String(generated?.probe?.prompt ?? '')
    expect(prompt).toContain(SHOT_CONTINUATION)
    expect(prompt).toMatch(/previous shot of this ad/)
    expect(prompt).toMatch(/The product in use/)
  })

  it('does not treat the first clip as a continuation', async () => {
    const project = fashionProject()
    const ctx: StudioToolContext = {
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
      confirmSpend: true,
    }
    const outcome = await runGenerateVideoClipTool(ctx, {
      prompt: 'Open on the product',
      confirmSpend: true,
    })
    expect(outcome).toMatchObject({
      ok: true,
      data: expect.objectContaining({
        referenceVideoAssetIds: [],
      }),
    })
    const generated = ctx.project.assets.find(
      (asset) =>
        asset.kind === 'video' && asset.source === 'generator' && asset.id !== CLIP_VIDEO_ID,
    )
    expect(String(generated?.probe?.prompt ?? '')).not.toContain(SHOT_CONTINUATION)
  })
})

describe('last-frame continuation (#648)', () => {
  it('picks last-frame when the model cannot take a video ref', () => {
    expect(videoContinuationKind(0, true)).toBe('last-frame')
    expect(videoContinuationKind(9, true)).toBe('clip')
    expect(videoContinuationKind(0, false)).toBe('none')
    expect(lastFrameSeekSeconds(240, 30)).toBe(239 / 30)
  })

  it('asks Veo to continue from the last frame, not a new photo', () => {
    const next = withLastFrameContinuation('Keep walking.', true)
    expect(next).toContain(LAST_FRAME_CONTINUATION)
    expect(next).toMatch(/Keep walking/)
    expect(LAST_FRAME_CONTINUATION).toMatch(/last frame/)
    expect(LAST_FRAME_CONTINUATION).toMatch(/original photo/)
    expect(withLastFrameContinuation('Keep walking.', false)).toBe('Keep walking.')
  })

  it('extracts a jpeg at the last-frame seek', async () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff])
    const extractFrame = vi.fn(async () => ({ ok: true as const, bytes: Buffer.from(jpeg) }))
    const framed = await lastFrameJpegFromVideo({
      bytes: new Uint8Array([1, 2, 3, 4]),
      durationFrames: 240,
      fps: 30,
      extractFrame,
    })
    expect(framed).toEqual({ ok: true, bytes: jpeg })
    expect(extractFrame).toHaveBeenCalledWith(
      expect.objectContaining({ seekSeconds: lastFrameSeekSeconds(240, 30) }),
    )
  })
})

describe('mediaTypeForAsset', () => {
  it('keeps audio types so enhance_speech QC does not see image/jpeg', () => {
    expect(mediaTypeForAsset({ contentType: 'audio/mpeg', blobKey: 'local/vo.bin' })).toBe(
      'audio/mpeg',
    )
    expect(mediaTypeForAsset({ blobKey: 'local/vo.mp3' })).toBe('audio/mpeg')
    expect(mediaTypeForAsset({ contentType: 'video/mp4', blobKey: 'local/take.bin' })).toBe(
      'video/mp4',
    )
  })
})

describe('import_product_brand DNA fallback (#986)', () => {
  const blobEnv = {
    connectionString: 'x',
    containerName: 'marketing-os',
    useLocalPrefix: true,
    accountName: 'a',
    accountKey: 'k',
  }

  const ctxFor = (productId: string, persist: boolean, supabase: StudioToolContext['supabase']) => {
    const project = createEmptyProject({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      productId,
    })
    return {
      productId,
      projectId: project.id,
      project,
      expectedRevision: project.revision,
      supabase,
      blobEnv,
      modelProfileId: 'ci-stub',
      persist,
      toolTrace: [],
    } satisfies StudioToolContext
  }

  it('imports copy only when no disk kit exists, and says logo/colors are still empty', async () => {
    const ctx = ctxFor('no-disk-kit-product', false, { from: vi.fn() } as never)
    const result = await runImportProductBrandTool(ctx)
    expect(result).toMatchObject({ ok: true })
    expect(result.ok && result.summary).toMatch(/Logo and colors are still empty/)
    expect(ctx.project.brand?.productId).toBe('no-disk-kit-product')
    expect(ctx.project.brand?.primaryColor).toBeUndefined()
    expect(ctx.project.brand?.logoAssetId).toBeUndefined()
  })

  it('does not hide a brand-library read failure behind DNA copy', async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: { message: 'RLS denied' } }),
          }),
        }),
      }),
    } as never
    const ctx = ctxFor('demo', true, supabase)
    await expect(runImportProductBrandTool(ctx)).rejects.toThrow(
      /Failed to read product brand library/,
    )
    expect(ctx.project.brand).toBeUndefined()
  })
})
