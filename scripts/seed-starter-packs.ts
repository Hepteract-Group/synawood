#!/usr/bin/env node
/**
 * Seed published starter packs into local Supabase + Blob (#296).
 *
 *   ALLOW_UNSIGNED_PACKS=true npm run seed:starter-packs -- --product-id <id>
 *   PRODUCT_ID=<id> ALLOW_UNSIGNED_PACKS=true npm run seed:starter-packs
 */

import { createServiceSupabase, readBlobEnv, readSupabaseEnv } from '../core/creative/src/index'
import { readRequiredProductId } from '../core/creative/src/packs/cli-product-id'
import { seedStarterPacks } from '../core/creative/src/packs/seed-starters'

const main = async () => {
  const productId = readRequiredProductId(process.argv, process.env)
  const supabase = createServiceSupabase(readSupabaseEnv(process.env))
  const blobEnv = readBlobEnv(process.env)
  const published = await seedStarterPacks({
    supabase,
    blobEnv,
    productId,
  })
  for (const row of published) {
    console.log(`Published ${row.slug}@${row.semver} → ${row.blobKey}`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
