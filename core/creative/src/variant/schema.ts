import { z } from 'zod'
import type { CompositionId } from '../project/schema'
import { localeCodeSchema } from '../locale/schema'

export const adPlatformSchema = z.enum(['tiktok', 'ig_reels', 'yt_shorts', 'meta_feed'])
export type AdPlatform = z.infer<typeof adPlatformSchema>

export const variantAspectSchema = z.enum(['9:16', '1:1', '4:5'])
export type VariantAspect = z.infer<typeof variantAspectSchema>

/** Soft default max variants per plan unless founder confirms spend (ADR-0027). */
export const VARIANT_SOFT_CAP = 12

export const variantSpecSchema = z
  .object({
    platform: adPlatformSchema,
    /** Index into brief.messaging.hookCandidates, or -1 when hookOverride is set. */
    hookIndex: z.number().int().min(-1),
    ctaIndex: z.number().int().min(-1),
    hookOverride: z.string().min(1).optional(),
    ctaOverride: z.string().min(1).optional(),
    aspect: variantAspectSchema,
    label: z.string().min(1),
    /**
     * Parent named-branch tip this child was forked from (ADR-0030 / #188).
     * Optional for legacy children created before Wave 2D.
     */
    sourceBranchId: z.string().uuid().optional(),
    /** Optional matrix axis (ADR-0043 / #334). */
    locale: localeCodeSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.hookIndex < 0 && !value.hookOverride) {
      ctx.addIssue({
        code: 'custom',
        message: 'hookOverride required when hookIndex is -1',
        path: ['hookOverride'],
      })
    }
    if (value.ctaIndex < 0 && !value.ctaOverride) {
      ctx.addIssue({
        code: 'custom',
        message: 'ctaOverride required when ctaIndex is -1',
        path: ['ctaOverride'],
      })
    }
  })

export type VariantSpec = z.infer<typeof variantSpecSchema>

export const parseVariantSpec = (input: unknown): VariantSpec => variantSpecSchema.parse(input)

/** Stamp the parent's active branch onto a planned VariantSpec at create time. */
export const stampVariantSourceBranch = (
  spec: VariantSpec,
  sourceBranchId: string | null | undefined,
): VariantSpec => {
  if (!sourceBranchId) return spec
  if (spec.sourceBranchId === sourceBranchId) return spec
  return parseVariantSpec({ ...spec, sourceBranchId })
}

const PLATFORM_ASPECT: Record<AdPlatform, VariantAspect> = {
  tiktok: '9:16',
  ig_reels: '9:16',
  yt_shorts: '9:16',
  meta_feed: '1:1',
}

const PLATFORM_LABEL: Record<AdPlatform, string> = {
  tiktok: 'TikTok',
  ig_reels: 'IG Reels',
  yt_shorts: 'YT Shorts',
  meta_feed: 'Meta',
}

export const defaultAspectForPlatform = (platform: AdPlatform): VariantAspect =>
  PLATFORM_ASPECT[platform]

/** Composition suggestion from platform (meta feed uses square carousel preset). */
export const suggestedCompositionForPlatform = (platform: AdPlatform): CompositionId =>
  platform === 'meta_feed' ? 'social-carousel' : 'talking-head-60'

export const formatVariantLabel = (input: {
  platform: AdPlatform
  hookIndex: number
  ctaIndex: number
  hookOverride?: string
  ctaOverride?: string
  locale?: string
}): string => {
  const hook = input.hookIndex < 0 ? (input.hookOverride ?? 'Hook') : `Hook ${input.hookIndex + 1}`
  const cta = input.ctaIndex < 0 ? (input.ctaOverride ?? 'CTA') : `CTA ${input.ctaIndex + 1}`
  const locale = input.locale ? ` · ${input.locale}` : ''
  return `${PLATFORM_LABEL[input.platform]} · ${hook} · ${cta}${locale}`
}

export type VariantPlan = {
  items: VariantSpec[]
  requestedCount: number
  truncated: boolean
}

export const planVariantMatrix = (input: {
  platforms: AdPlatform[]
  hookIndexes: number[]
  ctaIndexes: number[]
  locales?: string[]
  softCap?: number
}): VariantPlan => {
  const softCap = input.softCap ?? VARIANT_SOFT_CAP
  const locales = input.locales?.length
    ? input.locales.map((code) => localeCodeSchema.parse(code))
    : [undefined]
  const items: VariantSpec[] = []
  for (const platform of input.platforms) {
    for (const hookIndex of input.hookIndexes) {
      for (const ctaIndex of input.ctaIndexes) {
        for (const locale of locales) {
          items.push(
            variantSpecSchema.parse({
              platform,
              hookIndex,
              ctaIndex,
              aspect: defaultAspectForPlatform(platform),
              ...(locale ? { locale } : {}),
              label: formatVariantLabel({ platform, hookIndex, ctaIndex, locale }),
            }),
          )
        }
      }
    }
  }
  const requestedCount = items.length
  const truncated = requestedCount > softCap
  return {
    items: truncated ? items.slice(0, softCap) : items,
    requestedCount,
    truncated,
  }
}
