import { displayMusicBedTitle } from './music-bed-display'

type ClipLabelAsset = {
  kind?: string
  probe?: Record<string, unknown>
}

const firstLine = (text: string, max = 48): string => {
  const line = text.trim().split(/\n/)[0]?.trim() ?? ''
  if (line.length <= max) return line
  return `${line.slice(0, Math.max(1, max - 1)).trimEnd()}…`
}

/** Short name for a timeline clip — never the full music style prompt. */
export const clipTimelineLabel = (asset: ClipLabelAsset | undefined): string => {
  if (!asset) return 'clip'
  const probe = asset.probe ?? {}
  const role = typeof probe.role === 'string' ? probe.role : ''
  const prompt = typeof probe.prompt === 'string' ? probe.prompt : ''

  if (role === 'music_bed' || (asset.kind === 'audio' && /Mood:|User request:/i.test(prompt))) {
    const title = displayMusicBedTitle(prompt)
    if (/^placeholder$/i.test(title) || title === 'Untitled bed') return 'Music bed'
    return firstLine(title)
  }

  if (asset.kind === 'audio' && prompt) return firstLine(prompt) || 'Audio'
  if (typeof probe.filename === 'string' && probe.filename.trim()) {
    return firstLine(probe.filename)
  }
  if (typeof probe.brandKitPath === 'string' && probe.brandKitPath.trim()) {
    return firstLine(probe.brandKitPath)
  }
  if (asset.kind === 'audio') return 'Audio'
  return asset.kind ?? 'clip'
}
