export {
  compactBranchTip,
  isMainBranchSlug,
  listBranches,
  MAIN_BRANCH_NAME,
  MAIN_BRANCH_SLUG,
  resolveActiveBranch,
  resolveBranchById,
  resolveBranchBySlug,
  resolveMainBranch,
  slugifyBranchName,
  syncActiveBranchMirror,
  writeActiveBranchTip,
} from './branches'
export type { ResolvedBranch, StudioProjectBranchRow, WriteActiveBranchTipResult } from './branches'

export {
  BRANCH_EXISTS_PREFIX,
  branchExistsError,
  createBranchFromActiveTip,
  isBranchExistsError,
  listBranchSummaries,
  mergeBranchTip,
  promoteBranchToMain,
  replaceBranchTip,
  summarizeBranchRow,
  switchActiveBranch,
} from './branch-ops'
export type { BranchSummary } from './branch-ops'

export {
  COMPOSITION_DISPLAY,
  COMPOSITION_IDS,
  COMPOSITION_PRESETS,
  FORMAT_COMPOSITION_IDS,
  applyStudioCraft,
  brandChromeSchema,
  proofStatSchema,
  artDirectionSchema,
  compositionSourceSchema,
  createEmptyProject,
  generateMotionSeed,
  isKnownComposition,
  isSlideshowComposition,
  isCampaignPackComposition,
  isAuthoredComposition,
  normalizeCompositionId,
  overlayKindSchema,
  overlayLayoutSchema,
  overlayStyleSchema,
  overlaySchema,
  defaultOverlayLayout,
  isSingletonOverlayKind,
  parseStudioProject,
  studioProjectSchema,
  whyLogEntrySchema,
} from './schema'
export type {
  BrandChrome,
  ProofStat,
  CompositionId,
  CompositionSource,
  OverlayKind,
  OverlayLayout,
  OverlayStyle,
  ProjectAsset,
  ProjectClip,
  ProjectOverlay,
  ProjectStatus,
  ProjectTrack,
  StudioProject,
  WhyLogEntry,
} from './schema'

export {
  directorPlanSchema,
  emptyIntent,
  emptyScenes,
  intentSchema,
  parseDirectorPlan,
  parseIntent,
  parseScenes,
  sceneClipInvariantIssues,
  sceneSchema,
  scenesSchema,
  suggestionSchema,
} from '../intent'
export type { DirectorPlan, Intent, Scene, Suggestion } from '../intent'

export {
  assignLayouts,
  COMPARTMENT_SLIDE_LAYOUTS,
  draftSlides,
  emptySlideshowExtras,
  isCompartmentSlideLayout,
  isOverlaySlideLayout,
  isSplitSlideLayout,
  isStackedSlideLayout,
  OVERLAY_SLIDE_LAYOUTS,
  slideLayoutIdSchema,
  slideLayoutSchema,
  slideSchema,
  slideshowExtrasSchema,
  validateBodyForPreset,
  validateHeadlineForPreset,
  validateSafeMargins,
  validateSlideshow,
} from './slides'
export type {
  CompartmentSlideLayout,
  OverlaySlideLayout,
  Slide,
  SlideLayout,
  SlideshowExtras,
  SlideshowValidationIssue,
  SlideshowValidationResult,
  SlideTransition,
  VoiceoverMode,
} from './slides'

export {
  campaignAspectSchema,
  campaignBriefSchema,
  campaignCreativeSchema,
  campaignPackExtrasSchema,
  draftCreatives,
  emptyCampaignPackExtras,
  validateCampaignPack,
} from './campaign-pack'
export type {
  CampaignAspect,
  CampaignBrief,
  CampaignCreative,
  CampaignPackExtras,
  CampaignPackValidationIssue,
} from './campaign-pack'

export { buildSlideBackgroundPrompt } from './slide-background-prompt'
export {
  addSlide,
  planSlideshow,
  removeSlide,
  reorderSlides,
  setSlide,
  setSlideBackground,
  setSlideshowVoiceover,
} from './slide-ops'
export type { AddSlideInput, PlanSlideshowInput, SetSlidePatch } from './slide-ops'

export {
  buildCampaignBackgroundPrompt,
  clearCampaignCreativeMedia,
  ensureCampaignPackExtras,
  planCampaignCreatives,
  removeCampaignCreative,
  setCampaignBrief,
  setCampaignCreative,
  setCreativeBackground,
  addCampaignCreative,
} from './campaign-ops'
export type { SetCampaignBriefInput, SetCampaignCreativePatch } from './campaign-ops'

export {
  ensureDefaultTracks,
  overlaysForTrack,
  trackTypeForOverlayKind,
  isBrollTrack,
  MAIN_VIDEO_TRACK_ID,
  BROLL_TRACK_ID,
  SFX_TRACK_ID,
} from './tracks'

export {
  assertPictureCompleteness,
  evaluatePictureCompleteness,
  isSpeechAudioAsset,
  lastMainPictureEndFrames,
  lastMainVideoAssetId,
  lastMainVideoEndFrames,
  overlayLayoutIsReadable,
  pictureWindowFrames,
  projectHasMusicBed,
  projectHasVoiceover,
  voiceoverStartsAfterPicture,
  remainingBriefVideoSeconds,
  resolvePictureTrackId,
} from './picture-completeness'
export type { PictureCompletenessFailure, PictureCompletenessReport } from './picture-completeness'
export {
  cutReviewFingerprint,
  cutReviewRequired,
  formatCutReviewRubric,
  hasFreshCutReview,
  stampCutReview,
  stampFailedCutReview,
  stampPassedCutReview,
} from './cut-review-state'
export type {
  CutReviewCheck,
  CutReviewRubricDimensions,
  CutReviewVerdict,
} from './cut-review-rubric'
export { adReadySummary, listAdReadyIssues } from './ad-ready'
export type { AdReadyIssue } from './ad-ready'

export {
  attachAsset,
  addClip,
  retargetClipAsset,
  autoFitDuration,
  lastContentEndFrames,
  reanchorEarlyEndCard,
  repairPictureToBrief,
  placeClip,
  packClips,
  resolveMagneticClipFrom,
  resolveTrackId,
  trackEndFrame,
  videoTrackHasGaps,
  placeOverlay,
  removeAsset,
  renameAsset,
  writeTranscriptOnAsset,
  removeClip,
  removeOverlay,
  rippleDeleteClip,
  setCoverFrame,
  setTrackFlags,
  splitClip,
  detachBrandKit,
  clearProjectBrand,
  setDuration,
  fitDurationToContent,
  trimClip,
  setHookTitle,
  setEndCard,
  addCaptions,
  addText,
  findStickerAsset,
  placeSticker,
  updateOverlay,
} from './operations'
export { applyStudioMutation, studioMutationSchema, summarizeStudioMutation } from './mutations'
export type { StudioMutation } from './mutations'
export { summarizeProject } from './summary'
export type { ProjectSummary } from './summary'

export { assetTokenFor, assetLabel, resolveAssetReferences } from './asset-token'
export {
  clipLabel,
  clipTokenFor,
  formatTimeChipLabel,
  formatTimeToken,
  groundingReferenceBlock,
  implicitGroundedLabel,
  listGroundingChips,
  overlayLabel,
  overlayTokenFor,
  removeGroundingToken,
  resolveChatGrounding,
  stripGroundingTokens,
} from './grounding-token'
export type {
  ChatGroundingPayload,
  ClipRefLike,
  GroundingChip,
  ImplicitChatGrounding,
  OverlayRefLike,
  ResolvedChatGrounding,
} from './grounding-token'
export { resolveSlideReferences, slideLabel, slideTokenFor } from './slide-token'
export type { ResolvedSlideReference, SlideRefLike } from './slide-token'
export type { AssetRefLike, ResolvedAssetReference } from './asset-token'

export { loadProject, listProjects } from './load'
export type { StudioProjectRow } from './load'
export {
  attachMissingExtractAssets,
  ensureAssetOnProject,
  projectAssetFromRow,
  resolveProjectAsset,
} from './resolve-asset'
export type { AssetTableRow } from './resolve-asset'

export {
  createProject,
  deleteProject,
  renameProject,
  RevisionConflictError,
  saveProject,
} from './save'
export {
  historyMetaFromRow,
  redoProject,
  resolveHistoryMeta,
  seedCurrentRevision,
  undoProject,
} from './history'
export type { HistoryMeta } from './history'
export { uploadProjectAsset } from './upload-asset'
export {
  ingestProjectAssetFromUrl,
  URL_ASSET_MAX_BYTES,
  UrlAssetIngestError,
} from './ingest-asset-from-url'
export type { UploadedAssetResult } from './upload-asset'
