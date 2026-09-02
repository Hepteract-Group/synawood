import { assignClipToSceneOnProject } from '../intent/mutations'
import { placeShotOnProject } from '../asset-intelligence/place-shot'
import { BROLL_TRACK_ID } from '../project/tracks'
import { addClip, trackEndFrame, trimClip } from '../project/operations'
import type { StudioProject } from '../project/schema'
import { clearBrollInSceneWindow, sceneWindowFrames, type FrameRange } from './replace'
import type {
  BrollGenerateRow,
  BrollMomentRow,
  BrollMusicRow,
  BrollPlan,
  BrollStillRow,
} from './schema'

export type FillGenerateResult =
  { ok: true; project: StudioProject; clipId: string } | { ok: false; error: string }

export type FillGenerateRow = (input: {
  project: StudioProject
  row: BrollGenerateRow
  from?: number
  until?: number
}) => FillGenerateResult | Promise<FillGenerateResult>

export type FillMusicRow = (input: {
  project: StudioProject
  row: BrollMusicRow
}) => FillGenerateResult | Promise<FillGenerateResult>

export type CommitBrollPlanResult =
  | { ok: false; error: string }
  | {
      ok: true
      project: StudioProject
      plan: BrollPlan
      placedClipIds: string[]
      pendingGenerate: number
      pendingMusic: number
      skippedLocked: string[]
      rowErrors: string[]
    }

const sceneIsLocked = (project: StudioProject, sceneId: string): boolean =>
  project.scenes.find((scene) => scene.id === sceneId)?.locked === true

const settleBrollReplacement = (
  project: StudioProject,
  sceneId: string,
  clipId: string,
  window: FrameRange | null,
): StudioProject => {
  const next = clearBrollInSceneWindow(project, sceneId, new Set([clipId]))
  if (!window) return next
  const clip = next.clips.find((item) => item.id === clipId)
  if (!clip) return next
  const durationInFrames = Math.max(1, Math.min(clip.durationInFrames, window.to - window.from))
  try {
    return trimClip(next, clipId, { from: window.from, durationInFrames })
  } catch {
    return next
  }
}

const existingClipIds = (project: StudioProject): Set<string> =>
  new Set(project.clips.map((clip) => clip.id))

const stillAsGenerate = (row: BrollStillRow): BrollGenerateRow => ({
  kind: 'generate',
  id: row.id,
  sceneId: row.sceneId,
  sceneRole: row.sceneRole,
  media: 'image',
  prompt: row.prompt,
  sourceImageAssetId: row.sourceImageAssetId,
  estimatedGbp: row.estimatedGbp,
  blockedReason: row.blockedReason,
})

const applyPictureFill = async (input: {
  project: StudioProject
  row: BrollGenerateRow
  fillGenerate?: FillGenerateRow
  from?: number
  until?: number
}): Promise<
  | { kind: 'pending'; project: StudioProject }
  | { kind: 'skip'; project: StudioProject; locked?: string; error?: string }
  | { kind: 'placed'; project: StudioProject; clipId: string; error?: string }
> => {
  if (input.row.blockedReason) {
    return {
      kind: 'skip',
      project: input.project,
      error: `${input.row.sceneId}: ${input.row.blockedReason}`,
    }
  }
  if (!input.fillGenerate) {
    return { kind: 'pending', project: input.project }
  }
  if (sceneIsLocked(input.project, input.row.sceneId)) {
    return { kind: 'skip', project: input.project, locked: input.row.sceneId }
  }
  const filled = await input.fillGenerate({
    project: input.project,
    row: input.row,
    from: input.from,
    until: input.until,
  })
  if (!filled.ok) {
    return { kind: 'skip', project: input.project, error: filled.error }
  }
  let project = filled.project
  if (project.scenes.some((scene) => scene.id === input.row.sceneId)) {
    try {
      project = assignClipToSceneOnProject(project, {
        clipId: filled.clipId,
        sceneId: input.row.sceneId,
      })
    } catch (error) {
      return {
        kind: 'placed',
        project: filled.project,
        clipId: filled.clipId,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
  return { kind: 'placed', project, clipId: filled.clipId }
}

export const placeGeneratedFill = (
  project: StudioProject,
  input: { assetId: string; durationInFrames?: number; from?: number; until?: number },
): FillGenerateResult => {
  if (!project.assets.some((asset) => asset.id === input.assetId)) {
    return { ok: false, error: `Fill asset ${input.assetId} is not on the project` }
  }
  const from = input.from ?? trackEndFrame(project, BROLL_TRACK_ID)
  const requested = input.durationInFrames ?? 120
  const capped =
    input.until != null ? Math.max(1, Math.min(requested, input.until - from)) : requested
  const before = existingClipIds(project)
  try {
    const placed = addClip(project, {
      assetId: input.assetId,
      trackId: BROLL_TRACK_ID,
      from,
      durationInFrames: capped,
    })
    const clip = placed.clips.find((item) => !before.has(item.id))
    if (!clip) return { ok: false, error: `Fill ${input.assetId} did not add a clip` }
    return { ok: true, project: placed, clipId: clip.id }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Generate-to-fill failed' }
  }
}

/**
 * Apply library Moment rows onto track_broll and assign those clips to Scenes.
 * Generate/still rows: optional fillGenerate. Music: optional fillMusic.
 * Replaces overlapping track_broll in the scene window (A-roll untouched).
 * Never rolls back already-placed shots if a later row fails.
 */
export const commitBrollPlanToProject = async (
  project: StudioProject,
  plan: BrollPlan,
  input: { confirmSpend?: boolean; fillGenerate?: FillGenerateRow; fillMusic?: FillMusicRow } = {},
): Promise<CommitBrollPlanResult> => {
  if (plan.status !== 'draft') {
    return { ok: false, error: `Overlay plan ${plan.id} is ${plan.status}, not draft` }
  }
  if (plan.projectRevision !== project.revision) {
    return {
      ok: false,
      error: `Overlay plan is stale (plan rev ${plan.projectRevision}, project rev ${project.revision}). Call assemble_broll again.`,
    }
  }
  if (plan.estimatedGbp > 0 && !input.confirmSpend) {
    return {
      ok: false,
      error: `Estimated £${plan.estimatedGbp.toFixed(2)} needs confirmSpend=true before commit_broll_plan.`,
    }
  }

  let next = project
  const placedClipIds: string[] = []
  const skippedLocked: string[] = []
  const rowErrors: string[] = []
  let pendingGenerate = 0
  let pendingMusic = 0

  for (const row of plan.rows) {
    if (row.kind === 'generate' || row.kind === 'still') {
      const picture = row.kind === 'still' ? stillAsGenerate(row) : row
      const canPlace =
        !picture.blockedReason &&
        Boolean(input.fillGenerate) &&
        !sceneIsLocked(next, picture.sceneId)
      const window = canPlace ? sceneWindowFrames(next, picture.sceneId) : null
      const applied = await applyPictureFill({
        project: next,
        row: picture,
        fillGenerate: input.fillGenerate,
      })
      next = applied.project
      if (applied.kind === 'pending') pendingGenerate += 1
      if (applied.kind === 'skip' && applied.locked) skippedLocked.push(applied.locked)
      if (applied.kind === 'skip' && applied.error) rowErrors.push(applied.error)
      if (applied.kind === 'placed') {
        next = settleBrollReplacement(next, picture.sceneId, applied.clipId, window)
        placedClipIds.push(applied.clipId)
        if (applied.error) rowErrors.push(applied.error)
      }
      continue
    }
    if (row.kind === 'music') {
      if (!input.fillMusic) {
        pendingMusic += 1
        continue
      }
      const filled = await input.fillMusic({ project: next, row })
      if (!filled.ok) {
        rowErrors.push(filled.error)
        continue
      }
      next = filled.project
      placedClipIds.push(filled.clipId)
      continue
    }
    if (sceneIsLocked(next, row.sceneId)) {
      skippedLocked.push(row.sceneId)
      continue
    }
    const window = sceneWindowFrames(next, row.sceneId)
    const placed = placeMomentRow(next, row)
    if (!placed.ok) {
      rowErrors.push(placed.error)
      continue
    }
    next = settleBrollReplacement(placed.project, row.sceneId, placed.clipId, window)
    placedClipIds.push(placed.clipId)
    if (next.scenes.some((scene) => scene.id === row.sceneId)) {
      try {
        next = assignClipToSceneOnProject(next, { clipId: placed.clipId, sceneId: row.sceneId })
      } catch (error) {
        rowErrors.push(error instanceof Error ? error.message : String(error))
      }
    }
  }

  const applied: BrollPlan = {
    ...plan,
    status: 'applied',
    projectRevision: next.revision,
  }
  next = { ...next, brollPlan: applied }

  return {
    ok: true,
    project: next,
    plan: applied,
    placedClipIds,
    pendingGenerate,
    pendingMusic,
    skippedLocked,
    rowErrors,
  }
}

const placeMomentRow = (
  project: StudioProject,
  row: BrollMomentRow,
  from?: number,
): { ok: true; project: StudioProject; clipId: string } | { ok: false; error: string } => {
  if (!project.assets.some((asset) => asset.id === row.assetId)) {
    return {
      ok: false,
      error: `Moment ${row.shotId}: asset ${row.assetId} is not on the project`,
    }
  }
  const before = existingClipIds(project)
  try {
    const placed = placeShotOnProject(project, {
      assetId: row.assetId,
      startMs: row.startMs,
      endMs: row.endMs,
      trackId: BROLL_TRACK_ID,
      from: from ?? trackEndFrame(project, BROLL_TRACK_ID),
    })
    const clip = placed.clips.find((item) => !before.has(item.id))
    if (!clip) {
      return { ok: false, error: `Moment ${row.shotId}: place_shot did not add a clip` }
    }
    return { ok: true, project: placed, clipId: clip.id }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : `Moment ${row.shotId} failed`,
    }
  }
}
