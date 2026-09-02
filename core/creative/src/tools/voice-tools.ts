/** Voice Studio tools (ADR-0033 / #217–#220). */

import { tool } from 'ai'
import { z } from 'zod'
import { generateSpeech } from '../generators'
import type { BrandPromptContext } from '../brand/prompt-context'
import { runSyncedGeneration } from '../generation-jobs'
import { isToolEnabled, resolveModelRef } from '../model-profiles'
import { addClip, attachAsset, trackEndFrame } from '../project/operations'
import { parseStudioProject, type StudioProject } from '../project/schema'
import { estimateGbp } from '../pricing'
import { resolveCreativeSpendGate } from '../billing/gate'
import { applyProjectMutation, wrapTool } from './store'
import type { StudioToolContext } from './types'
import { toolFail, toolOk } from './types'
import { applyCutList, cutWhyReason } from '../voice/apply-cut-list'
import { applyJumpCutZooms } from '../voice/jump-cut-zooms'
import {
  buildCutList,
  clipLocalTimedCuts,
  isLargeClarityCut,
  isTimedCut,
  proposeClarityRanges,
  timedCutsToFrameRanges,
} from '../voice/cut-list'
import { fillerCutList, type TranscriptSegment } from '../voice/fillers'
import { cutListItemSchema, cutReasonSchema } from '../voice/schema'
import {
  estimateVoiceCloneGbp,
  estimateVoiceDubGbp,
  estimateVoiceSynthGbp,
} from '../voice/estimate'
import { resolveLipsyncPair } from '../voice/lipsync'
import {
  assertCloneReady,
  getVoiceProfile,
  insertDubJob,
  insertVoiceEvent,
  isMockVoiceModelId,
  listVoiceProfiles,
  pickDefaultVoiceProfile,
  type VoiceProvenance,
} from '../voice'

const transcriptSegmentsOf = (
  asset: { probe?: Record<string, unknown> } | undefined,
): TranscriptSegment[] => {
  const raw = asset?.probe?.transcriptSegments
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (item): item is TranscriptSegment =>
      item !== null &&
      typeof item === 'object' &&
      typeof (item as TranscriptSegment).startMs === 'number' &&
      typeof (item as TranscriptSegment).endMs === 'number' &&
      typeof (item as TranscriptSegment).text === 'string',
  )
}

const appendOnAudioTrackFrom = (project: StudioProject): number => {
  const audioTrackId = project.tracks.find((track) => track.type === 'audio')?.id ?? 'track_audio'
  return trackEndFrame(project, audioTrackId)
}

const durationFramesFrom = (probe: Record<string, unknown> | undefined, units: number): number => {
  const fromProbe = Number(probe?.durationFrames)
  if (Number.isFinite(fromProbe) && fromProbe > 0) return Math.round(fromProbe)
  const seconds = Number(probe?.durationSeconds)
  if (Number.isFinite(seconds) && seconds > 0) return Math.max(1, Math.round(seconds * 30))
  return Math.max(1, units * 30)
}

const ensureEnabled = (ctx: StudioToolContext, name: string) => {
  if (!isToolEnabled(ctx.modelProfileId, name)) {
    return toolFail(`Tool ${name} is disabled on profile ${ctx.modelProfileId}.`)
  }
  return null
}

const spendGate = async (ctx: StudioToolContext, estimatedGbp: number, confirmSpend?: boolean) => {
  if (estimatedGbp <= 0) return null
  if (!ctx.persist) return null
  const gate = await resolveCreativeSpendGate(ctx.supabase, {
    productId: ctx.productId,
    projectId: ctx.projectId,
    estimatedGbp,
    requireConfirm: estimatedGbp > 0,
    confirmSpend: confirmSpend ?? ctx.confirmSpend,
  })
  if (!gate.ok) {
    return toolFail(gate.error)
  }
  return null
}

const speechBrand = (ctx: StudioToolContext, voiceId: string): BrandPromptContext => ({
  productId: ctx.productId,
  displayName: ctx.project.brand?.displayName ?? ctx.productId,
  mood: ctx.project.brand?.mood ?? 'direct',
  paletteHex: [ctx.project.brand?.primaryColor ?? '#1f6b4a'],
  promptTokens: [],
  forbiddenClaims: [],
  doNotes: [],
  dontNotes: [],
  voiceId,
  speakingNotes: '',
  defaultCta: ctx.project.brand?.defaultCta ?? 'Learn more',
  neverFakeProductChrome: true,
})

const loadProfileIfAny = async (ctx: StudioToolContext, profileId?: string | null) => {
  if (profileId) {
    if (!ctx.persist) {
      return {
        id: profileId,
        productId: ctx.productId,
        kind: 'synth' as const,
        consentAt: new Date().toISOString(),
        name: 'test',
        providerVoiceId: null as string | null,
        sampleBlobKey: null as string | null,
      }
    }
    const profile = await getVoiceProfile(ctx.supabase, {
      productId: ctx.productId,
      profileId,
    })
    if (profile.status === 'archived') {
      throw new Error('That voice profile is archived. Pick an active one in Settings, Voice.')
    }
    if (profile.kind === 'clone') assertCloneReady(profile)
    return profile
  }
  if (!ctx.persist) return null
  const profiles = await listVoiceProfiles(ctx.supabase, ctx.productId)
  const picked = pickDefaultVoiceProfile(profiles)
  if (picked?.kind === 'clone') assertCloneReady(picked)
  return picked
}

const cloneVoiceIdOf = (
  profile: { kind?: string; providerVoiceId?: string | null } | null,
): string | undefined =>
  profile?.kind === 'clone' ? (profile.providerVoiceId ?? undefined) : undefined

const brandForProfile = (
  ctx: StudioToolContext,
  profile: { id?: string; kind?: string; providerVoiceId?: string | null } | null,
) =>
  speechBrand(
    ctx,
    (profile?.kind === 'clone' ? profile.providerVoiceId : null) ||
      profile?.id ||
      ctx.project.brand?.voiceId ||
      'default',
  )

export const createVoiceStudioTools = (ctx: StudioToolContext) => ({
  synthesize_voice: tool({
    description:
      'Generate spoken audio with Voice Studio provenance (profile optional). Places the clip on the audio track. confirmSpend when estimate > £0.',
    inputSchema: z.object({
      text: z.string().min(1).max(4000),
      profileId: z.string().uuid().optional(),
      confirmSpend: z.boolean().optional(),
    }),
    execute: async (input) =>
      wrapTool(ctx, 'synthesize_voice', input, async () => {
        const disabled = ensureEnabled(ctx, 'synthesize_voice')
        if (disabled) return disabled
        const profile = await loadProfileIfAny(ctx, input.profileId)
        const durationSeconds = Math.max(1, Math.ceil(input.text.split(/\s+/).length / 2.5))
        const clone = profile?.kind === 'clone'
        const estimate = clone
          ? estimateVoiceCloneGbp({ modelProfileId: ctx.modelProfileId, durationSeconds })
          : estimateVoiceSynthGbp({ modelProfileId: ctx.modelProfileId, durationSeconds })
        const blocked = await spendGate(ctx, estimate.estimatedGbp, input.confirmSpend)
        if (blocked) return blocked
        const brand = brandForProfile(ctx, profile)
        const provenance: VoiceProvenance = {
          kind: clone ? 'clone' : 'synth',
          profileId: profile?.id,
          consentAt: profile?.consentAt ?? undefined,
          modelId: estimate.modelId,
          stub: isMockVoiceModelId(estimate.modelId) || undefined,
        }
        const units = estimate.units
        const mergeProbe = (probe: Record<string, unknown> | undefined) => ({
          ...(probe ?? {}),
          modelId: estimate.modelId,
          text: input.text,
          voiceProvenance: provenance,
          role: 'voice_studio',
        })

        if (!ctx.persist) {
          const asset = await generateSpeech({
            text: input.text,
            brand,
            modelId: estimate.modelId,
            cloneVoiceId: cloneVoiceIdOf(profile),
          })
          const assetId = crypto.randomUUID()
          await applyProjectMutation(ctx, (current) => {
            const withAsset = attachAsset(current, {
              id: assetId,
              kind: 'audio',
              blobKey: `memory/generated/${assetId}.mp3`,
              contentType: asset.contentType,
              source: 'generator',
              probe: mergeProbe(asset.probe),
            })
            return addClip(withAsset, {
              assetId,
              from: appendOnAudioTrackFrom(withAsset),
              durationInFrames: durationFramesFrom(asset.probe, units),
            })
          })
          return toolOk('Synthesized voice (in-memory)', {
            assetId,
            estimatedGbp: estimate.estimatedGbp,
            modelId: estimate.modelId,
            provenance,
          })
        }

        const result = await runSyncedGeneration({
          supabase: ctx.supabase,
          blobEnv: ctx.blobEnv,
          productId: ctx.productId,
          projectId: ctx.projectId,
          role: clone ? 'voice_clone' : 'voice_synth',
          modelId: estimate.modelId,
          modelProfileId: ctx.modelProfileId,
          estimatedGbp: estimate.estimatedGbp,
          units,
          confirmSpend: Boolean(input.confirmSpend || ctx.confirmSpend),
          inputSnapshot: { text: input.text, profileId: input.profileId },
          produce: () =>
            generateSpeech({
              text: input.text,
              brand,
              modelId: estimate.modelId,
              cloneVoiceId: cloneVoiceIdOf(profile),
            }),
        })
        await applyProjectMutation(ctx, (current) => {
          const withAsset = attachAsset(current, {
            id: result.assetId!,
            kind: 'audio',
            blobKey: result.blobKey!,
            contentType: result.contentType ?? 'audio/mpeg',
            source: 'generator',
            probe: mergeProbe(result.probe),
          })
          return addClip(withAsset, {
            assetId: result.assetId!,
            from: appendOnAudioTrackFrom(withAsset),
            durationInFrames: durationFramesFrom(result.probe, units),
          })
        })
        await insertVoiceEvent(ctx.supabase, {
          productId: ctx.productId,
          projectId: ctx.projectId,
          profileId: profile?.id ?? null,
          assetId: result.assetId,
          kind: provenance.kind === 'clone' ? 'clone' : 'synth',
          modelId: estimate.modelId,
        })
        return toolOk(`Synthesized voice ${result.assetId}`, {
          jobId: result.jobId,
          assetId: result.assetId,
          estimatedGbp: estimate.estimatedGbp,
          actualGbp: result.actualGbp,
          modelId: estimate.modelId,
          provenance,
        })
      }),
  }),

  translate_and_dub: tool({
    description:
      'TTS a target-locale line and record a dub job. Does not lip-sync. confirmSpend when estimate > £0.',
    inputSchema: z.object({
      text: z.string().min(1).max(4000),
      targetLocale: z.string().min(2).max(16),
      sourceLocale: z.string().min(2).max(16).optional(),
      profileId: z.string().uuid().optional(),
      confirmSpend: z.boolean().optional(),
    }),
    execute: async (input) =>
      wrapTool(ctx, 'translate_and_dub', input, async () => {
        const disabled = ensureEnabled(ctx, 'translate_and_dub')
        if (disabled) return disabled
        const profile = await loadProfileIfAny(ctx, input.profileId)
        const clone = profile?.kind === 'clone'
        const spoken = isMockVoiceModelId(
          resolveModelRef(ctx.modelProfileId, clone ? 'voiceClone' : 'voiceDub').modelId,
        )
          ? `[${input.targetLocale}] ${input.text}`
          : input.text
        const durationSeconds = Math.max(1, Math.ceil(spoken.split(/\s+/).length / 2.5))
        const estimate = clone
          ? estimateVoiceCloneGbp({ modelProfileId: ctx.modelProfileId, durationSeconds })
          : estimateVoiceDubGbp({ modelProfileId: ctx.modelProfileId, durationSeconds })
        const blocked = await spendGate(ctx, estimate.estimatedGbp, input.confirmSpend)
        if (blocked) return blocked
        const brand = brandForProfile(ctx, profile)
        const provenance: VoiceProvenance = {
          kind: 'dub',
          profileId: profile?.id,
          consentAt: profile?.consentAt ?? undefined,
          modelId: estimate.modelId,
          stub: isMockVoiceModelId(estimate.modelId) || undefined,
        }
        const units = estimate.units
        const speechInput = {
          text: spoken,
          brand,
          modelId: estimate.modelId,
          cloneVoiceId: cloneVoiceIdOf(profile),
        }
        const assetId = ctx.persist ? undefined : crypto.randomUUID()
        let placedId: string | undefined = assetId
        if (!ctx.persist) {
          const asset = await generateSpeech(speechInput)
          await applyProjectMutation(ctx, (current) => {
            const withAsset = attachAsset(current, {
              id: assetId!,
              kind: 'audio',
              blobKey: `memory/generated/${assetId}.mp3`,
              contentType: asset.contentType,
              source: 'generator',
              probe: { ...asset.probe, voiceProvenance: provenance, role: 'voice_studio' },
            })
            return addClip(withAsset, {
              assetId: assetId!,
              from: appendOnAudioTrackFrom(withAsset),
              durationInFrames: durationFramesFrom(asset.probe, units),
            })
          })
        } else {
          const result = await runSyncedGeneration({
            supabase: ctx.supabase,
            blobEnv: ctx.blobEnv,
            productId: ctx.productId,
            projectId: ctx.projectId,
            role: 'voice_dub',
            modelId: estimate.modelId,
            modelProfileId: ctx.modelProfileId,
            estimatedGbp: estimate.estimatedGbp,
            units,
            confirmSpend: Boolean(input.confirmSpend || ctx.confirmSpend),
            inputSnapshot: {
              text: spoken,
              targetLocale: input.targetLocale,
              profileId: input.profileId,
            },
            produce: () => generateSpeech(speechInput),
          })
          placedId = result.assetId
          await applyProjectMutation(ctx, (current) => {
            const withAsset = attachAsset(current, {
              id: result.assetId!,
              kind: 'audio',
              blobKey: result.blobKey!,
              contentType: result.contentType ?? 'audio/mpeg',
              source: 'generator',
              probe: {
                ...(result.probe ?? {}),
                voiceProvenance: provenance,
                role: 'voice_studio',
              },
            })
            return addClip(withAsset, {
              assetId: result.assetId!,
              from: appendOnAudioTrackFrom(withAsset),
              durationInFrames: durationFramesFrom(result.probe, units),
            })
          })
          await insertDubJob(ctx.supabase, {
            productId: ctx.productId,
            projectId: ctx.projectId,
            generationJobId: result.jobId,
            profileId: profile?.id ?? null,
            assetId: result.assetId,
            sourceLocale: input.sourceLocale ?? ctx.project.localization?.activeLocale ?? 'en',
            targetLocale: input.targetLocale,
            status: 'ready',
          })
          await insertVoiceEvent(ctx.supabase, {
            productId: ctx.productId,
            projectId: ctx.projectId,
            profileId: profile?.id ?? null,
            assetId: result.assetId,
            kind: 'dub',
            modelId: estimate.modelId,
          })
        }
        return toolOk(`Dubbed to ${input.targetLocale}`, {
          assetId: placedId,
          estimatedGbp: estimate.estimatedGbp,
          modelId: estimate.modelId,
          provenance,
        })
      }),
  }),

  lipsync_clip: tool({
    description:
      'Record a lip-sync job against a video+audio pair after the quality floor. v1 is mock (not Final-eligible).',
    inputSchema: z.object({
      videoClipId: z.string().min(1),
      audioClipId: z.string().min(1),
    }),
    execute: async (input) =>
      wrapTool(ctx, 'lipsync_clip', input, async () => {
        const disabled = ensureEnabled(ctx, 'lipsync_clip')
        if (disabled) return disabled
        const pair = resolveLipsyncPair(ctx.project, input)
        const model = resolveModelRef(ctx.modelProfileId, 'voiceLipsync')
        const provenance: VoiceProvenance = {
          kind: 'lipsync',
          modelId: model.modelId,
          stub: true,
        }
        await applyProjectMutation(ctx, (current) =>
          parseStudioProject({
            ...current,
            assets: current.assets.map((asset) =>
              asset.id === pair.videoAsset.id
                ? {
                    ...asset,
                    probe: {
                      ...asset.probe,
                      voiceProvenance: provenance,
                      lipsyncAudioClipId: pair.audioClip.id,
                    },
                  }
                : asset,
            ),
            revision: current.revision + 1,
          }),
        )
        if (ctx.persist) {
          await insertVoiceEvent(ctx.supabase, {
            productId: ctx.productId,
            projectId: ctx.projectId,
            assetId: pair.videoAsset.id,
            kind: 'lipsync',
            modelId: model.modelId,
            inputSnapshot: input,
          })
        }
        return toolOk(
          'Lip-sync recorded as mock. Approve will block until a live vendor is wired.',
          { videoAssetId: pair.videoAsset.id, provenance },
        )
      }),
  }),

  remove_fillers: tool({
    description:
      'Build a cut list from transcript filler words (um, uh, er). Does not edit the timeline until apply_cut_list.',
    inputSchema: z.object({
      clipId: z.string().min(1),
    }),
    execute: async (input) =>
      wrapTool(ctx, 'remove_fillers', input, async () => {
        const disabled = ensureEnabled(ctx, 'remove_fillers')
        if (disabled) return disabled
        const clip = ctx.project.clips.find((item) => item.id === input.clipId)
        if (!clip) return toolFail(`Unknown clip: ${input.clipId}`)
        const asset = ctx.project.assets.find((item) => item.id === clip.assetId)
        const segments = transcriptSegmentsOf(asset)
        if (segments.length === 0) {
          return toolFail('Transcribe this clip first so filler words have timestamps.')
        }
        const cuts = fillerCutList({
          segments,
          fps: ctx.project.fps,
          clipFrom: clip.from,
        })
        return toolOk(
          cuts.length === 0
            ? 'No filler words found.'
            : `Found ${cuts.length} filler range(s). Call apply_cut_list to remove them.`,
          { clipId: clip.id, cuts },
        )
      }),
  }),

  build_cut_list: tool({
    description:
      'Propose cuts for ums, long pauses, and repeated takes. Leaves the video unchanged unless dryRun is false. Off-topic stretches only if you pass those ranges — this tool will not invent them.',
    inputSchema: z.object({
      clipId: z.string().min(1),
      reasons: z.array(cutReasonSchema).min(1).max(4).optional(),
      pauseMs: z.number().int().positive().max(5_000).optional(),
      dryRun: z.boolean().optional(),
      clarityRanges: z
        .array(
          z
            .object({
              startMs: z.number().nonnegative(),
              endMs: z.number().positive(),
            })
            .strict(),
        )
        .max(20)
        .optional(),
    }),
    execute: async (input) =>
      wrapTool(ctx, 'build_cut_list', input, async () => {
        const disabled = ensureEnabled(ctx, 'build_cut_list')
        if (disabled) return disabled
        const clip = ctx.project.clips.find((item) => item.id === input.clipId)
        if (!clip) return toolFail(`Unknown clip: ${input.clipId}`)
        const asset = ctx.project.assets.find((item) => item.id === clip.assetId)
        const segments = transcriptSegmentsOf(asset)
        if (segments.length === 0) {
          return toolFail('Transcribe this clip first so we know when each word happens.')
        }
        const fps = ctx.project.fps > 0 ? ctx.project.fps : 30
        const cuts = clipLocalTimedCuts(
          buildCutList({
            segments,
            reasons: input.reasons,
            pauseMs: input.pauseMs,
            clarityRanges: input.clarityRanges,
          }),
          {
            trimStartMs: Math.round(((clip.trim.startFrames ?? 0) / fps) * 1000),
            durationMs: Math.round((clip.durationInFrames / fps) * 1000),
          },
        )
        const frameCuts = timedCutsToFrameRanges(cuts, {
          fps: ctx.project.fps,
          clipFrom: clip.from,
        })
        const pauseOnly = input.reasons?.length === 1 && input.reasons[0] === 'pause'
        const retakeOnly = input.reasons?.length === 1 && input.reasons[0] === 'retake'
        const dryRun = input.dryRun !== false
        if (dryRun || cuts.length === 0) {
          return toolOk(
            cuts.length === 0
              ? pauseOnly
                ? 'No long pauses in this take.'
                : retakeOnly
                  ? 'No false starts in this take.'
                  : 'Nothing to cut.'
              : `Found ${cuts.length} cut(s). The video is unchanged until you apply them.`,
            { clipId: clip.id, dryRun, cuts, frameCuts },
          )
        }
        const { project } = await applyProjectMutation(ctx, (current) =>
          applyCutList(current, clip.id, cuts),
        )
        if (ctx.persist) {
          await insertVoiceEvent(ctx.supabase, {
            productId: ctx.productId,
            projectId: ctx.projectId,
            kind: 'fillers',
            inputSnapshot: input,
          })
        }
        return toolOk(cutWhyReason(cuts), {
          clipId: clip.id,
          dryRun: false,
          cuts,
          frameCuts,
          clipCount: project.clips.length,
          revision: project.revision,
        })
      }),
  }),

  edit_for_clarity: tool({
    description:
      'Propose rambling cuts from the transcript versus the project brief. Leaves the video unchanged unless dryRun is false. If the cut would remove more than 15% of the take, pass confirmLargeCut to apply.',
    inputSchema: z.object({
      clipId: z.string().min(1),
      dryRun: z.boolean().optional(),
      confirmLargeCut: z.boolean().optional(),
    }),
    execute: async (input) =>
      wrapTool(ctx, 'edit_for_clarity', input, async () => {
        const disabled = ensureEnabled(ctx, 'edit_for_clarity')
        if (disabled) return disabled
        const clip = ctx.project.clips.find((item) => item.id === input.clipId)
        if (!clip) return toolFail(`Unknown clip: ${input.clipId}`)
        const asset = ctx.project.assets.find((item) => item.id === clip.assetId)
        const segments = transcriptSegmentsOf(asset)
        if (segments.length === 0) {
          return toolFail('Transcribe this clip first so we know when each word happens.')
        }
        const brief = ctx.project.brief
        const briefText = [
          brief?.product.name,
          brief?.product.oneLiner,
          ...(brief?.product.benefits ?? []),
          ...(brief?.messaging.hookCandidates ?? []),
          ...(brief?.messaging.ctaCandidates ?? []),
        ]
          .filter((part): part is string => Boolean(part && part.trim()))
          .join(' ')
        if (!briefText) {
          return toolFail('Add a brief first so we know what is off-topic.')
        }
        const fps = ctx.project.fps > 0 ? ctx.project.fps : 30
        const window = {
          trimStartMs: Math.round(((clip.trim.startFrames ?? 0) / fps) * 1000),
          durationMs: Math.round((clip.durationInFrames / fps) * 1000),
        }
        const cuts = clipLocalTimedCuts(proposeClarityRanges({ segments, briefText }), window)
        const frameCuts = timedCutsToFrameRanges(cuts, {
          fps: ctx.project.fps,
          clipFrom: clip.from,
        })
        const removedMs = cuts.reduce((sum, cut) => sum + (cut.endMs - cut.startMs), 0)
        const dryRun = input.dryRun !== false
        if (cuts.length === 0) {
          return toolOk('No rambling in this take.', {
            clipId: clip.id,
            dryRun,
            cuts,
            frameCuts,
          })
        }
        if (!dryRun && isLargeClarityCut(removedMs, window.durationMs) && !input.confirmLargeCut) {
          return toolOk(
            'This would remove more than 15% of the take. Confirm to cut the rambling.',
            {
              clipId: clip.id,
              dryRun: true,
              needsConfirm: true,
              cuts,
              frameCuts,
              removedMs,
            },
          )
        }
        if (dryRun) {
          return toolOk(
            `Found ${cuts.length} rambling range(s). The video is unchanged until you apply them.`,
            { clipId: clip.id, dryRun: true, cuts, frameCuts },
          )
        }
        const { project } = await applyProjectMutation(ctx, (current) =>
          applyCutList(current, clip.id, cuts),
        )
        if (ctx.persist) {
          await insertVoiceEvent(ctx.supabase, {
            productId: ctx.productId,
            projectId: ctx.projectId,
            kind: 'fillers',
            inputSnapshot: input,
          })
        }
        return toolOk(cutWhyReason(cuts), {
          clipId: clip.id,
          dryRun: false,
          cuts,
          frameCuts,
          clipCount: project.clips.length,
          revision: project.revision,
        })
      }),
  }),

  apply_cut_list: tool({
    description:
      'Remove the listed ranges from a talking-head clip. Captions in those ranges move or drop with the picture. Accepts millisecond cuts (startMs/endMs/reason) or frame cuts (from/durationInFrames).',
    inputSchema: z.object({
      clipId: z.string().min(1),
      cuts: z.array(cutListItemSchema).min(1).max(40),
    }),
    execute: async (input) =>
      wrapTool(ctx, 'apply_cut_list', input, async () => {
        const disabled = ensureEnabled(ctx, 'apply_cut_list')
        if (disabled) return disabled
        const { project } = await applyProjectMutation(ctx, (current) => {
          const clip = current.clips.find((item) => item.id === input.clipId)
          if (!clip) throw new Error(`Unknown clip: ${input.clipId}`)
          const clipFrom = clip.from
          const cut = applyCutList(current, input.clipId, input.cuts)
          return applyJumpCutZooms(cut, {
            clipFrom,
            cuts: input.cuts.filter(isTimedCut),
          })
        })
        if (ctx.persist) {
          await insertVoiceEvent(ctx.supabase, {
            productId: ctx.productId,
            projectId: ctx.projectId,
            kind: 'fillers',
            inputSnapshot: input,
          })
        }
        return toolOk(cutWhyReason(input.cuts), {
          clipCount: project.clips.length,
          revision: project.revision,
        })
      }),
  }),

  apply_jump_cut_zooms: tool({
    description:
      'Add a small zoom punch on filler or false-start jumps so they do not flash. Call after apply_cut_list with the same ranges. clipFrom is the original clip start (frames) before the cut list — the original clip id is usually gone after the split. Pause and rambling jumps are skipped. No spend.',
    inputSchema: z.object({
      clipId: z.string().min(1),
      cuts: z.array(cutListItemSchema).min(1).max(40),
      clipFrom: z.number().int().nonnegative(),
    }),
    execute: async (input) =>
      wrapTool(ctx, 'apply_jump_cut_zooms', input, async () => {
        const disabled = ensureEnabled(ctx, 'apply_jump_cut_zooms')
        if (disabled) return disabled
        const cuts = input.cuts.filter(isTimedCut)
        if (cuts.length === 0) {
          return toolFail(
            'Pass the millisecond cut list from apply_cut_list (filler or false starts).',
          )
        }
        const { project } = await applyProjectMutation(ctx, (current) =>
          applyJumpCutZooms(current, { clipFrom: input.clipFrom, cuts }),
        )
        const zoomed = project.clips.filter((item) =>
          item.treatments?.some((treatment) => treatment.id === 'zoom_punch'),
        )
        return toolOk(
          zoomed.length === 0
            ? 'No filler or false-start jumps to zoom.'
            : 'Added a small zoom so the jump does not flash.',
          {
            clipCount: zoomed.length,
            revision: project.revision,
          },
        )
      }),
  }),
})
