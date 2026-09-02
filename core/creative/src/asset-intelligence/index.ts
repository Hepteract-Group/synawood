export {
  ASSET_EMBEDDING_DIMS,
  assetEmbeddingKindSchema,
  assetEmbeddingMetaSchema,
  assetIndexStageSchema,
  assetIndexStateFromRow,
  assetIndexStateSchema,
  assetIndexStatusSchema,
  assetShotSchema,
  assetTagSchema,
  assetTagSourceSchema,
  parseAssetEmbeddingMeta,
  parseAssetIndexState,
  parseAssetShot,
  parseAssetTag,
  toIsoDateTime,
  transcriptSegmentSchema,
} from './schema'
export type {
  AssetEmbeddingKind,
  AssetEmbeddingMeta,
  AssetIndexStage,
  AssetIndexState,
  AssetIndexStatus,
  AssetShot,
  AssetTag,
  AssetTagSource,
} from './schema'

export { enqueueAssetIndexJob } from './enqueue-index'
export { estimateAssetIndexGbp, gateAssetIndexSpend } from './estimate-index'
export {
  captionAssetWithVlm,
  normalizeAssetTag,
  normalizeAssetTags,
  parseCaptionVlmResult,
} from './caption'
export type { CaptionAssetResult } from './caption'
export {
  replaceAssetEmbedding,
  replaceAssetShots,
  replaceAssetTags,
  upsertAssetIndexState,
} from './persist'
export type { PersistedShot } from './persist'
export {
  ASSET_TEXT_EMBEDDING_MODEL_ID,
  buildEmbedText,
  embedAssetForIndex,
  formatPgVector,
  mockTextEmbedding,
} from './embed'
export type { EmbedAssetResult } from './embed'
export { probeAssetBytes } from './probe'
export type { AssetProbeResult } from './probe'
export { enqueueAndRunAssetIndexInline, runAssetIndexJob } from './run-index'
export { startAssetIndexAfterAttach } from './start-index-after-attach'
export { HEURISTIC_SHOT_MS, MAX_HEURISTIC_SHOTS, proposeHeuristicShots } from './shots'
export type { ProposedShot } from './shots'
export {
  excerptTranscript,
  MAX_TRANSCRIPT_EXCERPT,
  normalizeTranscriptPhrase,
  shotWindowContainsPhrase,
  transcribeAssetForIndex,
  transcriptWindowForShot,
} from './transcript'
export type { TranscribeAssetResult, TranscriptSegment } from './transcript'
export {
  cosineDistance,
  describeAssetIndex,
  filterByMaxDistance,
  findAssetsByKeyword,
  findAssetsSemantic,
  findShotEmbeddingsSemantic,
  loadStoredVisualQueryVector,
  listAssetsByTag,
  MAX_TEXT_SEMANTIC_DISTANCE,
  MAX_VISUAL_SEMANTIC_DISTANCE,
  queryVectorForTests,
  rankByCosineDistance,
} from './search'
export type { AssetDescription, AssetSearchHit, ShotEmbeddingHit } from './search'
export { findMoments, rankMoments, scoreMoment } from './moments'
export type { MomentCandidate, MomentHit } from './moments'
export { loadIndexedShot, placeShotOnProject, shotWindowToClipTiming } from './place-shot'
export type { ClipTiming, IndexedShot, PlaceShotInput, ShotWindow } from './place-shot'
export {
  attachVisualEmbeddingFlags,
  indexingChipLabel,
  visitorLibraryError,
  isActiveIndexStatus,
  listAssetIndexStatuses,
  listUnindexedAssetIds,
  needsAppearanceIndex,
  summarizeAssetIndexStatuses,
} from './index-status'
export type { AssetIndexStatusItem, AssetIndexStatusSummary } from './index-status'
export { listBackfillAssetIds, resolveLibraryBackfill } from './backfill-index'
export type { BackfillAsset, BackfillShot } from './backfill-index'
export { analyzeAsset, estimateAnalyzeGbp, MISSING_THUMBS_ANALYZE_ERROR } from './analyze-asset'
export type { AnalyzeAssetResult } from './analyze-asset'
export {
  ANALYZE_KINDS,
  analyzeKindSchema,
  analyzeSchemaId,
  fixtureAnalyzeResult,
  parseAnalyzeJsonResult,
  validateAnalyzeResult,
} from './analyze-schema'
export type { AnalyzeKind, JsonSchemaObject } from './analyze-schema'
export {
  listAssetAnalyses,
  listAssetAnalysesForAssets,
  replaceAssetAnalysis,
} from './analyze-persist'
export type { ListedAnalysis } from './analyze-persist'
export { motionScenePlanContextBlock, motionScenePlanFromAnalyses } from './motion-scene-plan'
export type { AnalysisForMotionPlan, MotionSceneKind, MotionScenePlan } from './motion-scene-plan'
export { commitSegmentShots, SEGMENT_SCHEMA, shotsFromSegmentResult } from './segment-shots'
export { resolveAnalyzePack, fixtureAnalyzePackResult } from './analyze-pack'
export { COMPLIANCE_SCHEMA, complianceHitsFromResult, compliancePrompt } from './compliance-pack'
export type { ComplianceHit } from './compliance-pack'
export { HIGHLIGHT_SCHEMA, highlightScoresFromResult } from './highlight-pack'
export { mapAnalyzeHttpError, parseAnalyzeGetQuery, parseAnalyzePostBody } from './analyze-http'
export {
  isPaidIndexSoftSkip,
  PAID_INDEX_SOFT_SKIP_MESSAGE,
  PAID_INDEX_SOFT_SKIP_PREFIX,
} from './soft-skip'
export { isKeyframeThumbsMissing, KEYFRAME_THUMBS_MISSING_PREFIX } from './thumbs-missing'
export {
  isUnrecoverableIndexError,
  isVisualEmbedCapSkip,
  isVisualEmbedFailed,
  VISUAL_EMBED_CAP_SKIP_MESSAGE,
  VISUAL_EMBED_FAILED_PREFIX,
} from './visual-embed-status'
