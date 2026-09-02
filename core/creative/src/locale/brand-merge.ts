/** Optional brand-kit locale overlays (ADR-0043 / #326 / #510). */

import { readFile } from 'node:fs/promises'
import path from 'node:path'

const mergeRecords = (
  base: Record<string, unknown>,
  overlay: Record<string, unknown>,
): Record<string, unknown> => {
  const out: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(overlay)) {
    const prev = out[key]
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      prev &&
      typeof prev === 'object' &&
      !Array.isArray(prev)
    ) {
      out[key] = mergeRecords(prev as Record<string, unknown>, value as Record<string, unknown>)
    } else {
      out[key] = value
    }
  }
  return out
}

const isEnoent = (error: unknown): boolean =>
  Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')

const readOptionalJson = async (filePath: string): Promise<Record<string, unknown> | null> => {
  let rawText: string
  try {
    rawText = await readFile(filePath, 'utf8')
  } catch (error) {
    if (isEnoent(error)) return null
    throw error
  }
  let raw: unknown
  try {
    raw = JSON.parse(rawText)
  } catch {
    throw new Error(`Invalid JSON in locale brand overlay: ${filePath}`)
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`Locale brand overlay must be a JSON object: ${filePath}`)
  }
  return raw as Record<string, unknown>
}

export const mergeBrandKitForLocale = async (input: {
  kitRoot: string
  locale: string
  files: Record<string, Record<string, unknown>>
}): Promise<Record<string, Record<string, unknown>>> => {
  const root = path.join(input.kitRoot, 'locales', input.locale)
  const out: Record<string, Record<string, unknown>> = {}
  for (const [name, base] of Object.entries(input.files)) {
    const overlay = await readOptionalJson(path.join(root, name))
    out[name] = overlay ? mergeRecords(base, overlay) : base
  }
  return out
}
