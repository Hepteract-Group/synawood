import { getSlideshowPreset } from '@synawood/creative/presets/slideshow'
import {
  buildSlideBackgroundPrompt,
  loadProject,
  setSlideBackground,
} from '@synawood/creative/project'
import {
  applyProjectMutation,
  runGenerateImageTool,
  type StudioToolContext,
} from '@synawood/creative/tools'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { z } from 'zod'

const bodySchema = z.object({
  expectedRevision: z.number().int().positive(),
  headline: z.string().max(120).optional(),
  direction: z.string().max(400).optional(),
  /** When true, attach immediately. Default false — return candidate for preview. */
  apply: z.boolean().optional().default(false),
})

export const POST = async (
  request: Request,
  context: { params: Promise<{ projectId: string; slideId: string }> },
) => {
  try {
    const { projectId, slideId } = await context.params
    const body = bodySchema.parse(await request.json())
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    const { supabase, blobEnv } = access
    const { project, row } = await loadProject(supabase, projectId)

    if (!project.slideshow) {
      return jsonError('This project is not a slideshow', 400)
    }
    const slide = project.slideshow.slides.find((item) => item.id === slideId)
    if (!slide) {
      return jsonError(`Unknown slide ${slideId}`, 404)
    }
    if (!project.brand) {
      return jsonError(
        'No project brand. Open Brand in the header to set logo and colors, then try again.',
        400,
      )
    }

    const headline = body.headline?.trim() || slide.headline
    const prompt = buildSlideBackgroundPrompt({
      headline,
      direction: body.direction,
    })
    const preset = getSlideshowPreset(project.slideshow.presetId)
    const aspectRatio = preset.aspect

    const toolContext: StudioToolContext = {
      productId: project.productId,
      projectId,
      project,
      expectedRevision: body.expectedRevision,
      supabase,
      blobEnv,
      modelProfileId: row.model_profile_id,
      persist: true,
      toolTrace: [],
    }

    const gen = await runGenerateImageTool(toolContext, { prompt, aspectRatio })
    if (!gen.ok) {
      return jsonError(gen.error ?? 'Image generation failed', 400)
    }
    const assetId = String((gen.data as { assetId?: string } | undefined)?.assetId ?? '')
    if (!assetId) {
      return jsonError('Image generation did not return an assetId', 500)
    }

    // Generation attaches the asset to the project; reload for revision + asset list.
    let { project: next } = await loadProject(supabase, projectId)
    let applied = false
    if (body.apply) {
      const mutated = await applyProjectMutation(
        {
          ...toolContext,
          project: next,
          expectedRevision: next.revision,
        },
        (current) => setSlideBackground(current, { slideId, backgroundAssetId: assetId }),
      )
      next = mutated.project
      applied = true
    }

    return Response.json({
      assetId,
      applied,
      previewUrl: `/api/studio/projects/${projectId}/assets/${assetId}/content`,
      prompt,
      project: next,
      revision: next.revision,
    })
  } catch (error) {
    return handleRouteError(error, 'Slide background generation failed', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return null
    })
  }
}
