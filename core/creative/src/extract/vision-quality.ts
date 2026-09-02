import type { ProductExtractQuality } from './product-extract-schema'

export type ExtractQualityScore = {
  quality: ProductExtractQuality
  note?: string
}

const QUALITIES: readonly ProductExtractQuality[] = ['usable', 'weak', 'reject']

const asQuality = (value: unknown): ProductExtractQuality | null => {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return QUALITIES.find((item) => item === normalized) ?? null
}

/** Fixture / model JSON only. CI must not call a live vision model. */
export const parseVisionQualityScore = (raw: unknown): ExtractQualityScore => {
  if (typeof raw === 'string') {
    try {
      return parseVisionQualityScore(JSON.parse(raw) as unknown)
    } catch {
      const quality = asQuality(raw)
      if (quality) return { quality }
      throw new Error('Vision quality fixture is not valid JSON')
    }
  }
  if (!raw || typeof raw !== 'object') {
    throw new Error('Vision quality fixture must be an object')
  }
  const record = raw as Record<string, unknown>
  const quality = asQuality(record.quality)
  if (!quality) {
    throw new Error('Vision quality must be usable, weak, or reject')
  }
  const note = typeof record.note === 'string' ? record.note.trim().slice(0, 240) : undefined
  return note ? { quality, note } : { quality }
}

/** Byte-size heuristic when vision is not injected (tests / mock reasoner). */
export const scoreScreenshotBytes = (bytes: Uint8Array): ExtractQualityScore => {
  if (bytes.byteLength < 8 * 1024) {
    return { quality: 'reject', note: 'Screenshot is too small to use as a still.' }
  }
  if (bytes.byteLength < 40 * 1024) {
    return { quality: 'weak', note: 'Screenshot is thin — usable as a last resort.' }
  }
  return { quality: 'usable' }
}
