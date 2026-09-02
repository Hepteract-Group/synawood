import { brandPromptContextFromProject } from '../brand'
import { generateImage, generateMusic, generateVideoClip } from '../generators'
import { getModelProfile, isToolEnabled, resolveModelRef } from '../model-profiles'
import { attachAsset, addClip } from '../project/operations'
import { BRAND_REQUIRED_COPY } from './assemble'
import { placeGeneratedFill, type FillGenerateResult } from './commit'
import type { BrollGenerateRow, BrollMusicRow } from './schema'
import type { StudioProject } from '../project/schema'

export const fillGenerateRow = async (input: {
  project: StudioProject
  row: BrollGenerateRow
  modelProfileId: string
  from?: number
  until?: number
}): Promise<FillGenerateResult> => {
  const durationSeconds = Math.min(4, input.row.durationSeconds ?? 4)
  const durationInFrames = Math.max(1, Math.round(durationSeconds * 30))

  if (input.row.media === 'image' && input.row.sourceImageAssetId) {
    const library = input.project.assets.find(
      (asset) => asset.id === input.row.sourceImageAssetId && asset.kind === 'image',
    )
    if (library) {
      return placeGeneratedFill(input.project, {
        assetId: library.id,
        durationInFrames,
        from: input.from,
        until: input.until,
      })
    }
  }

  if (!input.project.brand) {
    return { ok: false, error: BRAND_REQUIRED_COPY }
  }
  const brand = brandPromptContextFromProject(input.project)
  const profile = getModelProfile(input.modelProfileId)
  const assetId = crypto.randomUUID()

  try {
    if (input.row.media === 'image') {
      if (!isToolEnabled(input.modelProfileId, 'generate_image')) {
        return { ok: false, error: 'generate_image is disabled on this profile' }
      }
      const model = resolveModelRef(input.modelProfileId, 'image')
      const asset = await generateImage({
        prompt: input.row.prompt,
        brand,
        referenceAssetIds: input.row.sourceImageAssetId ? [input.row.sourceImageAssetId] : [],
        aspectRatio: '9:16',
        modelId: model.modelId,
      })
      const attached = attachAsset(input.project, {
        id: assetId,
        kind: 'image',
        blobKey: `memory/generated/${assetId}.png`,
        contentType: asset.contentType,
        source: 'generator',
        probe: asset.probe,
      })
      return placeGeneratedFill(attached, {
        assetId,
        durationInFrames: Math.max(1, Math.round(durationSeconds * 30)),
        from: input.from,
        until: input.until,
      })
    }

    if (!isToolEnabled(input.modelProfileId, 'generate_video_clip')) {
      return { ok: false, error: 'generate_video_clip is disabled on this profile' }
    }
    const model = resolveModelRef(input.modelProfileId, 'video')
    const asset = await generateVideoClip({
      prompt: input.row.prompt,
      brand,
      sourceImageAssetId: input.row.sourceImageAssetId,
      durationSeconds,
      modelId: model.modelId,
      maxVideoSeconds: profile.limits.maxVideoSeconds || 4,
    })
    const attached = attachAsset(input.project, {
      id: assetId,
      kind: 'video',
      blobKey: `memory/generated/${assetId}.mp4`,
      contentType: asset.contentType,
      source: 'generator',
      probe: asset.probe,
    })
    return placeGeneratedFill(attached, {
      assetId,
      durationInFrames: Math.max(1, Math.round(durationSeconds * 30)),
      from: input.from,
      until: input.until,
    })
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Generate-to-fill failed',
    }
  }
}

export const fillMusicRow = async (input: {
  project: StudioProject
  row: BrollMusicRow
  modelProfileId: string
}): Promise<FillGenerateResult> => {
  if (!isToolEnabled(input.modelProfileId, 'generate_music')) {
    return { ok: false, error: 'generate_music is disabled on this profile' }
  }
  const model = resolveModelRef(input.modelProfileId, 'music')
  const assetId = crypto.randomUUID()
  try {
    const result = await generateMusic({
      prompt: input.row.prompt,
      modelId: model.modelId,
      durationMs: Math.round(input.row.durationSeconds * 1000),
      forceInstrumental: true,
    })
    const attached = attachAsset(input.project, {
      id: assetId,
      kind: 'audio',
      blobKey: `memory/generated/${assetId}.mp3`,
      contentType: result.asset.contentType,
      source: 'generator',
      probe: result.asset.probe,
    })
    const before = new Set(attached.clips.map((clip) => clip.id))
    const placed = addClip(attached, {
      assetId,
      durationInFrames: Math.max(1, Math.round(input.row.durationSeconds * 30)),
    })
    const clip = placed.clips.find((item) => !before.has(item.id))
    if (!clip) return { ok: false, error: 'Music bed did not add a clip' }
    return { ok: true, project: placed, clipId: clip.id }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Music bed failed',
    }
  }
}
