import { z } from 'zod'
import { ensureDefaultTracks, defaultStudioTracks } from './tracks'
import { emptySlideshowExtras, slideshowExtrasSchema } from './slides'
import { campaignPackExtrasSchema, emptyCampaignPackExtras } from './campaign-pack'
import { getSlideshowPreset, type SlideshowPresetId } from '../presets/slideshow'
import { extractedBriefSchema } from '../brief/extracted-brief'
import { directorPlanSchema, intentSchema, scenesSchema } from '../intent/schema'
import { brollPlanSchema } from '../broll/schema'
import { localizationSliceSchema, emptyLocalization } from '../locale/schema'
import { creativeStructureSchema, emptyCreativeStructure } from '../intent/creative-structure'
import { cutReviewRubricDimensionsSchema } from './cut-review-rubric'
import { pipLayoutSchema } from './pip-layout'
import { generationPlanSchema } from '../generation-plan/schema'
import {
  MOTION_DIALECTS,
  MOTION_LAYOUTS,
  MOTION_TRANSITION_FAMILIES,
  HOOK_LAYOUTS,
} from '../motion-kit/catalog'

/** Remotion composition ids: letters, digits, CJK, hyphen only (no underscore). */
export const COMPOSITION_IDS = [
  'talking-head-60',
  'social-carousel',
  'vertical-slideshow',
  'campaign-pack-still',
  'authored',
] as const
export type CompositionId = (typeof COMPOSITION_IDS)[number]

/**
 * Format-picker tiles (Studio → New project). Motion ad is a first-class format
 * (#1326) — operators should not have to type “kinetic” for Remotion craft.
 */
export const FORMAT_COMPOSITION_IDS = COMPOSITION_IDS

/** Founder-facing labels — never show raw composition ids in the UI. */
export const COMPOSITION_DISPLAY: Record<CompositionId, { label: string; description: string }> = {
  'talking-head-60': {
    label: 'Video Suite',
    description: 'Multi-track video editor — clips, stills, overlay, captions, end card.',
  },
  'social-carousel': {
    label: 'Instagram Carousel',
    description: 'Square/landscape slide pack for Instagram (up to 10 slides).',
  },
  'vertical-slideshow': {
    label: 'Vertical Slideshow',
    description: 'Portrait slide pack for TikTok, Reels, or Stories.',
  },
  'campaign-pack-still': {
    label: 'Campaign Pack',
    description: 'Square still creatives with Path C chrome — brief to Approve.',
  },
  authored: {
    label: 'Motion ad',
    description: 'Agent-authored Remotion composition — kinetic type, stingers, custom motion.',
  },
}

const LEGACY_COMPOSITION_IDS: Record<string, CompositionId> = {
  talking_head_60: 'talking-head-60',
  social_carousel: 'social-carousel',
  vertical_slideshow: 'vertical-slideshow',
}

export const normalizeCompositionId = (id: string): CompositionId => {
  const mapped = LEGACY_COMPOSITION_IDS[id] ?? id
  if (!COMPOSITION_IDS.includes(mapped as CompositionId)) {
    throw new Error(`Unknown composition: ${id}`)
  }
  return mapped as CompositionId
}

export const compositionIdSchema = z.preprocess(
  (value) => (typeof value === 'string' ? (LEGACY_COMPOSITION_IDS[value] ?? value) : value),
  z.enum(COMPOSITION_IDS),
)

export const COMPOSITION_PRESETS: Record<
  CompositionId,
  { fps: number; width: number; height: number; durationFrames: number }
> = {
  'talking-head-60': {
    fps: 30,
    width: 1080,
    height: 1920,
    durationFrames: 1800,
  },
  'social-carousel': {
    fps: 30,
    width: 1080,
    height: 1080,
    durationFrames: 900,
  },
  'vertical-slideshow': {
    fps: 30,
    width: 1080,
    height: 1920,
    durationFrames: 900,
  },
  'campaign-pack-still': {
    fps: 30,
    width: 1080,
    height: 1080,
    durationFrames: 1,
  },
  authored: {
    fps: 30,
    width: 1080,
    height: 1920,
    durationFrames: 1800,
  },
}

/** Deterministic-enough seed for Remotion `random()`; stored on the document. */
export const generateMotionSeed = (): string => crypto.randomUUID()

export const artDirectionSchema = z
  .object({
    dialect: z.enum(MOTION_DIALECTS),
    layout: z.enum(MOTION_LAYOUTS),
    transitionFamily: z.enum(MOTION_TRANSITION_FAMILIES).optional(),
    stingerLibraryItemId: z.string().min(1).max(80).optional(),
    beatLayout: z
      .object({
        emptyStructure: z.boolean(),
        hookLayout: z.enum(HOOK_LAYOUTS),
        sequences: z
          .array(
            z
              .object({
                kind: z.enum(['hook', 'education', 'trust', 'offer', 'cta', 'fallback']),
                from: z.number().int().nonnegative(),
                durationInFrames: z.number().int().positive(),
                kit: z.enum(['KineticType', 'CountUp', 'DeviceFrame', 'BrandText']),
                note: z.string().max(200),
              })
              .strict(),
          )
          .max(24),
      })
      .strict()
      .optional(),
  })
  .strict()

export const compositionSourceSchema = z
  .object({
    /** Remotion TSX module body. Compiled in the sandbox. */
    source: z.string(),
    /** Deterministic PRNG seed for Remotion `random()`. */
    motionSeed: z.string().min(1),
    /** Dialect + layout chosen for this take. */
    artDirection: artDirectionSchema.optional(),
    /** Project revision at last successful compile. */
    compiledAtRevision: z.number().int().positive().optional(),
    /** Last compile error, plain English. Null when green. */
    compileError: z.string().max(2000).nullable().optional(),
  })
  .strict()

export type CompositionSource = z.infer<typeof compositionSourceSchema>

const compositionSourceFieldSchema = z.preprocess((value) => {
  if (value === undefined || value === null) return value
  if (typeof value !== 'object') return value
  const record = value as Record<string, unknown>
  const source = typeof record.source === 'string' ? record.source : ''
  const existing = typeof record.motionSeed === 'string' ? record.motionSeed.trim() : ''
  return {
    ...record,
    source,
    motionSeed: existing.length > 0 ? existing : generateMotionSeed(),
  }
}, compositionSourceSchema)

export const projectStatusSchema = z.enum([
  'drafting',
  'rendering',
  'needs_review',
  'approved',
  'killed',
])

export const trackTypeSchema = z.enum(['video', 'audio', 'caption', 'overlay'])

export const assetKindSchema = z.enum(['video', 'image', 'audio', 'other'])

export const assetSourceSchema = z.enum(['upload', 'brand_kit', 'generator', 'url'])

export const trimSchema = z
  .object({
    startFrames: z.number().int().nonnegative().default(0),
    endFrames: z.number().int().nonnegative().optional(),
  })
  .strict()

export const trackSchema = z
  .object({
    id: z.string().min(1),
    type: trackTypeSchema,
    order: z.number().int().nonnegative(),
    /** Timeline chrome — blocks drag/trim on this track's clips. */
    locked: z.boolean().default(false),
    /** Timeline chrome — collapses the lane in the editor. */
    hidden: z.boolean().default(false),
    /** Timeline chrome — mute flag (composition may honor later). */
    muted: z.boolean().default(false),
  })
  .strict()

export const clipTreatmentSchema = z
  .object({
    id: z.string().min(1).max(80),
    intensity: z.number().min(0).max(1).default(1),
    from: z.number().int().nonnegative().optional(),
    durationInFrames: z.number().int().positive().optional(),
  })
  .strict()

export type ClipTreatment = z.infer<typeof clipTreatmentSchema>

export const clipSchema = z
  .object({
    id: z.string().min(1),
    trackId: z.string().min(1),
    assetId: z.string().uuid(),
    from: z.number().int().nonnegative(),
    durationInFrames: z.number().int().positive(),
    trim: trimSchema.default({ startFrames: 0 }),
    /** First-party grade on this clip (ADR-0058). Overrides project.stylePackId. */
    filterId: z.string().min(1).max(80).nullable().optional(),
    filterIntensity: z.number().min(0).max(1).optional(),
    /** Clip treatments (ADR-0058). Unknown ids fail Approve. */
    treatments: z.array(clipTreatmentSchema).max(8).optional(),
    /** Music volume keys (clip-local frames). Used by duck_music (ADR-0073). */
    volumeEnvelope: z
      .array(
        z
          .object({
            atFrame: z.number().int().nonnegative(),
            gain: z.number().min(0).max(1),
          })
          .strict(),
      )
      .max(128)
      .optional(),
    /** Subject-tracking pan/scan (ADR-0074). 0–1 of source. */
    reframe: z
      .object({
        aspect: z.enum(['9:16', '16:9', '1:1', '4:5']),
        tracking: z
          .array(
            z
              .object({
                t: z.number().min(0),
                x: z.number().min(0).max(1),
                y: z.number().min(0).max(1),
                w: z.number().min(0.01).max(1),
                h: z.number().min(0.01).max(1),
              })
              .strict(),
          )
          .min(1)
          .max(64),
      })
      .strict()
      .optional(),
  })
  .strict()

export const overlayKindSchema = z.enum([
  'hook_title',
  'end_card',
  'lower_third',
  'title',
  'caption',
  'sticker',
])

export type OverlayKind = z.infer<typeof overlayKindSchema>

export const overlayLayoutSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().min(0).max(1),
    height: z.number().min(0).max(1),
    rotation: z.number().default(0),
  })
  .strict()

export type OverlayLayout = z.infer<typeof overlayLayoutSchema>

export const overlayStyleSchema = z
  .object({
    presetId: z.string().min(1).optional(),
    align: z.enum(['left', 'center', 'right']).optional(),
    fontSizeEm: z.number().positive().optional(),
    fill: z.string().min(1).optional(),
    stroke: z.string().min(1).optional(),
    emphasis: z
      .array(z.object({ wordIndex: z.number().int().nonnegative() }).strict())
      .max(24)
      .optional(),
    emoji: z
      .array(
        z
          .object({
            wordIndex: z.number().int().nonnegative(),
            stickerId: z.string().min(1).max(40),
          })
          .strict(),
      )
      .max(12)
      .optional(),
  })
  .strict()

export type OverlayStyle = z.infer<typeof overlayStyleSchema>

export const captionWordSchema = z
  .object({
    text: z.string().min(1).max(80),
    startMs: z.number().nonnegative(),
    endMs: z.number().positive(),
  })
  .strict()

export type CaptionWord = z.infer<typeof captionWordSchema>

/** Hook/end/lower-third remain one each; title, caption, and sticker are many. */
export const isSingletonOverlayKind = (kind: OverlayKind): boolean =>
  kind === 'hook_title' || kind === 'end_card' || kind === 'lower_third'

export const defaultOverlayLayout = (kind: OverlayKind): OverlayLayout => {
  if (kind === 'hook_title' || kind === 'title') {
    return { x: 0.08, y: 0.08, width: 0.84, height: 0.28, rotation: 0 }
  }
  if (kind === 'caption' || kind === 'end_card') {
    return { x: 0.08, y: 0.72, width: 0.84, height: 0.22, rotation: 0 }
  }
  if (kind === 'lower_third') {
    return { x: 0.06, y: 0.68, width: 0.55, height: 0.18, rotation: 0 }
  }
  return { x: 0.7, y: 0.7, width: 0.22, height: 0.22, rotation: 0 }
}

export const overlaySchema = z
  .object({
    id: z.string().min(1),
    kind: overlayKindSchema,
    text: z.string().default(''),
    from: z.number().int().nonnegative().default(0),
    durationInFrames: z.number().int().positive().default(90),
    layout: overlayLayoutSchema.optional(),
    style: overlayStyleSchema.optional(),
    assetId: z.string().uuid().optional(),
    libraryItemId: z.string().min(1).optional(),
    /** Word timings for karaoke captions (ms on the composition clock). */
    words: z.array(captionWordSchema).max(80).optional(),
  })
  .strict()
  .superRefine((overlay, ctx) => {
    if (overlay.kind === 'sticker' && !overlay.assetId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'sticker overlays require assetId',
        path: ['assetId'],
      })
    }
    if (overlay.kind !== 'sticker' && overlay.assetId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'assetId is only valid on sticker overlays',
        path: ['assetId'],
      })
    }
  })

export const projectAssetSchema = z
  .object({
    id: z.string().uuid(),
    kind: assetKindSchema,
    blobKey: z.string().min(1),
    contentType: z.string().optional(),
    source: assetSourceSchema,
    probe: z.record(z.string(), z.unknown()).default({}),
  })
  .strict()

export const brandChromeSchema = z
  .object({
    /** Logo bug corner on Path C. */
    corner: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']).default('top-right'),
    /** Logo bug scale relative to default (1 = 96px). */
    scale: z.number().min(0.4).max(2.5).default(1),
    /** Outer padding from frame edge in px. */
    safeMargin: z.number().int().min(8).max(160).default(40),
  })
  .strict()

export type BrandChrome = z.infer<typeof brandChromeSchema>

export const proofStatSchema = z
  .object({
    value: z.number(),
    unit: z.string().max(40).default(''),
    source: z.enum(['catalog', 'dna']),
    claimId: z.string().max(80).optional(),
  })
  .strict()

export type ProofStat = z.infer<typeof proofStatSchema>

export const brandSliceSchema = z
  .object({
    productId: z.string().min(1),
    displayName: z.string().min(1).max(80).optional(),
    logoAssetId: z.string().uuid().optional(),
    logoMonoAssetId: z.string().uuid().optional(),
    /** Primary Path B still; prefer stillAssetIds[0] when both exist. */
    stillAssetId: z.string().uuid().optional(),
    stillAssetIds: z.array(z.string().uuid()).optional(),
    primaryColor: z.string().optional(),
    accentColor: z.string().optional(),
    captionBg: z.string().optional(),
    fontFamily: z.string().optional(),
    voiceId: z.string().optional(),
    defaultCta: z.string().optional(),
    mood: z.string().optional(),
    chrome: brandChromeSchema.optional(),
    /** Catalog/DNA proof bound into authored CountUp (`proofStat` inputProps). */
    proofStats: z.array(proofStatSchema).max(12).optional(),
  })
  .strict()
  .optional()

export const whyLogEntrySchema = z
  .object({
    id: z.string().min(1),
    /** Seconds on the composition clock. */
    t: z.number().nonnegative(),
    target: z.string().min(1).max(120),
    action: z.string().min(1).max(80),
    reason: z.string().min(1).max(280),
  })
  .strict()

export type WhyLogEntry = z.infer<typeof whyLogEntrySchema>

export const studioProjectSchema = z
  .object({
    id: z.string().uuid(),
    productId: z.string().min(1),
    compositionId: compositionIdSchema,
    /** Founder-facing display name (set at create; optional on legacy projects). */
    name: z.string().trim().min(1).max(80).optional(),
    fps: z.number().int().positive(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    durationFrames: z.number().int().positive(),
    status: projectStatusSchema.default('drafting'),
    brand: brandSliceSchema,
    tracks: z.array(trackSchema).default([]),
    clips: z.array(clipSchema).default([]),
    overlays: z.array(overlaySchema).default([]),
    assets: z.array(projectAssetSchema).default([]),
    /** Frame used as export/cover thumbnail when set from timeline chrome. */
    coverFrame: z.number().int().nonnegative().optional(),
    /** Chosen channel still at Approve / Work board (ADR-0077). */
    thumbnailAssetId: z.string().uuid().nullable().optional(),
    thumbnailCandidateIds: z.array(z.string().uuid()).max(4).default([]),
    /**
     * Slideshow / carousel authoring surface (ADR-0013). Present when composition
     * is social-carousel or vertical-slideshow; ignored for talking-head.
     */
    slideshow: slideshowExtrasSchema.optional(),
    /**
     * Campaign pack creatives (Plan 09 / #109). Present for campaign-pack-still;
     * never reuse slides[] here.
     */
    campaignPack: campaignPackExtrasSchema.optional(),
    /**
     * Applied ExtractedBrief mirror (ADR-0027). Canonical row lives in extracted_briefs;
     * this copy seeds agent context after apply_brief.
     */
    brief: extractedBriefSchema.optional(),
    /**
     * Founder Intent (ADR-0026). Always present after parse — defaults to empty object.
     */
    intent: intentSchema.default(() => ({ keywords: [] })),
    /**
     * Semantic Scene tree (ADR-0026). Empty until inferred or authored.
     */
    scenes: scenesSchema.default([]),
    /**
     * Optional draft DirectorPlan mirror (ADR-0029). Durable store is `director_plans` (#139).
     */
    directorPlan: directorPlanSchema.optional(),
    /**
     * Optional draft BrollPlan mirror (ADR-0047). Durable store is `broll_plans` (#518).
     */
    brollPlan: brollPlanSchema.optional(),
    /**
     * Optional Generation Plan mirror (ADR-0086). Paid generate preview before Gateway.
     */
    generationPlan: generationPlanSchema.optional(),
    /**
     * Structural Intent change awaiting Director preview (survives reload).
     * Cleared on Preview / Dismiss / commit / reject. Never auto-applies a plan.
     */
    directorRebuildPrompt: z
      .object({
        diffs: z.array(z.string().min(1).max(160)).min(1).max(8),
        atRevision: z.number().int().positive(),
      })
      .strict()
      .nullable()
      .optional(),
    /**
     * Locale copy + active language (ADR-0043). Timeline text is the resolved
     * active locale; other languages live in localization.copy.
     */
    localization: localizationSliceSchema.default(() => emptyLocalization()),
    /**
     * Optional first-party Remotion look (ADR-0045). Null/omitted = no grade.
     */
    stylePackId: z.string().min(1).max(80).nullable().optional(),
    /**
     * Picture-in-picture / split layout for B-roll (ADR-0046). Omitted = bottom-right inset.
     */
    pipLayout: pipLayoutSchema.optional(),
    /**
     * Last inspect (ADR-0051 / #1244). Stale when the fingerprint no longer
     * matches clips / duration / overlay layout. `passed` is the Approve gate.
     */
    cutReview: z
      .object({
        passed: z.boolean(),
        fingerprint: z.string().min(1),
        frames: z.array(z.number().int().nonnegative()),
        rubric: cutReviewRubricDimensionsSchema.optional(),
        notes: z.string().max(800).optional(),
        at: z.string().min(1),
      })
      .strict()
      .optional(),
    /**
     * Creative knowledge-graph beats (ADR-0034). Empty until derived or authored.
     */
    creativeStructure: creativeStructureSchema.default(() => emptyCreativeStructure()),
    /**
     * Mandatory on-composition disclaimer (ADR-0042). Copied from product policy
     * when required; rendered by Talking Head / Slideshow props.
     */
    governanceDisclaimer: z.string().max(500).optional(),
    /**
     * Operator-facing why-log (ADR-0076). Not the source of truth for the cut.
     */
    whyLog: z.array(whyLogEntrySchema).max(100).default([]),
    /**
     * Agent-authored Remotion TSX (ADR-0091). Present when compositionId is
     * `authored`; empty source is a valid draft (Player banners).
     */
    compositionSource: compositionSourceFieldSchema.optional(),
    /**
     * Chat-footer turn mode (Plan / Ask / Inspect / Execute). Default execute.
     */
    turnMode: z.enum(['plan', 'ask', 'inspect', 'execute']).optional(),
    revision: z.number().int().positive().default(1),
  })
  .strict()

export type StudioProject = z.infer<typeof studioProjectSchema>
export type StudioProjectCutReview = NonNullable<StudioProject['cutReview']>
export type ProjectTrack = z.infer<typeof trackSchema>
export type ProjectClip = z.infer<typeof clipSchema>
export type ProjectOverlay = z.infer<typeof overlaySchema>
export type ProjectAsset = z.infer<typeof projectAssetSchema>
export type ProjectStatus = z.infer<typeof projectStatusSchema>

export const parseStudioProject = (input: unknown): StudioProject => {
  const parsed = ensureDefaultTracks(studioProjectSchema.parse(input))
  return {
    ...parsed,
    overlays: parsed.overlays.map((overlay) => ({
      ...overlay,
      layout: overlay.layout ?? defaultOverlayLayout(overlay.kind),
    })),
  }
}

export const isKnownComposition = (id: string): id is CompositionId =>
  (COMPOSITION_IDS as readonly string[]).includes(id)

export const isSlideshowComposition = (
  id: CompositionId,
): id is 'social-carousel' | 'vertical-slideshow' =>
  id === 'social-carousel' || id === 'vertical-slideshow'

export const isCampaignPackComposition = (id: CompositionId): id is 'campaign-pack-still' =>
  id === 'campaign-pack-still'

export const isAuthoredComposition = (id: CompositionId): id is 'authored' => id === 'authored'

export const createEmptyProject = (input: {
  id: string
  productId: string
  compositionId?: CompositionId
  /** Founder-facing display name. */
  name?: string
  /** Initial duration override (ADR-0014). Defaults to the composition preset. */
  durationFrames?: number
  /** Channel slideshow preset when creating social-carousel / vertical-slideshow. */
  slideshowPresetId?: SlideshowPresetId
}): StudioProject => {
  const compositionId = normalizeCompositionId(input.compositionId ?? 'talking-head-60')
  const compositionPreset = COMPOSITION_PRESETS[compositionId]
  const name = input.name?.trim()

  let slideshow: z.infer<typeof slideshowExtrasSchema> | undefined
  let campaignPack: z.infer<typeof campaignPackExtrasSchema> | undefined
  let width = compositionPreset.width
  let height = compositionPreset.height
  let fps = compositionPreset.fps

  if (isSlideshowComposition(compositionId)) {
    const defaultPresetId: SlideshowPresetId =
      input.slideshowPresetId ??
      (compositionId === 'vertical-slideshow' ? 'tiktok_slideshow_9x16' : 'ig_carousel_1080')
    const channel = getSlideshowPreset(defaultPresetId)
    if (channel.compositionId !== compositionId) {
      throw new Error(
        `Preset ${defaultPresetId} targets ${channel.compositionId}, not ${compositionId}`,
      )
    }
    slideshow = emptySlideshowExtras(defaultPresetId)
    width = channel.width
    height = channel.height
    fps = channel.fps
  }

  if (isCampaignPackComposition(compositionId)) {
    campaignPack = emptyCampaignPackExtras()
  }

  const compositionSource = isAuthoredComposition(compositionId)
    ? { source: '', motionSeed: generateMotionSeed(), compileError: null }
    : undefined

  return ensureDefaultTracks(
    studioProjectSchema.parse({
      id: input.id,
      productId: input.productId,
      compositionId,
      ...(name ? { name } : {}),
      fps,
      width,
      height,
      durationFrames: input.durationFrames ?? compositionPreset.durationFrames,
      status: 'drafting',
      tracks: defaultStudioTracks(),
      clips: [],
      overlays: [],
      assets: [],
      intent: { keywords: [] },
      scenes: [],
      ...(slideshow ? { slideshow } : {}),
      ...(campaignPack ? { campaignPack } : {}),
      ...(compositionSource ? { compositionSource } : {}),
      revision: 1,
    }),
  )
}

/** Video Suite craft: footage cut vs agent-authored motion graphics (#1326). */
export const STUDIO_CRAFTS = ['footage', 'motion'] as const
export type StudioCraft = (typeof STUDIO_CRAFTS)[number]

export const parseStudioCraft = (value: unknown): StudioCraft =>
  value === 'motion' ? 'motion' : 'footage'

export const craftFromComposition = (compositionId?: string | null): StudioCraft =>
  compositionId === 'authored' ? 'motion' : 'footage'

export const isVideoSuiteCraftSwitchable = (compositionId?: string | null): boolean =>
  compositionId === 'authored' || compositionId === 'talking-head-60' || !compositionId

export const applyStudioCraft = (project: StudioProject, craft: StudioCraft): StudioProject => {
  if (craft === 'motion') {
    if (project.compositionId === 'authored') return project
    return parseStudioProject({
      ...project,
      compositionId: 'authored',
      compositionSource: project.compositionSource ?? {
        source: '',
        motionSeed: generateMotionSeed(),
        compileError: null,
      },
    })
  }
  if (project.compositionId !== 'authored') return project
  return parseStudioProject({
    ...project,
    compositionId: 'talking-head-60',
  })
}
