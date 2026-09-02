import type { SupabaseClient } from '@supabase/supabase-js'
import { hashApiSecret } from './public-api-schema'
import { ProductAccessError } from './product-membership'
import type { ApiKeyAccess } from './with-api-key'

export const requireIdempotencyKey = (request: Request): string => {
  const key = request.headers.get('Idempotency-Key')?.trim()
  if (!key) {
    throw new ProductAccessError('Idempotency-Key is required.', 400)
  }
  return key
}

export const hashV1Request = async (
  method: string,
  pathname: string,
  bodyText: string,
): Promise<string> => hashApiSecret(`${method.toUpperCase()}\n${pathname}\n${bodyText}`)

export const persistApiIdempotency = async (input: {
  supabase: SupabaseClient
  access: ApiKeyAccess
  idempotencyKey: string
  requestHash: string
  statusCode: number
  responseBody: unknown
}): Promise<void> => {
  const { error } = await input.supabase.from('api_idempotency').insert({
    product_id: input.access.productId,
    api_key_id: input.access.apiKeyId,
    idempotency_key: input.idempotencyKey,
    request_hash: input.requestHash,
    status_code: input.statusCode,
    response: input.responseBody,
  })
  if (!error) return
  // Unique (product_id, idempotency_key) — replay is #1078; do not fail the mutate.
  if (error.code === '23505') return
  throw new Error(`Failed to persist idempotency: ${error.message}`)
}

export type StoredIdempotencyRow = {
  request_hash: string
  status_code: number
  response: unknown
}

export const resolveStoredIdempotency = (
  row: StoredIdempotencyRow | null,
  requestHash: string,
):
  | { kind: 'miss' }
  | { kind: 'replay'; statusCode: number; responseBody: unknown }
  | { kind: 'conflict' } => {
  if (!row) return { kind: 'miss' }
  if (row.request_hash === requestHash) {
    return { kind: 'replay', statusCode: row.status_code, responseBody: row.response }
  }
  return { kind: 'conflict' }
}

export const v1IdempotencyReplayResponse = (statusCode: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { 'content-type': 'application/json' },
  })

export const loadApiIdempotency = async (
  supabase: SupabaseClient,
  productId: string,
  idempotencyKey: string,
): Promise<StoredIdempotencyRow | null> => {
  const { data, error } = await supabase
    .from('api_idempotency')
    .select('request_hash, status_code, response')
    .eq('product_id', productId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  if (error) {
    throw new Error(`Failed to load idempotency: ${error.message}`)
  }
  if (!data) return null
  return data as StoredIdempotencyRow
}

export const replayIfStored = async (
  request: Request,
  access: ApiKeyAccess,
  rawBody: unknown,
): Promise<Response | null> => {
  const idempotencyKey = requireIdempotencyKey(request)
  const pathname = new URL(request.url).pathname
  const bodyText = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody ?? {})
  const requestHash = await hashV1Request(request.method, pathname, bodyText)
  const row = await loadApiIdempotency(access.supabase, access.productId, idempotencyKey)
  const resolved = resolveStoredIdempotency(row, requestHash)
  if (resolved.kind === 'miss') return null
  if (resolved.kind === 'conflict') {
    throw new ProductAccessError('Idempotency-Key was reused with a different request body.', 409)
  }
  return v1IdempotencyReplayResponse(resolved.statusCode, resolved.responseBody)
}

export const recordV1MutationIdempotency = async (
  request: Request,
  access: ApiKeyAccess,
  rawBody: unknown,
  response: Response,
): Promise<Response> => {
  const idempotencyKey = requireIdempotencyKey(request)
  const pathname = new URL(request.url).pathname
  const bodyText = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody ?? {})
  const requestHash = await hashV1Request(request.method, pathname, bodyText)
  let responseBody: unknown = null
  try {
    responseBody = await response.clone().json()
  } catch {
    responseBody = null
  }
  await persistApiIdempotency({
    supabase: access.supabase,
    access,
    idempotencyKey,
    requestHash,
    statusCode: response.status,
    responseBody,
  })
  return response
}
