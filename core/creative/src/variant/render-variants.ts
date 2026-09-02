import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExtractedBrief } from '../brief/extracted-brief'
import { parseExtractedBrief } from '../brief/extracted-brief'
import { loadProject } from '../project/load'
import { seedCurrentRevision } from '../project/history'
import type { StudioProjectRow } from '../project/load'
import type { StudioProject } from '../project/schema'
import { gateSpend, readCreativeBudgets } from '../pricing/limits'
import { recordCostEvent, sumCostEventsGbp } from '../pricing/ledger'
import { enqueueRenderJob, type RenderJobRow, type RenderTargets } from '../render/enqueue'
import { materializeVariantProject } from './materialize'
import {
  VARIANT_RENDER_GBP,
  buildVariantPlan,
  estimateVariantMatrixGbp,
  type CostedVariantPlan,
} from './plan'
import { resolveVariantCopy } from './resolve'
import {
  VARIANT_SOFT_CAP,
  parseVariantSpec,
  stampVariantSourceBranch,
  type AdPlatform,
  type VariantSpec,
} from './schema'

const sinceDaysAgoIso = (days: number): string =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

const briefFromParent = (project: StudioProject, fallback?: unknown): ExtractedBrief => {
  if (project.brief) return parseExtractedBrief(project.brief)
  if (fallback) return parseExtractedBrief(fallback)
  throw new Error('Parent project has no ExtractedBrief — apply a brief before planning variants')
}

export const planVariantsForParent = (input: {
  parent: StudioProject
  platforms: AdPlatform[]
  hookIndexes: number[]
  ctaIndexes: number[]
  locales?: string[]
  softCap?: number
  confirmSpend?: boolean
  briefJson?: unknown
}): CostedVariantPlan => {
  const brief = briefFromParent(input.parent, input.briefJson)
  const hooks = brief.messaging.hookCandidates
  const ctas = brief.messaging.ctaCandidates
  for (const index of input.hookIndexes) {
    if (index < 0 || index >= hooks.length) {
      throw new Error(`hookIndexes includes ${index} but brief has ${hooks.length} hooks`)
    }
  }
  for (const index of input.ctaIndexes) {
    if (index < 0 || index >= ctas.length) {
      throw new Error(`ctaIndexes includes ${index} but brief has ${ctas.length} CTAs`)
    }
  }
  // Plan defaults to create-only (£0 gated). exportEstimatedGbp still carries
  // Remotion export intent for UI confirm copy (enqueue via render_variants).
  return buildVariantPlan({
    platforms: input.platforms,
    hookIndexes: input.hookIndexes,
    ctaIndexes: input.ctaIndexes,
    locales: input.locales,
    softCap: input.softCap,
    confirmSpend: input.confirmSpend,
    includeRenders: false,
  })
}

export type RenderedVariantChild = {
  projectId: string
  label: string
  variantSpec: VariantSpec
  renderJobId?: string
}

export const createVariantChildProject = async (input: {
  supabase: SupabaseClient
  parentRow: StudioProjectRow
  parent: StudioProject
  spec: VariantSpec
  brief: ExtractedBrief
  modelProfileId: string
}): Promise<{ row: StudioProjectRow; project: StudioProject }> => {
  const childId = crypto.randomUUID()
  const project = materializeVariantProject({
    parent: input.parent,
    childId,
    spec: input.spec,
    brief: input.brief,
  })

  const { data, error } = await input.supabase
    .from('studio_projects')
    .insert({
      id: project.id,
      product_id: project.productId,
      composition_id: project.compositionId,
      status: project.status,
      model_profile_id: input.modelProfileId,
      project_json: project,
      revision: project.revision,
      history_tip: project.revision,
      parent_project_id: input.parent.id,
      variant_spec: input.spec,
    })
    .select('*')
    .single()

  if (error) {
    throw new Error(`Failed to create variant child: ${error.message}`)
  }

  const row = data as StudioProjectRow
  await seedCurrentRevision(input.supabase, row, project)
  return { row, project }
}

export const renderVariantsForParent = async (input: {
  supabase: SupabaseClient
  parentProjectId: string
  items: VariantSpec[]
  confirmSpend?: boolean
  enqueueRenders?: boolean
  renderTargets?: RenderTargets
  briefJson?: unknown
}): Promise<{
  plan: CostedVariantPlan
  children: RenderedVariantChild[]
  estimatedGbp: number
}> => {
  const { project: parent, row: parentRow } = await loadProject(
    input.supabase,
    input.parentProjectId,
  )
  if (parentRow.parent_project_id) {
    throw new Error('Cannot fan out variants from a child project — use the parent cut')
  }

  const brief = briefFromParent(parent, input.briefJson)
  const sourceBranchId = parentRow.active_branch_id ?? null
  const specs = input.items.map((item) =>
    stampVariantSourceBranch(parseVariantSpec(item), sourceBranchId),
  )
  if (specs.length === 0) {
    throw new Error('render_variants requires at least one VariantSpec')
  }

  // Fail closed before creating any children (avoid partial fan-out).
  for (const spec of specs) {
    resolveVariantCopy({ spec, brief })
  }

  const enqueueRenders = input.enqueueRenders !== false
  const createEstimatedGbp = 0
  const exportEstimatedGbp = estimateVariantMatrixGbp({
    variantCount: specs.length,
    includeRenders: true,
  })
  const estimatedGbp = enqueueRenders ? exportEstimatedGbp : createEstimatedGbp

  if (estimatedGbp > 0 && input.confirmSpend !== true) {
    throw new Error(
      `Estimated £${estimatedGbp.toFixed(2)} to export ${specs.length} versions needs confirmSpend=true`,
    )
  }
  if (specs.length > VARIANT_SOFT_CAP && input.confirmSpend !== true) {
    throw new Error(
      `${specs.length} versions exceeds soft cap ${VARIANT_SOFT_CAP} — pass confirmSpend=true`,
    )
  }

  if (enqueueRenders && process.env.STUDIO_RENDER_API === 'false') {
    throw new Error('Render API is disabled (STUDIO_RENDER_API=false)')
  }

  const budgets = readCreativeBudgets()
  const [spentThisMonthGbp, spentThisWeekGbp, spentThisProjectGbp] = await Promise.all([
    sumCostEventsGbp(input.supabase, {
      productId: parent.productId,
      sinceIso: sinceDaysAgoIso(31),
    }),
    sumCostEventsGbp(input.supabase, {
      productId: parent.productId,
      sinceIso: sinceDaysAgoIso(7),
    }),
    sumCostEventsGbp(input.supabase, {
      productId: parent.productId,
      projectId: parent.id,
      sinceIso: sinceDaysAgoIso(365),
    }),
  ])
  const gate = gateSpend({
    estimatedGbp,
    spentThisMonthGbp,
    spentThisWeekGbp,
    spentThisProjectGbp,
    budgets,
    requireConfirm: estimatedGbp > 0,
    confirmSpend: input.confirmSpend === true,
  })
  if (!gate.ok) {
    throw new Error(gate.error)
  }

  const children: RenderedVariantChild[] = []
  for (const spec of specs) {
    const { project } = await createVariantChildProject({
      supabase: input.supabase,
      parentRow,
      parent,
      spec,
      brief,
      modelProfileId: parentRow.model_profile_id,
    })
    let renderJob: RenderJobRow | undefined
    if (enqueueRenders) {
      renderJob = await enqueueRenderJob(input.supabase, project.id, {
        targets: input.renderTargets ?? 'mp4',
      })
      if (renderJob) {
        await recordCostEvent(input.supabase, {
          productId: parent.productId,
          projectId: project.id,
          jobId: renderJob.id,
          role: 'render',
          modelId: 'remotion',
          units: 1,
          estimatedGbp: VARIANT_RENDER_GBP,
        })
      }
    }
    children.push({
      projectId: project.id,
      label: spec.label,
      variantSpec: spec,
      renderJobId: renderJob?.id,
    })
  }

  const plan: CostedVariantPlan = {
    items: specs,
    requestedCount: specs.length,
    truncated: false,
    estimatedGbp,
    createEstimatedGbp,
    exportEstimatedGbp,
    warnings: enqueueRenders
      ? [
          `Enqueued ${children.length} ad versions (~£${exportEstimatedGbp.toFixed(2)} export estimate).`,
        ]
      : [
          `Created ${children.length} ad versions (free). Export later ~£${exportEstimatedGbp.toFixed(2)} if you render all of them.`,
        ],
  }

  return { plan, children, estimatedGbp }
}

export const listVariantChildren = async (
  supabase: SupabaseClient,
  parentProjectId: string,
): Promise<StudioProjectRow[]> => {
  const { data, error } = await supabase
    .from('studio_projects')
    .select('*')
    .eq('parent_project_id', parentProjectId)
    .order('created_at', { ascending: true })
  if (error) {
    throw new Error(`Failed to list variant children: ${error.message}`)
  }
  return (data as StudioProjectRow[]) ?? []
}
