import { kitTagAttr } from '../authored/on-screen-text'
import type { StudioProject } from '../project/schema'

const PURCHASE_HARD_CTA = /\b(buy now|shop now|order now|purchase now|get yours)\b/i

const meaningfulTokens = (text: string): Set<string> =>
  new Set(
    text
      .toLowerCase()
      .split(/\W+/)
      .filter((word) => word.length >= 3),
  )

export const ctaTextAligns = (graphic: string, intentCta: string): boolean => {
  const left = graphic.trim().toLowerCase()
  const right = intentCta.trim().toLowerCase()
  if (!left || !right) return false
  if (left === right) return true
  if (left.includes(right) || right.includes(left)) return true
  for (const token of meaningfulTokens(right)) {
    if (meaningfulTokens(left).has(token)) return true
  }
  return false
}

type SequenceBlock = { from: number; duration: number; body: string }

const sequenceBlocks = (source: string): SequenceBlock[] => {
  const blocks: SequenceBlock[] = []
  const re = /<Sequence\b([^>]*)>([\s\S]*?)<\/Sequence>/g
  for (const match of source.matchAll(re)) {
    const attrs = match[1] ?? ''
    const fromMatch = attrs.match(/\bfrom=\{(\d+)\}/)
    const durationMatch = attrs.match(/\bdurationInFrames=\{(\d+)\}/)
    if (!fromMatch || !durationMatch) continue
    blocks.push({
      from: Number(fromMatch[1]),
      duration: Number(durationMatch[1]),
      body: match[2] ?? '',
    })
  }
  return blocks
}

const brandTextInBlock = (body: string): string[] => kitTagAttr(body, 'BrandText', 'text')

const lastSecondsStart = (project: StudioProject): number =>
  Math.max(0, project.durationFrames - Math.max(project.fps * 3, 45))

const authoredCloseTexts = (project: StudioProject, source: string): string[] => {
  const threshold = lastSecondsStart(project)
  const texts: string[] = []
  for (const block of sequenceBlocks(source)) {
    const blockEnd = block.from + block.duration
    if (blockEnd <= threshold) continue
    texts.push(...brandTextInBlock(block.body))
  }
  return texts.map((text) => text.trim()).filter(Boolean)
}

const overlayCloseTexts = (project: StudioProject): string[] => {
  const threshold = lastSecondsStart(project)
  return project.overlays
    .filter((overlay) => overlay.kind === 'end_card')
    .filter((overlay) => overlay.from + overlay.durationInFrames > threshold)
    .map((overlay) => overlay.text?.trim() ?? '')
    .filter(Boolean)
}

export const closeGraphicCtaTexts = (project: StudioProject, source = ''): string[] => [
  ...overlayCloseTexts(project),
  ...authoredCloseTexts(project, source),
]

const isAwarenessBrief = (project: StudioProject): boolean =>
  project.intent?.goal === 'awareness' || project.intent?.funnelStage === 'tof'

const isConversionBrief = (project: StudioProject): boolean =>
  project.intent?.funnelStage === 'bof' ||
  project.intent?.goal === 'signup' ||
  project.intent?.goal === 'purchase'

const isMusicBedAsset = (asset: StudioProject['assets'][number] | undefined): boolean =>
  asset?.probe?.role === 'music_bed'

export const hasVoiceoverSpeech = (project: StudioProject): boolean => {
  const speechClip = project.clips.some((clip) => {
    const asset = project.assets.find((item) => item.id === clip.assetId)
    return asset?.kind === 'audio' && !isMusicBedAsset(asset) && asset.source === 'generator'
  })
  if (speechClip) return true
  const intentCta = project.intent?.cta?.trim()
  if (!intentCta) return false
  return project.overlays.some(
    (overlay) => overlay.kind === 'caption' && (overlay.words?.length ?? 0) > 0,
  )
}

export const inspectCtaBrief = (
  project: StudioProject,
  source = '',
): { ok: true } | { ok: false; error: string } => {
  const closeTexts = closeGraphicCtaTexts(project, source)
  const intentCta = project.intent?.cta?.trim() ?? ''

  if (isAwarenessBrief(project)) {
    const hardClose = closeTexts.find((text) => PURCHASE_HARD_CTA.test(text))
    if (hardClose) {
      return {
        ok: false,
        error: `Top-of-funnel ads should not hard-sell "${hardClose}" — patch the close to a softer CTA from Intent.`,
      }
    }
  }

  if (isConversionBrief(project) && closeTexts.length === 0) {
    return {
      ok: false,
      error:
        'Conversion ads need a last-seconds CTA on screen — add BrandText or set_end_card matching Intent.cta.',
    }
  }

  if (intentCta && closeTexts.length > 0) {
    const aligned = closeTexts.some((text) => ctaTextAligns(text, intentCta))
    if (!aligned) {
      return {
        ok: false,
        error: `The close CTA must match Intent.cta ("${intentCta}") — patch BrandText or set_end_card.`,
      }
    }
  }

  if (intentCta && hasVoiceoverSpeech(project) && closeTexts.length === 0) {
    return {
      ok: false,
      error: `Voiceover needs a matching on-screen CTA ("${intentCta}") — add BrandText or set_end_card, not VO-only.`,
    }
  }

  return { ok: true }
}
