import type { SupabaseClient } from '@supabase/supabase-js'
import { recordBillingEventOnceBestEffort } from '../billing/events'
import { loadHostedSpendContext } from '../billing/load-hosted-spend-context'
import { planWantsTrialWatermark } from '../billing/trial-watermark'
import { getBlobBytes, putBlob, type BlobEnv } from '../persistence/blob'
import type { StudioProject, ProjectAsset } from '../project/schema'
import { parseStudioProject } from '../project/schema'
import { attachAsset } from '../project/operations'
import { saveProject } from '../project/save'
import { assertProjectMusicLicensesPublishable } from '../music/license-gate'
import { assertStylePackPublishable } from '../effects/license-gate'
import { assertProjectLibraryLicensesPublishable } from '../library/license'
import { assertTreatmentsPublishable } from '../effects/treatments'
import { assertVoiceProvenancePublishable } from '../voice/provenance-gate'
import { emptyCreativeStructure, type CreativeStructure } from '../intent/creative-structure'
import type { RenderJobRow } from '../render/enqueue'
import { motionFingerprint as computeMotionFingerprint } from '../critic/inspect-authored'
import { cutReviewRequired, hasFreshCutReview } from '../critic/inspect-preview'
import { isAuthoredComposition } from '../project/schema'
import { variantSpecSchema, type VariantSpec } from '../variant/schema'

export type ReviewAction = 'approve' | 'kill' | 'regenerate'

export type FinalAssetMember = {
  assetId: string
  kind: string
  blobKey: string
  role: string
  sourceAssetId: string
}

/** Stored on final_assets.attribution (ADR-0027) for Learning / Performance. */
export type FinalAttribution = {
  parent_project_id?: string
  variant_spec?: VariantSpec
  extracted_brief_id?: string
  /** True when Approve happened under a watermarking plan (#1046). */
  trial_export?: boolean
  /** Authored motion fingerprint for variety policy (#1192). */
  motion_fingerprint?: string
}

export type FinalAssetRow = {
  id: string
  product_id: string
  project_id: string
  render_job_id: string | null
  primary_asset_id: string
  members: FinalAssetMember[]
  attribution?: FinalAttribution
  creative_structure?: CreativeStructure
  thumbnail_asset_id?: string | null
  created_at: string
}

export type ApproveAttributionContext = {
  /** From studio_projects.parent_project_id when this cut is a variant child. */
  parentProjectId?: string | null
  /** From studio_projects.variant_spec. */
  variantSpec?: unknown
}

/**
 * Build Final attribution JSON. Empty object for ordinary (non-variant) Approves
 * without a brief. Never invents ids — only copies what the project already carries.
 */
export const buildFinalAttribution = (input: {
  parentProjectId?: string | null
  variantSpec?: unknown
  extractedBriefId?: string | null
  trialExport?: boolean
  motionFingerprint?: string | null
}): FinalAttribution => {
  const attribution: FinalAttribution = {}
  if (input.parentProjectId) {
    attribution.parent_project_id = input.parentProjectId
  }
  if (input.variantSpec != null) {
    const parsed = variantSpecSchema.safeParse(input.variantSpec)
    if (parsed.success) {
      attribution.variant_spec = parsed.data
    }
  }
  if (input.extractedBriefId) {
    attribution.extracted_brief_id = input.extractedBriefId
  }
  if (input.trialExport) {
    attribution.trial_export = true
  }
  if (input.motionFingerprint) {
    attribution.motion_fingerprint = input.motionFingerprint
  }
  return attribution
}

type AssetRow = {
  id: string
  product_id: string
  project_id: string | null
  kind: string
  source: string
  blob_key: string
  content_type: string | null
  probe: Record<string, unknown>
}

/** Latest completed render job for a project (the reviewable candidate), if any. */
export const latestCompletedRender = async (
  supabase: SupabaseClient,
  projectId: string,
): Promise<RenderJobRow | null> => {
  const { data, error } = await supabase
    .from('render_jobs')
    .select('*')
    .eq('project_id', projectId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    throw new Error(`Failed to load render jobs: ${error.message}`)
  }
  return (data as RenderJobRow | null) ?? null
}

const projectKindFromMember = (kind: string): ProjectAsset['kind'] =>
  kind === 'video' || kind === 'image' || kind === 'audio' ? kind : 'other'

const approvedAssetName = (kind: string): string => {
  if (kind === 'video') return 'Approved export'
  if (kind === 'image') return 'Approved still'
  if (kind === 'audio') return 'Approved audio'
  return 'Approved file'
}

/** Put retained Final members on `project.assets` so they appear in the Media bin (#1273). */
export const attachFinalMembersToProject = (
  project: StudioProject,
  members: FinalAssetMember[],
): StudioProject => {
  let next = project
  for (const member of members) {
    if (next.assets.some((asset) => asset.id === member.assetId)) continue
    next = attachAsset(next, {
      id: member.assetId,
      kind: projectKindFromMember(member.kind),
      blobKey: member.blobKey,
      source: 'generator',
      probe: {
        role: member.role,
        name: approvedAssetName(member.kind),
      },
    })
  }
  return next
}

const setStatus = (project: StudioProject, status: StudioProject['status']): StudioProject =>
  parseStudioProject({ ...project, status })

const loadAssetRows = async (supabase: SupabaseClient, assetIds: string[]): Promise<AssetRow[]> => {
  if (assetIds.length === 0) return []
  const { data, error } = await supabase.from('assets').select('*').in('id', assetIds)
  if (error) {
    throw new Error(`Failed to load render assets: ${error.message}`)
  }
  const rows = (data as AssetRow[] | null) ?? []
  const byId = new Map(rows.map((row) => [row.id, row]))
  return assetIds.map((id) => {
    const row = byId.get(id)
    if (!row) throw new Error(`Render output asset missing: ${id}`)
    return row
  })
}

const fileNameFor = (blobKey: string, index: number): string => {
  const base = blobKey.split('/').filter(Boolean).pop()
  return base && base.length > 0 ? base : `part-${index}`
}

/**
 * Copy render outputs into an immutable `finals/` Blob prefix and insert asset rows
 * that point at the retained copies (render blobs stay untouched).
 */
export const retainFinalBlobs = async (input: {
  supabase: SupabaseClient
  blobEnv: BlobEnv
  productId: string
  projectId: string
  finalAssetId: string
  sourceAssets: AssetRow[]
}): Promise<{ primaryAssetId: string; members: FinalAssetMember[] }> => {
  const members: FinalAssetMember[] = []

  for (const [index, source] of input.sourceAssets.entries()) {
    const fileName = fileNameFor(source.blob_key, index)
    const bytes = await getBlobBytes({ blobEnv: input.blobEnv, blobKey: source.blob_key })
    const { blobKey } = await putBlob({
      blobEnv: input.blobEnv,
      productId: input.productId,
      kind: 'finals',
      parts: [input.projectId, input.finalAssetId, fileName],
      data: bytes,
      contentType: source.content_type ?? undefined,
    })

    const retainedId = crypto.randomUUID()
    const role =
      index === 0
        ? 'final_primary'
        : typeof source.probe?.role === 'string'
          ? `final_${source.probe.role}`
          : `final_member_${index}`

    const { error } = await input.supabase.from('assets').insert({
      id: retainedId,
      product_id: input.productId,
      project_id: input.projectId,
      kind: source.kind,
      source:
        source.source === 'upload' || source.source === 'brand_kit' ? source.source : 'generator',
      blob_key: blobKey,
      content_type: source.content_type,
      probe: {
        ...source.probe,
        role,
        name: approvedAssetName(source.kind),
        retainedFromAssetId: source.id,
        retainedFromBlobKey: source.blob_key,
        finalAssetId: input.finalAssetId,
      },
    })
    if (error) {
      throw new Error(`Failed to persist retained Final asset row: ${error.message}`)
    }

    members.push({
      assetId: retainedId,
      kind: source.kind,
      blobKey,
      role,
      sourceAssetId: source.id,
    })
  }

  const primary = members[0]
  if (!primary) {
    throw new Error('Completed render has no output asset to retain as Final.')
  }
  return { primaryAssetId: primary.assetId, members }
}

/**
 * Approve the current candidate: requires a completed render, retains the Final
 * asset (idempotent on project+render), and marks the project approved.
 * Per review-gates: never approve a preview-only project.
 *
 * Variant children Approves independently (ADR-0027): this never cascades to
 * siblings or the parent. Attribution metadata is written onto the Final row.
 */
export const approveProject = async (
  supabase: SupabaseClient,
  blobEnv: BlobEnv,
  project: StudioProject,
  expectedRevision: number,
  attributionContext: ApproveAttributionContext = {},
): Promise<{ project: StudioProject; finalAsset: FinalAssetRow; alreadyApproved: boolean }> => {
  if (project.status === 'killed') {
    throw new Error('Cannot approve a killed project.')
  }
  if (cutReviewRequired(project) && !hasFreshCutReview(project)) {
    throw new Error(
      'Approve requires a passing cut review on the current cut. Inspect the player first.',
    )
  }
  const render = await latestCompletedRender(supabase, project.id)
  if (!render) {
    throw new Error(
      'Approve requires a completed render. Export first, then approve the candidate.',
    )
  }
  if (!render.output_asset_ids[0]) {
    throw new Error('Completed render has no output asset to retain as Final.')
  }

  await assertProjectMusicLicensesPublishable(
    supabase,
    project.id,
    project.assets.map((asset) => ({ id: asset.id, probe: asset.probe })),
  )
  await assertProjectLibraryLicensesPublishable(supabase, project.productId, project)
  assertStylePackPublishable(project.stylePackId)
  assertVoiceProvenancePublishable(project)
  for (const clip of project.clips) {
    assertTreatmentsPublishable(clip.treatments)
  }

  const spendCtx = await loadHostedSpendContext(supabase, { productId: project.productId })
  const attribution = buildFinalAttribution({
    parentProjectId: attributionContext.parentProjectId,
    variantSpec: attributionContext.variantSpec,
    extractedBriefId: project.brief?.id,
    trialExport: planWantsTrialWatermark(spendCtx.planId),
    motionFingerprint: isAuthoredComposition(project.compositionId)
      ? computeMotionFingerprint(project)
      : undefined,
  })

  // Idempotent: final_assets has unique(project_id, render_job_id).
  const { data: existing } = await supabase
    .from('final_assets')
    .select('*')
    .eq('project_id', project.id)
    .eq('render_job_id', render.id)
    .maybeSingle()

  let finalAsset = existing as FinalAssetRow | null
  let alreadyApproved = false
  let membersToAttach: FinalAssetMember[] = finalAsset?.members ?? []
  if (finalAsset) {
    alreadyApproved = true
  } else {
    const sourceAssets = await loadAssetRows(supabase, render.output_asset_ids)
    const finalAssetId = crypto.randomUUID()
    const retained = await retainFinalBlobs({
      supabase,
      blobEnv,
      productId: project.productId,
      projectId: project.id,
      finalAssetId,
      sourceAssets,
    })
    membersToAttach = retained.members

    const { data, error } = await supabase
      .from('final_assets')
      .insert({
        id: finalAssetId,
        product_id: project.productId,
        project_id: project.id,
        render_job_id: render.id,
        primary_asset_id: retained.primaryAssetId,
        members: retained.members,
        attribution,
        creative_structure: project.creativeStructure ?? emptyCreativeStructure(),
        thumbnail_asset_id: project.thumbnailAssetId ?? null,
      })
      .select('*')
      .single()
    if (error) {
      // Unique violation → a concurrent approve already created it; treat as idempotent.
      if (error.code === '23505') {
        const { data: again } = await supabase
          .from('final_assets')
          .select('*')
          .eq('project_id', project.id)
          .eq('render_job_id', render.id)
          .single()
        finalAsset = again as FinalAssetRow
        alreadyApproved = true
        if (finalAsset?.members?.length) membersToAttach = finalAsset.members
      } else {
        throw new Error(`Failed to retain Final asset: ${error.message}`)
      }
    } else {
      finalAsset = data as FinalAssetRow
    }
  }

  const nextProject = attachFinalMembersToProject(project, membersToAttach)

  const { project: saved } = await saveProject(
    supabase,
    setStatus(nextProject, 'approved'),
    expectedRevision,
  )

  await recordBillingEventOnceBestEffort(supabase, {
    productId: project.productId,
    name: 'first_approve',
    payload: { projectId: project.id, finalAssetId: finalAsset!.id },
  })

  return { project: saved, finalAsset: finalAsset!, alreadyApproved }
}

/** Kill the candidate: allowed at any time; project is marked killed and cannot be published. */
export const killProject = async (
  supabase: SupabaseClient,
  project: StudioProject,
  expectedRevision: number,
): Promise<StudioProject> => {
  const { project: saved } = await saveProject(
    supabase,
    setStatus(project, 'killed'),
    expectedRevision,
  )
  return saved
}

/**
 * Regenerate: return the project to drafting so the founder can re-cut or
 * re-export. The prior Final (if any) is retained as immutable history.
 */
export const regenerateProject = async (
  supabase: SupabaseClient,
  project: StudioProject,
  expectedRevision: number,
): Promise<StudioProject> => {
  const { project: saved } = await saveProject(
    supabase,
    setStatus(project, 'drafting'),
    expectedRevision,
  )
  return saved
}
