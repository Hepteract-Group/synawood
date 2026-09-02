import { createHash } from 'node:crypto'
import type { ZodError } from 'zod'
import { mapStyleToDirectorVibe } from '../agent/skills/specialist'
import type { DirectorPlan, DirectorPlanScope, Intent } from '../intent/schema'
import { directorPlanSchema, emptyIntent } from '../intent/schema'
import { mergeIntent, pruneMissingSceneClipRefs } from '../intent/mutations'
import type { StudioProject } from '../project/schema'
import { videoTrackHasPackableGaps, resolveTrackId } from '../project/operations'
import { suggestStylePackFromText } from '../effects/hints'
import {
  applyStudioMutation,
  studioMutationSchema,
  type StudioMutation,
} from '../project/mutations'

export type DirectProjectInput = {
  style?: string
  intentOverrides?: Partial<Intent>
  scope?: DirectorPlanScope
  dryRun?: boolean
  maxCostGbp?: number
  refinement?: { priorPlanId: string; note: string }
}

export const hashDirectProjectInput = (
  projectId: string,
  projectRevision: number,
  input: DirectProjectInput,
): string => {
  const payload = JSON.stringify({
    projectId,
    projectRevision,
    style: input.style ?? null,
    intentOverrides: input.intentOverrides ?? null,
    scope: input.scope ?? 'global',
    maxCostGbp: input.maxCostGbp ?? null,
    refinement: input.refinement ?? null,
  })
  return createHash('sha256').update(payload).digest('hex').slice(0, 32)
}

const clipIdsInScope = (project: StudioProject, scope: DirectorPlanScope): Set<string> | 'all' => {
  if (scope === 'global') return 'all'
  if ('clipIds' in scope) return new Set(scope.clipIds)
  const ids = new Set<string>()
  for (const scene of project.scenes) {
    if (scope.sceneIds.includes(scene.id)) {
      for (const clipId of scene.clipIds) ids.add(clipId)
    }
  }
  return ids
}

const lockedClipIds = (project: StudioProject, scope: DirectorPlanScope): Set<string> => {
  const locked = new Set<string>()
  for (const scene of project.scenes) {
    if (!scene.locked) continue
    const explicitlyScoped =
      scope !== 'global' && 'sceneIds' in scope && scope.sceneIds.includes(scene.id)
    if (explicitlyScoped) continue
    for (const clipId of scene.clipIds) locked.add(clipId)
  }
  return locked
}

const sceneIdForClip = (project: StudioProject, clipId: string): string | undefined =>
  project.scenes.find((scene) => scene.clipIds.includes(clipId))?.id

export const formatMutationRejection = (error: ZodError, mutationType?: string): string => {
  const issue = error.issues[0]
  if (!issue) return 'Invalid mutation shape'
  const path = issue.path
    .filter((part): part is string | number => typeof part === 'string' || typeof part === 'number')
    .join('.')
  if (path === 'type') {
    const typeHint = mutationType?.trim() || 'unknown'
    return `unsupported mutation type "${typeHint}"`
  }
  const looksMissing =
    (issue.code === 'invalid_type' && 'received' in issue && issue.received === 'undefined') ||
    /received undefined/i.test(issue.message)
  if (looksMissing) {
    return path ? `missing ${path}` : 'missing required field'
  }
  if (issue.code === 'invalid_union') {
    const typeHint = mutationType?.trim()
    return typeHint ? `invalid shape for "${typeHint}"` : 'invalid mutation shape'
  }
  return path ? `${path}: ${issue.message}` : issue.message
}

/**
 * Deterministic DirectorPlan when reasoner is mock/unavailable.
 * Emits safe StudioMutation proposals only (no generator spend).
 */
export const buildHeuristicDirectorPlan = (
  project: StudioProject,
  input: DirectProjectInput,
  meta: { id: string; reasonerModelId: string },
): DirectorPlan => {
  const intent = mergeIntent(project.intent ?? emptyIntent(), input.intentOverrides ?? {})
  const scope = input.scope ?? 'global'
  const allowed = clipIdsInScope(project, scope)
  const locked = lockedClipIds(project, scope)
  const edits: DirectorPlan['edits'] = []

  const videoClips = [...project.clips]
    .filter((clip) => {
      if (locked.has(clip.id)) return false
      if (allowed !== 'all' && !allowed.has(clip.id)) return false
      const asset = project.assets.find((item) => item.id === clip.assetId)
      return asset?.kind === 'video' || asset?.kind === 'image'
    })
    .sort((a, b) => a.from - b.from)

  if (videoClips.length >= 2 && videoTrackHasPackableGaps(project)) {
    edits.push({
      id: 'e_pack',
      mutation: { type: 'pack_clips' },
      previewText: 'Pack video clips end-to-end (close gaps)',
      status: 'proposed',
    })
  }

  // Use mapped vibe so free-text styles (e.g. "viral launch" → energetic) affect heuristic trims.
  const vibeId = mapStyleToDirectorVibe(input.style).vibeId
  const shorten =
    intent.emotion === 'urgent' ||
    vibeId === 'urgent' ||
    vibeId === 'energetic' ||
    (intent.lengthSeconds != null &&
      project.durationFrames / project.fps > intent.lengthSeconds * 1.15)

  if (shorten) {
    for (const clip of videoClips.slice(0, 3)) {
      const nextDuration = Math.max(15, Math.floor(clip.durationInFrames * 0.85))
      if (nextDuration >= clip.durationInFrames) continue
      edits.push({
        id: `e_trim_${clip.id}`,
        mutation: {
          type: 'trim_clip',
          clipId: clip.id,
          durationInFrames: nextDuration,
        },
        sceneId: sceneIdForClip(project, clip.id),
        previewText: `Shorten clip for ${intent.emotion ?? vibeId ?? input.style ?? 'tighter'} pacing`,
        status: 'proposed',
      })
    }
  }

  const punchy =
    vibeId === 'energetic' ||
    vibeId === 'urgent' ||
    intent.emotion === 'urgent' ||
    intent.emotion === 'exciting' ||
    intent.platform === 'tiktok' ||
    intent.platform === 'ig_reels' ||
    intent.platform === 'yt_shorts'

  const hookText =
    intent.keywords[0] ||
    intent.cta ||
    intent.goalNote ||
    (intent.goal === 'signup' ? 'Try it free' : undefined)

  if (punchy && hookText) {
    edits.push({
      id: 'e_hook',
      mutation: { type: 'set_hook_title', text: hookText.slice(0, 120) },
      previewText: `Set punchy hook title: "${hookText.slice(0, 60)}"`,
      status: 'proposed',
    })
  }

  if (intent.cta) {
    const end = project.overlays.find((overlay) => overlay.kind === 'end_card')
    if (end) {
      edits.push({
        id: `e_end_${end.id}`,
        mutation: {
          type: 'place_overlay',
          overlayId: end.id,
          from: Math.max(0, project.durationFrames - end.durationInFrames),
          durationInFrames: end.durationInFrames,
        },
        previewText: `Park end card at timeline end (CTA: ${intent.cta})`,
        status: 'proposed',
      })
    } else {
      edits.push({
        id: 'e_end_card',
        mutation: { type: 'set_end_card', text: intent.cta.slice(0, 160) },
        previewText: `Add end card CTA: "${intent.cta}"`,
        status: 'proposed',
      })
    }
  }

  if (punchy) {
    const captionText =
      intent.keywords.slice(0, 3).join(' · ') || intent.cta || intent.brandVoice || ''
    if (captionText.trim()) {
      edits.push({
        id: 'e_captions',
        mutation: {
          type: 'add_captions',
          text: captionText.slice(0, 400),
          from: 0,
          durationInFrames: Math.min(90, Math.max(45, Math.floor(project.fps * 3))),
        },
        previewText: `Add on-screen captions for ${intent.platform ?? vibeId ?? 'short-form'} pacing`,
        status: 'proposed',
      })
    }
  }

  let costEstimateGbp = 0
  const maxCost = input.maxCostGbp
  let status: DirectorPlan['status'] = 'draft'
  let finalEdits = edits
  if (maxCost != null && costEstimateGbp > maxCost) {
    finalEdits = []
    status = 'draft'
  }

  const styleNote = input.style ? ` style=${input.style}` : ''
  const suggestedLook = suggestStylePackFromText(input.style)
  const lookNote =
    suggestedLook && !project.stylePackId
      ? ` Suggested look: ${suggestedLook} (Filters tab or set_style_pack).`
      : ''
  const rationale =
    finalEdits.length === 0
      ? `No safe timeline edits proposed${styleNote}.${lookNote} Adjust Intent/Scenes or unlock clips, then retry.`
      : `Heuristic Director draft${styleNote}: ${finalEdits.length} proposed edit(s) from Intent + Scenes (no generator spend).${lookNote}`

  return directorPlanSchema.parse({
    id: meta.id,
    createdAt: new Date().toISOString(),
    projectRevision: project.revision,
    scope,
    style: input.style,
    edits: finalEdits,
    rationale,
    costEstimateGbp,
    generatorCalls: [],
    status,
    reasonerModelId: meta.reasonerModelId,
  })
}

export type ReasonerDirectorPayload = {
  rationale?: string
  edits?: Array<{
    mutation: Record<string, unknown>
    previewText?: string
    sceneId?: string
  }>
}

export const parseReasonerDirectorPayload = (raw: string): ReasonerDirectorPayload | null => {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced?.[1]?.trim() ?? trimmed
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as ReasonerDirectorPayload
  } catch {
    return null
  }
}

export const directorPlanFromReasonerPayload = (
  project: StudioProject,
  input: DirectProjectInput,
  payload: ReasonerDirectorPayload,
  meta: { id: string; reasonerModelId: string },
): DirectorPlan => {
  const scope = input.scope ?? 'global'
  const locked = lockedClipIds(project, scope)
  const allowed = clipIdsInScope(project, scope)
  const edits: DirectorPlan['edits'] = []

  const pushRejected = (
    index: number,
    mutation: DirectorPlan['edits'][number]['mutation'],
    previewText: string | undefined,
    sceneId: string | undefined,
    rejectReason: string,
  ) => {
    edits.push({
      id: `e_rej_${index}`,
      mutation,
      previewText,
      sceneId,
      status: 'rejected',
      rejectReason,
    })
  }

  for (const [index, row] of (payload.edits ?? []).entries()) {
    const rawType =
      row.mutation && typeof row.mutation === 'object' && typeof row.mutation.type === 'string'
        ? row.mutation.type
        : undefined
    const parsed = studioMutationSchema.safeParse(row.mutation)
    if (!parsed.success) {
      pushRejected(
        index,
        { type: String(rawType ?? 'unknown') },
        row.previewText ?? 'Invalid mutation rejected',
        row.sceneId,
        formatMutationRejection(parsed.error, rawType),
      )
      continue
    }
    const mutation = parsed.data
    const clipId =
      'clipId' in mutation && typeof mutation.clipId === 'string' ? mutation.clipId : undefined
    if (clipId && locked.has(clipId)) {
      pushRejected(
        index,
        mutation,
        row.previewText,
        row.sceneId ?? sceneIdForClip(project, clipId),
        'clip is in a locked scene',
      )
      continue
    }
    if (clipId && allowed !== 'all' && !allowed.has(clipId)) {
      pushRejected(
        index,
        mutation,
        row.previewText,
        row.sceneId ?? sceneIdForClip(project, clipId),
        'clip is outside Director scope',
      )
      continue
    }
    edits.push({
      id: `e_${index}_${mutation.type}`,
      mutation,
      previewText: row.previewText,
      sceneId: row.sceneId ?? (clipId ? sceneIdForClip(project, clipId) : undefined),
      status: 'proposed',
    })
  }

  return directorPlanSchema.parse({
    id: meta.id,
    createdAt: new Date().toISOString(),
    projectRevision: project.revision,
    scope,
    style: input.style,
    edits,
    rationale:
      payload.rationale?.trim() ||
      `Director proposed ${edits.filter((e) => e.status === 'proposed').length} edit(s).`,
    costEstimateGbp: 0,
    generatorCalls: [],
    status: 'draft',
    reasonerModelId: meta.reasonerModelId,
  })
}

/**
 * When the reasoner only produced rejected edits, keep those skip reasons and
 * splice in heuristic proposals so Preview isn’t empty.
 */
export const mergeHeuristicWhenReasonerEmpty = (
  reasonerPlan: DirectorPlan,
  heuristicPlan: DirectorPlan,
): DirectorPlan => {
  if (reasonerPlan.edits.some((edit) => edit.status === 'proposed')) return reasonerPlan
  const rejected = reasonerPlan.edits.filter((edit) => edit.status === 'rejected')
  if (heuristicPlan.edits.length === 0) return reasonerPlan
  return directorPlanSchema.parse({
    ...heuristicPlan,
    id: reasonerPlan.id,
    createdAt: reasonerPlan.createdAt,
    reasonerModelId: reasonerPlan.reasonerModelId,
    edits: [...rejected, ...heuristicPlan.edits],
    rationale: [
      reasonerPlan.rationale.trim(),
      'Reasoner ideas failed validation — added safe heuristic edits.',
      heuristicPlan.rationale.trim(),
    ]
      .filter(Boolean)
      .join(' '),
  })
}

export const buildDirectorPrompt = (
  project: StudioProject,
  input: DirectProjectInput,
  specialistBlock?: string,
): string => {
  const intent = mergeIntent(project.intent ?? emptyIntent(), input.intentOverrides ?? {})
  return [
    'You are the Synawood AI Director. Propose timeline mutations as JSON only.',
    'Respond with a single JSON object:',
    '{"rationale":"1-3 sentences","edits":[{"mutation":{"type":"..."},"previewText":"...","sceneId":"optional"}]}',
    'Allowed mutation types + exact shapes (all fields required unless marked optional):',
    '- {"type":"pack_clips","trackId":"optional"}',
    '- {"type":"trim_clip","clipId":"<existing>","durationInFrames":<int>,"from":optional,"trimStartFrames":optional}',
    '- {"type":"place_clip","clipId":"<existing>","from":<int>}',
    '- {"type":"split_clip","clipId":"<existing>","atFrame":<int>}',
    '- {"type":"place_overlay","overlayId":"<existing>","from":<int>,"durationInFrames":optional} — repositions only; does not set copy',
    '- {"type":"remove_overlay","overlayId":"<existing>"}',
    '- {"type":"fit_duration"}',
    '- {"type":"set_cover_frame","frame":<int>}',
    '- {"type":"set_hook_title","text":"<1-120 chars>"} — creates/updates opening hook copy',
    '- {"type":"set_end_card","text":"<1-160 chars>"} — creates/updates CTA end card',
    '- {"type":"add_captions","text":"<1-400 chars>","from":optional,"durationInFrames":optional}',
    '- {"type":"add_text","text":"<1-240 chars>","kind":"title|hook_title|end_card|lower_third optional","from":optional,"durationInFrames":optional,"layout":optional,"style":optional}',
    '- {"type":"update_overlay","overlayId":"<existing>","text":optional,"from":optional,"durationInFrames":optional,"layout":optional,"style":optional}',
    'Examples:',
    '{"type":"set_hook_title","text":"Stop scrolling — see this"}',
    '{"type":"trim_clip","clipId":"clip_abc","durationInFrames":90}',
    '{"type":"add_captions","text":"3 tips in 15s","from":0,"durationInFrames":90}',
    'Do not invent clip/overlay ids — copy them from the project snapshot below.',
    'Prefer fewer high-impact edits. Cost is estimate-only; avoid generate_* in v1.',
    specialistBlock?.trim() || '(no specialist vibe pack loaded)',
    `style: ${input.style ?? '(none)'}`,
    `refinement: ${input.refinement?.note ?? '(none)'}`,
    `intent: ${JSON.stringify(intent)}`,
    `scenes: ${JSON.stringify(project.scenes)}`,
    `clips: ${JSON.stringify(
      project.clips.map((c) => ({
        id: c.id,
        from: c.from,
        durationInFrames: c.durationInFrames,
        assetId: c.assetId,
      })),
    )}`,
    `overlays: ${JSON.stringify(
      project.overlays.map((o) => ({
        id: o.id,
        kind: o.kind,
        from: o.from,
        durationInFrames: o.durationInFrames,
        text: o.text,
      })),
    )}`,
  ].join('\n')
}

export const applyDirectorPlanEdits = (
  project: StudioProject,
  plan: DirectorPlan,
  excludeMutationIds: string[] = [],
): { project: StudioProject; appliedIds: string[]; skippedIds: string[] } => {
  const excluded = new Set(excludeMutationIds)
  const appliedIds: string[] = []
  const skippedIds: string[] = []
  let next = project

  for (const edit of plan.edits) {
    if (edit.status !== 'proposed' || excluded.has(edit.id)) {
      skippedIds.push(edit.id)
      continue
    }
    const parsed = studioMutationSchema.safeParse(edit.mutation)
    if (!parsed.success) {
      skippedIds.push(edit.id)
      continue
    }
    try {
      next = applyStudioMutation(next, omitUnknownMutationTrackId(next, parsed.data))
      appliedIds.push(edit.id)
    } catch {
      skippedIds.push(edit.id)
    }
  }

  next = pruneMissingSceneClipRefs(next)
  return { project: next, appliedIds, skippedIds }
}

/** Reasoners sometimes copy a scene id into trackId. Drop it so pack hits main picture. */
export const omitUnknownMutationTrackId = (
  project: StudioProject,
  mutation: StudioMutation,
): StudioMutation => {
  if (!('trackId' in mutation) || typeof mutation.trackId !== 'string' || !mutation.trackId) {
    return mutation
  }
  try {
    return { ...mutation, trackId: resolveTrackId(project, mutation.trackId) }
  } catch {
    const { trackId: _dropped, ...rest } = mutation
    return rest as StudioMutation
  }
}

export const markPlanStaleIfNeeded = (
  plan: DirectorPlan,
  currentRevision: number,
): DirectorPlan => {
  if (plan.status !== 'draft') return plan
  if (plan.projectRevision === currentRevision) return plan
  return { ...plan, status: 'stale' }
}
