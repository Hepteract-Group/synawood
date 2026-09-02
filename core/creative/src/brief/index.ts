/**
 * Server barrel. Client components must import schema helpers from
 * `@synawood/creative/brief/extracted-brief` — this barrel also re-exports
 * apply-brief → project/operations → node:crypto (breaks Next client bundles).
 */
export {
  BRIEF_LOW_CONFIDENCE_THRESHOLD,
  brandCandidatesSchema,
  briefConfidenceSchema,
  briefMessagingSchema,
  briefProductSchema,
  briefSourceKindSchema,
  briefSourceSchema,
  extractedBriefSchema,
  lowConfidenceFields,
  parseExtractedBrief,
} from './extracted-brief'
export type {
  BrandCandidates,
  BriefConfidence,
  BriefMessaging,
  BriefProduct,
  BriefSource,
  BriefSourceKind,
  ExtractedBrief,
} from './extracted-brief'
export { applyBriefMinimal, applyBriefToProject } from './apply-brief'
export type { ApplyBriefResult, FirstCutMode } from './apply-brief'
export { mergeReadyBriefBrandPatch, patchReadyBriefBrandCandidates } from './patch-ready-brief'
export type { ReadyBriefBrandPatch } from './patch-ready-brief'
