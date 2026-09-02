import { z } from 'zod'

const confidenceUnit = z.number().min(0).max(1)

export const briefSourceKindSchema = z.enum(['url', 'pdf'])

export const briefSourceSchema = z
  .object({
    kind: briefSourceKindSchema,
    uri: z.string().url().optional(),
    blobKey: z.string().min(1).optional(),
    title: z.string().optional(),
    fetchedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.kind === 'url' && !value.uri) {
      ctx.addIssue({ code: 'custom', message: 'url source requires uri', path: ['uri'] })
    }
    if (value.kind === 'pdf' && !value.blobKey) {
      ctx.addIssue({ code: 'custom', message: 'pdf source requires blobKey', path: ['blobKey'] })
    }
  })

export const brandCandidatesSchema = z
  .object({
    displayName: z.string().optional(),
    primaryColor: z.string().optional(),
    accentColor: z.string().optional(),
    logoAssetId: z.string().uuid().optional(),
    stillAssetIds: z.array(z.string().uuid()).default([]),
    fontFamily: z.string().optional(),
    defaultCta: z.string().optional(),
  })
  .strict()

export const briefProductSchema = z
  .object({
    name: z.string().optional(),
    oneLiner: z.string().optional(),
    benefits: z.array(z.string()).default([]),
    pricingNotes: z.string().optional(),
    socialProof: z.array(z.string()).default([]),
  })
  .strict()

export const briefMessagingSchema = z
  .object({
    hookCandidates: z.array(z.string()).default([]),
    ctaCandidates: z.array(z.string()).default([]),
    audienceHints: z.array(z.string()).default([]),
    tone: z.string().optional(),
  })
  .strict()

export const briefConfidenceSchema = z
  .object({
    overall: confidenceUnit,
    fields: z.record(z.string(), confidenceUnit).optional(),
  })
  .strict()

/** Structured URL/PDF extract — ADR-0027 / Wave 2B. */
export const extractedBriefSchema = z
  .object({
    id: z.string().uuid(),
    source: briefSourceSchema,
    brandCandidates: brandCandidatesSchema.default(() => ({ stillAssetIds: [] })),
    product: briefProductSchema.default(() => ({ benefits: [], socialProof: [] })),
    messaging: briefMessagingSchema.default(() => ({
      hookCandidates: [],
      ctaCandidates: [],
      audienceHints: [],
    })),
    confidence: briefConfidenceSchema,
    /** Truncated digest for debug — not founder truth. */
    raw: z.string().max(50_000).optional(),
  })
  .strict()

export type BriefSourceKind = z.infer<typeof briefSourceKindSchema>
export type BriefSource = z.infer<typeof briefSourceSchema>
export type BrandCandidates = z.infer<typeof brandCandidatesSchema>
export type BriefProduct = z.infer<typeof briefProductSchema>
export type BriefMessaging = z.infer<typeof briefMessagingSchema>
export type BriefConfidence = z.infer<typeof briefConfidenceSchema>
export type ExtractedBrief = z.infer<typeof extractedBriefSchema>

export const parseExtractedBrief = (input: unknown): ExtractedBrief =>
  extractedBriefSchema.parse(input)

/** Fields with confidence below this should be highlighted in the wizard. */
export const BRIEF_LOW_CONFIDENCE_THRESHOLD = 0.55

export const lowConfidenceFields = (brief: ExtractedBrief): string[] => {
  const fields = brief.confidence.fields ?? {}
  return Object.entries(fields)
    .filter(([, score]) => score < BRIEF_LOW_CONFIDENCE_THRESHOLD)
    .map(([key]) => key)
}
