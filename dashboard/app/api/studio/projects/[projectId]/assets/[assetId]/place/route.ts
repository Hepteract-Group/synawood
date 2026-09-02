import {
  addClip,
  ensureAssetOnProject,
  loadProject,
  RevisionConflictError,
  saveProject,
} from '@synawood/creative/project'
import { placeShotOnProject } from '@synawood/creative/asset-intelligence'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { z } from 'zod'

const bodySchema = z.object({
  expectedRevision: z.number().int().positive(),
  from: z.number().int().nonnegative().optional(),
  startMs: z.number().int().nonnegative().optional(),
  endMs: z.number().int().nonnegative().nullable().optional(),
  /** When false, only attach product-library asset onto project JSON (#441 Reference). */
  addToTimeline: z.boolean().optional().default(true),
})

/**
 * Recall a library asset onto the timeline (ADR-0015 / #441).
 * Ensures product-scoped indexed assets are attached to project JSON first
 * (Story Builder Place for orphans removed from Library).
 */
export const POST = async (
  request: Request,
  context: { params: Promise<{ projectId: string; assetId: string }> },
) => {
  try {
    const { projectId, assetId } = await context.params
    const body = bodySchema.parse(await request.json())
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    const { supabase } = access
    const { project } = await loadProject(supabase, projectId)
    const ensured = await ensureAssetOnProject({
      supabase,
      project,
      assetId,
    })

    let next = ensured.project
    if (body.addToTimeline) {
      if (body.startMs != null) {
        next = placeShotOnProject(next, {
          assetId,
          startMs: body.startMs,
          endMs: body.endMs ?? null,
        })
      } else {
        const from =
          body.from ??
          next.clips.reduce((end, clip) => Math.max(end, clip.from + clip.durationInFrames), 0)
        // addClip auto-fits duration to content (ADR-0014), so recall never overflows.
        next = addClip(next, { assetId, from })
      }
    } else if (!ensured.attached) {
      // Already on project and no timeline change — nothing to save.
      return Response.json({ project: ensured.project, attached: false })
    }

    const { project: saved } = await saveProject(supabase, next, body.expectedRevision)
    return Response.json({ project: saved, attached: ensured.attached })
  } catch (error) {
    return handleRouteError(error, 'Failed to place asset', (error) => {
      if (error instanceof RevisionConflictError) {
        return jsonError(error.message, 409)
      }
      if (error instanceof z.ZodError) {
        return jsonError(error.issues.map((issue) => issue.message).join('; '), 400)
      }
      return null
    })
  }
}
