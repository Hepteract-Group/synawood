import { applyBriefToProject } from '@synawood/creative/brief'
import {
  attachAsset,
  loadProject,
  projectAssetFromRow,
  saveProject,
} from '@synawood/creative/project'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z
  .object({
    briefId: z.string().uuid().optional(),
    firstCutMode: z.enum(['minimal', 'director']).optional(),
    expectedRevision: z.number().int().positive(),
  })
  .strict()

export const POST = async (
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const body = bodySchema.parse(await request.json())
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    const { supabase } = access
    const loaded = await loadProject(supabase, projectId)
    let project = loaded.project
    const baseRevision = project.revision

    const briefLookup = body.briefId
      ? supabase
          .from('extracted_briefs')
          .select('id, brief_json, status')
          .eq('id', body.briefId)
          .eq('project_id', projectId)
          .maybeSingle()
      : supabase
          .from('extracted_briefs')
          .select('id, brief_json, status')
          .eq('project_id', projectId)
          .eq('status', 'ready')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

    const { data: briefRow, error: briefError } = await briefLookup

    if (briefError) {
      return jsonError(`Failed to load brief: ${briefError.message}`, 500)
    }
    if (!briefRow?.brief_json) {
      return jsonError('No ready extracted brief for this project', 404)
    }
    if (briefRow.status !== 'ready') {
      return jsonError('Brief is not ready', 409)
    }

    const brief = briefRow.brief_json as {
      brandCandidates?: { logoAssetId?: string; stillAssetIds?: string[] }
    }
    const brandAssetIds = [
      brief.brandCandidates?.logoAssetId,
      ...(brief.brandCandidates?.stillAssetIds ?? []),
    ].filter((id): id is string => Boolean(id))

    if (brandAssetIds.length > 0) {
      const missing = brandAssetIds.filter((id) => !project.assets.some((asset) => asset.id === id))
      if (missing.length > 0) {
        const { data: rows, error: assetError } = await supabase
          .from('assets')
          .select('id, kind, blob_key, content_type, source, probe')
          .eq('project_id', projectId)
          .in('id', missing)
        if (assetError) {
          return jsonError(`Failed to load extract assets: ${assetError.message}`, 500)
        }
        for (const row of rows ?? []) {
          if (project.assets.some((asset) => asset.id === row.id)) continue
          project = attachAsset(project, projectAssetFromRow(row))
        }
      }
    }

    const applied = applyBriefToProject({
      project,
      brief: briefRow.brief_json,
      firstCutMode: body.firstCutMode,
    })
    const forSave = { ...applied.project, revision: baseRevision }
    const saved = await saveProject(supabase, forSave, body.expectedRevision)

    return Response.json({
      project: saved.project,
      modeUsed: applied.modeUsed,
      warning: applied.warning ?? null,
      briefId: briefRow.id,
      hookText: applied.hookText ?? null,
      endCardText: applied.endCardText ?? null,
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to apply brief', (err) => {
      if (err instanceof z.ZodError) return jsonError(err.message, 400)
      return null
    })
  }
}
