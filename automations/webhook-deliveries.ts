#!/usr/bin/env node
/**
 * Drain pending Public API v1 webhook_deliveries (ADR-0038 / #1080).
 *
 * Usage:
 *   npm run webhooks:local
 */
import { createServiceSupabase, readSupabaseEnv } from '../core/creative/src/index.ts'
import { deliverDueWebhookDeliveries } from '../core/creative/src/webhooks/deliver.ts'

const main = async () => {
  const supabase = createServiceSupabase(readSupabaseEnv(process.env))
  const result = await deliverDueWebhookDeliveries({ supabase })
  console.log(JSON.stringify({ ok: true, ...result }, null, 2))
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
