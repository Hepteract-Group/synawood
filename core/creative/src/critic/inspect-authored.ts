import { compileAuthoredComposition } from '../authored/compile'
import { authoredSequenceCoverage } from '../authored/sequence-coverage'
import {
  authoredHeadlineText,
  authoredJsxTextNodes,
  authoredOnScreenText,
  countUpValues,
} from '../authored/on-screen-text'
import { lintCampaignClaims } from '../campaign/claim-lint'
import { inspectCtaBrief } from './cta-brief'
import { isFeatureDumpCopy } from '../intent/proposition'
import { isAuthoredComposition, type StudioProject } from '../project/schema'
import { catalogNumbersFromProject, numbersInText } from '../authored/proof-numbers'

export type AuthoredInspectFailure = {
  ok: false
  check: 'motion' | 'hierarchy' | 'variety' | 'brand' | 'picture' | 'claims' | 'compile' | 'brief'
  error: string
}

export type AuthoredInspectSuccess = { ok: true }

export type AuthoredInspectResult = AuthoredInspectSuccess | AuthoredInspectFailure

/** Empty beats are an Approve nudge, not an inspect fail and not a new pill. */
export const emptyStructureInspectWarning = (project: StudioProject): string | null => {
  if (!isAuthoredComposition(project.compositionId)) return null
  if (!project.compositionSource?.artDirection?.beatLayout?.emptyStructure) return null
  return 'Creative structure has no beats. Derive from Intent or keep this one-scene ad — Approve still works.'
}

export const motionFingerprint = (project: StudioProject): string => {
  const source = project.compositionSource?.source ?? ''
  const dialect = project.compositionSource?.artDirection?.dialect ?? 'none'
  const layout = project.compositionSource?.artDirection?.layout ?? 'none'
  return `${dialect}|${layout}|${source.replace(/\s+/g, ' ').trim()}`
}

const hasFrameMotion = (source: string): boolean =>
  /useCurrentFrame/.test(source) &&
  (/spring\s*\(/.test(source) ||
    /interpolate\s*\(/.test(source) ||
    /KineticType|CountUp|slideIn|SceneWipe|LottieStinger/.test(source))

const isFadeOnlyPoster = (source: string): boolean =>
  /opacity/.test(source) &&
  !/spring\s*\(/.test(source) &&
  !/KineticType|CountUp|slideIn/.test(source)

const isKenBurnsStillSlop = (source: string): boolean =>
  /ken\s*burns/i.test(source) && !/KineticType|CountUp|spring\s*\(/.test(source)

const VAGUE_AUDIENCE = /everyone|anybody|the world/i

const hasSpecificAudience = (project: StudioProject): boolean => {
  const persona = project.intent?.audience?.persona?.trim() ?? ''
  return persona.length > 0 && !VAGUE_AUDIENCE.test(persona)
}

const meaningfulTokens = (text: string): Set<string> =>
  new Set(
    text
      .toLowerCase()
      .split(/\W+/)
      .filter((word) => word.length >= 3),
  )

const sharesMeaningfulToken = (a: string, b: string): boolean => {
  const left = meaningfulTokens(a)
  for (const token of meaningfulTokens(b)) {
    if (left.has(token)) return true
  }
  return false
}

const competingHeadlines = (source: string, primaryMessage: string): string[] =>
  authoredHeadlineText(source).filter(
    (headline) => !sharesMeaningfulToken(headline, primaryMessage),
  )

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

const isLogoIntroOpen = (source: string): boolean => {
  const opening = sequenceBlocks(source).find((block) => block.from === 0 && block.duration <= 12)
  if (!opening) return false
  if (/KineticType|CountUp/.test(opening.body)) return false
  if (!/LottieStinger|BrandText/.test(opening.body)) return false
  const stripped = opening.body
    .replace(/<LottieStinger\b[^/>]*\/>/g, '')
    .replace(/<BrandText\b[^/>]*\/>/g, '')
    .replace(/<LottieStinger\b[^>]*>[\s\S]*?<\/LottieStinger>/g, '')
    .replace(/<BrandText\b[^>]*>[\s\S]*?<\/BrandText>/g, '')
    .replace(/<[^>]+>/g, '')
    .trim()
  return stripped.length === 0
}

const hasOnScreenMessage = (source: string): boolean => {
  if (/KineticType|BrandText|CountUp/.test(source)) return true
  if (authoredOnScreenText(source).some((text) => text.trim().length >= 3)) return true
  return authoredJsxTextNodes(source).some((text) => text.trim().length >= 3)
}

const hasCaptionOverlays = (project: StudioProject): boolean =>
  project.overlays.some((overlay) => overlay.kind === 'caption')

const inspectConstitution = (
  project: StudioProject,
  source: string,
): AuthoredInspectFailure | null => {
  if (!hasSpecificAudience(project)) {
    return {
      ok: false,
      check: 'brief',
      error:
        'Name a specific audience on Intent (not everyone), then patch the open so it speaks to them.',
    }
  }
  const primaryMessage = project.intent?.primaryMessage?.trim() ?? ''
  if (primaryMessage) {
    const unrelated = competingHeadlines(source, primaryMessage)
    if (unrelated.length >= 3) {
      return {
        ok: false,
        check: 'brief',
        error:
          'Drop the extra on-screen headlines and keep one message from Intent.primaryMessage through the open.',
      }
    }
  }
  const onScreenJoined = authoredOnScreenText(source).join(' ')
  if (isFeatureDumpCopy(onScreenJoined)) {
    return {
      ok: false,
      check: 'brief',
      error:
        'Replace feature-dump headlines (Fast! Easy! AI-powered!) with one concrete promise from Intent.',
    }
  }
  if (isLogoIntroOpen(source)) {
    return {
      ok: false,
      check: 'brief',
      error: 'Open with the problem or message, not a logo stinger — patch the first beat.',
    }
  }
  if (!hasCaptionOverlays(project) && !hasOnScreenMessage(source)) {
    return {
      ok: false,
      check: 'brief',
      error:
        'Add KineticType or captions so the ad still reads on mute — patch_composition or place captions.',
    }
  }
  const ctaBrief = inspectCtaBrief(project, source)
  if (!ctaBrief.ok) {
    return { ok: false, check: 'brief', error: ctaBrief.error }
  }
  return null
}

export const inspectAuthoredComposition = (
  project: StudioProject,
  input?: {
    recentFingerprints?: readonly string[]
    sequel?: boolean
  },
): AuthoredInspectResult => {
  if (!isAuthoredComposition(project.compositionId)) {
    return { ok: true }
  }
  const source = project.compositionSource?.source ?? ''
  if (source.trim().length === 0) {
    return {
      ok: false,
      check: 'picture',
      error: 'The composition is empty. write_composition first, then inspect_preview.',
    }
  }
  if (project.compositionSource?.compileError) {
    return {
      ok: false,
      check: 'compile',
      error: project.compositionSource.compileError,
    }
  }
  const compile = compileAuthoredComposition(source)
  if (!compile.ok) {
    return { ok: false, check: 'compile', error: compile.compileError }
  }
  const coverage = authoredSequenceCoverage(source)
  if (coverage) {
    const slack = Math.max(project.fps, 15)
    if (project.durationFrames > coverage.end + slack) {
      const extraSeconds = Math.round((project.durationFrames - coverage.end) / project.fps)
      return {
        ok: false,
        check: 'picture',
        error: `The last ${extraSeconds}s of the Player has no Sequence (${coverage.end}–${project.durationFrames}). set_duration to ${coverage.end} or extend the last beat through the canvas, then inspect_preview.`,
      }
    }
  }
  if (isFadeOnlyPoster(source) || !hasFrameMotion(source) || isKenBurnsStillSlop(source)) {
    return {
      ok: false,
      check: 'motion',
      error:
        'Type is a static poster (fade or Ken Burns still). Use a kit dialect spring (KineticType / interpolate / spring), then patch_composition.',
    }
  }
  const hasImageAssets = project.assets.some((asset) => asset.kind === 'image')
  const usesDeviceOrImg = /<(?:DeviceFrame|Img)\b/.test(source)
  const bindsHostStills =
    /props\.(?:productUrl|logoUrl|heroSrc|logoSrc|plates)\b/.test(source) ||
    /src=\{props\./.test(source)
  if (hasImageAssets && usesDeviceOrImg && !bindsHostStills) {
    return {
      ok: false,
      check: 'picture',
      error:
        'Stills are on the project but DeviceFrame/Img is not bound to props.productUrl, props.logoUrl, or props.plates[i]. Patch the TSX to use those host props — do not wait for a new URL and do not generate_image again.',
    }
  }
  const layout = project.compositionSource?.artDirection?.layout
  if (layout === 'split-stat' && countUpValues(source).length === 0) {
    return {
      ok: false,
      check: 'hierarchy',
      error: 'split-stat needs a CountUp proof next to the headline. Add it and patch_composition.',
    }
  }
  if (!project.brand?.logoAssetId && !/Path C|BrandText/.test(source)) {
    return {
      ok: false,
      check: 'brand',
      error: 'Brand is missing. import_product_brand or add BrandText, then inspect again.',
    }
  }
  const catalog = catalogNumbersFromProject(project)
  const onScreen = authoredOnScreenText(source)
  const invented = [
    ...countUpValues(source),
    ...onScreen.flatMap((text) => numbersInText(text)),
  ].filter((value) => !catalog.includes(value))
  if (invented.length > 0) {
    return {
      ok: false,
      check: 'claims',
      error: `On-screen number ${invented.join(', ')} is not in Catalog/DNA. Bind it from the brief, then patch_composition.`,
    }
  }
  const forbidden = lintCampaignClaims(onScreen.join('\n'))
  if (!forbidden.ok) {
    const hit = forbidden.hits[0]
    return {
      ok: false,
      check: 'claims',
      error: `On-screen copy (${hit?.pattern ?? 'claim'}) is not in Catalog/DNA. ${hit?.suggestion ?? 'Patch the BrandText.'}`,
    }
  }
  if (!input?.sequel) {
    const fingerprint = motionFingerprint(project)
    if ((input?.recentFingerprints ?? []).includes(fingerprint)) {
      return {
        ok: false,
        check: 'variety',
        error:
          'This take matches a recent Final fingerprint. Pick another dialect or layout (list_motion_kit), then write_composition.',
      }
    }
  }
  const constitution = inspectConstitution(project, source)
  if (constitution) return constitution
  return { ok: true }
}
