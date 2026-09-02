import { z } from 'zod'

/**
 * Intent + Scenes + DirectorPlan / Suggestion stubs — Wave 2A / ADR-0026 + 0029.
 * Persist on Studio Project JSON (`project.intent`, `project.scenes`).
 */

/** Aligns short-form ads with AdPlatform; adds long-form / social presets. */
export const intentPlatformSchema = z.enum([
  'tiktok',
  'ig_reels',
  'yt_shorts',
  'meta_feed',
  'linkedin',
  'x',
  'youtube',
  'landing',
])

export const intentFunnelStageSchema = z.enum(['tof', 'mof', 'bof'])

export const intentGoalSchema = z.enum([
  'awareness',
  'consideration',
  'signup',
  'purchase',
  'retention',
  'custom',
])

export const intentEmotionSchema = z.enum([
  'exciting',
  'emotional',
  'trustworthy',
  'humorous',
  'urgent',
  'calm',
  'aspirational',
  'informative',
])

export const sceneRoleSchema = z.enum([
  'hook',
  'problem',
  'context',
  'proof',
  'solution',
  'offer',
  'cta',
  'custom',
])

/** Inclusive age years, e.g. [25, 40]. Homogeneous array — Gemini rejects tuple `items` lists. */
export const intentAgeRangeSchema = z
  .array(z.number().int().min(0).max(120))
  .min(2)
  .max(2)
  .refine((pair) => pair[0]! <= pair[1]!, {
    message: 'ageRange low must be ≤ high',
  })

export const intentAwarenessStageSchema = z.enum([
  'unaware',
  'problem-aware',
  'solution-aware',
  'product-aware',
  'most-aware',
])

export const intentAudienceSchema = z
  .object({
    persona: z.string().min(1).max(120).optional(),
    ageRange: intentAgeRangeSchema.optional(),
    context: z.string().min(1).max(240).optional(),
    awarenessStage: intentAwarenessStageSchema.optional(),
    language: z.string().min(1).max(160).optional(),
    primaryPain: z.string().min(1).max(160).optional(),
  })
  .strict()

export const intentSchema = z
  .object({
    goal: intentGoalSchema.optional(),
    goalNote: z.string().min(1).max(240).optional(),
    funnelStage: intentFunnelStageSchema.optional(),
    kpi: z.string().min(1).max(80).optional(),
    desiredBehaviour: z.string().min(1).max(160).optional(),
    audience: intentAudienceSchema.optional(),
    platform: intentPlatformSchema.optional(),
    emotion: intentEmotionSchema.optional(),
    lengthSeconds: z.number().positive().max(600).optional(),
    cta: z.string().min(1).max(120).optional(),
    primaryMessage: z.string().min(1).max(160).optional(),
    supportingPoints: z.array(z.string().min(1).max(160)).max(2).optional(),
    brandVoice: z.string().min(1).max(120).optional(),
    keywords: z.array(z.string().min(1).max(40)).max(24).default([]),
  })
  .strict()

/** HTTP / tool patch. All Intent keys optional. Do not default keywords to [] on a partial. */
export const intentPatchSchema = intentSchema.partial().extend({
  keywords: z.array(z.string().min(1).max(40)).max(24).optional(),
})

export const sceneSchema = z
  .object({
    id: z.string().min(1).max(64),
    role: sceneRoleSchema,
    label: z.string().min(1).max(160),
    intentNote: z.string().min(1).max(400).optional(),
    targetDurationFrames: z.number().int().positive().optional(),
    clipIds: z.array(z.string().min(1)).default([]),
    overlayIds: z.array(z.string().min(1)).default([]),
    locked: z.boolean().default(false),
  })
  .strict()

export const scenesSchema = z.array(sceneSchema).default([])

export const emptyIntent = (): Intent => intentSchema.parse({})
export const emptyScenes = (): Scene[] => scenesSchema.parse([])

export const directorPlanStatusSchema = z.enum(['draft', 'applied', 'rejected', 'stale'])

export const directorPlanScopeSchema = z.union([
  z.literal('global'),
  z.object({ sceneIds: z.array(z.string().min(1)).min(1) }).strict(),
  z.object({ clipIds: z.array(z.string().min(1)).min(1) }).strict(),
])

/**
 * One proposed edit inside a DirectorPlan.
 * `mutation` is validated against StudioMutation at commit time (#139).
 */
export const directorPlanEditSchema = z
  .object({
    id: z.string().min(1),
    mutation: z
      .object({
        type: z.string().min(1),
      })
      .passthrough(),
    sceneId: z.string().min(1).optional(),
    previewText: z.string().max(400).optional(),
    /** Human-readable validation / scope reason when status is rejected. */
    rejectReason: z.string().max(400).optional(),
    status: z.enum(['proposed', 'rejected']).default('proposed'),
  })
  .strict()

export const generatorPlanStubSchema = z
  .object({
    tool: z.string().min(1),
    estimatedCostGbp: z.number().nonnegative().default(0),
    args: z.record(z.string(), z.unknown()).default({}),
  })
  .strict()

/** Preview-first plan — ADR-0029. Durable table lands in #139. */
export const directorPlanSchema = z
  .object({
    id: z.string().uuid(),
    createdAt: z.string().datetime(),
    projectRevision: z.number().int().positive(),
    scope: directorPlanScopeSchema.default('global'),
    style: z.string().min(1).max(80).optional(),
    edits: z.array(directorPlanEditSchema).default([]),
    rationale: z.string().max(2000).default(''),
    costEstimateGbp: z.number().nonnegative().default(0),
    generatorCalls: z.array(generatorPlanStubSchema).default([]),
    status: directorPlanStatusSchema.default('draft'),
    reasonerModelId: z.string().min(1).default('mock-reasoner'),
  })
  .strict()

export const suggestionKindSchema = z.enum([
  'trim',
  'zoom',
  'caption',
  'brand',
  'broll',
  'copy',
  'audio',
  'replace',
  'reorder',
])

export const suggestionSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1).max(160),
    previewText: z.string().max(400).optional(),
    kind: suggestionKindSchema,
    tool: z.string().min(1),
    args: z.record(z.string(), z.unknown()).default({}),
    estimatedCostGbp: z.number().nonnegative().default(0),
    requiresGenerator: z.boolean().default(false),
  })
  .strict()

export type IntentPlatform = z.infer<typeof intentPlatformSchema>
export type IntentGoal = z.infer<typeof intentGoalSchema>
export type IntentFunnelStage = z.infer<typeof intentFunnelStageSchema>
export type IntentAwarenessStage = z.infer<typeof intentAwarenessStageSchema>
export type IntentEmotion = z.infer<typeof intentEmotionSchema>
export type SceneRole = z.infer<typeof sceneRoleSchema>
export type IntentAgeRange = z.infer<typeof intentAgeRangeSchema>
export type IntentAudience = z.infer<typeof intentAudienceSchema>
export type Intent = z.infer<typeof intentSchema>
export type Scene = z.infer<typeof sceneSchema>
export type DirectorPlanStatus = z.infer<typeof directorPlanStatusSchema>
export type DirectorPlanScope = z.infer<typeof directorPlanScopeSchema>
export type DirectorPlanEdit = z.infer<typeof directorPlanEditSchema>
export type DirectorPlan = z.infer<typeof directorPlanSchema>
export type SuggestionKind = z.infer<typeof suggestionKindSchema>
export type Suggestion = z.infer<typeof suggestionSchema>

export const parseIntent = (input: unknown): Intent => intentSchema.parse(input)
export const parseScene = (input: unknown): Scene => sceneSchema.parse(input)
export const parseScenes = (input: unknown): Scene[] => scenesSchema.parse(input)
export const parseDirectorPlan = (input: unknown): DirectorPlan => directorPlanSchema.parse(input)
export const parseSuggestion = (input: unknown): Suggestion => suggestionSchema.parse(input)

/** Clip may appear in at most one scene; every clipId must exist when knownClipIds is provided. */
export const sceneClipInvariantIssues = (
  scenes: Scene[],
  knownClipIds?: ReadonlySet<string>,
): string[] => {
  const issues: string[] = []
  const seen = new Map<string, string>()
  for (const scene of scenes) {
    for (const clipId of scene.clipIds) {
      const prior = seen.get(clipId)
      if (prior) {
        issues.push(`clip ${clipId} assigned to both ${prior} and ${scene.id}`)
      } else {
        seen.set(clipId, scene.id)
      }
      if (knownClipIds && !knownClipIds.has(clipId)) {
        issues.push(`clip ${clipId} in scene ${scene.id} is not on the project`)
      }
    }
  }
  return issues
}
