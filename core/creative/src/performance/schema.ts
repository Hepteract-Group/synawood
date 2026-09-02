/** Performance DTOs (ADR-0035). Client-safe. */

import { z } from 'zod'

export const outcomeMetricSchema = z.enum(['views', 'clicks', 'signups', 'revenue', 'other'])
export type OutcomeMetric = z.infer<typeof outcomeMetricSchema>

export const outcomeSourceSchema = z.enum(['manual', 'organic', 'commerce'])
export type OutcomeSource = z.infer<typeof outcomeSourceSchema>

export const integrationProviderSchema = z.enum([
  'tiktok',
  'meta',
  'youtube',
  'linkedin',
  'shopify',
  'stripe',
  'manual',
])
export type IntegrationProvider = z.infer<typeof integrationProviderSchema>

export const organicProviderSchema = z.enum(['tiktok', 'meta', 'youtube', 'linkedin'])
export const commerceProviderSchema = z.enum(['shopify', 'stripe'])

export const outcomeInputSchema = z
  .object({
    metric: outcomeMetricSchema,
    value: z.number().finite(),
    occurredAt: z.string().datetime().optional(),
    publishRecordId: z.string().uuid().optional(),
    finalAssetId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
    externalUrl: z.string().url().optional(),
    note: z.string().max(240).optional(),
  })
  .strict()

export type OutcomeInput = z.infer<typeof outcomeInputSchema>

export type AdapterPullResult = {
  ok: true
  rows: unknown[]
  reason: 'not_connected' | 'stub_provider'
}
