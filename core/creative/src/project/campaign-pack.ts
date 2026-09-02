/** Campaign pack authoring surface (#109) — distinct from slideshow slides[]. */

import { z } from 'zod'

export const campaignAspectSchema = z.enum(['1:1', '4:5', '9:16'])
export type CampaignAspect = z.infer<typeof campaignAspectSchema>

export const campaignBriefSchema = z
  .object({
    prompt: z.string().default(''),
    productId: z.string().min(1).optional(),
    aspect: campaignAspectSchema.default('1:1'),
    notes: z.string().max(2000).optional(),
    /** Optional Path B reference stills (product shots / mood). */
    imageAssetIds: z.array(z.string().uuid()).max(8).optional(),
    /** Set when DNA suggestions land (#104+); optional while DNA is deferred. */
    suggestionSource: z.enum(['manual', 'dna', 'catalog']).optional(),
  })
  .strict()

export const campaignCreativeSchema = z
  .object({
    id: z.string().min(1),
    order: z.number().int().nonnegative(),
    headline: z.string().default(''),
    body: z.string().optional(),
    cta: z.string().optional(),
    /** Path B / generated still behind Path C chrome. */
    backgroundAssetId: z.string().uuid().optional(),
    /** Filled by still-to-motion (#113). */
    motionAssetId: z.string().uuid().optional(),
    /** In-flight Animate job — survives reload while generating. */
    motionJobId: z.string().uuid().optional(),
    textSafe: z.boolean().default(true),
  })
  .strict()

export const campaignPackExtrasSchema = z
  .object({
    brief: campaignBriefSchema.default(() => ({ prompt: '', aspect: '1:1' as const })),
    creatives: z.array(campaignCreativeSchema).default([]),
  })
  .strict()

export type CampaignBrief = z.infer<typeof campaignBriefSchema>
export type CampaignCreative = z.infer<typeof campaignCreativeSchema>
export type CampaignPackExtras = z.infer<typeof campaignPackExtrasSchema>

export const emptyCampaignPackExtras = (): CampaignPackExtras =>
  campaignPackExtrasSchema.parse({
    brief: { prompt: '', aspect: '1:1' },
    creatives: [],
  })

/** Seed N empty creatives for tests / later batch generate. */
export const draftCreatives = (input: {
  count?: number
  headlines?: string[]
}): CampaignCreative[] => {
  const headlines = input.headlines ?? []
  const count = Math.min(12, Math.max(1, input.count ?? (headlines.length || 1)))
  return Array.from({ length: count }, (_, order) =>
    campaignCreativeSchema.parse({
      id: `creative_${order + 1}`,
      order,
      headline: headlines[order] ?? '',
      textSafe: true,
    }),
  )
}

export type CampaignPackValidationIssue = {
  code: 'duplicate_id' | 'order_gap' | 'empty_headline' | 'text_unsafe'
  creativeId?: string
  message: string
}

export const validateCampaignPack = (
  extras: CampaignPackExtras,
): { ok: boolean; issues: CampaignPackValidationIssue[] } => {
  const issues: CampaignPackValidationIssue[] = []
  const ids = new Set<string>()
  const orders = extras.creatives.map((c) => c.order).sort((a, b) => a - b)
  for (let i = 0; i < orders.length; i += 1) {
    if (orders[i] !== i) {
      issues.push({
        code: 'order_gap',
        message: `Creative order must be contiguous from 0; got [${orders.join(', ')}]`,
      })
      break
    }
  }
  for (const creative of extras.creatives) {
    if (ids.has(creative.id)) {
      issues.push({
        code: 'duplicate_id',
        creativeId: creative.id,
        message: `Duplicate creative id ${creative.id}`,
      })
    }
    ids.add(creative.id)
    if (!creative.headline.trim()) {
      issues.push({
        code: 'empty_headline',
        creativeId: creative.id,
        message: `Creative ${creative.id} needs a headline`,
      })
    }
    if (!creative.textSafe) {
      issues.push({
        code: 'text_unsafe',
        creativeId: creative.id,
        message: `Creative ${creative.id} marked textSafe=false`,
      })
    }
  }
  return { ok: issues.length === 0, issues }
}
