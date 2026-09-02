import { createHmac, timingSafeEqual } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { rowToPublishRecord } from './manual-publish'
import { applyPostizRemoteState } from './postiz-remote-status'

export const POSTIZ_WEBHOOK_NOT_CONFIGURED_COPY =
  'Postiz webhook is not configured. Poll remains the source of posted status.'

export const POSTIZ_WEBHOOK_BAD_SECRET_COPY = 'Postiz webhook secret was rejected.'

export const POSTIZ_WEBHOOK_SECRET_HEADER = 'x-postiz-webhook-secret'

const hmacHex = (secret: string, rawBody: string): string =>
  createHmac('sha256', secret).update(rawBody).digest('hex')

const hashedEqual = (left: string, right: string): boolean => {
  const a = createHmac('sha256', 'postiz-webhook-cmp').update(left).digest()
  const b = createHmac('sha256', 'postiz-webhook-cmp').update(right).digest()
  return timingSafeEqual(a, b)
}

export const verifyPostizWebhookSecret = (input: {
  secret: string
  header: string | null
  rawBody: string
}): boolean => {
  const provided = input.header?.trim() ?? ''
  if (!provided) return false
  return (
    hashedEqual(provided, input.secret) ||
    hashedEqual(provided, hmacHex(input.secret, input.rawBody))
  )
}

const payloadPost = (
  body: unknown,
): { id: string; state: string; releaseURL?: string | null } | null => {
  const row =
    body && typeof body === 'object' && (body as { post?: unknown }).post
      ? (body as { post: unknown }).post
      : body
  if (!row || typeof row !== 'object') return null
  const id = (row as { id?: unknown; postId?: unknown }).id ?? (row as { postId?: unknown }).postId
  const state = (row as { state?: unknown }).state
  if (typeof id !== 'string' || typeof state !== 'string') return null
  const releaseURL = (row as { releaseURL?: unknown }).releaseURL
  return {
    id,
    state,
    releaseURL: typeof releaseURL === 'string' ? releaseURL : null,
  }
}

export type PostizWebhookResult = {
  ok: true
  ignored?: 'unknown_postiz_id' | 'manual_posted' | 'unchanged'
  status?: string
  postedUrl?: string | null
  publishRecordId?: string
}

export const ingestPostizWebhook = async (input: {
  supabase: SupabaseClient
  env?: NodeJS.ProcessEnv
  header: string | null
  rawBody: string
}): Promise<PostizWebhookResult> => {
  const secret = (input.env ?? process.env).POSTIZ_WEBHOOK_SECRET?.trim() ?? ''
  if (!secret) {
    throw new Error(POSTIZ_WEBHOOK_NOT_CONFIGURED_COPY)
  }
  if (input.rawBody.length > 64_000) {
    throw new Error(POSTIZ_WEBHOOK_BAD_SECRET_COPY)
  }
  if (!verifyPostizWebhookSecret({ secret, header: input.header, rawBody: input.rawBody })) {
    throw new Error(POSTIZ_WEBHOOK_BAD_SECRET_COPY)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(input.rawBody) as unknown
  } catch {
    return { ok: true, ignored: 'unchanged' }
  }
  const post = payloadPost(parsed)
  if (!post) {
    return { ok: true, ignored: 'unknown_postiz_id' }
  }

  const { data, error } = await input.supabase
    .from('publish_records')
    .select('*')
    .eq('postiz_id', post.id)
    .maybeSingle()
  if (error) throw new Error(`Failed to load publish record: ${error.message}`)
  if (!data) {
    return { ok: true, ignored: 'unknown_postiz_id' }
  }
  const record = rowToPublishRecord(data as never)
  if (record.status === 'manual_posted') {
    return {
      ok: true,
      ignored: 'manual_posted',
      status: record.status,
      postedUrl: record.externalUrl,
      publishRecordId: record.id,
    }
  }
  const applied = await applyPostizRemoteState(input.supabase, record, post, 'Postiz webhook.')
  const unchanged = applied.status === record.status && applied.postedUrl === record.externalUrl
  return {
    ok: true,
    ignored: unchanged ? 'unchanged' : undefined,
    status: applied.status,
    postedUrl: applied.postedUrl,
    publishRecordId: applied.record.id,
  }
}
