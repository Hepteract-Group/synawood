import type { SupabaseClient } from '@supabase/supabase-js'
import { parseExtractedBrief, type BrandCandidates, type ExtractedBrief } from './extracted-brief'

export type ReadyBriefBrandPatch = Partial<
  Pick<
    BrandCandidates,
    | 'logoAssetId'
    | 'stillAssetIds'
    | 'primaryColor'
    | 'accentColor'
    | 'displayName'
    | 'defaultCta'
    | 'fontFamily'
  >
> & {
  clearLogo?: boolean
}

/** Pure merge used when Brand Studio corrections must update the ready brief before Apply. */
export const mergeReadyBriefBrandPatch = (
  brief: ExtractedBrief,
  patch: ReadyBriefBrandPatch,
): ExtractedBrief => {
  const { clearLogo, ...fields } = patch
  const brandCandidates: BrandCandidates = {
    ...brief.brandCandidates,
    ...Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)),
  }
  if (clearLogo) {
    const { logoAssetId: _removed, ...rest } = brandCandidates
    return { ...brief, brandCandidates: { ...rest, stillAssetIds: rest.stillAssetIds ?? [] } }
  }
  return { ...brief, brandCandidates }
}

/**
 * If a ready (unapplied) extract brief exists, patch its brandCandidates.
 * Returns null when there is nothing to update.
 */
export const patchReadyBriefBrandCandidates = async (
  supabase: SupabaseClient,
  projectId: string,
  patch: ReadyBriefBrandPatch,
): Promise<{ briefId: string } | null> => {
  const { data: row, error } = await supabase
    .from('extracted_briefs')
    .select('id, brief_json, status')
    .eq('project_id', projectId)
    .eq('status', 'ready')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load ready brief: ${error.message}`)
  }
  if (!row?.brief_json) return null

  const next = mergeReadyBriefBrandPatch(parseExtractedBrief(row.brief_json), patch)
  const { error: updateError } = await supabase
    .from('extracted_briefs')
    .update({
      brief_json: next,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)
    .eq('project_id', projectId)
    .eq('status', 'ready')

  if (updateError) {
    throw new Error(`Failed to sync brief brand: ${updateError.message}`)
  }
  return { briefId: row.id as string }
}
