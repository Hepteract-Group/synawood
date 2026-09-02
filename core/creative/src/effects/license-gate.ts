/** Approve license gate for style packs (ADR-0045 / #209). */

import { getStylePack } from './packs'

export const assertStylePackPublishable = (stylePackId: string | null | undefined): void => {
  if (!stylePackId) return
  const pack = getStylePack(stylePackId)
  if (!pack) {
    throw new Error(
      `Approve blocked: unknown style pack "${stylePackId}". Clear the look or pick a first-party pack.`,
    )
  }
  if (pack.license !== 'first-party') {
    throw new Error(`Approve blocked: style pack "${pack.label}" is not license-cleared for Final.`)
  }
}
