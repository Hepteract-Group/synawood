import { randomBytes } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { apiKeyPrefix, hashApiSecret } from './public-api-schema'
import { toPublicApiKey, type PublicApiKey } from './api-console-copy'

export const generateApiKeyPlaintext = (): string => `mos_${randomBytes(24).toString('hex')}`

export const listProductApiKeys = async (
  supabase: SupabaseClient,
  productId: string,
): Promise<PublicApiKey[]> => {
  const { data, error } = await supabase
    .from('product_api_keys')
    .select('id, name, key_prefix, created_at, last_used_at, revoked_at')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
  if (error) {
    throw new Error(`Failed to list API keys: ${error.message}`)
  }
  return ((data ?? []) as Parameters<typeof toPublicApiKey>[0][]).map(toPublicApiKey)
}

export const createProductApiKey = async (input: {
  supabase: SupabaseClient
  productId: string
  createdBy: string
  name: string
}): Promise<{ key: PublicApiKey; plaintext: string }> => {
  const name = input.name.trim()
  if (!name) {
    throw new Error('Name is required.')
  }
  const plaintext = generateApiKeyPlaintext()
  const keyHash = await hashApiSecret(plaintext)
  const row = {
    product_id: input.productId,
    name,
    key_prefix: apiKeyPrefix(plaintext),
    key_hash: keyHash,
    created_by: input.createdBy,
  }
  const { data, error } = await input.supabase
    .from('product_api_keys')
    .insert(row)
    .select('*')
    .single()
  if (error) {
    throw new Error(`Failed to create API key: ${error.message}`)
  }
  return { key: toPublicApiKey(data as Parameters<typeof toPublicApiKey>[0]), plaintext }
}

export const revokeProductApiKey = async (input: {
  supabase: SupabaseClient
  productId: string
  keyId: string
}): Promise<PublicApiKey> => {
  const { data, error } = await input.supabase
    .from('product_api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', input.keyId)
    .eq('product_id', input.productId)
    .is('revoked_at', null)
    .select('id, name, key_prefix, created_at, last_used_at, revoked_at')
    .maybeSingle()
  if (error) {
    throw new Error(`Failed to revoke API key: ${error.message}`)
  }
  if (data) {
    return toPublicApiKey(data as Parameters<typeof toPublicApiKey>[0])
  }
  const existing = await input.supabase
    .from('product_api_keys')
    .select('id, name, key_prefix, created_at, last_used_at, revoked_at')
    .eq('id', input.keyId)
    .eq('product_id', input.productId)
    .maybeSingle()
  if (existing.error) {
    throw new Error(`Failed to revoke API key: ${existing.error.message}`)
  }
  if (!existing.data) {
    throw new Error('API key not found.')
  }
  return toPublicApiKey(existing.data as Parameters<typeof toPublicApiKey>[0])
}
