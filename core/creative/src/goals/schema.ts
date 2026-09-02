/** Campaign goals / plans / actions DTOs (ADR-0040 / #298). */

import { z } from 'zod'

export const campaignGoalStatusSchema = z.enum(['active', 'paused', 'completed', 'killed'])
export type CampaignGoalStatus = z.infer<typeof campaignGoalStatusSchema>

export const campaignPlanStatusSchema = z.enum(['draft', 'active', 'paused', 'completed', 'killed'])
export type CampaignPlanStatus = z.infer<typeof campaignPlanStatusSchema>

export const campaignActionStatusSchema = z.enum([
  'proposed',
  'awaiting_approval',
  'approved',
  'rejected',
  'running',
  'done',
  'failed',
  'killed',
])
export type CampaignActionStatus = z.infer<typeof campaignActionStatusSchema>

export const campaignActionTypeSchema = z.enum([
  'create_campaign_pack',
  'open_studio_project',
  'draft_brief',
  'generate_stills',
  'enqueue_render',
  'draft_content_slot',
  'noop_verify',
])
export type CampaignActionType = z.infer<typeof campaignActionTypeSchema>

export const campaignGoalSchema = z
  .object({
    id: z.string().uuid(),
    productId: z.string().min(1),
    title: z.string().min(1).max(200),
    outcome: z.string().max(4000),
    successMetric: z.string().max(500),
    status: campaignGoalStatusSchema,
    createdBy: z.string().uuid().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
    pausedAt: z.string().nullable(),
    killedAt: z.string().nullable(),
    completedAt: z.string().nullable(),
  })
  .strict()

export type CampaignGoal = z.infer<typeof campaignGoalSchema>

export const campaignPlanSchema = z
  .object({
    id: z.string().uuid(),
    goalId: z.string().uuid(),
    productId: z.string().min(1),
    title: z.string().min(1).max(200),
    summary: z.string().max(4000),
    status: campaignPlanStatusSchema,
    createdAt: z.string(),
    updatedAt: z.string(),
    pausedAt: z.string().nullable(),
    killedAt: z.string().nullable(),
  })
  .strict()

export type CampaignPlan = z.infer<typeof campaignPlanSchema>

export const campaignActionSchema = z
  .object({
    id: z.string().uuid(),
    planId: z.string().uuid(),
    goalId: z.string().uuid(),
    productId: z.string().min(1),
    actionType: campaignActionTypeSchema,
    title: z.string().min(1).max(200),
    payload: z.record(z.string(), z.unknown()),
    sortOrder: z.number().int(),
    status: campaignActionStatusSchema,
    requiresApproval: z.boolean(),
    errorMessage: z.string().nullable(),
    result: z.record(z.string(), z.unknown()).nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
    approvedAt: z.string().nullable(),
    approvedBy: z.string().uuid().nullable(),
    startedAt: z.string().nullable(),
    finishedAt: z.string().nullable(),
  })
  .strict()

export type CampaignAction = z.infer<typeof campaignActionSchema>

export const createCampaignGoalInputSchema = z
  .object({
    productId: z.string().min(1),
    title: z.string().min(1).max(200),
    outcome: z.string().max(4000).default(''),
    successMetric: z.string().max(500).default(''),
    createdBy: z.string().uuid().nullable().optional(),
  })
  .strict()

export type CreateCampaignGoalInput = z.infer<typeof createCampaignGoalInputSchema>

export const mapCampaignGoalRow = (row: Record<string, unknown>): CampaignGoal =>
  campaignGoalSchema.parse({
    id: row.id,
    productId: row.product_id,
    title: row.title,
    outcome: row.outcome ?? '',
    successMetric: row.success_metric ?? '',
    status: row.status,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    pausedAt: row.paused_at ?? null,
    killedAt: row.killed_at ?? null,
    completedAt: row.completed_at ?? null,
  })

export const mapCampaignPlanRow = (row: Record<string, unknown>): CampaignPlan =>
  campaignPlanSchema.parse({
    id: row.id,
    goalId: row.goal_id,
    productId: row.product_id,
    title: row.title,
    summary: row.summary ?? '',
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    pausedAt: row.paused_at ?? null,
    killedAt: row.killed_at ?? null,
  })

export const mapCampaignActionRow = (row: Record<string, unknown>): CampaignAction =>
  campaignActionSchema.parse({
    id: row.id,
    planId: row.plan_id,
    goalId: row.goal_id,
    productId: row.product_id,
    actionType: row.action_type,
    title: row.title,
    payload: (row.payload as Record<string, unknown>) ?? {},
    sortOrder: row.sort_order ?? 0,
    status: row.status,
    requiresApproval: row.requires_approval ?? true,
    errorMessage: row.error_message ?? null,
    result: (row.result as Record<string, unknown> | null) ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    approvedAt: row.approved_at ?? null,
    approvedBy: row.approved_by ?? null,
    startedAt: row.started_at ?? null,
    finishedAt: row.finished_at ?? null,
  })
