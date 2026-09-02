/** Shared generate_music orchestration for tool + HTTP (#195 / #199). */

import type { SupabaseClient } from '@supabase/supabase-js'
import { attachAsset, addClip, trackEndFrame } from '../project/operations'
import type { StudioProject } from '../project/schema'
import { parseStudioProject } from '../project/schema'
import { saveProject } from '../project/save'
import { generateMusic, clampMusicDurationMs, isStubMusicModelId } from '../generators/music'
import type { MusicLicenseMeta } from '../generators/music'
import { runSyncedGeneration } from '../generation-jobs'
import { getModelProfile, resolveModelRef } from '../model-profiles'
import type { BlobEnv } from '../persistence/blob'
import { estimateGbp } from '../pricing'
import { resolveCreativeSpendGate } from '../billing/gate'
import { insertMusicGeneration } from './persist'
import { loadMusicStyle } from './style'
import type { MusicGeneration } from './schema'

const appendOnAudioTrackFrom = (project: StudioProject): number => {
  const audioTrackId = project.tracks.find((track) => track.type === 'audio')?.id ?? 'track_audio'
  return trackEndFrame(project, audioTrackId)
}

/** Place the bed under the picture, not past the ad. Operator can still extend via trim. */
export const placedMusicClipDurationFrames = (input: {
  audioFrames: number
  projectDurationFrames: number
  from: number
}): number => {
  const remaining = Math.max(1, input.projectDurationFrames - Math.max(0, input.from))
  return Math.max(1, Math.min(Math.max(1, input.audioFrames), remaining))
}

const musicDurationFrames = (
  probe: Record<string, unknown> | undefined,
  durationMs: number,
): number => {
  const fromProbe = Number(probe?.durationFrames)
  if (Number.isFinite(fromProbe) && fromProbe > 0) return Math.round(fromProbe)
  const seconds = Number(probe?.durationSeconds)
  if (Number.isFinite(seconds) && seconds > 0) return Math.max(1, Math.round(seconds * 30))
  return Math.max(1, Math.round((durationMs / 1000) * 30))
}

export const estimateMusicGbp = (input: {
  modelProfileId: string
  durationMs: number
}): { modelId: string; units: number; estimatedGbp: number; stub: boolean } => {
  const model = resolveModelRef(input.modelProfileId, 'music')
  const durationMs = clampMusicDurationMs(input.durationMs)
  const units = Math.max(1, Math.ceil(durationMs / 1000))
  return {
    modelId: model.modelId,
    units,
    estimatedGbp: estimateGbp(model.modelId, units),
    stub: isStubMusicModelId(model.modelId),
  }
}

export const generateMusicForProject = async (input: {
  supabase: SupabaseClient
  blobEnv: BlobEnv
  productId: string
  project: StudioProject
  expectedRevision: number
  modelProfileId: string
  prompt: string
  durationMs?: number
  forceInstrumental?: boolean
  confirmSpend?: boolean
  placeOnTimeline?: boolean
  repoRoot?: string
}): Promise<{
  project: StudioProject
  jobId: string
  assetId: string
  musicGeneration: MusicGeneration
  estimatedGbp: number
  actualGbp: number
  modelId: string
}> => {
  const profile = getModelProfile(input.modelProfileId)
  if (!profile.enabledTools.includes('generate_music')) {
    throw new Error(`generate_music is disabled on profile ${profile.id}`)
  }

  const durationMs = clampMusicDurationMs(input.durationMs ?? 30_000)
  const forceInstrumental = input.forceInstrumental !== false
  const { modelId, units, estimatedGbp } = estimateMusicGbp({
    modelProfileId: input.modelProfileId,
    durationMs,
  })

  const gate = await resolveCreativeSpendGate(input.supabase, {
    productId: input.productId,
    projectId: input.project.id,
    estimatedGbp,
    requireConfirm: estimatedGbp > 0,
    confirmSpend: Boolean(input.confirmSpend),
    suggestProfile: 'ci-stub',
  })
  if (!gate.ok) {
    throw new Error(gate.error)
  }

  const { style } = await loadMusicStyle(input.productId, input.repoRoot)
  const licenseBox: { value: MusicLicenseMeta | null } = { value: null }
  let promptUsed = input.prompt

  const result = await runSyncedGeneration({
    supabase: input.supabase,
    blobEnv: input.blobEnv,
    productId: input.productId,
    projectId: input.project.id,
    role: 'music',
    modelId,
    modelProfileId: input.modelProfileId,
    estimatedGbp,
    units,
    confirmSpend: Boolean(input.confirmSpend),
    inputSnapshot: {
      prompt: input.prompt,
      durationMs,
      forceInstrumental,
      musicStyle: style,
    },
    produce: async () => {
      const generated = await generateMusic({
        prompt: input.prompt,
        modelId,
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
    throw new Error('Music generation produced no asset')
  }

  const durationFrames = musicDurationFrames(result.probe, durationMs)
  let next = attachAsset(input.project, {
    id: result.assetId,
    kind: 'audio',
    blobKey: result.blobKey,
    contentType: result.contentType ?? 'audio/mpeg',
    source: 'generator',
    probe: {
      modelId,
      prompt: promptUsed,
      role: 'music_bed',
      ...(result.probe ?? {}),
      durationSeconds:
        typeof result.probe?.durationSeconds === 'number'
          ? result.probe.durationSeconds
          : durationMs / 1000,
      durationFrames,
    },
  })
  if (input.placeOnTimeline !== false) {
    const from = appendOnAudioTrackFrom(next)
    next = addClip(next, {
      assetId: result.assetId,
      from,
      durationInFrames: placedMusicClipDurationFrames({
        audioFrames: durationFrames,
        projectDurationFrames: next.durationFrames,
        from,
      }),
    })
  }
  next = parseStudioProject(next)

  // License row before tip save — Approve must not see music_bed assets without a row (#gate).
  const musicGeneration = await insertMusicGeneration(input.supabase, {
    productId: input.productId,
    projectId: input.project.id,
    generationJobId: result.jobId,
    assetId: result.assetId,
    prompt: promptUsed,
    modelId,
    provider: licenseMeta.provider,
    durationMs,
    forceInstrumental,
    licenseStatus: licenseMeta.licenseStatus,
    licenseTier: licenseMeta.licenseTier,
    commercialUseAllowed: licenseMeta.commercialUseAllowed,
    licenseNotes: licenseMeta.licenseNotes,
    providerSongId: licenseMeta.providerSongId,
    inputSnapshot: { durationMs, forceInstrumental, style, userPrompt: input.prompt },
  })

  try {
    const saved = await saveProject(input.supabase, next, input.expectedRevision)
    return {
      project: saved.project,
      jobId: result.jobId,
      assetId: result.assetId,
      musicGeneration,
      estimatedGbp,
      actualGbp: result.actualGbp,
      modelId,
    }
  } catch (error) {
    await input.supabase.from('music_generations').delete().eq('id', musicGeneration.id)
    throw error
  }
}
