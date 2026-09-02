/** Wave 2E / #196 — Approve blocks Final when project music is not cleared. */

import type { SupabaseClient } from '@supabase/supabase-js'
import { isMusicLicensePublishable, musicGenerationFromRow } from './schema'

export type MusicGateAsset = {
  id: string
  probe?: Record<string, unknown> | null
}

/**
 * Throws if any attached music bed lacks a cleared commercial license row.
 * Fail closed: `probe.role === 'music_bed'` without a publishable row also blocks.
 */
export const assertProjectMusicLicensesPublishable = async (
  supabase: SupabaseClient,
  projectId: string,
  projectAssets?: readonly MusicGateAsset[],
): Promise<void> => {
  const { data, error } = await supabase
    .from('music_generations')
    .select(
      'id, license_status, commercial_use_allowed, provider, product_id, project_id, generation_job_id, asset_id, prompt, model_id, duration_ms, force_instrumental, license_tier, license_notes, provider_song_id, input_snapshot, created_at, updated_at',
    )
    .eq('project_id', projectId)
  if (error) {
    throw new Error(`Failed to check music licenses: ${error.message}`)
  }
  const rows = (data ?? []).map((row) =>
    musicGenerationFromRow(row as Parameters<typeof musicGenerationFromRow>[0]),
  )
  const byAssetId = new Map(
    rows.filter((row) => row.assetId != null).map((row) => [row.assetId!, row]),
  )

  const attachedIds = new Set((projectAssets ?? []).map((asset) => asset.id))
  const relevantRows =
    projectAssets != null
      ? rows.filter((row) => row.assetId != null && attachedIds.has(row.assetId))
      : rows

  const blockers = relevantRows.filter((row) => !isMusicLicensePublishable(row))

  if (projectAssets) {
    for (const asset of projectAssets) {
      if (asset.probe?.role !== 'music_bed') continue
      const row = byAssetId.get(asset.id)
      if (!row || !isMusicLicensePublishable(row)) {
        blockers.push(
          row ??
            ({
              id: asset.id,
              licenseStatus: 'unknown',
              commercialUseAllowed: false,
            } as (typeof blockers)[number]),
        )
      }
    }
  }

  const unique = [...new Map(blockers.map((row) => [row.id, row])).values()]
  if (unique.length === 0) return

  const summary = unique
    .slice(0, 3)
    .map(
      (row) =>
        `${row.id.slice(0, 8)}… (${row.licenseStatus}${row.commercialUseAllowed ? '' : ', non-commercial'})`,
    )
    .join('; ')
  throw new Error(
    `Approve blocked: ${unique.length} music bed(s) lack a cleared commercial license. Replace mock/CI beds with live ElevenLabs generations, or remove them from the project. ${summary}`,
  )
}
