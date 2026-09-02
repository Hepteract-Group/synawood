import {
  DEFAULT_MODEL_PROFILE_ID,
  resolveExtractReasonerId,
} from '@synawood/creative/model-profiles'
import {
  enqueueExtractJob,
  getLatestExtractJobForProject,
  loadBriefForJob,
} from '@synawood/creative/generation-jobs'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { spawnLocalExtractWorker } from '@/lib/spawn-local-extract'
import { appliedBriefIdFromProjectJson } from '@/lib/extract-chrome'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const shouldRunInlineLocalExtract = (): boolean =>
  process.env.NODE_ENV === 'development' && process.env.STUDIO_EXTRACT_INLINE !== 'false'

/** Hint shown when the local extract worker is not auto-started (non-inline dev). */
const workerHintForActiveJob = (jobId: string): string | null => {
  if (shouldRunInlineLocalExtract()) return null
  return `Extract queued. Start the local worker: npm run extract:local -- --job ${jobId}`
}

type ExtractBody = {
  sourceKind?: 'url' | 'pdf'
  url?: string
  blobKey?: string
  confirmSpend?: boolean
}

export const POST = async (
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const body = (await request.json().catch(() => ({}))) as ExtractBody
    if (body.sourceKind !== 'url' && body.sourceKind !== 'pdf') {
      return jsonError('sourceKind must be url or pdf')
    }

    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    const { supabase } = access

    const { data: projectRow, error } = await supabase
      .from('studio_projects')
      .select('model_profile_id, reasoner_model_id')
      .eq('id', projectId)
      .maybeSingle()
    if (error || !projectRow) {
      return jsonError(error?.message ?? 'Project not found', 404)
    }

    const reasonerModelId = resolveExtractReasonerId(
      typeof projectRow.reasoner_model_id === 'string' ? projectRow.reasoner_model_id : null,
    )
    const modelProfileId =
      (typeof projectRow.model_profile_id === 'string' && projectRow.model_profile_id) ||
      DEFAULT_MODEL_PROFILE_ID

    const { job, estimatedGbp } = await enqueueExtractJob({
      supabase,
      productId: access.productId,
      projectId,
      sourceKind: body.sourceKind,
      url: body.url,
      blobKey: body.blobKey,
      reasonerModelId,
      modelProfileId,
    })

    const inlineLocal = shouldRunInlineLocalExtract()
    let workerHint: string | null = workerHintForActiveJob(job.id)
    let spawnedInline = false
    if (inlineLocal) {
      try {
        spawnLocalExtractWorker(job.id)
        spawnedInline = true
      } catch (spawnError: unknown) {
        console.error('[studio extract inline]', spawnError)
        workerHint =
          'Inline extract worker failed to start. Run: npm run extract:local -- --job ' + job.id
      }
    }

    return Response.json(
      {
        job: {
          id: job.id,
          status: job.status,
          role: job.role,
          errorMessage: job.error_message,
        },
        estimatedGbp,
        inlineLocal: spawnedInline,
        workerHint,
      },
      { status: 201 },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to enqueue extract'
    if (/confirm|budget|cap|credit|required/i.test(message)) {
      return jsonError(message, 402)
    }
    return handleRouteError(error, 'Failed to enqueue extract')
  }
}

export const GET = async (
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const access = await requireStudioAccess({ projectId, minRole: 'viewer' })
    const job = await getLatestExtractJobForProject(access.supabase, projectId)
    if (!job) {
      return Response.json({ job: null, brief: null })
    }
    const brief = job.status === 'ready' ? await loadBriefForJob(access.supabase, job.id) : null
    let applied = false
    if (brief) {
      const { data: projectRow } = await access.supabase
        .from('studio_projects')
        .select('project_json')
        .eq('id', projectId)
        .maybeSingle()
      applied = appliedBriefIdFromProjectJson(projectRow?.project_json) === brief.id
    }
    return Response.json({
      job: {
        id: job.id,
        status: job.status,
        role: job.role,
        errorMessage: job.error_message,
      },
      brief,
      applied,
      workerHint:
        job.status === 'queued' || job.status === 'generating'
          ? workerHintForActiveJob(job.id)
          : null,
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to load extract job')
  }
}
