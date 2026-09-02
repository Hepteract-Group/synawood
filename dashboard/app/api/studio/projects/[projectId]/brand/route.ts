import {
  attachFallbackBrand,
  importProductBrand,
  updateProjectBrand,
  type BrandFieldPatch,
} from '@synawood/creative/brand'
import { patchReadyBriefBrandCandidates } from '@synawood/creative/brief'
import { brandChromeSchema, loadProject, saveProject } from '@synawood/creative/project'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { z } from 'zod'

const patchSchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    displayName: z.string().min(1).max(80).optional(),
    primaryColor: z.string().min(1).max(40).optional(),
    accentColor: z.string().min(1).max(40).optional(),
    captionBg: z.string().min(1).max(80).optional(),
    fontFamily: z.string().min(1).max(120).optional(),
    voiceId: z.string().min(1).max(80).optional(),
    defaultCta: z.string().min(1).max(160).optional(),
    mood: z.string().min(1).max(200).optional(),
    primaryStillAssetId: z.string().uuid().optional(),
    chrome: brandChromeSchema.optional(),
    clearLogo: z.boolean().optional(),
    clearLogoMono: z.boolean().optional(),
  })
  .strict()

export const POST = async (
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    const { supabase, blobEnv } = access
    const { project } = await loadProject(supabase, projectId)
    let imported: Awaited<ReturnType<typeof importProductBrand>>
    try {
      imported = await importProductBrand({
        supabase,
        blobEnv,
        project,
        productId: project.productId,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Brand import failed'
      // Missing disk kit or empty Product Brand Library — still attach operable chrome.
      if (
        /brand kit/i.test(message) ||
        /brand-kit/i.test(message) ||
        /brand library/i.test(message) ||
        /missing or invalid/i.test(message)
      ) {
        const fallback = attachFallbackBrand({
          project,
          productId: project.productId,
          displayName: project.name,
        })
        const forSave = { ...fallback.project, revision: project.revision }
        const saved = await saveProject(supabase, forSave, project.revision)
        return Response.json({
          project: saved.project,
          brand: saved.project.brand,
          library: null,
          fallbackBrand: true,
          warning: message,
        })
      }
      throw error
    }
    const forSave = { ...imported.project, revision: project.revision }
    const saved = await saveProject(supabase, forSave, project.revision)
    return Response.json({
      project: saved.project,
      brand: saved.project.brand,
      library: imported.library,
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to import product brand')
  }
}

export const PATCH = async (
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const body = patchSchema.parse(await request.json())
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    const { supabase } = access
    const { project } = await loadProject(supabase, projectId)
    const patch: BrandFieldPatch = {
      displayName: body.displayName,
      primaryColor: body.primaryColor,
      accentColor: body.accentColor,
      captionBg: body.captionBg,
      fontFamily: body.fontFamily,
      voiceId: body.voiceId,
      defaultCta: body.defaultCta,
      mood: body.mood,
      primaryStillAssetId: body.primaryStillAssetId,
      chrome: body.chrome,
      clearLogo: body.clearLogo,
      clearLogoMono: body.clearLogoMono,
    }
    const next = updateProjectBrand(project, patch)
    const forSave = { ...next, revision: project.revision }
    const saved = await saveProject(supabase, forSave, body.expectedRevision)
    if (
      body.clearLogo ||
      body.primaryColor ||
      body.accentColor ||
      body.displayName ||
      body.defaultCta
    ) {
      await patchReadyBriefBrandCandidates(supabase, projectId, {
        clearLogo: body.clearLogo || undefined,
        primaryColor: body.primaryColor,
        accentColor: body.accentColor,
        displayName: body.displayName,
        defaultCta: body.defaultCta,
      })
    }
    return Response.json({ project: saved.project, brand: saved.project.brand })
  } catch (error) {
    return handleRouteError(error, 'Failed to update brand', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return null
    })
  }
}
