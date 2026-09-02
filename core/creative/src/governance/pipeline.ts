/** Multi-stage Approve pipeline (#315 / #319 / #320). */

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadChatState, saveChatMessages } from '../agent/chat-store'
import type { ChatMessage } from '../agent/types'
import type { BlobEnv } from '../persistence/blob'
import type { StudioProject } from '../project/schema'
import { parseStudioProject } from '../project/schema'
import { saveProject } from '../project/save'
import {
  approveProject,
  type ApproveAttributionContext,
  type FinalAssetRow,
} from '../review/review'
import { scanProjectClaims } from './claim-scanner'
import { withGovernanceDisclaimer } from './disclaimer'
import { assertOwnerCanOverride, assertReadyForFinal, assertRejectReason } from './gates'
import { loadGovernancePolicy } from './policy-loader'
import {
  mapApprovalEventRow,
  mapApprovalRunRow,
  roleMeetsMinimum,
  type ApprovalEvent,
  type ApprovalRun,
  type ClaimScanResult,
  type GovernancePolicy,
  type ProductRoleName,
} from './schema'

const findOpenRun = async (
  supabase: SupabaseClient,
  projectId: string,
): Promise<ApprovalRun | null> => {
  const { data, error } = await supabase
    .from('approval_runs')
    .select('*')
    .eq('project_id', projectId)
    .eq('status', 'open')
    .maybeSingle()
  if (error) throw new Error(`Failed to load approval run: ${error.message}`)
  return data ? mapApprovalRunRow(data as Record<string, unknown>) : null
}

const insertEvent = async (
  supabase: SupabaseClient,
  input: {
    runId: string
    stageKey: string
    stageIndex: number
    action: 'submit' | 'sign_off' | 'reject' | 'override' | 'claim_scan'
    actorUserId: string | null
    actorRole: string | null
    reason?: string
    detail?: Record<string, unknown>
  },
): Promise<ApprovalEvent> => {
  const { data, error } = await supabase
    .from('approval_events')
    .insert({
      run_id: input.runId,
      stage_key: input.stageKey,
      stage_index: input.stageIndex,
      action: input.action,
      actor_user_id: input.actorUserId,
      actor_role: input.actorRole,
      reason: input.reason ?? '',
      detail: input.detail ?? {},
    })
    .select('*')
    .single()
  if (error) throw new Error(`Failed to insert approval event: ${error.message}`)
  return mapApprovalEventRow(data as Record<string, unknown>)
}

export const listOpenApprovalRuns = async (
  supabase: SupabaseClient,
  productId: string,
): Promise<ApprovalRun[]> => {
  const { data, error } = await supabase
    .from('approval_runs')
    .select('*')
    .eq('product_id', productId)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
  if (error) throw new Error(`Failed to list approval runs: ${error.message}`)
  return (data ?? []).map((row) => mapApprovalRunRow(row as Record<string, unknown>))
}

export const listApprovalEvents = async (
  supabase: SupabaseClient,
  runId: string,
): Promise<ApprovalEvent[]> => {
  const { data, error } = await supabase
    .from('approval_events')
    .select('*')
    .eq('run_id', runId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(`Failed to list approval events: ${error.message}`)
  return (data ?? []).map((row) => mapApprovalEventRow(row as Record<string, unknown>))
}

export const getOpenApprovalRunForProject = findOpenRun

const resolveDisclaimer = (
  policy: GovernancePolicy,
  project: StudioProject,
): { text: string | null; required: boolean } => {
  const required = policy.body.disclaimer.required
  const text = project.governanceDisclaimer?.trim() || policy.body.disclaimer.text.trim() || null
  return { text, required }
}

export type GovernancePreview = {
  policy: GovernancePolicy | null
  run: ApprovalRun | null
  claimScan: ClaimScanResult | null
  disclaimerRequired: boolean
  disclaimerText: string | null
  canSignOff: boolean
  canOverride: boolean
}

export const previewGovernance = async (
  supabase: SupabaseClient,
  input: {
    project: StudioProject
    actorRole: ProductRoleName
    repoRoot?: string
  },
): Promise<GovernancePreview> => {
  const policy = await loadGovernancePolicy(supabase, {
    productId: input.project.productId,
    repoRoot: input.repoRoot,
  })
  const run = await findOpenRun(supabase, input.project.id)
  if (!policy) {
    return {
      policy: null,
      run,
      claimScan: null,
      disclaimerRequired: false,
      disclaimerText: null,
      canSignOff: true,
      canOverride: input.actorRole === 'owner',
    }
  }
  const claimScan = scanProjectClaims(input.project, policy.body)
  const disclaimer = resolveDisclaimer(policy, input.project)
  const stage = run?.stages[run.currentStageIndex] ?? policy.body.stages[0]
  const canSignOff = stage ? roleMeetsMinimum(input.actorRole, stage.minRole) : false
  return {
    policy,
    run,
    claimScan,
    disclaimerRequired: disclaimer.required,
    disclaimerText: disclaimer.text,
    canSignOff,
    canOverride: input.actorRole === 'owner',
  }
}

/**
 * Disclaimer is applied at composition resolve time from the active policy /
 * open approval run — not stored as a strict project JSON field.
 */

export type SignOffResult = {
  run: ApprovalRun
  project: StudioProject
  finalAsset?: FinalAssetRow
  alreadyApproved?: boolean
  completed: boolean
}

const finalizeIfComplete = async (input: {
  supabase: SupabaseClient
  blobEnv: BlobEnv
  project: StudioProject
  expectedRevision: number
  run: ApprovalRun
  attribution: ApproveAttributionContext
}): Promise<SignOffResult> => {
  const approved = await approveProject(
    input.supabase,
    input.blobEnv,
    input.project,
    input.expectedRevision,
    input.attribution,
  )
  const now = new Date().toISOString()
  const { data, error } = await input.supabase
    .from('approval_runs')
    .update({
      status: 'completed',
      completed_at: now,
      updated_at: now,
      current_stage_index: input.run.stages.length,
    })
    .eq('id', input.run.id)
    .select('*')
    .single()
  if (error) throw new Error(`Failed to complete approval run: ${error.message}`)
  return {
    run: mapApprovalRunRow(data as Record<string, unknown>),
    project: approved.project,
    finalAsset: approved.finalAsset,
    alreadyApproved: approved.alreadyApproved,
    completed: true,
  }
}

export const submitOrSignOffApproval = async (input: {
  supabase: SupabaseClient
  blobEnv: BlobEnv
  project: StudioProject
  expectedRevision: number
  actorUserId: string
  actorRole: ProductRoleName
  reason?: string
  repoRoot?: string
  attribution?: ApproveAttributionContext
}): Promise<SignOffResult> => {
  const policy = await loadGovernancePolicy(input.supabase, {
    productId: input.project.productId,
    repoRoot: input.repoRoot,
  })
  if (!policy) {
    // No policy → legacy single-step Approve.
    const approved = await approveProject(
      input.supabase,
      input.blobEnv,
      input.project,
      input.expectedRevision,
      input.attribution ?? {},
    )
    return {
      run: {
        id: '00000000-0000-4000-8000-000000000000',
        productId: input.project.productId,
        projectId: input.project.id,
        policyId: null,
        policyVersion: 0,
        status: 'completed',
        currentStageIndex: 0,
        stages: [],
        claimScan: { ok: true, hits: [], scannedAt: new Date().toISOString() },
        disclaimerText: null,
        createdBy: input.actorUserId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      },
      project: approved.project,
      finalAsset: approved.finalAsset,
      alreadyApproved: approved.alreadyApproved,
      completed: true,
    }
  }

  const claimScan = scanProjectClaims(input.project, policy.body)
  const disclaimer = resolveDisclaimer(policy, input.project)
  assertReadyForFinal({
    scan: claimScan,
    disclaimerRequired: disclaimer.required,
    disclaimerText: disclaimer.text,
    verb: 'Approve',
  })

  let project = withGovernanceDisclaimer(input.project, policy.body)
  let expectedRevision = input.expectedRevision
  if (project.governanceDisclaimer !== input.project.governanceDisclaimer) {
    const saved = await saveProject(input.supabase, project, expectedRevision)
    project = saved.project
    expectedRevision = saved.project.revision
  }

  let run = await findOpenRun(input.supabase, project.id)
  if (!run) {
    const { data, error } = await input.supabase
      .from('approval_runs')
      .insert({
        product_id: project.productId,
        project_id: project.id,
        policy_id: policy.id,
        policy_version: policy.version,
        status: 'open',
        current_stage_index: 0,
        stages: policy.body.stages,
        claim_scan: claimScan,
        disclaimer_text: project.governanceDisclaimer ?? disclaimer.text,
        created_by: input.actorUserId,
      })
      .select('*')
      .single()
    if (error) throw new Error(`Failed to start approval run: ${error.message}`)
    run = mapApprovalRunRow(data as Record<string, unknown>)
    await insertEvent(input.supabase, {
      runId: run.id,
      stageKey: run.stages[0]?.key ?? 'start',
      stageIndex: 0,
      action: 'submit',
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      reason: input.reason ?? '',
      detail: { claimScan },
    })
  } else {
    await input.supabase
      .from('approval_runs')
      .update({
        claim_scan: claimScan,
        disclaimer_text: project.governanceDisclaimer ?? disclaimer.text,
        updated_at: new Date().toISOString(),
      })
      .eq('id', run.id)
  }

  await insertEvent(input.supabase, {
    runId: run.id,
    stageKey: 'scan',
    stageIndex: run.currentStageIndex,
    action: 'claim_scan',
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    detail: { claimScan },
  })

  const stage = run.stages[run.currentStageIndex]
  if (!stage) {
    throw new Error('Approval run has no current stage.')
  }
  if (!roleMeetsMinimum(input.actorRole, stage.minRole)) {
    throw new Error(
      `Stage “${stage.label}” requires role ${stage.minRole}; you are ${input.actorRole}.`,
    )
  }

  await insertEvent(input.supabase, {
    runId: run.id,
    stageKey: stage.key,
    stageIndex: run.currentStageIndex,
    action: 'sign_off',
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    reason: input.reason ?? '',
  })

  const nextIndex = run.currentStageIndex + 1
  const isLast = nextIndex >= run.stages.length
  if (isLast) {
    return finalizeIfComplete({
      supabase: input.supabase,
      blobEnv: input.blobEnv,
      project,
      expectedRevision,
      run,
      attribution: input.attribution ?? {},
    })
  }

  const { data, error } = await input.supabase
    .from('approval_runs')
    .update({
      current_stage_index: nextIndex,
      updated_at: new Date().toISOString(),
      claim_scan: claimScan,
    })
    .eq('id', run.id)
    .select('*')
    .single()
  if (error) throw new Error(`Failed to advance approval stage: ${error.message}`)
  return {
    run: mapApprovalRunRow(data as Record<string, unknown>),
    project,
    completed: false,
  }
}

export const overrideApproval = async (input: {
  supabase: SupabaseClient
  blobEnv: BlobEnv
  project: StudioProject
  expectedRevision: number
  actorUserId: string
  actorRole: ProductRoleName
  reason: string
  repoRoot?: string
  attribution?: ApproveAttributionContext
}): Promise<SignOffResult> => {
  const reason = assertOwnerCanOverride(input.actorRole, input.reason)

  const policy = await loadGovernancePolicy(input.supabase, {
    productId: input.project.productId,
    repoRoot: input.repoRoot,
  })
  if (policy) {
    const claimScan = scanProjectClaims(input.project, policy.body)
    const disclaimer = resolveDisclaimer(policy, input.project)
    assertReadyForFinal({
      scan: claimScan,
      disclaimerRequired: disclaimer.required,
      disclaimerText: disclaimer.text,
      verb: 'Override',
    })

    let project = withGovernanceDisclaimer(input.project, policy.body)
    let expectedRevision = input.expectedRevision
    if (project.governanceDisclaimer !== input.project.governanceDisclaimer) {
      const saved = await saveProject(input.supabase, project, expectedRevision)
      project = saved.project
      expectedRevision = saved.project.revision
    }

    let run = await findOpenRun(input.supabase, project.id)
    if (!run) {
      const { data, error } = await input.supabase
        .from('approval_runs')
        .insert({
          product_id: project.productId,
          project_id: project.id,
          policy_id: policy.id,
          policy_version: policy.version,
          status: 'open',
          current_stage_index: 0,
          stages: policy.body.stages,
          claim_scan: claimScan,
          disclaimer_text: project.governanceDisclaimer ?? disclaimer.text,
          created_by: input.actorUserId,
        })
        .select('*')
        .single()
      if (error) throw new Error(`Failed to start approval run for override: ${error.message}`)
      run = mapApprovalRunRow(data as Record<string, unknown>)
    }

    await insertEvent(input.supabase, {
      runId: run.id,
      stageKey: run.stages[run.currentStageIndex]?.key ?? 'override',
      stageIndex: run.currentStageIndex,
      action: 'override',
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      reason,
    })

    const approved = await approveProject(
      input.supabase,
      input.blobEnv,
      project,
      expectedRevision,
      input.attribution ?? {},
    )
    const now = new Date().toISOString()
    const { data, error } = await input.supabase
      .from('approval_runs')
      .update({
        status: 'overridden',
        completed_at: now,
        updated_at: now,
        current_stage_index: run.stages.length,
      })
      .eq('id', run.id)
      .select('*')
      .single()
    if (error) throw new Error(`Failed to mark override: ${error.message}`)
    return {
      run: mapApprovalRunRow(data as Record<string, unknown>),
      project: approved.project,
      finalAsset: approved.finalAsset,
      alreadyApproved: approved.alreadyApproved,
      completed: true,
    }
  }

  const approved = await approveProject(
    input.supabase,
    input.blobEnv,
    input.project,
    input.expectedRevision,
    input.attribution ?? {},
  )
  return {
    run: {
      id: '00000000-0000-4000-8000-000000000000',
      productId: input.project.productId,
      projectId: input.project.id,
      policyId: null,
      policyVersion: 0,
      status: 'overridden',
      currentStageIndex: 0,
      stages: [],
      claimScan: { ok: true, hits: [], scannedAt: new Date().toISOString() },
      disclaimerText: null,
      createdBy: input.actorUserId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    },
    project: approved.project,
    finalAsset: approved.finalAsset,
    alreadyApproved: approved.alreadyApproved,
    completed: true,
  }
}

export const rejectApproval = async (input: {
  supabase: SupabaseClient
  project: StudioProject
  expectedRevision: number
  actorUserId: string
  actorRole: ProductRoleName
  reason: string
}): Promise<{ run: ApprovalRun | null; project: StudioProject }> => {
  const reason = assertRejectReason(input.reason)

  const run = await findOpenRun(input.supabase, input.project.id)
  if (run) {
    await insertEvent(input.supabase, {
      runId: run.id,
      stageKey: run.stages[run.currentStageIndex]?.key ?? 'reject',
      stageIndex: run.currentStageIndex,
      action: 'reject',
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      reason,
    })
    await input.supabase
      .from('approval_runs')
      .update({
        status: 'rejected',
        updated_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
      .eq('id', run.id)
  }

  const { project: saved } = await saveProject(
    input.supabase,
    parseStudioProject({ ...input.project, status: 'drafting' }),
    input.expectedRevision,
  )

  const { messages } = await loadChatState(input.supabase, input.project.id)
  const agentPrompt: ChatMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    content: `[Approval rejected] Please revise this cut based on the rejection reason:\n\n${reason}\n\nKeep brand voice; fix any claim issues; do not invent proof points.`,
    createdAt: new Date().toISOString(),
  }
  await saveChatMessages(input.supabase, input.project.id, [...messages, agentPrompt])

  return {
    run: run
      ? {
          ...run,
          status: 'rejected',
          completedAt: new Date().toISOString(),
        }
      : null,
    project: saved,
  }
}
