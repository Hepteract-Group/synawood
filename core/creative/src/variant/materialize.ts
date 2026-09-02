import type { ExtractedBrief } from '../brief/extracted-brief'
import { switchProjectLocale } from '../locale/resolve'
import { setEndCard, setHookTitle } from '../project/operations'
import { parseStudioProject, type StudioProject } from '../project/schema'
import { dimensionsForAspect } from './plan'
import { resolveVariantCopy } from './resolve'
import type { VariantSpec } from './schema'

/**
 * Pure: fork parent project JSON into a child cut for one VariantSpec.
 * Keeps the same asset ids + blobKeys (ADR-0027 shared media).
 */
export const materializeVariantProject = (input: {
  parent: StudioProject
  childId: string
  spec: VariantSpec
  brief: ExtractedBrief
}): StudioProject => {
  const { hookText, ctaText } = resolveVariantCopy({
    spec: input.spec,
    brief: input.brief,
  })
  const dims = dimensionsForAspect(input.spec.aspect)
  const baseName = input.parent.name?.trim() || 'Ad'
  const named = `${baseName} · ${input.spec.label}`.slice(0, 80)

  let child = parseStudioProject({
    ...input.parent,
    id: input.childId,
    productId: input.parent.productId,
    compositionId: dims.compositionId,
    width: dims.width,
    height: dims.height,
    status: 'drafting',
    revision: 1,
    name: named,
    // Shared asset refs — same ids + blobKeys; assets table rows stay on parent.
    assets: input.parent.assets.map((asset) => ({ ...asset })),
    clips: input.parent.clips.map((clip) => ({ ...clip })),
    tracks: input.parent.tracks.map((track) => ({ ...track })),
    overlays: input.parent.overlays.map((overlay) => ({ ...overlay })),
    brand: input.parent.brand ? { ...input.parent.brand } : undefined,
    brief: input.brief,
  })

  child = setHookTitle(child, hookText.slice(0, 120))
  child = setEndCard(child, ctaText.slice(0, 160))
  if (input.spec.locale) {
    child = switchProjectLocale(child, input.spec.locale)
  }
  return parseStudioProject({ ...child, revision: 1 })
}
