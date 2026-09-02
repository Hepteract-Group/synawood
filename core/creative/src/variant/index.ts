export {
  VARIANT_SOFT_CAP,
  adPlatformSchema,
  defaultAspectForPlatform,
  formatVariantLabel,
  parseVariantSpec,
  planVariantMatrix,
  stampVariantSourceBranch,
  suggestedCompositionForPlatform,
  variantAspectSchema,
  variantSpecSchema,
} from './schema'
export type { AdPlatform, VariantAspect, VariantPlan, VariantSpec } from './schema'
export {
  VARIANT_RENDER_GBP,
  buildVariantPlan,
  dimensionsForAspect,
  estimateVariantMatrixGbp,
  makeVariantSpec,
} from './plan'
export type { CostedVariantPlan } from './plan'
export { resolveVariantCopy } from './resolve'
export type { ResolvedVariantCopy } from './resolve'
export { materializeVariantProject } from './materialize'
export {
  createVariantChildProject,
  listVariantChildren,
  planVariantsForParent,
  renderVariantsForParent,
} from './render-variants'
export type { RenderedVariantChild } from './render-variants'
export { saveVariantChildOverrides } from './overrides'
export {
  PROMOTE_FIELD_LABELS,
  applyPromoteFields,
  promoteFieldSchema,
  promoteSharedClipTrims,
  promoteVariantFieldsToParent,
} from './promote'
export type { PromoteField } from './promote'
