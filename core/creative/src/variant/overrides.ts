import type { SupabaseClient } from '@supabase/supabase-js'
import { setEndCard, setHookTitle } from '../project/operations'
import { loadProject } from '../project/load'
import { saveProject } from '../project/save'
import { parseVariantSpec, type VariantSpec } from './schema'

/**
 * Update hook/CTA on a variant child only (ADR-0027 F6 overrides).
 * Also mirrors overrides onto variant_spec for plan fidelity.
 */
export const saveVariantChildOverrides = async (input: {
  supabase: SupabaseClient
  parentProjectId: string
  childProjectId: string
  hookText: string
  ctaText: string
  expectedRevision: number
}): Promise<{ projectId: string; revision: number; variantSpec: VariantSpec }> => {
  const hookText = input.hookText.trim()
  const ctaText = input.ctaText.trim()
  if (!hookText) throw new Error('hookText is required')
  if (!ctaText) throw new Error('ctaText is required')

  const { project, row } = await loadProject(input.supabase, input.childProjectId)
  if (row.parent_project_id !== input.parentProjectId) {
    throw new Error('Variant child does not belong to this parent project')
  }
  if (project.revision !== input.expectedRevision) {
    throw new Error(
      `Project revision conflict: expected ${input.expectedRevision}, found ${project.revision}`,
    )
  }

  const previousSpec = parseVariantSpec(row.variant_spec)
  const nextSpec = parseVariantSpec({
    ...previousSpec,
    hookIndex: -1,
    ctaIndex: -1,
    hookOverride: hookText,
    ctaOverride: ctaText,
    label: previousSpec.label,
  })

  let next = setHookTitle(project, hookText.slice(0, 120))
  next = setEndCard(next, ctaText.slice(0, 160))
  const saved = await saveProject(input.supabase, next, input.expectedRevision)

  const { error } = await input.supabase
    .from('studio_projects')
    .update({
      variant_spec: nextSpec,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.childProjectId)

  if (error) {
    throw new Error(`Failed to update variant_spec: ${error.message}`)
  }

  return {
    projectId: saved.project.id,
    revision: saved.project.revision,
    variantSpec: nextSpec,
  }
}
