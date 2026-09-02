/**
 * Browser-safe authored Player helpers. Do not re-export compile / bundle
 * (TypeScript + Remotion webpack / Node fs).
 */
export {
  AUTHORED_IMPORT_ALLOWLIST,
  authoredRequireName,
  isAllowlistedAuthoredImport,
} from './allowlist'
export type { AuthoredImport } from './allowlist'
export { authoredCompileBanner } from './banner'
export type { AuthoredBanner } from './banner'
export {
  AUTHORED_IFRAME_ALLOW,
  AUTHORED_IFRAME_SANDBOX,
  AUTHORED_PLAYER_PATH,
  SYNAWOOD_AUTHORED_MESSAGE,
  UNIQUE_ORIGIN_STORAGE_POLYFILL,
  authoredPlayerSrcDoc,
  isMosAuthoredFromFrame,
} from './iframe-protocol'
export type { MosAuthoredFromFrame, MosAuthoredToFrame } from './iframe-protocol'
export {
  authoredCoveredLastFrame,
  authoredMotionSpanLayout,
  authoredPlayStartFrame,
  authoredSequenceCoverage,
} from './sequence-coverage'
