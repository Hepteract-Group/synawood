/**
 * Browser-safe Studio Project surface (#690).
 *
 * `'use client'` files must import from here (or a deep path like
 * `./schema` / `./tracks`), never from `@synawood/creative/project` — that barrel
 * re-exports load/save/operations and pulls Node builtins.
 */

export {
  COMPOSITION_DISPLAY,
  COMPOSITION_IDS,
  COMPOSITION_PRESETS,
  FORMAT_COMPOSITION_IDS,
  applyStudioCraft,
  brandChromeSchema,
  proofStatSchema,
  compositionSourceSchema,
  artDirectionSchema,
  craftFromComposition,
  createEmptyProject,
  defaultOverlayLayout,
  generateMotionSeed,
  isAuthoredComposition,
  isCampaignPackComposition,
  isKnownComposition,
  isSingletonOverlayKind,
  isSlideshowComposition,
  isVideoSuiteCraftSwitchable,
  normalizeCompositionId,
  parseStudioCraft,
  overlayKindSchema,
  overlayLayoutSchema,
  overlaySchema,
  overlayStyleSchema,
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
  StudioProjectCutReview,
  StudioCraft,
  WhyLogEntry,
} from './schema'

export {
  BROLL_TRACK_ID,
  MAIN_VIDEO_TRACK_ID,
  SFX_TRACK_ID,
  ensureDefaultTracks,
  isBrollTrack,
  overlaysForTrack,
  trackTypeForOverlayKind,
} from './tracks'

export { resolveMagneticClipFrom } from './clip-placement'

export { formatWhyLogTimecode } from './why-log'

export { adReadySummary, listAdReadyIssues } from './ad-ready'
export type { AdReadyIssue } from './ad-ready'

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

export {
  assertPictureCompleteness,
  evaluatePictureCompleteness,
  lastMainPictureEndFrames,
  lastMainVideoAssetId,
  lastMainVideoEndFrames,
  overlayLayoutIsReadable,
  pictureWindowFrames,
  projectHasMusicBed,
  projectHasVoiceover,
  remainingBriefVideoSeconds,
  resolvePictureTrackId,
  voiceoverStartsAfterPicture,
} from './picture-completeness'
export type { PictureCompletenessFailure, PictureCompletenessReport } from './picture-completeness'

export type { PipLayout, PipMode, PipPresetId } from './pip-layout'
export {
  DEFAULT_PIP_LAYOUT,
  layoutFromPreset,
  normalizePipLayout,
  pipLayoutSchema,
} from './pip-layout'

export type { StudioMutation } from './mutations'

export { channelNeedsThumbnail, MAX_THUMBNAIL_CANDIDATES } from './approval-thumbnail'
