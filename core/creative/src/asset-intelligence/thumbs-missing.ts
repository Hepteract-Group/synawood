/** Marker on ready index rows when keyframe extract failed (#580). */

export const KEYFRAME_THUMBS_MISSING_PREFIX = 'Keyframe thumbs missing' as const

export const isKeyframeThumbsMissing = (lastError: string | null | undefined): boolean =>
  Boolean(lastError?.includes(KEYFRAME_THUMBS_MISSING_PREFIX))
