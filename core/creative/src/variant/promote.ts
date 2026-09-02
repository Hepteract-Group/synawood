import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { updateProjectBrand } from '../brand/brand-ops'
import { setEndCard, setHookTitle, trimClip } from '../project/operations'
import { loadProject } from '../project/load'
import { saveProject } from '../project/save'
import type { StudioProject } from '../project/schema'

export const promoteFieldSchema = z.enum(['hook', 'end_card', 'brand_cta', 'clip_trim'])
export type PromoteField = z.infer<typeof promoteFieldSchema>

export const PROMOTE_FIELD_LABELS: Record<PromoteField, string> = {
  hook: 'Opening line (hook)',
  end_card: 'End card CTA overlay',
  brand_cta: 'Brand default CTA',
  clip_trim: 'Shared clip timing (trim)',
}

/**
 * Copy selected fields from a variant child onto its parent.
 * Never replaces the whole parent project — only the chosen surfaces.
 */
export const applyPromoteFields = (input: {
  parent: StudioProject
  child: StudioProject
  fields: PromoteField[]
}): { project: StudioProject; applied: PromoteField[]; skipped: PromoteField[] } => {
  const fields = [...new Set(input.fields)]
  if (fields.length === 0) {
    throw new Error('Select at least one field to promote')
  }

  let project = input.parent
  const applied: PromoteField[] = []
  const skipped: PromoteField[] = []

  for (const field of fields) {
    if (field === 'hook') {
      const text = input.child.overlays.find((o) => o.kind === 'hook_title')?.text?.trim()
      if (!text) {
        skipped.push(field)
        continue
      }
      project = setHookTitle(project, text.slice(0, 120))
      applied.push(field)
      continue
    }

    if (field === 'end_card') {
      const text = input.child.overlays.find((o) => o.kind === 'end_card')?.text?.trim()
      if (!text) {
        skipped.push(field)
        continue
      }
      project = setEndCard(project, text.slice(0, 160))
      applied.push(field)
      continue
    }

    if (field === 'brand_cta') {
      const cta =
        input.child.brand?.defaultCta?.trim() ||
        input.child.overlays.find((o) => o.kind === 'end_card')?.text?.trim()
      if (!cta) {
        skipped.push(field)
        continue
      }
      project = updateProjectBrand(project, { defaultCta: cta.slice(0, 160) })
      applied.push(field)
      continue
    }

    if (field === 'clip_trim') {
      const { project: next, changed } = promoteSharedClipTrims(project, input.child)
      if (!changed) {
        skipped.push(field)
        continue
      }
      project = next
      applied.push(field)
    }
  }

  if (applied.length === 0) {
    throw new Error('Nothing to promote — selected fields are empty on this ad version')
  }

  return { project, applied, skipped }
}

/** Match parent clips to child clips by assetId; copy timing from the first child match. */
export const promoteSharedClipTrims = (
  parent: StudioProject,
  child: StudioProject,
): { project: StudioProject; changed: boolean } => {
  const childByAsset = new Map(child.clips.map((clip) => [clip.assetId, clip]))
  let next = parent
  let changed = false
  for (const clip of parent.clips) {
    const source = childByAsset.get(clip.assetId)
    if (!source) continue
    if (
      source.from === clip.from &&
      source.durationInFrames === clip.durationInFrames &&
      source.trim.startFrames === clip.trim.startFrames
    ) {
      continue
    }
    next = trimClip(next, clip.id, {
      from: source.from,
      durationInFrames: source.durationInFrames,
      trimStartFrames: source.trim.startFrames,
    })
    changed = true
  }
  return { project: next, changed }
}

export const promoteVariantFieldsToParent = async (input: {
  supabase: SupabaseClient
  parentProjectId: string
  childProjectId: string
  fields: PromoteField[]
  expectedRevision: number
}): Promise<{
  parent: StudioProject
  applied: PromoteField[]
  skipped: PromoteField[]
}> => {
  const childLoaded = await loadProject(input.supabase, input.childProjectId)
  if (childLoaded.row.parent_project_id !== input.parentProjectId) {
    throw new Error('Variant child does not belong to this parent project')
  }

  const parentLoaded = await loadProject(input.supabase, input.parentProjectId)
  if (parentLoaded.row.parent_project_id) {
    throw new Error('Can only promote into a parent (main) cut')
  }
  if (parentLoaded.project.revision !== input.expectedRevision) {
    throw new Error(
      `Project revision conflict: expected ${input.expectedRevision}, found ${parentLoaded.project.revision}`,
    )
  }

  const { project, applied, skipped } = applyPromoteFields({
    parent: parentLoaded.project,
    child: childLoaded.project,
    fields: input.fields,
  })

  const saved = await saveProject(input.supabase, project, input.expectedRevision)
  return { parent: saved.project, applied, skipped }
}
