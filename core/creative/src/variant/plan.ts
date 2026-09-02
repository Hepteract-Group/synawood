import type { CompositionId } from '../project/schema'
import type { AdPlatform, VariantAspect, VariantPlan, VariantSpec } from './schema'
import {
  VARIANT_SOFT_CAP,
  defaultAspectForPlatform,
  formatVariantLabel,
  planVariantMatrix,
  variantSpecSchema,
} from './schema'

/** Living £ estimate per child Remotion mp4 render (not an invoice). */
export const VARIANT_RENDER_GBP = 0.03

/**
 * Remotion export estimate for a variant matrix.
 * Creating child projects alone is £0 (shared media; no generate deltas in v1).
 * Pass includeRenders:false when gating a create-only fan-out.
 */
export const estimateVariantMatrixGbp = (input: {
  variantCount: number
  /** When false, returns £0 (create-only / no enqueue). */
  includeRenders?: boolean
}): number => {
  const count = Math.max(0, input.variantCount)
  if (input.includeRenders === false) return 0
  return Number((count * VARIANT_RENDER_GBP).toFixed(4))
}

export type CostedVariantPlan = VariantPlan & {
  /**
   * Spend gated for this action: export estimate when includeRenders,
   * else £0 for create-only.
   */
  estimatedGbp: number
  /** Always £0 in v1 — children share parent media; no paid generate deltas. */
  createEstimatedGbp: number
  /** Remotion export estimate if every planned child is exported. */
  exportEstimatedGbp: number
  warnings: string[]
}

export const buildVariantPlan = (input: {
  platforms: AdPlatform[]
  hookIndexes: number[]
  ctaIndexes: number[]
  locales?: string[]
  softCap?: number
  /** Raise soft cap only when founder confirmed spend for a larger matrix. */
  confirmSpend?: boolean
  includeRenders?: boolean
}): CostedVariantPlan => {
  const softCap = input.softCap ?? VARIANT_SOFT_CAP
  const effectiveCap =
    input.confirmSpend === true ? Math.max(softCap, input.softCap ?? 48) : softCap
  const matrix = planVariantMatrix({
    platforms: input.platforms,
    hookIndexes: input.hookIndexes,
    ctaIndexes: input.ctaIndexes,
    locales: input.locales,
    softCap: effectiveCap,
  })
  const warnings: string[] = []
  if (matrix.truncated) {
    warnings.push(
      `Soft-capped to ${matrix.items.length} of ${matrix.requestedCount} versions. Confirm to raise the cap.`,
    )
  }
  if (matrix.items.length > VARIANT_SOFT_CAP) {
    warnings.push(
      `Above default soft cap of ${VARIANT_SOFT_CAP} — confirmation required before creating.`,
    )
  }
  const createEstimatedGbp = 0
  const exportEstimatedGbp = estimateVariantMatrixGbp({
    variantCount: matrix.items.length,
    includeRenders: true,
  })
  const estimatedGbp = input.includeRenders === false ? createEstimatedGbp : exportEstimatedGbp
  if (exportEstimatedGbp > 0) {
    warnings.push(
      `Creating versions is free. Exporting all ${matrix.items.length} later is about £${exportEstimatedGbp.toFixed(2)} (~£${VARIANT_RENDER_GBP.toFixed(2)} each).`,
    )
  }
  return {
    ...matrix,
    estimatedGbp,
    createEstimatedGbp,
    exportEstimatedGbp,
    warnings,
  }
}

export const dimensionsForAspect = (
  aspect: VariantAspect,
): { width: number; height: number; compositionId: CompositionId } => {
  if (aspect === '1:1') {
    return { width: 1080, height: 1080, compositionId: 'social-carousel' }
  }
  if (aspect === '4:5') {
    return { width: 1080, height: 1350, compositionId: 'talking-head-60' }
  }
  return { width: 1080, height: 1920, compositionId: 'talking-head-60' }
}

/** Prefer platform default aspect when building a single manually specified cell. */
export const makeVariantSpec = (input: {
  platform: AdPlatform
  hookIndex: number
  ctaIndex: number
  hookOverride?: string
  ctaOverride?: string
  aspect?: VariantAspect
  locale?: string
}): VariantSpec =>
  variantSpecSchema.parse({
    platform: input.platform,
    hookIndex: input.hookIndex,
    ctaIndex: input.ctaIndex,
    hookOverride: input.hookOverride,
    ctaOverride: input.ctaOverride,
    aspect: input.aspect ?? defaultAspectForPlatform(input.platform),
    locale: input.locale,
    label: formatVariantLabel(input),
  })
