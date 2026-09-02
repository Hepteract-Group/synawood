/** Reject NLE projects and formats ADR-0059 does not import. Client-safe. */

const NLE_EXTENSIONS = ['.prproj', '.aep', '.aepx', '.prel', '.fcpxml', '.dra']
const ANIMATED_EXTENSIONS = ['.gif', '.apng']
const FONT_EXTENSIONS = ['.woff', '.woff2', '.ttf', '.otf', '.eot']

export type LibraryImportRejection = {
  ok: false
  error: string
}

const extOf = (fileName: string): string => {
  const base = fileName.trim().toLowerCase()
  const dot = base.lastIndexOf('.')
  return dot >= 0 ? base.slice(dot) : ''
}

export const rejectLibraryImportFile = (
  fileName: string,
  contentType = '',
): LibraryImportRejection | null => {
  const name = fileName.trim().toLowerCase()
  const ext = extOf(name)
  const type = contentType.toLowerCase()

  if (name.includes('capcut') || ext === '.capcut' || ext === '.draft') {
    return {
      ok: false,
      error: 'CapCut drafts cannot be imported. Export a PNG/WebP sticker or JSON grade instead.',
    }
  }
  if (NLE_EXTENSIONS.includes(ext) || type.includes('premiere') || type.includes('aftereffects')) {
    return {
      ok: false,
      error:
        'Premiere, After Effects, and other NLE projects cannot be imported. Use PNG/WebP/SVG or JSON grade/treatment recipes.',
    }
  }
  if (ANIMATED_EXTENSIONS.includes(ext) || type === 'image/gif' || type === 'image/apng') {
    return {
      ok: false,
      error: 'Animated GIF/APNG stickers are not in v1. Import a still PNG or WebP with alpha.',
    }
  }
  if (FONT_EXTENSIONS.includes(ext) || type.includes('font')) {
    return {
      ok: false,
      error: 'Font files stay in the Brand kit. Overlay import does not install fonts.',
    }
  }
  return null
}

export const isLottieJson = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return Array.isArray(record.layers) && typeof record.v === 'string' && record.fr != null
}
