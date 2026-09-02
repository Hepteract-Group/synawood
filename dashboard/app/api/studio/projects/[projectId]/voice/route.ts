import { DEFAULT_MODEL_PROFILE_ID } from '@synawood/creative/model-profiles'
import { assetLabel } from '@synawood/creative/project/asset-token'
import { loadProject, RevisionConflictError } from '@synawood/creative/project'
import {
  estimateVoiceCloneGbp,
  estimateVoiceDubGbp,
  estimateVoiceSynthGbp,
  listPendingVoiceJobs,
  listVoiceProfiles,
  parseVoiceProvenance,
  pickDefaultVoiceProfile,
  voiceClipLabel,
} from '@synawood/creative/voice'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import {
  jsonFromToolOutcome,
  mapStudioRouteError,
  runStudioProjectTool,
} from '@/lib/studio-tool-route'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const bodySchema = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    action: z.enum([
      'synthesize',
      'dub',
      'fillers',
      'apply_cuts',
      'lipsync',
      'estimate',
      'transcribe',
      'enhance',
      'reframe',
    ]),
    text: z.string().min(1).max(4000).optional(),
    profileId: z.string().uuid().optional(),
    targetLocale: z.string().min(2).max(16).optional(),
    clipId: z.string().min(1).optional(),
    videoClipId: z.string().min(1).optional(),
    audioClipId: z.string().min(1).optional(),
    estimateRole: z.enum(['synth', 'dub', 'clone']).optional(),
    cuts: z
      .array(
        z.union([
          z.object({
            from: z.number().int().nonnegative(),
            durationInFrames: z.number().int().positive(),
          }),
          z.object({
            startMs: z.number().nonnegative(),
            endMs: z.number().positive(),
            reason: z.enum(['filler', 'pause', 'retake', 'clarity']).optional(),
          }),
        ]),
      )
      .optional(),
    confirmSpend: z.boolean().optional(),
    aspect: z.enum(['9:16', '16:9', '1:1', '4:5']).optional(),
  })
  .strict()

export const GET = async (
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const access = await requireStudioAccess({ projectId, minRole: 'viewer' })
    const { project } = await loadProject(access.supabase, projectId)
    const pendingJobs = await listPendingVoiceJobs(access.supabase, projectId)
    const profiles = await listVoiceProfiles(access.supabase, access.productId)
    const clips = project.clips.flatMap((clip) => {
      const asset = project.assets.find((item) => item.id === clip.assetId)
      if (!asset || (asset.kind !== 'audio' && asset.kind !== 'video')) return []
      const provenance = parseVoiceProvenance(asset.probe)
      const profileName = profiles.find((row) => row.id === provenance?.profileId)?.name ?? null
      return [
        {
          id: clip.id,
          kind: asset.kind,
          label: voiceClipLabel({
            assetLabel: assetLabel(asset),
            provenanceKind: provenance?.kind ?? null,
            profileName,
          }),
          provenanceKind: provenance?.kind ?? null,
          profileId: provenance?.profileId ?? null,
        },
      ]
    })
    return Response.json({
      ok: true,
      projectId,
      pendingJobs,
      clips,
      profiles,
      defaultProfileId: pickDefaultVoiceProfile(profiles)?.id ?? null,
    })
  } catch (error) {
    return handleRouteError(error, 'Could not load Voice Studio.')
  }
}

export const POST = async (
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const body = bodySchema.parse(await request.json())
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })

    if (body.action === 'estimate') {
      const { row } = await loadProject(access.supabase, projectId)
      const modelProfileId =
        (typeof row.model_profile_id === 'string' && row.model_profile_id) ||
        DEFAULT_MODEL_PROFILE_ID
      const text = body.text ?? 'hello'
      const durationSeconds = Math.max(1, Math.ceil(text.split(/\s+/).length / 2.5))
      const estimate =
        body.estimateRole === 'clone'
          ? estimateVoiceCloneGbp({ modelProfileId, durationSeconds })
          : body.estimateRole === 'dub'
            ? estimateVoiceDubGbp({ modelProfileId, durationSeconds })
            : estimateVoiceSynthGbp({ modelProfileId, durationSeconds })
      return Response.json(estimate)
    }

    if (body.action === 'enhance') {
      if (!body.clipId) {
        return jsonError('Select a clip to enhance.', 400)
      }
      const { outcome, project, traceWarning } = await runStudioProjectTool(
        access,
        projectId,
        body.expectedRevision,
        'enhance_speech',
        { clipId: body.clipId, confirmSpend: body.confirmSpend },
      )
      return jsonFromToolOutcome(outcome, { project, traceWarning })
    }

    if (body.action === 'reframe') {
      if (!body.clipId) {
        return jsonError('Select a clip to reframe.', 400)
      }
      const { outcome, project, traceWarning } = await runStudioProjectTool(
        access,
        projectId,
        body.expectedRevision,
        'reframe_clip',
        { clipId: body.clipId, aspect: body.aspect ?? '9:16' },
      )
      return jsonFromToolOutcome(outcome, { project, traceWarning })
    }

    if (body.action === 'transcribe') {
      if (!body.clipId) {
        return jsonError('Select a clip to transcribe.', 400)
      }
      const { project: current } = await loadProject(access.supabase, projectId)
      const clip = current.clips.find((item) => item.id === body.clipId)
      if (!clip) {
        return jsonError('Select a clip to transcribe.', 400)
      }
      const { outcome, project, traceWarning } = await runStudioProjectTool(
        access,
        projectId,
        body.expectedRevision,
        'transcribe_media',
        { assetId: clip.assetId, confirmSpend: body.confirmSpend },
      )
      return jsonFromToolOutcome(outcome, { project, traceWarning })
    }

    const mappedCuts = body.cuts?.map((cut) =>
      'startMs' in cut ? { ...cut, reason: cut.reason ?? 'clarity' } : cut,
    )

    const toolName =
      body.action === 'synthesize'
        ? 'synthesize_voice'
        : body.action === 'dub'
          ? 'translate_and_dub'
          : body.action === 'fillers'
            ? 'remove_fillers'
            : body.action === 'apply_cuts'
              ? 'apply_cut_list'
              : 'lipsync_clip'

    const args =
      body.action === 'synthesize'
        ? { text: body.text, profileId: body.profileId, confirmSpend: body.confirmSpend }
        : body.action === 'dub'
          ? {
              text: body.text,
              targetLocale: body.targetLocale ?? 'fr',
              profileId: body.profileId,
              confirmSpend: body.confirmSpend,
            }
          : body.action === 'fillers'
            ? { clipId: body.clipId }
            : body.action === 'apply_cuts'
              ? { clipId: body.clipId, cuts: mappedCuts }
              : { videoClipId: body.videoClipId, audioClipId: body.audioClipId }

    const { outcome, project, traceWarning } = await runStudioProjectTool(
      access,
      projectId,
      body.expectedRevision,
      toolName,
      args,
    )
    return jsonFromToolOutcome(outcome, { project, traceWarning })
  } catch (error) {
    return handleRouteError(error, 'Voice Studio action failed', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      if (err instanceof RevisionConflictError) {
        return mapStudioRouteError(err)
      }
      return mapStudioRouteError(err)
    })
  }
}
