/** Load product approval-policy.json into governance_policies (#312). */

import 'server-only'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  governancePolicyBodySchema,
  mapGovernancePolicyRow,
  type GovernancePolicy,
  type GovernancePolicyBody,
} from './schema'

const here = path.dirname(fileURLToPath(import.meta.url))

const defaultRepoRoot = (): string => path.resolve(here, '../../../..')

const defaultSourcePath = (productId: string): string =>
  path.join('products', productId, 'governance', 'approval-policy.json')

export const readPolicyFile = async (
  repoRoot: string,
  productId: string,
): Promise<{ body: GovernancePolicyBody; sourcePath: string } | null> => {
  const sourcePath = defaultSourcePath(productId)
  const absolute = path.join(repoRoot, sourcePath)
  try {
    const raw = await readFile(absolute, 'utf8')
    const body = governancePolicyBodySchema.parse(JSON.parse(raw))
    return { body, sourcePath }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

export const upsertGovernancePolicy = async (
  supabase: SupabaseClient,
  input: {
    productId: string
    body: GovernancePolicyBody
    sourcePath: string
  },
): Promise<GovernancePolicy> => {
  const now = new Date().toISOString()
  const slug = input.body.slug
  const { data, error } = await supabase
    .from('governance_policies')
    .upsert(
      {
        product_id: input.productId,
        slug,
        version: input.body.version,
        body: input.body,
        source_path: input.sourcePath,
        synced_at: now,
        updated_at: now,
      },
      { onConflict: 'product_id,slug' },
    )
    .select('*')
    .single()
  if (error) throw new Error(`Failed to upsert governance policy: ${error.message}`)
  return mapGovernancePolicyRow(data as Record<string, unknown>)
}

/** Prefer DB mirror; if missing, read file + upsert. */
export const loadGovernancePolicy = async (
  supabase: SupabaseClient,
  input: {
    productId: string
    slug?: string
    repoRoot?: string
    forceSync?: boolean
  },
): Promise<GovernancePolicy | null> => {
  const slug = input.slug ?? 'default'
  if (!input.forceSync) {
    const { data, error } = await supabase
      .from('governance_policies')
      .select('*')
      .eq('product_id', input.productId)
      .eq('slug', slug)
      .maybeSingle()
    if (error) throw new Error(`Failed to load governance policy: ${error.message}`)
    if (data) return mapGovernancePolicyRow(data as Record<string, unknown>)
  }

  const repoRoot = input.repoRoot ?? defaultRepoRoot()
  const fromFile = await readPolicyFile(repoRoot, input.productId)
  if (!fromFile) return null
  if (fromFile.body.slug !== slug && slug !== 'default') return null
  return upsertGovernancePolicy(supabase, {
    productId: input.productId,
    body: fromFile.body,
    sourcePath: fromFile.sourcePath,
  })
}

export const syncGovernancePolicyFromFile = async (
  supabase: SupabaseClient,
  input: { productId: string; repoRoot?: string },
): Promise<GovernancePolicy | null> =>
  loadGovernancePolicy(supabase, {
    productId: input.productId,
    repoRoot: input.repoRoot,
    forceSync: true,
  })
