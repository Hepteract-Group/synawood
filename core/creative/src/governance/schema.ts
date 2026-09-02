/** Governance DTOs (ADR-0042 / #311). */

import { z } from 'zod'
import { localeCodeSchema } from '../locale/schema'

export const productRoleSchema = z.enum(['viewer', 'editor', 'owner'])
export type ProductRoleName = z.infer<typeof productRoleSchema>

export const approvalStageSchema = z
  .object({
    key: z.string().min(1).max(64),
    label: z.string().min(1).max(120),
    minRole: productRoleSchema,
  })
  .strict()

export type ApprovalStage = z.infer<typeof approvalStageSchema>

export const claimRuleSeveritySchema = z.enum(['block', 'warn'])
export type ClaimRuleSeverity = z.infer<typeof claimRuleSeveritySchema>

export const claimRuleSchema = z
  .object({
    id: z.string().min(1).max(64),
    pattern: z.string().min(1).max(500),
    severity: claimRuleSeveritySchema,
    suggestion: z.string().max(500).default(''),
    /** Empty / omitted = all locales (ADR-0043 / #333). */
    locales: z.array(localeCodeSchema).max(24).optional(),
  })
  .strict()

export type ClaimRule = z.infer<typeof claimRuleSchema>

export const disclaimerPolicySchema = z
  .object({
    required: z.boolean().default(false),
    text: z.string().max(500).default(''),
  })
  .strict()

export type DisclaimerPolicy = z.infer<typeof disclaimerPolicySchema>

export const governancePolicyBodySchema = z
  .object({
    slug: z.string().min(1).max(64).default('default'),
    version: z.number().int().positive().default(1),
    stages: z.array(approvalStageSchema).min(1).max(12),
    claimRules: z.array(claimRuleSchema).default([]),
    disclaimer: disclaimerPolicySchema.default({ required: false, text: '' }),
  })
  .strict()

export type GovernancePolicyBody = z.infer<typeof governancePolicyBodySchema>

export const governancePolicySchema = z
  .object({
    id: z.string().uuid(),
    productId: z.string().min(1),
    slug: z.string().min(1),
    version: z.number().int().positive(),
    body: governancePolicyBodySchema,
    sourcePath: z.string(),
    syncedAt: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict()

export type GovernancePolicy = z.infer<typeof governancePolicySchema>

export const approvalRunStatusSchema = z.enum([
  'open',
  'completed',
  'rejected',
  'overridden',
  'cancelled',
])
export type ApprovalRunStatus = z.infer<typeof approvalRunStatusSchema>

export const claimScanHitSchema = z
  .object({
    ruleId: z.string(),
    severity: claimRuleSeveritySchema,
    match: z.string(),
    suggestion: z.string(),
    source: z.string().optional(),
  })
  .strict()

export type ClaimScanHit = z.infer<typeof claimScanHitSchema>

export const claimScanResultSchema = z
  .object({
    ok: z.boolean(),
    hits: z.array(claimScanHitSchema),
    scannedAt: z.string(),
  })
  .strict()

export type ClaimScanResult = z.infer<typeof claimScanResultSchema>

export const approvalRunSchema = z
  .object({
    id: z.string().uuid(),
    productId: z.string().min(1),
    projectId: z.string().uuid(),
    policyId: z.string().uuid().nullable(),
    policyVersion: z.number().int(),
    status: approvalRunStatusSchema,
    currentStageIndex: z.number().int().nonnegative(),
    stages: z.array(approvalStageSchema),
    claimScan: z.union([claimScanResultSchema, z.record(z.string(), z.unknown())]).default({}),
    disclaimerText: z.string().nullable(),
    createdBy: z.string().uuid().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
    completedAt: z.string().nullable(),
  })
  .strict()

export type ApprovalRun = z.infer<typeof approvalRunSchema>

export const approvalEventActionSchema = z.enum([
  'submit',
  'sign_off',
  'reject',
  'override',
  'claim_scan',
])
export type ApprovalEventAction = z.infer<typeof approvalEventActionSchema>

export const approvalEventSchema = z
  .object({
    id: z.string().uuid(),
    runId: z.string().uuid(),
    stageKey: z.string(),
    stageIndex: z.number().int(),
    action: approvalEventActionSchema,
    actorUserId: z.string().uuid().nullable(),
    actorRole: z.string().nullable(),
    reason: z.string(),
    detail: z.record(z.string(), z.unknown()),
    createdAt: z.string(),
  })
  .strict()

export type ApprovalEvent = z.infer<typeof approvalEventSchema>

export const mapGovernancePolicyRow = (row: Record<string, unknown>): GovernancePolicy =>
  governancePolicySchema.parse({
    id: row.id,
    productId: row.product_id,
    slug: row.slug,
    version: row.version,
    body: row.body,
    sourcePath: row.source_path,
    syncedAt: row.synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })

export const mapApprovalRunRow = (row: Record<string, unknown>): ApprovalRun =>
  approvalRunSchema.parse({
    id: row.id,
    productId: row.product_id,
    projectId: row.project_id,
    policyId: row.policy_id,
    policyVersion: row.policy_version,
    status: row.status,
    currentStageIndex: row.current_stage_index,
    stages: row.stages,
    claimScan: row.claim_scan,
    disclaimerText: row.disclaimer_text,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  })

export const mapApprovalEventRow = (row: Record<string, unknown>): ApprovalEvent =>
  approvalEventSchema.parse({
    id: row.id,
    runId: row.run_id,
    stageKey: row.stage_key,
    stageIndex: row.stage_index,
    action: row.action,
    actorUserId: row.actor_user_id,
    actorRole: row.actor_role,
    reason: row.reason,
    detail: row.detail ?? {},
    createdAt: row.created_at,
  })

const ROLE_RANK: Record<ProductRoleName, number> = {
  viewer: 0,
  editor: 1,
  owner: 2,
}

export const roleMeetsMinimum = (role: ProductRoleName, minRole: ProductRoleName): boolean =>
  ROLE_RANK[role] >= ROLE_RANK[minRole]
