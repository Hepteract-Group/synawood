/** Wave 2J / #583 — fuse visual + text + keyword Moment lists (ADR-0052).
 * Visual weight 2 so an appearance neighbour beats a caption-only distractor
 * when both lists have a rank-1 hit.
 */

export const RRF_K = 60
export const RRF_VISUAL_WEIGHT = 2
export const RRF_TEXT_WEIGHT = 1
export const RRF_KEYWORD_WEIGHT = 1

export type RankedShot = { shotId: string }

export const reciprocalRankFusion = (
  lists: Array<{ weight: number; hits: readonly RankedShot[] }>,
  k: number = RRF_K,
): Map<string, number> => {
  const scores = new Map<string, number>()
  for (const { weight, hits } of lists) {
    hits.forEach((hit, index) => {
      scores.set(hit.shotId, (scores.get(hit.shotId) ?? 0) + weight / (k + index + 1))
    })
  }
  return scores
}
