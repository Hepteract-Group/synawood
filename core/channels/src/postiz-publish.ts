import type { SupabaseClient } from '@supabase/supabase-js'
import {
  isLivePostedStatus,
  type PublishAdapter,
  type SchedulePostInput,
  type ScheduleResult,
  type StatusResult,
} from './publish-port'
import {
  loadPublishRecord,
  markPublishSkipped,
  POSTED_CANCEL_COPY,
  rowToPublishRecord,
} from './manual-publish'
import { listProductChannelIntegrations } from './postiz-channel-bind'
import { mapOrganicChannelToPostizType, type PostizSettingsType } from './postiz-settings-type'
import { uploadFinalBlobToPostiz, type ReadFinalBytes } from './postiz-upload'
import { applyPostizRemoteState, asPostizListState } from './postiz-remote-status'

const NOT_CONFIGURED_COPY =
  'Postiz is not configured. Set POSTIZ_ADAPTER=live with POSTIZ_BASE_URL and POSTIZ_API_KEY in .env.local (local) or Vercel (hosted). Mock is CI-only (POSTIZ_ADAPTER=mock). Never commit the API key.'

const missingLiveEnvError = (name: 'POSTIZ_BASE_URL' | 'POSTIZ_API_KEY') =>
  new Error(
    `Postiz live adapter is selected but ${name} is missing. Set it in .env.local (local) or Vercel env (hosted). Mock is CI-only. Never commit the API key.`,
  )

const MOCK_HTTP_REQUIRED_COPY =
  'Mock Postiz HTTP is required. Inject fetchImpl. CI must not call a live host.'

const UNMAPPED_CHANNEL_COPY =
  'This channel is not bound to a Postiz account. Bind it in Settings, or paste the live URL on the Work board.'

const RATE_LIMIT_COPY = 'Postiz create-post rate limit hit (429). Wait and retry. Do not burst.'

const MOCK_BASE_URL = 'http://postiz.test/public/v1'

const parsePostizAdapterMode = (raw: string | undefined): 'mock' | 'live' => {
  const value = (raw ?? '').trim().toLowerCase()
  if (value === 'mock') return 'mock'
  if (value === 'live') return 'live'
  if (value === '') {
    throw new Error(NOT_CONFIGURED_COPY)
  }
  throw new Error(
    'POSTIZ_ADAPTER must be mock (CI tests) or live. Unset is not mock. Unknown values are not treated as mock.',
  )
}

export type PostizPublishDeps = {
  supabase: SupabaseClient
  readBytes: ReadFinalBytes
  fetchImpl?: typeof fetch
  now?: () => Date
  integrations?: Array<{ id: string; provider: string }>
}

const joinApiUrl = (baseUrl: string, path: string): string =>
  `${baseUrl.trim().replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`

const settingsFor = (type: PostizSettingsType): Record<string, unknown> => {
  if (type === 'tiktok') {
    return {
      __type: 'tiktok',
      privacy_level: 'PUBLIC_TO_EVERYONE',
      duet: false,
      stitch: false,
      comment: true,
      autoAddMusic: 'no',
      brand_content_toggle: false,
      brand_organic_toggle: false,
      content_posting_method: 'DIRECT_POST',
    }
  }
  if (type === 'x') {
    return { __type: 'x', who_can_reply_post: 'everyone' }
  }
  return { __type: type }
}

const parseCreatedPostId = (body: unknown): string => {
  const row = Array.isArray(body) ? body[0] : null
  if (row && typeof row === 'object' && 'postId' in row && typeof row.postId === 'string') {
    return row.postId
  }
  throw new Error('Postiz create-post returned no postId.')
}

type ListedPostizPost = {
  id: string
  state: string
  releaseURL?: string | null
}

/** Postiz list posts returns `{ posts: [...] }` (docs.postiz.com/public-api/posts/list). */
const listedPostsFromBody = (body: unknown): ListedPostizPost[] => {
  const rows =
    body && typeof body === 'object' && Array.isArray((body as { posts?: unknown }).posts)
      ? (body as { posts: unknown[] }).posts
      : []
  const posts: ListedPostizPost[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const id = (row as { id?: unknown }).id
    const state = asPostizListState(String((row as { state?: unknown }).state ?? ''))
    if (typeof id !== 'string' || !state) continue
    const releaseURL = (row as { releaseURL?: unknown }).releaseURL
    posts.push({
      id,
      state,
      releaseURL: typeof releaseURL === 'string' ? releaseURL : null,
    })
  }
  return posts
}

const findListedPost = (body: unknown, postizId: string): ListedPostizPost | null =>
  listedPostsFromBody(body).find((post) => post.id === postizId) ?? null

/** Public API list requires a range. Cover created_at history and far-future scheduled_at. */
const pollListWindow = (
  record: { createdAt: string; scheduledAt: string | null },
  now: Date,
): { start: string; end: string } => {
  const start = new Date(record.createdAt)
  start.setUTCDate(start.getUTCDate() - 7)
  const end = new Date(now)
  end.setUTCDate(end.getUTCDate() + 14)
  if (record.scheduledAt) {
    const scheduled = new Date(record.scheduledAt)
    scheduled.setUTCDate(scheduled.getUTCDate() + 1)
    if (scheduled > end) {
      end.setTime(scheduled.getTime())
    }
  }
  return { start: start.toISOString(), end: end.toISOString() }
}

const loadPrimaryAsset = async (
  supabase: SupabaseClient,
  assetId: string,
): Promise<{ blobKey: string; contentType: string; filename: string }> => {
  const { data, error } = await supabase
    .from('assets')
    .select('id, blob_key, content_type, kind')
    .eq('id', assetId)
    .maybeSingle()
  if (error) throw new Error(`Failed to load Final asset row: ${error.message}`)
  if (!data) throw new Error('Final primary asset row missing.')
  const row = data as { blob_key: string; content_type: string | null }
  const blobKey = row.blob_key
  const filename = blobKey.split('/').filter(Boolean).pop() ?? 'final.bin'
  return {
    blobKey,
    filename,
    contentType: row.content_type ?? 'application/octet-stream',
  }
}

const loadFinalAsset = async (
  supabase: SupabaseClient,
  finalAssetId: string,
): Promise<{ id: string; product_id: string; project_id: string; primary_asset_id: string }> => {
  const { data, error } = await supabase
    .from('final_assets')
    .select('id, product_id, project_id, primary_asset_id')
    .eq('id', finalAssetId)
    .maybeSingle()
  if (error) throw new Error(`Failed to load Final asset: ${error.message}`)
  if (!data) throw new Error('Final asset not found. Approve a candidate before publishing.')
  return data as {
    id: string
    product_id: string
    project_id: string
    primary_asset_id: string
  }
}

const assertProjectNotKilled = async (
  supabase: SupabaseClient,
  projectId: string,
): Promise<void> => {
  const { data, error } = await supabase
    .from('studio_projects')
    .select('status')
    .eq('id', projectId)
    .maybeSingle()
  if (error) throw new Error(`Failed to load Studio project: ${error.message}`)
  if ((data as { status?: string } | null)?.status === 'killed') {
    throw new Error('Cannot publish a discarded (killed) candidate.')
  }
}

const listRecordsForFinalChannel = async (
  supabase: SupabaseClient,
  input: { productId: string; finalAssetId: string; channel: string },
) => {
  const { data, error } = await supabase
    .from('publish_records')
    .select('*')
    .eq('product_id', input.productId)
    .eq('final_asset_id', input.finalAssetId)
    .eq('channel', input.channel)
  if (error) throw new Error(`Failed to list publish records: ${error.message}`)
  return ((data as Record<string, unknown>[] | null) ?? []).map((row) =>
    rowToPublishRecord(row as never),
  )
}

const persistPostizRecord = async (
  supabase: SupabaseClient,
  input: SchedulePostInput,
  saved: {
    postizId: string | null
    status: 'scheduled' | 'posted' | 'failed'
    note: string
  },
  clock: () => Date,
) => {
  const existing = await listRecordsForFinalChannel(supabase, input)
  const now = clock().toISOString()
  const historyEntry = { status: saved.status, at: now, note: saved.note }
  const scheduledAt = input.scheduledAt?.toISOString() ?? null
  const postedAt = saved.status === 'posted' ? now : null

  const current = existing[0]
  if (current) {
    const { data, error } = await supabase
      .from('publish_records')
      .update({
        status: saved.status,
        postiz_id: saved.postizId,
        caption: input.caption ?? current.caption,
        scheduled_at: scheduledAt ?? current.scheduledAt,
        posted_at: postedAt,
        status_history: [...current.statusHistory, historyEntry],
        updated_at: now,
      })
      .eq('id', current.id)
      .select('*')
      .single()
    if (error) throw new Error(`Failed to update publish record: ${error.message}`)
    return rowToPublishRecord(data as never)
  }

  const id = crypto.randomUUID()
  const { data, error } = await supabase
    .from('publish_records')
    .insert({
      id,
      product_id: input.productId,
      final_asset_id: input.finalAssetId,
      content_slot_id: input.contentSlotId ?? null,
      channel: input.channel,
      status: saved.status,
      caption: input.caption ?? null,
      scheduled_at: scheduledAt,
      posted_at: postedAt,
      postiz_id: saved.postizId,
      status_history: [historyEntry],
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single()
  if (error) throw new Error(`Failed to create publish record: ${error.message}`)
  return rowToPublishRecord(data as never)
}

/**
 * Postiz publish adapter. `POSTIZ_ADAPTER=mock` is CI/tests only and does not
 * call a host unless tests inject `fetchImpl`. Unset is not configured.
 */
export const createPostizPublishAdapter = (
  env: NodeJS.ProcessEnv = process.env,
  deps?: PostizPublishDeps,
): PublishAdapter => {
  const mode = parsePostizAdapterMode(env.POSTIZ_ADAPTER)
  const liveBaseUrl = (env.POSTIZ_BASE_URL ?? '').trim()
  const apiKey = (env.POSTIZ_API_KEY ?? '').trim()
  if (mode === 'live') {
    if (!liveBaseUrl) throw missingLiveEnvError('POSTIZ_BASE_URL')
    if (!apiKey) throw missingLiveEnvError('POSTIZ_API_KEY')
  }

  const baseUrl = mode === 'live' ? liveBaseUrl : liveBaseUrl || MOCK_BASE_URL
  const authorization = apiKey || 'mock'

  return {
    schedule: async (input: SchedulePostInput): Promise<ScheduleResult> => {
      // Reject ads/blog before any DB or HTTP work.
      mapOrganicChannelToPostizType(input.channel)

      if (!deps?.supabase) {
        throw new Error('Postiz schedule needs a database client.')
      }
      if (mode === 'mock' && !deps.fetchImpl) {
        throw new Error(MOCK_HTTP_REQUIRED_COPY)
      }
      if (!deps.readBytes) {
        throw new Error('Postiz schedule needs a Blob reader.')
      }

      const fetchImpl = deps.fetchImpl ?? fetch
      const clock = deps.now ?? (() => new Date())

      const final = await loadFinalAsset(deps.supabase, input.finalAssetId)
      if (final.product_id !== input.productId) {
        throw new Error('Final asset product does not match publish productId.')
      }
      await assertProjectNotKilled(deps.supabase, final.project_id)

      const existing = await listRecordsForFinalChannel(deps.supabase, input)
      const already = existing.find((row) => row.postizId)
      if (already?.postizId) {
        return {
          externalId: already.id,
          record: already,
          instructions:
            'Already scheduled in Postiz. The live URL will appear on this card when it posts.',
        }
      }

      const bindings = await listProductChannelIntegrations(deps.supabase, input.productId)
      const binding = bindings.find((row) => row.channel === input.channel)
      if (!binding) {
        throw new Error(UNMAPPED_CHANNEL_COPY)
      }

      const provider = deps.integrations?.find(
        (row) => row.id === binding.postizIntegrationId,
      )?.provider
      const settingsType = mapOrganicChannelToPostizType(input.channel, {
        linkedinType:
          provider === 'linkedin-page' || provider === 'linkedin' ? provider : undefined,
      })

      const asset = await loadPrimaryAsset(deps.supabase, final.primary_asset_id)
      const uploaded = await uploadFinalBlobToPostiz({
        blobKey: asset.blobKey,
        filename: asset.filename,
        contentType: asset.contentType,
        readBytes: deps.readBytes,
        baseUrl,
        apiKey: authorization,
        fetchImpl,
      })

      const postType = input.scheduledAt ? 'schedule' : 'now'
      const response = await fetchImpl(joinApiUrl(baseUrl, 'posts'), {
        method: 'POST',
        headers: {
          Authorization: authorization,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: postType,
          date: (input.scheduledAt ?? clock()).toISOString(),
          shortLink: false,
          tags: [],
          posts: [
            {
              integration: { id: binding.postizIntegrationId },
              value: [
                {
                  content: input.caption ?? '',
                  image: [{ id: uploaded.id, path: uploaded.path }],
                },
              ],
              settings: settingsFor(settingsType),
            },
          ],
        }),
      })

      if (response.status === 429) {
        await persistPostizRecord(
          deps.supabase,
          input,
          {
            postizId: null,
            status: 'failed',
            note: RATE_LIMIT_COPY,
          },
          clock,
        )
        throw new Error(RATE_LIMIT_COPY)
      }
      if (!response.ok) {
        throw new Error(`Postiz create-post failed (${response.status}).`)
      }

      const postizId = parseCreatedPostId(await response.json())
      const status = postType === 'now' ? 'posted' : 'scheduled'
      const record = await persistPostizRecord(
        deps.supabase,
        input,
        {
          postizId,
          status,
          note:
            postType === 'now'
              ? 'Posted now via Postiz.'
              : 'Scheduled via Postiz. Live URL returns when it publishes.',
        },
        clock,
      )

      return {
        externalId: record.id,
        record,
        instructions:
          postType === 'now'
            ? 'Posted via Postiz. The live URL will appear on this card when the network returns it.'
            : 'Scheduled via Postiz. The live URL will appear on this card when it posts.',
      }
    },
    getStatus: async (externalId: string): Promise<StatusResult> => {
      if (!deps?.supabase) {
        throw new Error('Postiz status needs a database client.')
      }
      const record = await loadPublishRecord(deps.supabase, externalId)
      if (record.status === 'manual_posted' || record.status === 'skipped') {
        return { status: record.status, postedUrl: record.externalUrl, record }
      }
      if (!record.postizId) {
        return { status: record.status, postedUrl: record.externalUrl, record }
      }
      if (mode === 'mock' && !deps.fetchImpl) {
        throw new Error(MOCK_HTTP_REQUIRED_COPY)
      }
      const fetchImpl = deps.fetchImpl ?? fetch
      const clock = deps.now ?? (() => new Date())
      const window = pollListWindow(record, clock())
      const listUrl = `${joinApiUrl(baseUrl, 'posts')}?startDate=${encodeURIComponent(window.start)}&endDate=${encodeURIComponent(window.end)}`
      const response = await fetchImpl(listUrl, {
        method: 'GET',
        headers: { Authorization: authorization },
      })
      if (!response.ok) {
        throw new Error(`Postiz list-posts failed (${response.status}).`)
      }
      const post = findListedPost(await response.json(), record.postizId)
      if (!post) {
        return { status: record.status, postedUrl: record.externalUrl, record }
      }
      return applyPostizRemoteState(deps.supabase, record, post, 'Postiz poll.')
    },
    cancel: async (externalId: string): Promise<StatusResult> => {
      if (!deps?.supabase) {
        throw new Error('Postiz cancel needs a database client.')
      }
      const existing = await loadPublishRecord(deps.supabase, externalId)
      if (isLivePostedStatus(existing.status)) {
        throw new Error(POSTED_CANCEL_COPY)
      }
      if (existing.status === 'skipped') {
        return { status: existing.status, postedUrl: existing.externalUrl, record: existing }
      }
      if (existing.postizId) {
        if (mode === 'mock' && !deps.fetchImpl) {
          throw new Error(MOCK_HTTP_REQUIRED_COPY)
        }
        const fetchImpl = deps.fetchImpl ?? fetch
        const response = await fetchImpl(joinApiUrl(baseUrl, `posts/${existing.postizId}`), {
          method: 'DELETE',
          headers: { Authorization: authorization },
        })
        if (!response.ok && response.status !== 404) {
          throw new Error(`Postiz cancel failed (${response.status}).`)
        }
      }
      const record = await markPublishSkipped(
        deps.supabase,
        externalId,
        'Cancelled in Postiz. Synawood row skipped.',
      )
      return { status: record.status, postedUrl: record.externalUrl, record }
    },
  }
}
