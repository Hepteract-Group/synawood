/** Apply pack_revocations to product installs (#294). */

import type { SupabaseClient } from '@supabase/supabase-js'
import { mapPackRevocationRow, type PackRevocation } from './schema'

export type RevocationSyncResult = {
  applied: PackRevocation[]
  disabledInstallIds: string[]
  cursor: string | null
}

/**
 * Disable installs for any revoked versions newer than `sinceIso` (or all if omitted).
 * Returns a cursor (`revoked_at` of last applied event) for incremental sync.
 */
export const syncPackRevocations = async (
  supabase: SupabaseClient,
  input: { productId: string; sinceIso?: string | null },
): Promise<RevocationSyncResult> => {
  let query = supabase.from('pack_revocations').select('*').order('revoked_at', { ascending: true })
  if (input.sinceIso) {
    query = query.gt('revoked_at', input.sinceIso)
  }
  const { data: rows, error } = await query
  if (error) throw new Error(`List pack revocations failed: ${error.message}`)
  const applied = (rows ?? []).map((row) => mapPackRevocationRow(row))
  if (!applied.length) {
    return { applied: [], disabledInstallIds: [], cursor: input.sinceIso ?? null }
  }

  const versionIds = [...new Set(applied.map((row) => row.packVersionId))]
  const disabledAt = new Date().toISOString()
  const { data: updated, error: updateError } = await supabase
    .from('pack_installs')
    .update({ enabled: false, disabled_at: disabledAt })
    .eq('product_id', input.productId)
    .in('pack_version_id', versionIds)
    .eq('enabled', true)
    .select('id')
  if (updateError) throw new Error(`Disable revoked installs failed: ${updateError.message}`)

  const cursor = applied[applied.length - 1]?.revokedAt ?? input.sinceIso ?? null
  return {
    applied,
    disabledInstallIds: (updated ?? []).map((row) => row.id as string),
    cursor,
  }
}

export const listActiveRevocationsForProduct = async (
  supabase: SupabaseClient,
  productId: string,
): Promise<PackRevocation[]> => {
  const { data: installs, error } = await supabase
    .from('pack_installs')
    .select('pack_version_id')
    .eq('product_id', productId)
  if (error) throw new Error(`List installs for revocation banner failed: ${error.message}`)
  const versionIds = [...new Set((installs ?? []).map((row) => row.pack_version_id as string))]
  if (!versionIds.length) return []

  const { data: rows, error: revError } = await supabase
    .from('pack_revocations')
    .select('*')
    .in('pack_version_id', versionIds)
    .order('revoked_at', { ascending: false })
  if (revError) throw new Error(`List pack revocations failed: ${revError.message}`)
  return (rows ?? []).map((row) => mapPackRevocationRow(row))
}
