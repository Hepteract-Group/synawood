/** Face-detect stage for asset index (#176 / ADR-0032). Off by default. */

/**
 * Privacy: never auto celebrity / identity labeling (ADR-0032 rejected).
 * When enabled, we only record that a detect pass ran (stub counts).
 */
export const isAssetFaceDetectEnabled = (env: NodeJS.ProcessEnv = process.env): boolean =>
  env.ASSET_FACE_DETECT === 'true'

export type FaceDetectResult = {
  ran: boolean
  /** Stub count only — not identities. */
  faceCount: number
  skippedReason?: string
}

/**
 * Optional index stage. Default: skip. Enabled: deterministic stub (no CV vendor yet).
 * Real detector adapters can replace this without changing the flag contract.
 */
export const runFaceDetectPass = (input: {
  enabled: boolean
  kind: 'video' | 'image' | 'audio' | 'other'
}): FaceDetectResult => {
  if (!input.enabled) {
    return { ran: false, faceCount: 0, skippedReason: 'ASSET_FACE_DETECT is off (default)' }
  }
  if (input.kind !== 'video' && input.kind !== 'image') {
    return { ran: true, faceCount: 0, skippedReason: `No faces for kind=${input.kind}` }
  }
  // Stub: enabled path marks the pass without claiming identities.
  return { ran: true, faceCount: 0 }
}
