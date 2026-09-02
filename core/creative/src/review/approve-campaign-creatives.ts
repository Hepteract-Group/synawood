/** Multi-Final Approve for Campaign Pack creatives (#114). */

import type { SupabaseClient } from '@supabase/supabase-js'
import { recordBillingEventOnceBestEffort } from '../billing/events'
import { emptyCreativeStructure } from '../intent/creative-structure'
import type { BlobEnv } from '../persistence/blob'
import type { StudioProject } from '../project/schema'
import { isCampaignPackComposition, parseStudioProject } from '../project/schema'
import { saveProject } from '../project/save'
import {
  buildFinalAttribution,
  retainFinalBlobs,
  type FinalAssetRow,
  type FinalAttribution,
} from './review'

export type CampaignFinalAttribution = FinalAttribution & {
  creative_id: string
  headline?: string
}

const loadAssetRows = async (
  supabase: SupabaseClient,
  assetIds: string[],
): Promise<
  Array<{
    id: string
    product_id: string
    project_id: string | null
    kind: string
    source: string
    blob_key: string
    content_type: string | null
    probe: Record<string, unknown>
  }>
> => {
  if (assetIds.length === 0) return []
  const { data, error } = await supabase.from('assets').select('*').in('id', assetIds)
  if (error) throw new Error(`Failed to load assets: ${error.message}`)
  const rows = data ?? []
  const byId = new Map(rows.map((row) => [row.id as string, row]))
  return assetIds.map((id) => {
    const row = byId.get(id)
    if (!row) throw new Error(`Asset missing: ${id}`)
    return row as {
      id: string
      product_id: string
      project_id: string | null
      kind: string
      source: string
      blob_key: string
      content_type: string | null
      probe: Record<string, unknown>
    }
  })
}

const findExistingCreativeFinal = async (
  supabase: SupabaseClient,
  projectId: string,
  creativeId: string,
): Promise<FinalAssetRow | null> => {
  const { data, error } = await supabase
    .from('final_assets')
    .select('*')
    .eq('project_id', projectId)
    .filter('attribution->>creative_id', 'eq', creativeId)
    .maybeSingle()
  if (error) {
    // Older DBs without filter support — fall through to create.
    return null
  }
  return (data as FinalAssetRow | null) ?? null
}

const ensurePublishRecord = async (
  supabase: SupabaseClient,
  input: {
    productId: string
    finalAssetId: string
    channel: string
  },
): Promise<{ id: string; created: boolean }> => {
  const { data: existing } = await supabase
    .from('publish_records')
    .select('id')
    .eq('final_asset_id', input.finalAssetId)
    .eq('channel', input.channel)
    .maybeSingle()
  if (existing?.id) {
    return { id: existing.id as string, created: false }
  }
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const { error } = await supabase.from('publish_records').insert({
    id,
    product_id: input.productId,
    final_asset_id: input.finalAssetId,
    channel: input.channel,
    status: 'ready',
    status_history: [{ status: 'ready', at: now, note: 'Campaign creative Approve' }],
    created_at: now,
    updated_at: now,
  })
  if (error) {
    throw new Error(`Failed to create publish_record: ${error.message}`)
  }
  return { id, created: true }
}

export const approveCampaignCreatives = async (
  supabase: SupabaseClient,
  blobEnv: BlobEnv,
  project: StudioProject,
  expectedRevision: number,
  input: {
    creativeIds: string[]
    /** Default channel for Phase 0–1 manual post path. */
    channel?: string
  },
): Promise<{
  project: StudioProject
  finals: Array<{
    creativeId: string
    finalAsset: FinalAssetRow
    publishRecordId: string
    alreadyApproved: boolean
  }>
}> => {
  if (!isCampaignPackComposition(project.compositionId) || !project.campaignPack) {
    throw new Error('Multi-Final Approve requires a Campaign Pack project.')
  }
  if (project.status === 'killed') {
    throw new Error('Cannot approve a killed project.')
  }
  const ids = [...new Set(input.creativeIds)]
  if (ids.length === 0) {
    throw new Error('Select at least one creative to Approve.')
  }
  const channel = input.channel ?? 'instagram'
  const finals: Array<{
    creativeId: string
    finalAsset: FinalAssetRow
    publishRecordId: string
    alreadyApproved: boolean
  }> = []

  for (const creativeId of ids) {
    const creative = project.campaignPack.creatives.find((row) => row.id === creativeId)
    if (!creative) {
      throw new Error(`Unknown creative ${creativeId}`)
    }
    const sourceAssetId = creative.motionAssetId ?? creative.backgroundAssetId
    if (!sourceAssetId) {
      throw new Error(`Creative ${creativeId} needs a still or motion asset before Approve.`)
    }

    const existing = await findExistingCreativeFinal(supabase, project.id, creativeId)
    if (existing) {
      const publish = await ensurePublishRecord(supabase, {
        productId: project.productId,
        finalAssetId: existing.id,
        channel,
      })
      finals.push({
        creativeId,
        finalAsset: existing,
        publishRecordId: publish.id,
        alreadyApproved: true,
      })
      continue
    }

    const sourceAssets = await loadAssetRows(supabase, [sourceAssetId])
    const finalAssetId = crypto.randomUUID()
    const retained = await retainFinalBlobs({
      supabase,
      blobEnv,
      productId: project.productId,
      projectId: project.id,
      finalAssetId,
      sourceAssets,
    })
    const attribution: CampaignFinalAttribution = {
      ...buildFinalAttribution({
        extractedBriefId: project.brief?.id,
      }),
      creative_id: creativeId,
      headline: creative.headline || undefined,
    }
    const { data, error } = await supabase
      .from('final_assets')
      .insert({
        id: finalAssetId,
        product_id: project.productId,
        project_id: project.id,
        render_job_id: null,
        primary_asset_id: retained.primaryAssetId,
        members: retained.members,
        attribution,
        creative_structure: project.creativeStructure ?? emptyCreativeStructure(),
      })
      .select('*')
      .single()
    if (error) {
      throw new Error(`Failed to retain Final for ${creativeId}: ${error.message}`)
    }
    const finalAsset = data as FinalAssetRow
    const publish = await ensurePublishRecord(supabase, {
      productId: project.productId,
      finalAssetId: finalAsset.id,
      channel,
    })
    finals.push({
      creativeId,
      finalAsset,
      publishRecordId: publish.id,
      alreadyApproved: false,
    })
  }

  const { project: saved } = await saveProject(
    supabase,
    parseStudioProject({ ...project, status: 'approved' }),
    expectedRevision,
  )

  const primaryFinal =
    finals.find((row) => !row.alreadyApproved)?.finalAsset ?? finals[0]?.finalAsset
  if (primaryFinal) {
    await recordBillingEventOnceBestEffort(supabase, {
      productId: project.productId,
      name: 'first_approve',
      payload: { projectId: project.id, finalAssetId: primaryFinal.id },
    })
  }

  return { project: saved, finals }
}
