import type { SupabaseClient } from '@supabase/supabase-js'
import { hashApiSecret } from './public-api-schema'
import { ProductAccessError } from './product-membership'
import { getStudioClients } from './studio-server'

export const API_RATE_LIMIT_PER_MINUTE = 60

export type ApiKeyAccess = {
  productId: string
  apiKeyId: string
  supabase: SupabaseClient
}

export const readBearerToken = (request: Request): string | null => {
  const header = request.headers.get('authorization')
  if (!header) return null
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim())
  return match?.[1] ?? null
}

export const utcMinuteWindowStart = (nowMs = Date.now()): string => {
  const date = new Date(nowMs)
  date.setUTCSeconds(0, 0)
  date.setUTCMilliseconds(0)
  return date.toISOString()
}

export const withApiKey = async (request: Request): Promise<ApiKeyAccess> => {
  const token = readBearerToken(request)
  if (!token) {
    throw new ProductAccessError('Send an Authorization Bearer API key.', 401)
  }

  const { supabase } = getStudioClients()
  const keyHash = await hashApiSecret(token)
  const { data, error } = await supabase
    .from('product_api_keys')
    .select('id, product_id, revoked_at')
    .eq('key_hash', keyHash)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to look up API key: ${error.message}`)
  }
  if (!data || data.revoked_at) {
    throw new ProductAccessError('Invalid API key.', 401)
  }

  const { data: hits, error: rateError } = await supabase.rpc('bump_api_rate', {
    p_key: data.id,
    p_window: utcMinuteWindowStart(),
    p_limit: API_RATE_LIMIT_PER_MINUTE,
  })
  if (rateError) {
    throw new Error(`Failed to apply API rate limit: ${rateError.message}`)
  }
  if (typeof hits === 'number' && hits > API_RATE_LIMIT_PER_MINUTE) {
    throw new ProductAccessError('API rate limit exceeded. Try again next minute.', 429)
  }

  await supabase
    .from('product_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)

  return {
    productId: data.product_id as string,
    apiKeyId: data.id as string,
    supabase,
  }
}
