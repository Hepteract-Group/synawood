import type { SupabaseClient } from '@supabase/supabase-js'
import { enqueueJobWebhooksAfterMark, renderWebhookEvent } from '../webhooks/enqueue'
import { abortRegisteredRender, CANCELLED_RENDER_MESSAGE } from './active-renders'
import type { RenderJobRow } from './enqueue'

export const getRenderJob = async (
  supabase: SupabaseClient,
  jobId: string,
): Promise<RenderJobRow> => {
  const { data, error } = await supabase
    .from('render_jobs')
    .select('*')
    .eq('id', jobId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load render job: ${error.message}`)
  }
  if (!data) {
    throw new Error(`Render job not found: ${jobId}`)
  }
  return data as RenderJobRow
}

export const markRenderJob = async (
  supabase: SupabaseClient,
  jobId: string,
  patch: {
    status: RenderJobRow['status']
    errorMessage?: string | null
    outputAssetIds?: string[]
    durationMs?: number | null
    attemptCount?: number
  },
): Promise<RenderJobRow> => {
  const update: Record<string, unknown> = {
    status: patch.status,
    updated_at: new Date().toISOString(),
  }
  if (patch.errorMessage !== undefined) {
    update.error_message = patch.errorMessage
  }
  if (patch.outputAssetIds !== undefined) {
    update.output_asset_ids = patch.outputAssetIds
  }
  if (patch.durationMs !== undefined) {
    update.duration_ms = patch.durationMs
  }
  if (patch.attemptCount !== undefined) {
    update.attempt_count = patch.attemptCount
  }

  const { data, error } = await supabase
    .from('render_jobs')
    .update(update)
    .eq('id', jobId)
    .select('*')
    .single()

  if (error) {
    throw new Error(`Failed to update render job: ${error.message}`)
  }
  const row = data as RenderJobRow
  await enqueueJobWebhooksAfterMark({
    supabase,
    productId: row.product_id,
    jobId: row.id,
    jobKind: 'render',
    event: renderWebhookEvent(patch.status),
  })
  return row
}

/** Stop an in-flight encode and return the project to drafting. */
export const cancelRenderJob = async (
  supabase: SupabaseClient,
  jobId: string,
): Promise<RenderJobRow> => {
  const job = await getRenderJob(supabase, jobId)
  if (job.status !== 'queued' && job.status !== 'rendering') {
    throw new Error('Nothing to cancel — this export already finished or failed.')
  }

  abortRegisteredRender(jobId)

  const updated = await markRenderJob(supabase, jobId, {
    status: 'failed',
    errorMessage: CANCELLED_RENDER_MESSAGE,
  })

  await supabase
    .from('studio_projects')
    .update({ status: 'drafting', updated_at: new Date().toISOString() })
    .eq('id', job.project_id)

  return updated
}

export const plainEnglishRenderError = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return 'Render failed for an unknown reason. Check the local worker logs.'
  }
  const message = error.message
  if (/cancel/i.test(message)) {
    return CANCELLED_RENDER_MESSAGE
  }
  if (/Chrome|Chromium|browser/i.test(message)) {
    return 'Render failed because Chromium is missing or could not start. Install Remotion browser deps and retry.'
  }
  if (/ffmpeg|codec|ENOENT/i.test(message)) {
    return 'Render failed during encode. Confirm FFmpeg/Remotion prerequisites are installed locally.'
  }
  if (/timeout/i.test(message)) {
    return 'Render timed out. Try a shorter clip or run the worker again.'
  }
  return `Render failed: ${message}`
}
