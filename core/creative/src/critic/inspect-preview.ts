import { generateText as defaultGenerateText } from 'ai'
import { z } from 'zod'
import {
  CUT_REVIEW_CHECKS,
  type CutReviewCheck,
  type CutReviewVerdict,
} from '../project/cut-review-rubric'
import { resolveModelRef } from '../model-profiles'
import {
  evaluatePictureCompleteness,
  formatPictureCompletenessError,
  lastMainPictureEndFrames,
  pictureWindowFrames,
  type PictureCompletenessFailure,
} from '../project/picture-completeness'
import {
  cutReviewFingerprint,
  cutReviewRequired,
  hasFreshCutReview,
} from '../project/cut-review-state'
import type { StudioProject } from '../project/schema'
import { isAuthoredComposition } from '../project/schema'
import { isMotionGraphicsBrief } from '../agent/motion-brief'
import { turnModeNeedsCutReview, type TurnMode } from '../agent/turn-mode'
import { authoredCoveredLastFrame } from '../authored/sequence-coverage'
import { inspectAuthoredComposition, type AuthoredInspectFailure } from './inspect-authored'
import { inspectCtaBrief } from './cta-brief'
import {
  founderCutReviewStatus,
  humanizeCutReviewForFounder,
  isCutReviewRenderInternals,
} from './humanize-cut-review'
import { mainVideoTrackId } from '../project/tracks'
import { SOURCE_IDENTITY_LOCK } from '../tools/generator-tools'

export { CUT_REVIEW_CHECKS } from '../project/cut-review-rubric'
export type { CutReviewCheck, CutReviewVerdict } from '../project/cut-review-rubric'

export type CutReviewRubric = Record<CutReviewCheck, CutReviewVerdict> & {
  notes: string
}

export type CutReviewStill = {
  frame: number
  bytes: Buffer
}

export type InspectCutResult =
  | {
      ok: false
      phase: 'completeness'
      failures: PictureCompletenessFailure[]
      error: string
    }
  | {
      ok: boolean
      phase: 'vision'
      frames: number[]
      rubric: CutReviewRubric
      error?: string
    }

export type RenderCutFrames = (frames: number[]) => Promise<CutReviewStill[]>

export type CritiqueCut = (input: {
  project: StudioProject
  stills: CutReviewStill[]
  frames: number[]
  skillsExcerpt?: string
}) => Promise<CutReviewRubric>

const rubricSchema = z
  .object({
    coverage: z.enum(['pass', 'fail']),
    motion: z.enum(['pass', 'fail']),
    size: z.enum(['pass', 'fail']),
    audio: z.enum(['pass', 'fail']),
    brand: z.enum(['pass', 'fail']),
    brief: z.enum(['pass', 'fail']),
    notes: z.string().max(800).default(''),
  })
  .strict()

/** Extra tagged stills on a generated MAIN clip must not be locked to one silhouette (ADR-0054). */
export const collectionLooksConflict = (project: StudioProject): string | null => {
  const mainId = mainVideoTrackId(project.tracks)
  const generated = project.clips
    .filter((clip) => clip.trackId === mainId)
    .map((clip) => project.assets.find((asset) => asset.id === clip.assetId))
    .filter((asset): asset is NonNullable<typeof asset> =>
      Boolean(asset && asset.kind === 'video' && asset.source === 'generator'),
    )
  const conflict = generated.find((asset) => {
    const refs = asset.probe?.referenceImageAssetIds
    const extra = Array.isArray(refs) ? refs.length : 0
    const prompt = typeof asset.probe?.prompt === 'string' ? asset.probe.prompt : ''
    return extra > 0 && prompt.includes(SOURCE_IDENTITY_LOCK)
  })
  if (!conflict) return null
  return 'The second tagged look never made it into the video. I locked the clip to the first photo only. Generate again so every tagged garment appears — I am not calling this done.'
}

const collectionLooksOnMain = (project: StudioProject): number => {
  const mainId = mainVideoTrackId(project.tracks)
  let maxLooks = 1
  for (const clip of project.clips) {
    if (clip.trackId !== mainId) continue
    const asset = project.assets.find((item) => item.id === clip.assetId)
    if (!asset || asset.kind !== 'video' || asset.source !== 'generator') continue
    const refs = asset.probe?.referenceImageAssetIds
    const extra = Array.isArray(refs) ? refs.length : 0
    maxLooks = Math.max(maxLooks, 1 + extra)
  }
  return maxLooks
}

const ASSEMBLE_TOOLS = new Set([
  'add_clip',
  'place_clip',
  'place_shot',
  'place_overlay',
  'trim_clip',
  'pack_clips',
  'remove_clip',
  'ripple_delete_clip',
  'generate_video_clip',
  'generate_image',
  'generate_music',
  'inspect_preview',
  'assemble_broll',
  'commit_broll_plan',
  'plan_slideshow',
  'generate_slide_background',
  'set_slide',
  'add_slide',
  'remove_slide',
  'reorder_slides',
  'write_composition',
  'patch_composition',
])

export const isCiStubProfile = (modelProfileId: string): boolean => modelProfileId === 'ci-stub'

export const isMakeVideoRequest = (text: string): boolean => {
  const trimmed = text.trim()
  if (
    /\b(make|create|finish|build|generate|produce|cut)\b[\s\S]{0,80}\b(ad|ads|video|videos|commercial|spot)\b/i.test(
      trimmed,
    )
  ) {
    return true
  }
  return /\b(ad|video|commercial)\b[\s\S]{0,48}\b(done|ready|finished|complete)\b/i.test(trimmed)
}

export const isMakeSlideshowRequest = (text: string): boolean => {
  const trimmed = text.trim()
  if (
    /\b(make|create|finish|build|generate|produce|cut)\b[\s\S]{0,80}\b(carousel|slideshow|slides|linkedin pack)\b/i.test(
      trimmed,
    )
  ) {
    return true
  }
  return /\b(carousel|slideshow)\b[\s\S]{0,48}\b(done|ready|finished|complete)\b/i.test(trimmed)
}

export const turnNeedsCutReview = (
  userMessage: string,
  toolNames: string[],
  turnMode: TurnMode = 'execute',
): boolean => {
  if (!turnModeNeedsCutReview(turnMode)) return false
  return (
    isMakeVideoRequest(userMessage) ||
    isMakeSlideshowRequest(userMessage) ||
    isMotionGraphicsBrief(userMessage) ||
    toolNames.some((name) => ASSEMBLE_TOOLS.has(name))
  )
}

export {
  cutReviewFingerprint,
  cutReviewRequired,
  formatCutReviewRubric,
  hasFreshCutReview,
  rubricDimensionsFromFull,
  stampCutReview,
  stampFailedCutReview,
  stampPassedCutReview,
} from '../project/cut-review-state'
export type { CutReviewRubricDimensions } from '../project/cut-review-rubric'

export const passingRubric = (notes = 'Cut looks complete.'): CutReviewRubric => ({
  coverage: 'pass',
  motion: 'pass',
  size: 'pass',
  audio: 'pass',
  brand: 'pass',
  brief: 'pass',
  notes,
})

export const failingRubric = (notes: string): CutReviewRubric => ({
  coverage: 'fail',
  motion: 'fail',
  size: 'fail',
  audio: 'fail',
  brand: 'fail',
  brief: 'fail',
  notes,
})

const AUTHORED_CHECK_TO_RUBRIC: Record<AuthoredInspectFailure['check'], CutReviewCheck> = {
  motion: 'motion',
  compile: 'motion',
  picture: 'coverage',
  brand: 'brand',
  hierarchy: 'brief',
  variety: 'brief',
  claims: 'brief',
  brief: 'brief',
}

export const authoredInspectRubric = (
  check: AuthoredInspectFailure['check'],
  error: string,
): CutReviewRubric => ({
  ...passingRubric(error),
  [AUTHORED_CHECK_TO_RUBRIC[check]]: 'fail',
})

const MAX_CUT_REVIEW_FRAMES = 8

export const sampleCutReviewFrames = (project: StudioProject): number[] => {
  if (isAuthoredComposition(project.compositionId)) {
    const last = authoredCoveredLastFrame(
      project.compositionSource?.source ?? '',
      project.durationFrames,
    )
    const mid = Math.floor(last / 2)
    return [...new Set([0, mid, last])].sort((a, b) => a - b)
  }
  const windowFrames = pictureWindowFrames(project)
  if (windowFrames <= 0) return []
  const pictureEnd = lastMainPictureEndFrames(project)
  const last = Math.max(0, Math.max(windowFrames, pictureEnd, project.durationFrames) - 1)
  const mid = Math.floor(last / 2)
  const uncovered =
    evaluatePictureCompleteness(project).failures.find((row) => row.code === 'uncovered_main')
      ?.uncoveredSeconds ?? []
  const clamp = (frame: number) => Math.min(last, Math.max(0, frame))
  const overlayFrames = project.overlays.flatMap((overlay) => [
    overlay.from,
    overlay.from + overlay.durationInFrames - 1,
  ])
  const extra = [
    ...uncovered.slice(0, 3).map((second) => second * project.fps),
    ...overlayFrames,
  ].map(clamp)
  const required = [0, mid, last].map(clamp)
  const extras = extra.filter((frame) => !required.includes(frame))
  const budget = Math.max(0, MAX_CUT_REVIEW_FRAMES - required.length)
  return [...new Set([...required, ...extras.slice(0, budget)])].sort((a, b) => a - b)
}

const failedChecks = (rubric: CutReviewRubric): CutReviewCheck[] =>
  CUT_REVIEW_CHECKS.filter((check) => rubric[check] === 'fail')

/** Three PNG stills cannot prove a kinetic ad “isn’t video.” Source inspect already gated motion. */
export const passAuthoredVisionMotion = (rubric: CutReviewRubric): CutReviewRubric => ({
  ...rubric,
  motion: 'pass',
})

const extractJsonObject = (text: string): unknown => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const raw = (fenced?.[1] ?? text).trim()
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) {
    throw new Error('Cut review response did not include a JSON object')
  }
  return JSON.parse(raw.slice(start, end + 1)) as unknown
}

export const parseCutReviewRubric = (text: string): CutReviewRubric =>
  rubricSchema.parse(extractJsonObject(text))

export const formatCutReviewError = (result: InspectCutResult): string => {
  if (result.phase === 'completeness') return result.error
  const failed = result.rubric ? failedChecks(result.rubric) : []
  const notes = result.rubric?.notes ? ` ${result.rubric.notes}` : ''
  return `Cut review failed (${failed.join(', ') || 'vision'}).${notes}`
}

const FOUNDER_HANDOFF =
  /[ \t]*(?:what should we do next|what do you want me to do(?: next)?|what would you like me to do(?: next)?|what should i do(?: next)?|what next|how would you like me to proceed|shall i continue|shall i proceed|what do you want next|want me to (?:try|do|fix|generate|make|continue)[^?\n]*|try another (?:angle|cut|take|pass)[^?\n]*)\??/gi

/** Drop “what next?” handoffs without flattening markdown newlines (#607 / #667). */
export const stripFounderHandoff = (text: string): string =>
  text
    .replace(FOUNDER_HANDOFF, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

export const isFounderHandoffQuestion = (text: string): boolean => {
  const trimmed = text.trim()
  if (!trimmed.includes('?')) return false
  return /\b(what should|what do you want|what would you like|what next|^next\?|shall i |how would you like me to proceed|want me to )\b/i.test(
    trimmed,
  )
}

const dropTrailingFounderQuestion = (text: string): string =>
  text.replace(/[^.!\n]*\?\s*$/g, '').trim()

export const applyCutReviewNarration = (input: {
  userMessage: string
  toolNames: string[]
  project: StudioProject
  inspectError?: string
  assistantText: string
  turnMode?: TurnMode
}): string => {
  const body = stripFounderHandoff(input.assistantText.trim())
  if (!cutReviewRequired(input.project)) return body || input.assistantText
  if (!turnNeedsCutReview(input.userMessage, input.toolNames, input.turnMode ?? 'execute')) {
    return body || input.assistantText
  }
  if (hasFreshCutReview(input.project)) return body || input.assistantText
  const inspectError =
    input.inspectError ??
    (input.project.cutReview?.passed
      ? 'The timeline changed after cut review.'
      : 'inspect_preview did not run.')
  const status = founderCutReviewStatus(inspectError)
  if (!body || isFounderHandoffQuestion(body)) return status
  if (/\?/.test(body)) {
    const withoutQuestion = dropTrailingFounderQuestion(body)
    return withoutQuestion ? `${withoutQuestion}\n\n${status}` : status
  }
  if (
    isCutReviewRenderInternals(body) ||
    /cannot say the video is done/i.test(body) ||
    /\b(video|ad|cut)\b[\s\S]{0,24}\b(done|ready|finished|complete)\b/i.test(body)
  ) {
    return status
  }
  if (body.includes(status) || body.includes(humanizeCutReviewForFounder(input.inspectError))) {
    return body
  }
  return `${body}\n\n${status}`
}

const defaultCritique =
  (modelId: string): CritiqueCut =>
  async ({ stills, skillsExcerpt, project }) => {
    if (stills.length === 0) {
      throw new Error('Cut review has no player frames to look at.')
    }
    if (modelId === 'mock-caption' || modelId.startsWith('mock-')) {
      return passingRubric('Mock cut review looked at player frames.')
    }
    const manyLooks = collectionLooksOnMain(project) >= 2
    const result = await defaultGenerateText({
      model: modelId,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: [
                'You are reviewing frames from an ad player. Return JSON only:',
                '{"coverage":"pass|fail","motion":"pass|fail","size":"pass|fail","audio":"pass|fail","brand":"pass|fail","brief":"pass|fail","notes":"..."}',
                'Fail coverage if any frame is black or empty main. Fail size if the only picture is a tiny corner. Fail motion if they asked for live-action footage and this is a still slideshow. Fail audio if music would play over black. Fail brand if it looks like generic stock. Fail brief if length/subject is wrong, if a source product/garment/prop is not recognisable (colour-only match is a fail), or if a hook/end card appears in the middle of the ad instead of the start/end.',
                manyLooks
                  ? 'This cut tagged more than one product still. Fail brief if every frame is only the first look. Pass brief when other tagged garments/looks appear. Do not fail only because wardrobe changed.'
                  : 'Fail brief if outfits or models change across frames when only one product still was tagged.',
                'Judge overlays too: hook at the start, end card only on the last seconds, type readable. The whole cut is MAIN + overlays + audio — not MAIN alone.',
                isAuthoredComposition(project.compositionId)
                  ? 'Authored motion graphics: stills plus kinetic type is the ad, not a defect. Pass motion. Do not fail for slideshow, Ken Burns photos, slow zoom, or lack of camera footage. Fail motion only if every frame is an empty or logo-only poster with no headline.'
                  : '',
                skillsExcerpt ? `Editor skills:\n${skillsExcerpt}` : '',
              ]
                .filter(Boolean)
                .join('\n'),
            },
            ...stills.map((still) => ({
              type: 'file' as const,
              mediaType: 'image/png',
              data: still.bytes,
              filename: `frame-${still.frame}.png`,
            })),
          ],
        },
      ],
    })
    return parseCutReviewRubric(result.text)
  }

const noFramesError = 'Cut review could not look at player frames. Press play to watch the clip.'

export type InspectCutInput = {
  modelProfileId: string
  renderFrames?: RenderCutFrames
  critique?: CritiqueCut
  skillsExcerpt?: string
  recentMotionFingerprints?: readonly string[]
  sequel?: boolean
}

export const inspectCut = async (
  project: StudioProject,
  input: InspectCutInput,
): Promise<InspectCutResult> => {
  const cheap = evaluatePictureCompleteness(project)
  if (!cheap.ok) {
    return {
      ok: false,
      phase: 'completeness',
      failures: cheap.failures,
      error: `Cut review failed picture completeness. ${formatPictureCompletenessError(cheap)}`,
    }
  }

  if (isAuthoredComposition(project.compositionId)) {
    const authored = inspectAuthoredComposition(project, {
      recentFingerprints: input.recentMotionFingerprints,
      sequel: input.sequel,
    })
    if (!authored.ok) {
      const rubric = authoredInspectRubric(authored.check, authored.error)
      return {
        ok: false,
        phase: 'vision',
        frames: sampleCutReviewFrames(project),
        rubric,
        error: authored.error,
      }
    }
  }

  const looksConflict = collectionLooksConflict(project)
  if (looksConflict) {
    return {
      ok: false,
      phase: 'completeness',
      failures: [{ code: 'missing_collection_look', message: looksConflict }],
      error: looksConflict,
    }
  }

  if (!isAuthoredComposition(project.compositionId)) {
    const ctaBrief = inspectCtaBrief(project)
    if (!ctaBrief.ok) {
      const frames = sampleCutReviewFrames(project)
      return {
        ok: false,
        phase: 'vision',
        frames,
        rubric: authoredInspectRubric('brief', ctaBrief.error),
        error: ctaBrief.error,
      }
    }
  }

  const frames = sampleCutReviewFrames(project)
  if (frames.length === 0 && !isAuthoredComposition(project.compositionId)) {
    return {
      ok: true,
      phase: 'vision',
      frames,
      rubric: passingRubric('Slideshow and campaign packs skip video cut review.'),
    }
  }

  const ciStub = isCiStubProfile(input.modelProfileId)
  if (ciStub && !input.critique && !input.renderFrames) {
    return {
      ok: true,
      phase: 'vision',
      frames,
      rubric: passingRubric('CI stub cut review passed.'),
    }
  }

  let stills: CutReviewStill[] = []
  try {
    stills = input.renderFrames ? await input.renderFrames(frames) : []
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown render error'
    const notes = isCutReviewRenderInternals(message)
      ? humanizeCutReviewForFounder(message)
      : `Could not render player frames. ${message}`
    const rubric = failingRubric(notes)
    return {
      ok: false,
      phase: 'vision',
      frames,
      rubric,
      error: formatCutReviewError({ ok: false, phase: 'vision', frames, rubric }),
    }
  }

  if (!ciStub && stills.length === 0) {
    const rubric = failingRubric(noFramesError)
    return {
      ok: false,
      phase: 'vision',
      frames,
      rubric,
      error: formatCutReviewError({ ok: false, phase: 'vision', frames, rubric }),
    }
  }

  const modelId = resolveModelRef(input.modelProfileId, 'caption').modelId
  const critique = input.critique ?? defaultCritique(modelId)
  let rubric = await critique({
    project,
    stills,
    frames,
    skillsExcerpt: input.skillsExcerpt,
  })
  if (isAuthoredComposition(project.compositionId)) {
    rubric = passAuthoredVisionMotion(rubric)
  }
  const failed = failedChecks(rubric)
  if (failed.length > 0) {
    return {
      ok: false,
      phase: 'vision',
      frames,
      rubric,
      error: formatCutReviewError({ ok: false, phase: 'vision', frames, rubric }),
    }
  }
  return { ok: true, phase: 'vision', frames, rubric }
}
