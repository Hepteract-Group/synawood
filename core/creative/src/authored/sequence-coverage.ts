/** Last frame exclusive-end of Sequence beats in authored TSX. Null when there are no Sequences. */
export type AuthoredSequenceCoverage = {
  from: number
  end: number
}

const FROM_RE = /\bfrom=\{(\d+)\}/
const DURATION_RE = /\bdurationInFrames=\{(\d+)\}/

const sequenceOpenTags = (source: string): string[] => {
  const tags: string[] = []
  const re = /<Sequence\b[^>]*>/g
  let match: RegExpExecArray | null
  while ((match = re.exec(source))) {
    tags.push(match[0])
  }
  return tags
}

export const authoredSequenceCoverage = (source: string): AuthoredSequenceCoverage | null => {
  let from = Number.POSITIVE_INFINITY
  let end = 0
  for (const tag of sequenceOpenTags(source)) {
    const startMatch = tag.match(FROM_RE)
    const durationMatch = tag.match(DURATION_RE)
    if (!startMatch || !durationMatch) continue
    const start = Number(startMatch[1])
    const duration = Number(durationMatch[1])
    if (!Number.isFinite(start) || !Number.isFinite(duration) || duration <= 0) continue
    from = Math.min(from, start)
    end = Math.max(end, start + duration)
  }
  if (!Number.isFinite(from) || end <= from) return null
  return { from, end }
}

/** Pixel box for the MAIN coverage span (not a clip). */
export const authoredMotionSpanLayout = (
  coverage: AuthoredSequenceCoverage,
  pixelsPerFrame: number,
): { left: number; width: number } => ({
  left: coverage.from * pixelsPerFrame,
  width: Math.max(1, (coverage.end - coverage.from) * pixelsPerFrame),
})

export const authoredCoveredLastFrame = (source: string, durationFrames: number): number => {
  const last = Math.max(0, durationFrames - 1)
  const coverage = authoredSequenceCoverage(source)
  if (!coverage) return last
  return Math.min(last, Math.max(0, coverage.end - 1))
}

/** Frame to play from. Ended or past the last Sequence beat restarts at 0. */
export const authoredPlayStartFrame = (
  currentFrame: number,
  durationInFrames: number,
  coveredLastFrame?: number,
): number => {
  const last = Math.max(0, durationInFrames - 1)
  const visualLast =
    typeof coveredLastFrame === 'number' && Number.isFinite(coveredLastFrame)
      ? Math.min(last, Math.max(0, Math.floor(coveredLastFrame)))
      : last
  if (currentFrame >= visualLast) return 0
  return currentFrame
}
