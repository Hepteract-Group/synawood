import type { StudioToolContext } from '../tools/types'
import { enhancedProbeFor, isStubEnhanceModelId, planEnhanceSpeech } from '../audio/enhance-speech'
import { applyDuckMusic, planDuckMusic } from '../audio/duck-music'
import {
  applyReframeClip,
  isStubReframeModelId,
  planReframeClip,
  REFRAME_STUB_MODEL_ID,
} from '../video/reframe-clip'
import { applyGenerationPlanToProject, parseGenerationPlan } from '../generation-plan'
import {
  addClip,
  attachAsset,
  removeClip,
  retargetClipAsset,
  trackEndFrame,
  writeTranscriptOnAsset,
} from '../project/operations'
import type { StudioProject } from '../project/schema'
import { extractStillAssetIds } from '../extract/prefer-extract-refs'
import {
  isSpeechAudioAsset,
  remainingBriefVideoSeconds,
  lastMainVideoAssetId,
} from '../project/picture-completeness'
import { mainVideoTrackId, SFX_TRACK_ID } from '../project/tracks'
import { brandPromptContextFromProject, importProductBrand, requireBrand } from '../brand'
import { toBrandPromptBlock, withBrandDna } from '../brand/prompt-context'
import { applyStylePackMusicHints, applyStylePackPromptHints } from '../effects/hints'
import { loadBrandDna } from '../brand/product-copy'
import { loadProductBrandDna } from '../brand/product-copy-store'
import { brandSliceFromDna } from '../brand/dna'
import {
  generateImage,
  generateSpeech,
  generateVideoClip,
  transcribeMedia,
  withVideoReferenceTags,
  preflightVideoGenerate,
} from '../generators'
import { generateMusic, clampMusicDurationMs } from '../generators/music'
import type { MusicLicenseMeta } from '../generators/music'
import { isStubTranscribeModelId } from '../generators/transcribe'
import { runSyncedGeneration } from '../generation-jobs'
import { getModelProfile, isToolEnabled, resolveModelRef } from '../model-profiles'
import {
  isLiveVideoModelId,
  resolveVideoModelId,
  snapVideoDurationSeconds,
  videoModelAllowedDurations,
  videoModelMaxInputVideos,
  videoModelMaxSeconds,
} from '../model-profiles/video-models'
import { insertMusicGeneration } from '../music/persist'
import { loadMusicStyle } from '../music/style'
import { getBlobBytes } from '../persistence/blob'
import { extractVideoFrameJpegResult } from '../project/media-probe'
import { estimateGbp } from '../pricing'
import { resolveCreativeSpendGate } from '../billing/gate'
import { applyProjectMutation } from '../tools/store'
import { appendWhyLog, secondsAtFrame } from '../project/why-log'
import { toolFail, toolOk, type ToolOutcome } from '../tools/types'
import type { GenerationPlan } from '../generation-plan'

/** Snapshot the canonical model ids from a confirmed plan into a generation job record. */
const planModelIds = (
  plan: GenerationPlan | undefined,
): Partial<Pick<GenerationPlan, 'reasonerModelId' | 'imageModelId' | 'videoModelId'>> => {
  if (!plan) return {}
  return {
    ...(plan.reasonerModelId ? { reasonerModelId: plan.reasonerModelId } : {}),
    ...(plan.imageModelId ? { imageModelId: plan.imageModelId } : {}),
    ...(plan.videoModelId ? { videoModelId: plan.videoModelId } : {}),
  }
}

/** Prefer a product photo over the logo so image-to-video is not a logo loop. */
export const pickImageToVideoSourceId = (project: StudioProject): string | undefined => {
  const logoId = project.brand?.logoAssetId
  const namedStills = [...(project.brand?.stillAssetIds ?? []), project.brand?.stillAssetId].filter(
    (id): id is string => Boolean(id) && id !== logoId,
  )
  if (namedStills[0]) return namedStills[0]
  const photo = project.assets.find((asset) => asset.kind === 'image' && asset.id !== logoId)
  if (photo) return photo.id
  return logoId
}

/** Lock later clips to the still already used on MAIN so the ad does not switch outfits. */
export const resolveVideoWardrobeSourceId = (
  project: StudioProject,
  requested?: string,
): string | undefined => {
  const logoId = project.brand?.logoAssetId
  const mainId = mainVideoTrackId(project.tracks)
  const fromTimeline = project.clips
    .filter((clip) => clip.trackId === mainId)
    .slice()
    .sort((a, b) => a.from - b.from)
    .map(
      (clip) =>
        project.assets.find((asset) => asset.id === clip.assetId)?.probe?.sourceImageAssetId,
    )
    .find((id): id is string => typeof id === 'string' && id.length > 0 && id !== logoId)
  if (fromTimeline) return fromTimeline
  if (requested && requested !== logoId) return requested
  return pickImageToVideoSourceId(project)
}

const uniqueStillIds = (ids: string[]): string[] => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

const isProductStillId = (project: StudioProject, id: string): boolean => {
  const logoId = project.brand?.logoAssetId
  const asset = project.assets.find((item) => item.id === id)
  return Boolean(asset && asset.kind === 'image' && id !== logoId)
}

/** First still = first frame / wardrobe lock. Remaining = refs, in requested then @asset order. */
export const resolveVideoSourceStillIds = (
  project: StudioProject,
  requested?: string[],
  referencedAssetIds?: string[],
): string[] => {
  const fromRequested = (requested ?? []).filter((id) => isProductStillId(project, id))
  const fromMentions = (referencedAssetIds ?? []).filter((id) => isProductStillId(project, id))
  const extras = uniqueStillIds([...fromRequested, ...fromMentions])
  const preferred = extras.length > 0 ? extras : extractStillAssetIds(project)
  const lock = resolveVideoWardrobeSourceId(project, preferred[0])
  if (lock && isProductStillId(project, lock)) {
    return [lock, ...preferred.filter((id) => id !== lock)]
  }
  return preferred
}

export type VideoGenerateRefs = {
  stillIds: string[]
  videoIds: string[]
  audioIds: string[]
  otherIds: string[]
}

const isProductVideoId = (project: StudioProject, id: string): boolean => {
  const asset = project.assets.find((item) => item.id === id)
  return asset?.kind === 'video'
}

/** Stills + mentioned video clips. Never drop a tagged @asset on the floor (#610). */
export const resolveVideoGenerateRefs = (
  project: StudioProject,
  requested?: string[],
  referencedAssetIds?: string[],
): VideoGenerateRefs => {
  const stillIds = resolveVideoSourceStillIds(project, requested, referencedAssetIds)
  const mentioned = uniqueStillIds([...(requested ?? []), ...(referencedAssetIds ?? [])])
  const stillSet = new Set(stillIds)
  const videoIds = mentioned.filter((id) => isProductVideoId(project, id) && !stillSet.has(id))
  const audioIds = mentioned.filter((id) => {
    const asset = project.assets.find((item) => item.id === id)
    return asset?.kind === 'audio'
  })
  const otherIds = mentioned.filter((id) => {
    const asset = project.assets.find((item) => item.id === id)
    return Boolean(
      asset && asset.kind !== 'image' && asset.kind !== 'video' && asset.kind !== 'audio',
    )
  })
  return { stillIds, videoIds, audioIds, otherIds }
}

/** Keep the preceding MAIN shot first so it is Seedance `[Video 1]`. */
export const withMainClipContinuation = (
  project: StudioProject,
  refs: VideoGenerateRefs,
  maxVideoRefs: number,
): VideoGenerateRefs => {
  if (maxVideoRefs < 1) return refs
  const prev = lastMainVideoAssetId(project)
  if (!prev) return refs
  const rest = refs.videoIds.filter((id) => id !== prev)
  const room = Math.max(0, maxVideoRefs - 1)
  return { ...refs, videoIds: [prev, ...rest.slice(0, room)] }
}

export const SHOT_CONTINUATION =
  'This is the next shot of the same ad. Continue the preceding clip: same person, wardrobe, location, and camera. Do not restart, recast, or smash-cut to a new setup. Pick up from the last beat as if the edit is invisible.'

export const LAST_FRAME_CONTINUATION =
  'The source still is the last frame of the previous shot. Continue that motion. Do not restart from the original photo as a new take.'

export const videoContinuationKind = (
  maxVideoRefs: number,
  continuing: boolean,
): 'none' | 'clip' | 'last-frame' => {
  if (!continuing) return 'none'
  return maxVideoRefs >= 1 ? 'clip' : 'last-frame'
}

/** Seek just before the last frame so ffmpeg does not overshoot the clip. */
export const lastFrameSeekSeconds = (durationFrames: number, fps: number): number => {
  const rate = Math.max(1, fps)
  const frames = Math.max(1, durationFrames)
  return Math.max(0, (frames - 1) / rate)
}

export const withShotContinuation = (prompt: string, continuing: boolean): string => {
  if (!continuing || prompt.includes(SHOT_CONTINUATION)) return prompt
  return `${SHOT_CONTINUATION} ${prompt}`
}

export const withLastFrameContinuation = (prompt: string, continuing: boolean): string => {
  if (!continuing || prompt.includes(LAST_FRAME_CONTINUATION)) return prompt
  return `${LAST_FRAME_CONTINUATION} ${prompt}`
}

export const lastFrameJpegFromVideo = async (input: {
  bytes: Uint8Array
  contentType?: string
  fileName?: string
  durationFrames: number
  fps: number
  extractFrame?: typeof extractVideoFrameJpegResult
}): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; reason: string }> => {
  const extract = input.extractFrame ?? extractVideoFrameJpegResult
  const framed = await extract({
    bytes: input.bytes,
    contentType: input.contentType,
    fileName: input.fileName,
    seekSeconds: lastFrameSeekSeconds(input.durationFrames, input.fps),
  })
  if (!framed.ok) return { ok: false, reason: framed.reason }
  return { ok: true, bytes: new Uint8Array(framed.bytes) }
}

export const mediaTypeForAsset = (asset: { contentType?: string; blobKey: string }): string => {
  if (asset.contentType?.startsWith('image/')) return asset.contentType
  if (asset.contentType?.startsWith('video/')) return asset.contentType
  if (asset.contentType?.startsWith('audio/')) return asset.contentType
  const key = asset.blobKey.toLowerCase()
  if (key.endsWith('.png')) return 'image/png'
  if (key.endsWith('.webp')) return 'image/webp'
  if (key.endsWith('.gif')) return 'image/gif'
  if (key.endsWith('.mp4') || key.endsWith('.webm') || key.endsWith('.mov')) return 'video/mp4'
  if (
    key.endsWith('.mp3') ||
    key.endsWith('.wav') ||
    key.endsWith('.m4a') ||
    key.endsWith('.aac') ||
    key.endsWith('.ogg')
  ) {
    return 'audio/mpeg'
  }
  return 'image/jpeg'
}

export const SOURCE_IDENTITY_LOCK =
  'Animate this exact source photo. Keep the same person, product, garment silhouette, materials, and props. Do not redesign the object or swap it for a generic look that only matches colour. The photo is the first frame.'

export const withSourceIdentityLock = (
  prompt: string,
  sourceImageAssetId?: string,
  stillCount = 1,
): string => {
  if (!sourceImageAssetId || stillCount >= 2 || prompt.includes(SOURCE_IDENTITY_LOCK)) return prompt
  return `${SOURCE_IDENTITY_LOCK} ${prompt}`
}

export const resolveGenerateVideoDurationSeconds = (input: {
  project: StudioProject
  requestedSeconds?: number
  modelMaxSeconds: number
  placeOnTimeline: boolean
  allowedDurations?: readonly number[]
}): { durationSeconds: number } | { error: string } => {
  const remaining = remainingBriefVideoSeconds(input.project)
  const modelMax = Math.max(0, input.modelMaxSeconds)
  if (input.placeOnTimeline && remaining !== null && remaining < 1) {
    return {
      error:
        'The requested length is already covered with moving video. Do not pad with stills. Call inspect_preview.',
    }
  }
  const raw = input.requestedSeconds ?? remaining ?? 4
  const capped = Math.min(raw, modelMax, remaining ?? modelMax)
  const durationSeconds = input.allowedDurations
    ? Math.min(modelMax, snapVideoDurationSeconds(capped, input.allowedDurations))
    : capped
  if (durationSeconds <= 0) {
    return { error: `Video duration must be positive. Remaining brief is ${remaining ?? 0}s.` }
  }
  return { durationSeconds }
}

const placeGeneratedVideoOnMain = (
  project: StudioProject,
  assetId: string,
  durationSeconds: number,
): StudioProject => {
  const mainId = mainVideoTrackId(project.tracks)
  const fps = Math.max(1, project.fps)
  return addClip(project, {
    assetId,
    trackId: mainId,
    from: trackEndFrame(project, mainId),
    durationInFrames: Math.max(1, Math.round(durationSeconds * fps)),
  })
}

/** Place music after the last clip on the music lane (never force from=0). */
const appendOnAudioTrackFrom = (project: StudioProject): number => {
  const audioTrackId =
    project.tracks.find((track) => track.id === 'track_audio')?.id ??
    project.tracks.find((track) => track.type === 'audio' && track.id !== SFX_TRACK_ID)?.id ??
    'track_audio'
  return trackEndFrame(project, audioTrackId)
}

/** Spoken VO overlaps the picture on track_sfx from frame 0 — never append after the bed. */
export const placeVoiceoverOnSfxFromStart = (
  project: StudioProject,
  assetId: string,
  durationInFrames: number,
): StudioProject => {
  const sfxId =
    project.tracks.find((track) => track.id === SFX_TRACK_ID)?.id ??
    project.tracks.find((track) => track.type === 'audio' && track.id !== 'track_audio')?.id ??
    SFX_TRACK_ID
  const toRemove = project.clips.filter((clip) => {
    if (clip.assetId === assetId) return true
    if (clip.trackId !== sfxId) return false
    const asset = project.assets.find((item) => item.id === clip.assetId)
    return isSpeechAudioAsset(asset)
  })
  let next = project
  for (const clip of toRemove) {
    if (next.clips.some((row) => row.id === clip.id)) {
      next = removeClip(next, clip.id)
    }
  }
  return addClip(next, {
    assetId,
    trackId: sfxId,
    from: 0,
    durationInFrames,
  })
}

const findReusableSpeechAsset = (
  project: StudioProject,
): StudioProject['assets'][number] | undefined =>
  [...project.assets].reverse().find((asset) => isSpeechAudioAsset(asset))

const voiceoverDurationFrames = (
  probe: Record<string, unknown> | undefined,
  fallbackUnits: number,
): number => {
  const fromProbe = Number(probe?.durationFrames)
  if (Number.isFinite(fromProbe) && fromProbe > 0) return Math.round(fromProbe)
  const seconds = Number(probe?.durationSeconds)
  if (Number.isFinite(seconds) && seconds > 0) return Math.max(1, Math.round(seconds * 30))
  return Math.max(1, fallbackUnits * 30)
}

const ensureToolEnabled = (ctx: StudioToolContext, toolName: string): ToolOutcome | null => {
  if (!isToolEnabled(ctx.modelProfileId, toolName)) {
    if (toolName === 'generate_video_clip') {
      return toolFail(
        `Video generation is off. I will not fake an ad with stills. Turn a video model on in the Video picker, then ask again.`,
      )
    }
    return toolFail(
      `Tool ${toolName} is disabled on profile ${ctx.modelProfileId}. Switch profile (e.g. seedream-lite) or use Brand kit stills / uploaded footage.`,
    )
  }
  return null
}

const spendConfirmed = (ctx: StudioToolContext, input?: { confirmSpend?: boolean }): boolean =>
  Boolean(input?.confirmSpend || ctx.confirmSpend)

const resolveToolSpendGate = async (
  ctx: StudioToolContext,
  input: {
    estimatedGbp: number
    requireConfirm: boolean
    confirmSpend?: boolean
    suggestProfile?: string
    role?: string | null
    modelId?: string | null
  },
): Promise<ToolOutcome | null> => {
  if (!ctx.persist) return null
  const gate = await resolveCreativeSpendGate(ctx.supabase, {
    productId: ctx.productId,
    projectId: ctx.projectId,
    estimatedGbp: input.estimatedGbp,
    requireConfirm: input.requireConfirm,
    confirmSpend: input.confirmSpend,
    suggestProfile: input.suggestProfile,
    role: input.role,
    modelId: input.modelId,
  })
  if (!gate.ok) {
    const code = 'code' in gate ? gate.code : undefined
    return toolFail(gate.error, code)
  }
  return null
}

const dnaCopyOnlySummary = (productId: string): string =>
  `Imported brand copy for ${productId}. Logo and colors are still empty — open Brand in the header to set them, then generate.`

const isMissingBrandLibrary = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error)
  return /No brand library|brand-kit|manifest\.json|Brand kit incomplete|Brand kit productId mismatch/i.test(
    message,
  )
}

/** Optional import from Product Brand Library or Brand DNA — never auto-runs on generate. */
export const runImportProductBrandTool = async (ctx: StudioToolContext): Promise<ToolOutcome> => {
  if (ctx.project.brand) {
    return toolOk('This project already has brand from Brand Studio.', {
      brand: ctx.project.brand,
    })
  }

  const applyDnaSlice = async (dna: Parameters<typeof brandSliceFromDna>[0]) => {
    const slice = brandSliceFromDna(dna)
    const { project } = await applyProjectMutation(ctx, (current) => ({
      ...current,
      brand: slice,
      revision: current.revision,
    }))
    return project
  }

  if (!ctx.persist) {
    try {
      const { loadBrandKitFiles, buildBrandPromptContext } = await import('../brand/attach')
      const kit = await loadBrandKitFiles(
        ctx.productId,
        undefined,
        ctx.project.localization?.activeLocale,
      )
      const promptContext = buildBrandPromptContext({
        productId: ctx.productId,
        manifest: kit.manifest,
        colors: kit.colors,
        style: kit.style,
        voice: kit.voice,
        dna: kit.dna,
      })
      const { project } = await applyProjectMutation(ctx, (current) => ({
        ...current,
        brand: {
          productId: ctx.productId,
          displayName: kit.manifest.displayName,
          primaryColor: kit.colors.primary,
          accentColor: kit.colors.accent,
          captionBg: kit.colors.captionBg,
          fontFamily: kit.manifest.fonts.display,
          voiceId: kit.voice.voiceId,
          defaultCta: kit.manifest.defaultCta,
          mood: kit.style.mood,
          stillAssetIds: [],
        },
        revision: current.revision,
      }))
      return toolOk(`Imported product brand tokens (in-memory) for ${ctx.productId}`, {
        brand: project.brand,
        promptPreview: toBrandPromptBlock(promptContext).slice(0, 280),
        revision: project.revision,
      })
    } catch (error) {
      if (!isMissingBrandLibrary(error)) throw error
      const loaded = await loadBrandDna({ productId: ctx.productId })
      const project = await applyDnaSlice(loaded.dna)
      return toolOk(dnaCopyOnlySummary(ctx.productId), {
        brand: project.brand,
        revision: project.revision,
      })
    }
  }

  try {
    const imported = await importProductBrand({
      supabase: ctx.supabase,
      blobEnv: ctx.blobEnv,
      project: ctx.project,
      productId: ctx.productId,
    })
    const { project } = await applyProjectMutation(ctx, (current) => {
      const knownIds = new Set(current.assets.map((asset) => asset.id))
      const newAssets = imported.project.assets.filter((asset) => !knownIds.has(asset.id))
      return {
        ...current,
        assets: [...current.assets, ...newAssets],
        brand: imported.project.brand,
        revision: current.revision,
      }
    })
    return toolOk(`Imported product brand for ${ctx.productId}`, {
      brand: project.brand,
      promptPreview: toBrandPromptBlock(imported.promptContext).slice(0, 280),
      revision: project.revision,
    })
  } catch (error) {
    if (!isMissingBrandLibrary(error)) throw error
    const loaded = await loadProductBrandDna(ctx.supabase, ctx.productId)
    const project = await applyDnaSlice(loaded.dna)
    return toolOk(dnaCopyOnlySummary(ctx.productId), {
      brand: project.brand,
      revision: project.revision,
    })
  }
}

/** @deprecated Prefer runImportProductBrandTool */
export const runAttachBrandKitTool = runImportProductBrandTool

export const runSetModelProfileTool = async (
  ctx: StudioToolContext,
  profileId: string,
): Promise<ToolOutcome> => {
  const profile = getModelProfile(profileId)
  ctx.modelProfileId = profile.id
  if (ctx.persist) {
    const { error } = await ctx.supabase
      .from('studio_projects')
      .update({ model_profile_id: profile.id, updated_at: new Date().toISOString() })
      .eq('id', ctx.projectId)
    if (error) {
      return toolFail(`Failed to persist model profile: ${error.message}`)
    }
  }
  return toolOk(`Active model profile is now ${profile.id} (${profile.label})`, {
    modelProfileId: profile.id,
    enabledTools: profile.enabledTools,
    limits: profile.limits,
  })
}

const resolvePromptBrand = async (ctx: StudioToolContext) => {
  let brand = brandPromptContextFromProject(ctx.project)
  try {
    if (ctx.persist) {
      const loaded = await loadProductBrandDna(ctx.supabase, ctx.productId)
      brand = withBrandDna(brand, loaded.dna)
    } else {
      const loaded = await loadBrandDna({ productId: ctx.productId })
      brand = withBrandDna(brand, loaded.dna)
    }
  } catch {
    /* DNA is optional Path A seasoning */
  }
  return brand
}

const withLookPrompt = (ctx: StudioToolContext, prompt: string): string =>
  applyStylePackPromptHints(prompt, ctx.project.stylePackId)

const withLookMusicPrompt = (ctx: StudioToolContext, prompt: string): string =>
  applyStylePackMusicHints(prompt, ctx.project.stylePackId)

const requireProjectBrandOrFail = (ctx: StudioToolContext): ToolOutcome | null => {
  if (ctx.project.brand) return null
  return toolFail(
    'No project brand. Open Brand in the header to set logo and colors, then try again.',
  )
}

const brandRefIds = (ctx: StudioToolContext): string[] => {
  const brand = ctx.project.brand
  if (!brand) return []
  const stills =
    brand.stillAssetIds && brand.stillAssetIds.length > 0
      ? brand.stillAssetIds
      : brand.stillAssetId
        ? [brand.stillAssetId]
        : []
  return [brand.logoAssetId, ...stills].filter((id): id is string => Boolean(id))
}

export const runGenerateImageTool = async (
  ctx: StudioToolContext,
  input: { prompt: string; aspectRatio?: string; referenceAssetIds?: string[] },
): Promise<ToolOutcome> => {
  const disabled = ensureToolEnabled(ctx, 'generate_image')
  if (disabled) return disabled
  const missing = requireProjectBrandOrFail(ctx)
  if (missing) return missing
  requireBrand(ctx.project)

  const brand = await resolvePromptBrand(ctx)
  const prompt = withLookPrompt(ctx, input.prompt)
  const model = resolveModelRef(ctx.modelProfileId, 'image')
  const units = 1
  const estimatedGbp = estimateGbp(model.modelId, units)
  const blocked = await resolveToolSpendGate(ctx, {
    estimatedGbp,
    requireConfirm: false,
    suggestProfile: 'seedream-lite',
    role: 'image',
    modelId: model.modelId,
  })
  if (blocked) return blocked

  const refs = input.referenceAssetIds ?? brandRefIds(ctx)

  if (!ctx.persist) {
    const asset = await generateImage({
      prompt,
      brand,
      referenceAssetIds: refs,
      aspectRatio: input.aspectRatio ?? '9:16',
      modelId: model.modelId,
    })
    const assetId = crypto.randomUUID()
    const ext = asset.contentType === 'image/svg+xml' ? 'svg' : 'png'
    await applyProjectMutation(ctx, (current) =>
      attachAsset(current, {
        id: assetId,
        kind: 'image',
        blobKey: `memory/generated/${assetId}.${ext}`,
        contentType: asset.contentType,
        source: 'generator',
        probe: asset.probe,
      }),
    )
    return toolOk(`Generated image (in-memory)`, {
      assetId,
      estimatedGbp,
      modelId: model.modelId,
    })
  }

  const result = await runSyncedGeneration({
    supabase: ctx.supabase,
    blobEnv: ctx.blobEnv,
    productId: ctx.productId,
    projectId: ctx.projectId,
    role: 'image',
    modelId: model.modelId,
    modelProfileId: ctx.modelProfileId,
    estimatedGbp,
    units,
    confirmSpend: spendConfirmed(ctx),
    inputSnapshot: {
      prompt,
      brand,
      referenceAssetIds: refs,
      aspectRatio: input.aspectRatio ?? '9:16',
    },
    produce: () =>
      generateImage({
        prompt,
        brand,
        referenceAssetIds: refs,
        aspectRatio: input.aspectRatio ?? '9:16',
        modelId: model.modelId,
      }),
  })

  await applyProjectMutation(ctx, (current) =>
    attachAsset(current, {
      id: result.assetId!,
      kind: 'image',
      blobKey: result.blobKey!,
      contentType: result.contentType ?? 'image/png',
      source: 'generator',
      probe: { modelId: model.modelId, prompt: input.prompt },
    }),
  )

  return toolOk(`Generated image asset ${result.assetId}`, {
    jobId: result.jobId,
    assetId: result.assetId,
    estimatedGbp,
    actualGbp: result.actualGbp,
    modelId: model.modelId,
    brandRefsUnsupported: result.brandRefsUnsupported,
  })
}

export const runGenerateVoiceoverTool = async (
  ctx: StudioToolContext,
  input: { text: string; confirmSpend?: boolean },
): Promise<ToolOutcome> => {
  const disabled = ensureToolEnabled(ctx, 'generate_voiceover')
  if (disabled) return disabled
  const missing = requireProjectBrandOrFail(ctx)
  if (missing) return missing
  requireBrand(ctx.project)

  const reusable = findReusableSpeechAsset(ctx.project)
  if (reusable) {
    const durationInFrames = voiceoverDurationFrames(
      reusable.probe as Record<string, unknown> | undefined,
      Math.max(1, Math.ceil(String(reusable.probe?.text ?? input.text).split(/\s+/).length / 2.5)),
    )
    await applyProjectMutation(ctx, (current) =>
      placeVoiceoverOnSfxFromStart(current, reusable.id, durationInFrames),
    )
    return toolOk(
      `Placed existing voiceover ${reusable.id} on the speech lane from frame 0 (no new TTS)`,
      {
        assetId: reusable.id,
        reused: true,
        trackId: SFX_TRACK_ID,
        from: 0,
      },
    )
  }

  const brand = brandPromptContextFromProject(ctx.project)
  const model = resolveModelRef(ctx.modelProfileId, 'speech')
  const units = Math.max(1, Math.ceil(input.text.split(/\s+/).length / 2.5))
  const estimatedGbp = estimateGbp(model.modelId, units)
  const blocked = await resolveToolSpendGate(ctx, {
    estimatedGbp,
    requireConfirm: estimatedGbp > 0,
    confirmSpend: spendConfirmed(ctx, input),
    role: 'speech',
    modelId: model.modelId,
  })
  if (blocked) return blocked

  if (!ctx.persist) {
    const asset = await generateSpeech({ text: input.text, brand, modelId: model.modelId })
    const assetId = crypto.randomUUID()
    await applyProjectMutation(ctx, (current) => {
      const withAsset = attachAsset(current, {
        id: assetId,
        kind: 'audio',
        blobKey: `memory/generated/${assetId}.mp3`,
        contentType: asset.contentType,
        source: 'generator',
        probe: { ...asset.probe, text: input.text, role: 'voiceover' },
      })
      const durationInFrames = voiceoverDurationFrames(asset.probe, units)
      return placeVoiceoverOnSfxFromStart(withAsset, assetId, durationInFrames)
    })
    return toolOk(`Generated voiceover and placed it on the speech lane from frame 0 (in-memory)`, {
      assetId,
      estimatedGbp,
      modelId: model.modelId,
      trackId: SFX_TRACK_ID,
      from: 0,
    })
  }

  const result = await runSyncedGeneration({
    supabase: ctx.supabase,
    blobEnv: ctx.blobEnv,
    productId: ctx.productId,
    projectId: ctx.projectId,
    role: 'speech',
    modelId: model.modelId,
    modelProfileId: ctx.modelProfileId,
    estimatedGbp,
    units,
    confirmSpend: spendConfirmed(ctx, input),
    inputSnapshot: { text: input.text, brand },
    produce: () => generateSpeech({ text: input.text, brand, modelId: model.modelId }),
  })

  const durationFrames = voiceoverDurationFrames(result.probe, units)

  await applyProjectMutation(ctx, (current) => {
    const withAsset = attachAsset(current, {
      id: result.assetId!,
      kind: 'audio',
      blobKey: result.blobKey!,
      contentType: result.contentType ?? 'audio/mpeg',
      source: 'generator',
      probe: {
        modelId: model.modelId,
        text: input.text,
        role: 'voiceover',
        ...(result.probe ?? {}),
        durationSeconds:
          typeof result.probe?.durationSeconds === 'number' ? result.probe.durationSeconds : units,
        durationFrames,
      },
    })
    return placeVoiceoverOnSfxFromStart(withAsset, result.assetId!, durationFrames)
  })

  return toolOk(
    `Generated voiceover ${result.assetId} and placed it on the speech lane from frame 0`,
    {
      jobId: result.jobId,
      assetId: result.assetId,
      estimatedGbp,
      actualGbp: result.actualGbp,
      modelId: model.modelId,
      trackId: SFX_TRACK_ID,
      from: 0,
    },
  )
}

const persistTranscriptSegments = async (
  ctx: StudioToolContext,
  assetId: string,
  text: string,
  segments: unknown,
): Promise<void> => {
  const rows = Array.isArray(segments)
    ? segments.flatMap((row) => {
        if (!row || typeof row !== 'object') return []
        const record = row as { startMs?: unknown; endMs?: unknown; text?: unknown }
        const itemText = String(record.text ?? '').trim()
        if (!itemText) return []
        return [
          {
            startMs: Number(record.startMs) || 0,
            endMs: Number(record.endMs) || 0,
            text: itemText,
          },
        ]
      })
    : []
  if (rows.length === 0 && !text.trim()) return
  await applyProjectMutation(ctx, (current) =>
    writeTranscriptOnAsset(current, assetId, { text, segments: rows }),
  )
}

export const runTranscribeTool = async (
  ctx: StudioToolContext,
  input: { assetId: string; confirmSpend?: boolean },
): Promise<ToolOutcome> => {
  const disabled = ensureToolEnabled(ctx, 'transcribe_media')
  if (disabled) return disabled
  const asset = ctx.project.assets.find((item) => item.id === input.assetId)
  if (!asset) {
    return toolFail(`Unknown asset ${input.assetId}`)
  }
  if (asset.kind !== 'audio' && asset.kind !== 'video') {
    return toolFail(`Asset ${input.assetId} is ${asset.kind}; transcription needs audio or video`)
  }
  const model = resolveModelRef(ctx.modelProfileId, 'transcribe')
  const units = 30
  const estimatedGbp = estimateGbp(model.modelId, units)
  const confirmed = spendConfirmed(ctx, input)
  if (estimatedGbp > 0 && !confirmed) {
    return toolFail(
      `Transcribe would cost about £${estimatedGbp.toFixed(2)} — pass confirmSpend=true to continue.`,
    )
  }
  const blocked = await resolveToolSpendGate(ctx, {
    estimatedGbp,
    requireConfirm: estimatedGbp > 0,
    confirmSpend: confirmed,
    suggestProfile: 'ci-stub',
    role: 'transcribe',
    modelId: model.modelId,
  })
  if (blocked) return blocked
  const mediaType = asset.contentType
  const fileName = asset.blobKey.split('/').pop() ?? asset.blobKey

  if (!ctx.persist) {
    if (!isStubTranscribeModelId(model.modelId)) {
      return toolFail(
        'Transcription needs a persisted project so audio can be loaded from Blob. Offline evals should use ci-stub / mock-transcribe.',
      )
    }
    const result = await transcribeMedia({
      audioAssetId: input.assetId,
      modelId: model.modelId,
      mediaType,
      fileName,
    })
    await persistTranscriptSegments(ctx, input.assetId, result.text, result.segments)
    return toolOk(transcriptSummary(result.text), {
      text: result.text,
      segments: result.segments,
      estimatedGbp,
      modelId: model.modelId,
    })
  }

  const audioBytes = await getBlobBytes({ blobEnv: ctx.blobEnv, blobKey: asset.blobKey })
  const result = await runSyncedGeneration({
    supabase: ctx.supabase,
    blobEnv: ctx.blobEnv,
    productId: ctx.productId,
    projectId: ctx.projectId,
    role: 'transcribe',
    modelId: model.modelId,
    modelProfileId: ctx.modelProfileId,
    estimatedGbp,
    units,
    confirmSpend: confirmed,
    inputSnapshot: { assetId: input.assetId },
    produce: async () => {
      const transcript = await transcribeMedia({
        audioAssetId: input.assetId,
        modelId: model.modelId,
        audioBytes,
        mediaType,
        fileName,
      })
      return { transcriptOnly: true as const, text: transcript.text, segments: transcript.segments }
    },
  })

  const text = String(result.transcript?.text ?? '').trim()
  await persistTranscriptSegments(ctx, input.assetId, text, result.transcript?.segments)
  return toolOk(transcriptSummary(text), {
    jobId: result.jobId,
    text,
    segments: result.transcript?.segments,
    estimatedGbp,
    actualGbp: result.actualGbp,
    modelId: model.modelId,
  })
}

const transcriptSummary = (text: string): string => {
  const trimmed = text.trim()
  if (!trimmed) return 'Transcribed media (empty transcript)'
  // Chat shows summary only — put the words where the founder will read them.
  return `Transcript:\n${trimmed}`
}

export const runGenerateVideoClipTool = async (
  ctx: StudioToolContext,
  input: {
    prompt: string
    durationSeconds?: number
    sourceImageAssetId?: string
    sourceImageAssetIds?: string[]
    confirmSpend?: boolean
    placeOnTimeline?: boolean
  },
): Promise<ToolOutcome> => {
  const disabled = ensureToolEnabled(ctx, 'generate_video_clip')
  if (disabled) return disabled
  const missing = requireProjectBrandOrFail(ctx)
  if (missing) return missing
  requireBrand(ctx.project)

  const profile = getModelProfile(ctx.modelProfileId)
  const modelId = resolveVideoModelId({
    profileVideoModelId: resolveModelRef(ctx.modelProfileId, 'video').modelId,
    videoModelId: ctx.videoModelId,
  })
  const maxVideoSeconds = isLiveVideoModelId(modelId)
    ? videoModelMaxSeconds(modelId)
    : profile.limits.maxVideoSeconds || 4
  const placeOnTimeline = input.placeOnTimeline !== false
  const durationResolved = resolveGenerateVideoDurationSeconds({
    project: ctx.project,
    requestedSeconds: input.durationSeconds,
    modelMaxSeconds: maxVideoSeconds,
    allowedDurations: isLiveVideoModelId(modelId) ? videoModelAllowedDurations(modelId) : undefined,
    placeOnTimeline,
  })
  if ('error' in durationResolved) {
    return toolFail(durationResolved.error)
  }
  const durationSeconds = durationResolved.durationSeconds
  if (durationSeconds <= 0) {
    return toolFail(`Profile ${profile.id} does not allow video generation`)
  }

  const requestedIds = uniqueStillIds([
    ...(input.sourceImageAssetIds ?? []),
    input.sourceImageAssetId ?? '',
  ])
  const maxVideoRefs = videoModelMaxInputVideos(modelId)
  const refs = withMainClipContinuation(
    ctx.project,
    resolveVideoGenerateRefs(ctx.project, requestedIds, ctx.referencedAssetIds),
    placeOnTimeline ? maxVideoRefs : 0,
  )
  const stillIds = refs.stillIds
  const videoIds = refs.videoIds
  const continuing = Boolean(placeOnTimeline && lastMainVideoAssetId(ctx.project))
  const continuationKind = videoContinuationKind(maxVideoRefs, continuing)
  const firstStill = ctx.project.assets.find((asset) => asset.id === stillIds[0])
  const lastStill =
    stillIds.length >= 2
      ? ctx.project.assets.find((asset) => asset.id === stillIds[stillIds.length - 1])
      : undefined
  const stillSize = (asset: { probe?: Record<string, unknown> } | undefined) => {
    const width = Number(asset?.probe?.width)
    const height = Number(asset?.probe?.height)
    return width > 0 && height > 0 ? { width, height } : undefined
  }
  const countCheck = preflightVideoGenerate({
    modelId,
    stillCount: stillIds.length,
    videoCount: videoIds.length,
    audioCount: refs.audioIds.length,
    otherCount: refs.otherIds.length,
    firstStillSize: stillSize(firstStill),
    lastStillSize: stillSize(lastStill),
  })
  if (!countCheck.ok) return toolFail(countCheck.message)

  const brand = await resolvePromptBrand(ctx)
  const sourceImageAssetId = stillIds[0]
  const referenceImageAssetIds = stillIds.slice(1)
  const clipContinue = continuationKind === 'clip'
  const prompt = withLastFrameContinuation(
    withShotContinuation(
      withVideoReferenceTags(
        modelId,
        withSourceIdentityLock(
          withLookPrompt(ctx, input.prompt),
          continuationKind === 'last-frame' ? undefined : sourceImageAssetId,
          stillIds.length,
        ),
        stillIds.length,
        videoIds.length,
        clipContinue,
      ),
      clipContinue,
    ),
    continuationKind === 'last-frame',
  )
  const model = { modelId }
  const estimatedGbp = estimateGbp(model.modelId, durationSeconds)
  const confirmed = spendConfirmed(ctx, input)
  const blocked = await resolveToolSpendGate(ctx, {
    estimatedGbp,
    requireConfirm: estimatedGbp > 0,
    confirmSpend: confirmed,
    suggestProfile: 'broll-live',
    role: 'video',
    modelId,
  })
  if (blocked) return blocked

  if (estimatedGbp > 0 && !confirmed) {
    return toolFail(
      `Estimated £${estimatedGbp.toFixed(2)} needs confirmSpend=true before live video (profile ${profile.id}, ${durationSeconds}s).`,
    )
  }

  let sourceImageBytes: Uint8Array | undefined
  let referenceImages: Array<{ bytes: Uint8Array; mediaType: string }> | undefined
  const loadIds = [...stillIds, ...videoIds]
  if (ctx.persist && loadIds.length > 0) {
    const loaded: Array<{ bytes: Uint8Array; mediaType: string }> = []
    for (const assetId of loadIds) {
      const sourceAsset = ctx.project.assets.find((asset) => asset.id === assetId)
      if (!sourceAsset) {
        return toolFail(
          'The source photo is not on this project. Pick a still from the media bin — I will not invent the product from text.',
        )
      }
      try {
        const buf = await getBlobBytes({ blobEnv: ctx.blobEnv, blobKey: sourceAsset.blobKey })
        const bytes = new Uint8Array(buf)
        if (!bytes.byteLength) {
          return toolFail(
            'Could not read the source photo for image-to-video. I will not invent the product from text.',
          )
        }
        loaded.push({ bytes, mediaType: mediaTypeForAsset(sourceAsset) })
      } catch {
        return toolFail(
          'Could not read the source photo for image-to-video. I will not invent the product from text.',
        )
      }
    }
    const sizeCheck = preflightVideoGenerate({
      modelId,
      stillCount: stillIds.length,
      videoCount: videoIds.length,
      stillByteLengths: loaded.slice(0, stillIds.length).map((row) => row.bytes.byteLength),
    })
    if (!sizeCheck.ok) return toolFail(sizeCheck.message)
    const stillLoaded = loaded.slice(0, stillIds.length)
    const videoLoaded = loaded.slice(stillIds.length)
    sourceImageBytes = stillLoaded[0]?.bytes
    const extra = [...stillLoaded.slice(1), ...videoLoaded]
    referenceImages = extra.length > 0 ? extra : undefined
    if (continuationKind === 'last-frame') {
      const lastId = lastMainVideoAssetId(ctx.project)
      const lastAsset = lastId ? ctx.project.assets.find((asset) => asset.id === lastId) : undefined
      const lastClip = lastId
        ? ctx.project.clips
            .filter((clip) => clip.assetId === lastId)
            .sort((a, b) => b.from - a.from)[0]
        : undefined
      if (!lastAsset || !lastClip) {
        return toolFail('Could not read the last shot to continue from its last frame.')
      }
      try {
        const buf = await getBlobBytes({ blobEnv: ctx.blobEnv, blobKey: lastAsset.blobKey })
        const framed = await lastFrameJpegFromVideo({
          bytes: new Uint8Array(buf),
          contentType: lastAsset.contentType,
          fileName: lastAsset.blobKey,
          durationFrames: lastClip.durationInFrames,
          fps: ctx.project.fps,
        })
        if (!framed.ok) {
          return toolFail(
            `Could not take the last frame of the previous shot (${framed.reason}). Retry generate_video_clip.`,
          )
        }
        sourceImageBytes = framed.bytes
        referenceImages = stillLoaded.slice(1).length > 0 ? stillLoaded.slice(1) : undefined
      } catch {
        return toolFail('Could not read the last shot to continue from its last frame.')
      }
    }
  }

  if (!ctx.persist) {
    const asset = await generateVideoClip({
      prompt,
      brand,
      sourceImageAssetId,
      referenceImageAssetIds:
        referenceImageAssetIds.length > 0 ? referenceImageAssetIds : undefined,
      referenceVideoAssetIds: videoIds.length > 0 ? videoIds : undefined,
      durationSeconds,
      modelId: model.modelId,
      maxVideoSeconds,
    })
    const assetId = crypto.randomUUID()
    await applyProjectMutation(ctx, (current) => {
      const withAsset = attachAsset(current, {
        id: assetId,
        kind: 'video',
        blobKey: `memory/generated/${assetId}.mp4`,
        contentType: asset.contentType,
        source: 'generator',
        probe: asset.probe,
      })
      return placeOnTimeline
        ? placeGeneratedVideoOnMain(withAsset, assetId, durationSeconds)
        : withAsset
    })
    return toolOk(`Generated video clip (in-memory)`, {
      assetId,
      estimatedGbp,
      modelId: model.modelId,
      durationSeconds,
      sourceImageAssetId,
      referenceImageAssetIds,
      referenceVideoAssetIds: videoIds,
      continuedFromLastFrame: continuationKind === 'last-frame',
    })
  }

  const result = await runSyncedGeneration({
    supabase: ctx.supabase,
    blobEnv: ctx.blobEnv,
    productId: ctx.productId,
    projectId: ctx.projectId,
    role: 'video',
    modelId: model.modelId,
    modelProfileId: ctx.modelProfileId,
    estimatedGbp,
    units: durationSeconds,
    confirmSpend: confirmed,
    inputSnapshot: {
      prompt,
      brand,
      sourceImageAssetId,
      referenceImageAssetIds,
      referenceVideoAssetIds: videoIds,
      durationSeconds,
      confirmSpend: confirmed,
      continuedFromLastFrame: continuationKind === 'last-frame',
      // ADR-0085/0086: snapshot the confirmed plan id and canonical model ids.
      ...(ctx.generationPlanId ? { generationPlanId: ctx.generationPlanId } : {}),
      ...planModelIds(ctx.project.generationPlan),
    },
    produce: () =>
      generateVideoClip({
        prompt,
        brand,
        sourceImageAssetId,
        sourceImageBytes,
        referenceImageAssetIds:
          referenceImageAssetIds.length > 0 ? referenceImageAssetIds : undefined,
        referenceVideoAssetIds: videoIds.length > 0 ? videoIds : undefined,
        referenceImages,
        durationSeconds,
        modelId: model.modelId,
        maxVideoSeconds,
      }),
  })

  await applyProjectMutation(ctx, (current) => {
    const withAsset = attachAsset(current, {
      id: result.assetId!,
      kind: 'video',
      blobKey: result.blobKey!,
      contentType: 'video/mp4',
      source: 'generator',
      probe: {
        modelId: model.modelId,
        durationSeconds,
        sourceImageAssetId,
        referenceImageAssetIds,
        referenceVideoAssetIds: videoIds,
        i2v: Boolean(sourceImageBytes) || Boolean(referenceImages?.length),
        continuedFromLastFrame: continuationKind === 'last-frame',
      },
    })
    const withVideo = placeOnTimeline
      ? placeGeneratedVideoOnMain(withAsset, result.assetId!, durationSeconds)
      : withAsset
    // ADR-0086: mark the confirmed plan applied so planForce does not re-fire next turn.
    if (ctx.generationPlanId && withVideo.generationPlan?.id === ctx.generationPlanId) {
      return applyGenerationPlanToProject(
        withVideo,
        parseGenerationPlan({ ...withVideo.generationPlan, status: 'applied' }),
      )
    }
    return withVideo
  })

  return toolOk(`Generated video clip ${result.assetId}`, {
    jobId: result.jobId,
    assetId: result.assetId,
    estimatedGbp,
    actualGbp: result.actualGbp,
    modelId: model.modelId,
    durationSeconds,
    sourceImageAssetId,
    referenceImageAssetIds,
    referenceVideoAssetIds: videoIds,
    continuedFromLastFrame: continuationKind === 'last-frame',
    brandRefsUnsupported: result.brandRefsUnsupported,
  })
}

export const runGenerateMusicTool = async (
  ctx: StudioToolContext,
  input: {
    prompt: string
    durationSeconds?: number
    forceInstrumental?: boolean
    confirmSpend?: boolean
    placeOnTimeline?: boolean
  },
): Promise<ToolOutcome> => {
  const disabled = ensureToolEnabled(ctx, 'generate_music')
  if (disabled) return disabled

  const durationMs = clampMusicDurationMs((input.durationSeconds ?? 30) * 1000)
  const forceInstrumental = input.forceInstrumental !== false
  const model = resolveModelRef(ctx.modelProfileId, 'music')
  const units = Math.max(1, Math.ceil(durationMs / 1000))
  const estimatedGbp = estimateGbp(model.modelId, units)
  const confirmed = spendConfirmed(ctx, input)
  const blocked = await resolveToolSpendGate(ctx, {
    estimatedGbp,
    requireConfirm: estimatedGbp > 0,
    confirmSpend: confirmed,
    suggestProfile: 'ci-stub',
    role: 'music',
    modelId: model.modelId,
  })
  if (blocked) return blocked

  const { style } = await loadMusicStyle(ctx.productId)
  const licenseBox: { value: MusicLicenseMeta | null } = { value: null }
  const musicPrompt = withLookMusicPrompt(ctx, input.prompt)
  let promptUsed = musicPrompt

  if (!ctx.persist) {
    const generated = await generateMusic({
      prompt: musicPrompt,
      modelId: model.modelId,
      durationMs,
      forceInstrumental,
      musicStyle: style,
    })
    const assetId = crypto.randomUUID()
    await applyProjectMutation(ctx, (current) => {
      const withAsset = attachAsset(current, {
        id: assetId,
        kind: 'audio',
        blobKey: `memory/generated/${assetId}.mp3`,
        contentType: generated.asset.contentType,
        source: 'generator',
        probe: generated.asset.probe,
      })
      if (input.placeOnTimeline === false) return withAsset
      return addClip(withAsset, {
        assetId,
        from: appendOnAudioTrackFrom(withAsset),
        durationInFrames: voiceoverDurationFrames(generated.asset.probe, units),
      })
    })
    return toolOk(`Generated music bed (in-memory)`, {
      assetId,
      estimatedGbp,
      modelId: model.modelId,
      licenseStatus: generated.license.licenseStatus,
      commercialUseAllowed: generated.license.commercialUseAllowed,
    })
  }

  const result = await runSyncedGeneration({
    supabase: ctx.supabase,
    blobEnv: ctx.blobEnv,
    productId: ctx.productId,
    projectId: ctx.projectId,
    role: 'music',
    modelId: model.modelId,
    modelProfileId: ctx.modelProfileId,
    estimatedGbp,
    units,
    confirmSpend: confirmed,
    inputSnapshot: {
      prompt: musicPrompt,
      durationMs,
      forceInstrumental,
      musicStyle: style,
    },
    produce: async () => {
      const generated = await generateMusic({
        prompt: musicPrompt,
        modelId: model.modelId,
        durationMs,
        forceInstrumental,
        musicStyle: style,
      })
      licenseBox.value = generated.license
      promptUsed = generated.promptUsed
      return generated.asset
    },
  })

  const licenseMeta = licenseBox.value
  if (!result.assetId || !result.blobKey || !licenseMeta) {
    return toolFail('Music generation produced no asset')
  }

  const durationFrames = voiceoverDurationFrames(result.probe, units)

  const musicGeneration = await insertMusicGeneration(ctx.supabase, {
    productId: ctx.productId,
    projectId: ctx.projectId,
    generationJobId: result.jobId,
    assetId: result.assetId,
    prompt: promptUsed,
    modelId: model.modelId,
    provider: licenseMeta.provider,
    durationMs,
    forceInstrumental,
    licenseStatus: licenseMeta.licenseStatus,
    licenseTier: licenseMeta.licenseTier,
    commercialUseAllowed: licenseMeta.commercialUseAllowed,
    licenseNotes: licenseMeta.licenseNotes,
    providerSongId: licenseMeta.providerSongId,
    inputSnapshot: { durationMs, forceInstrumental, style },
  })

  try {
    await applyProjectMutation(ctx, (current) => {
      const withAsset = attachAsset(current, {
        id: result.assetId!,
        kind: 'audio',
        blobKey: result.blobKey!,
        contentType: result.contentType ?? 'audio/mpeg',
        source: 'generator',
        probe: {
          modelId: model.modelId,
          prompt: promptUsed,
          role: 'music_bed',
          ...(result.probe ?? {}),
          durationFrames,
        },
      })
      if (input.placeOnTimeline === false) return withAsset
      return addClip(withAsset, {
        assetId: result.assetId!,
        from: appendOnAudioTrackFrom(withAsset),
        durationInFrames: durationFrames,
      })
    })
  } catch (error) {
    await ctx.supabase.from('music_generations').delete().eq('id', musicGeneration.id)
    throw error
  }

  return toolOk(`Generated music bed ${result.assetId}`, {
    jobId: result.jobId,
    assetId: result.assetId,
    estimatedGbp,
    actualGbp: result.actualGbp,
    modelId: model.modelId,
    licenseStatus: licenseMeta.licenseStatus,
    commercialUseAllowed: licenseMeta.commercialUseAllowed,
  })
}

const ENHANCE_MODEL_ID = 'mock-enhance'

export const runEnhanceSpeechTool = async (
  ctx: StudioToolContext,
  input: { clipId?: string; assetId?: string; confirmSpend?: boolean },
): Promise<ToolOutcome> => {
  const disabled = ensureToolEnabled(ctx, 'enhance_speech')
  if (disabled) return disabled

  const plan = planEnhanceSpeech(ctx.project, input)
  if (!plan.ok) return toolFail(plan.error)
  if (plan.skip) {
    return toolOk(plan.reason, { skipped: true, clipId: plan.clip.id, assetId: plan.asset.id })
  }

  if (!isStubEnhanceModelId(ENHANCE_MODEL_ID)) {
    return toolFail(
      'Speech enhance has no live vendor in this build. Use the stub path (mock-enhance).',
    )
  }

  const estimatedGbp = estimateGbp(ENHANCE_MODEL_ID, 1)
  const confirmed = spendConfirmed(ctx, input)
  if (estimatedGbp > 0 && !confirmed) {
    return toolFail(
      `Speech enhance would cost about £${estimatedGbp.toFixed(2)} — pass confirmSpend=true to continue.`,
    )
  }

  const source = plan.asset
  const clipId = plan.clip.id
  const contentType = mediaTypeForAsset(source)
  const probe = enhancedProbeFor(source, ENHANCE_MODEL_ID)

  if (!ctx.persist) {
    const assetId = crypto.randomUUID()
    await applyProjectMutation(ctx, (current) => {
      const withAsset = attachAsset(current, {
        id: assetId,
        kind: source.kind,
        blobKey: `memory/enhanced/${assetId}`,
        contentType,
        source: 'generator',
        probe,
      })
      return appendWhyLog(retargetClipAsset(withAsset, clipId, assetId), {
        t: secondsAtFrame(current, plan.clip.from),
        target: clipId,
        action: 'enhance',
        reason: 'Reduced noise and echo on this talking-head take.',
      })
    })
    return toolOk('Enhanced speech on this take (stub, in-memory).', {
      clipId,
      assetId,
      estimatedGbp,
      modelId: ENHANCE_MODEL_ID,
    })
  }

  const bytes = await getBlobBytes({ blobEnv: ctx.blobEnv, blobKey: source.blobKey })
  const result = await runSyncedGeneration({
    supabase: ctx.supabase,
    blobEnv: ctx.blobEnv,
    productId: ctx.productId,
    projectId: ctx.projectId,
    role: 'speech_enhance',
    modelId: ENHANCE_MODEL_ID,
    modelProfileId: ctx.modelProfileId,
    estimatedGbp,
    units: 1,
    confirmSpend: confirmed,
    inputSnapshot: { clipId, sourceAssetId: source.id },
    produce: async () => ({
      kind: source.kind === 'audio' ? 'audio' : 'video',
      bytes,
      contentType,
      probe,
    }),
  })

  await applyProjectMutation(ctx, (current) => {
    const withAsset = attachAsset(current, {
      id: result.assetId!,
      kind: source.kind,
      blobKey: result.blobKey!,
      contentType: result.contentType ?? contentType,
      source: 'generator',
      probe,
    })
    return appendWhyLog(retargetClipAsset(withAsset, clipId, result.assetId!), {
      t: secondsAtFrame(current, plan.clip.from),
      target: clipId,
      action: 'enhance',
      reason: 'Reduced noise and echo on this talking-head take.',
    })
  })

  return toolOk('Enhanced speech on this take.', {
    jobId: result.jobId,
    clipId,
    assetId: result.assetId,
    estimatedGbp,
    actualGbp: result.actualGbp,
    modelId: ENHANCE_MODEL_ID,
  })
}

export const runDuckMusicTool = async (
  ctx: StudioToolContext,
  input: { clipId?: string },
): Promise<ToolOutcome> => {
  const disabled = ensureToolEnabled(ctx, 'duck_music')
  if (disabled) return disabled

  const plan = planDuckMusic(ctx.project, input)
  if (!plan.ok) return toolFail(plan.error)
  if (plan.skip) {
    return toolOk(plan.reason, { skipped: true, clipIds: plan.clipIds })
  }

  await applyProjectMutation(ctx, (current) => applyDuckMusic(current, input))
  return toolOk('Ducked music under speech.', { clipIds: plan.clipIds })
}

export const runReframeClipTool = async (
  ctx: StudioToolContext,
  input: { clipId?: string; aspect?: string; subjectHint?: string },
): Promise<ToolOutcome> => {
  const disabled = ensureToolEnabled(ctx, 'reframe_clip')
  if (disabled) return disabled

  const plan = planReframeClip(ctx.project, input)
  if (!plan.ok) return toolFail(plan.error)
  if (plan.skip) {
    return toolOk(plan.reason, {
      skipped: true,
      clipId: plan.clip.id,
      aspect: plan.clip.reframe?.aspect,
    })
  }

  if (!isStubReframeModelId(REFRAME_STUB_MODEL_ID)) {
    return toolFail(
      'Reframe has no live tracking vendor in this build. Use the stub path (mock-reframe).',
    )
  }

  const clipId = plan.clip.id
  const reframe = plan.reframe

  if (!ctx.persist) {
    await applyProjectMutation(ctx, (current) => applyReframeClip(current, { clipId, reframe }))
    return toolOk(`Reframed this take to ${plan.aspect} (stub, in-memory).`, {
      clipId,
      aspect: plan.aspect,
      modelId: REFRAME_STUB_MODEL_ID,
    })
  }

  const result = await runSyncedGeneration({
    supabase: ctx.supabase,
    blobEnv: ctx.blobEnv,
    productId: ctx.productId,
    projectId: ctx.projectId,
    role: 'reframe',
    modelId: REFRAME_STUB_MODEL_ID,
    modelProfileId: ctx.modelProfileId,
    estimatedGbp: 0,
    units: 1,
    inputSnapshot: { clipId, aspect: plan.aspect, sourceAssetId: plan.asset.id },
    produce: async () => ({ metadataOnly: true as const }),
  })

  await applyProjectMutation(ctx, (current) => applyReframeClip(current, { clipId, reframe }))
  return toolOk(`Reframed this take to ${plan.aspect}.`, {
    jobId: result.jobId,
    clipId,
    aspect: plan.aspect,
    modelId: REFRAME_STUB_MODEL_ID,
  })
}
