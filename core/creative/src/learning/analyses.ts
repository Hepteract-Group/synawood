/** Five Learning analyses over Final rollup (ADR-0036 / #253). Pure. */

import type { InsightDraft } from './schema'

export type LearningRow = {
  finalAssetId: string
  beatCount: number
  views: number
  clicks: number
  signups: number
  revenue: number
  beats: Array<{ kind: string; durationInFrames: number }>
}

const HOOK_FPS = 30
const HOOK_MAX_SECONDS = 3

const avg = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length

export const runAnalyses = (rows: LearningRow[]): InsightDraft[] => {
  const drafts: InsightDraft[] = []
  if (rows.length === 0) return drafts

  const emptyWithViews = rows.filter((row) => row.beatCount === 0 && row.views > 0)
  if (emptyWithViews.length > 0) {
    drafts.push({
      kind: 'empty_structure',
      title: 'Finals with views have empty structure',
      body: `${emptyWithViews.length} Final(s) recorded views with zero beats. Derive hook/CTA before the next Approve.`,
      evidence: { finalIds: emptyWithViews.map((row) => row.finalAssetId) },
      proposedPrior: { structure: { requireBeats: true } },
    })
  }

  const withBeats = rows.filter((row) => row.beatCount > 0)
  const missingCta = withBeats.filter((row) => !row.beats.some((beat) => beat.kind === 'cta'))
  if (missingCta.length > 0 && missingCta.length >= withBeats.length / 2) {
    drafts.push({
      kind: 'missing_cta',
      title: 'Most structured Finals skip a CTA beat',
      body: `${missingCta.length} of ${withBeats.length} structured Finals have no CTA. Add a CTA scene before Approve.`,
      evidence: { finalIds: missingCta.map((row) => row.finalAssetId) },
      proposedPrior: { structure: { requireCta: true } },
    })
  }

  const longHooks = rows.filter((row) =>
    row.beats.some(
      (beat) => beat.kind === 'hook' && beat.durationInFrames / HOOK_FPS > HOOK_MAX_SECONDS,
    ),
  )
  if (longHooks.length > 0) {
    drafts.push({
      kind: 'hook_length',
      title: 'Hooks run longer than 3 seconds',
      body: `${longHooks.length} Final(s) have a hook beat over ${HOOK_MAX_SECONDS}s. Trim the first beat.`,
      evidence: { finalIds: longHooks.map((row) => row.finalAssetId) },
      proposedPrior: { hooks: { maxSeconds: HOOK_MAX_SECONDS } },
    })
  }

  const short = rows.filter((row) => row.beatCount > 0 && row.beatCount <= 2)
  const mid = rows.filter((row) => row.beatCount >= 3 && row.beatCount <= 5)
  if (
    short.length > 0 &&
    mid.length > 0 &&
    avg(short.map((row) => row.views)) < avg(mid.map((row) => row.views))
  ) {
    drafts.push({
      kind: 'beat_count',
      title: 'Thin structure underperforms 3-5 beat cuts',
      body: 'Finals with 1-2 beats averaged fewer views than 3-5 beat cuts. Prefer a four-beat spine.',
      evidence: {
        shortCount: short.length,
        midCount: mid.length,
      },
      proposedPrior: { structure: { preferredBeatCount: 4 } },
    })
  }

  const withOffer = rows.filter((row) => row.beats.some((beat) => beat.kind === 'offer'))
  const withoutOffer = rows.filter(
    (row) => row.beatCount > 0 && !row.beats.some((beat) => beat.kind === 'offer'),
  )
  if (
    withOffer.length > 0 &&
    withoutOffer.length > 0 &&
    avg(withOffer.map((row) => row.signups)) > avg(withoutOffer.map((row) => row.signups))
  ) {
    drafts.push({
      kind: 'offer_signups',
      title: 'Offer beats correlate with signups',
      body: 'Finals that include an offer beat recorded more signups than those that skip it.',
      evidence: {
        withOffer: withOffer.length,
        withoutOffer: withoutOffer.length,
      },
      proposedPrior: { structure: { requireOffer: true } },
    })
  }

  return drafts
}
