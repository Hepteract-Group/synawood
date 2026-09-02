import type { SupabaseClient } from '@supabase/supabase-js'
import type { FinalAttribution } from '../review/review'

export type FinalAttributionRow = {
  attribution?: FinalAttribution | null
}

export const artDirectionPair = (fingerprint: string): string =>
  fingerprint.split('|').slice(0, 2).join('|')

export const fingerprintsFromFinals = (rows: ReadonlyArray<FinalAttributionRow>): string[] =>
  rows
    .map((row) => row.attribution?.motion_fingerprint)
    .filter((fp): fp is string => typeof fp === 'string' && fp.length > 0)

export const fetchRecentMotionFingerprints = async (
  supabase: SupabaseClient,
  productId: string,
  limit = 5,
): Promise<string[]> => {
  const { data, error } = await supabase
    .from('final_assets')
    .select('attribution')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(Math.max(limit * 4, 20))
  if (error) return []
  return fingerprintsFromFinals((data ?? []) as FinalAttributionRow[]).slice(0, limit)
}
