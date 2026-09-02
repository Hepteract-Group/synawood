import { compileAuthoredComposition } from '@synawood/creative/authored/compile'
import { toAuthoredInputProps } from '@synawood/creative/authored/input-props'
import { authoredPreviewShouldPersist } from '@synawood/creative/authored/preview-persist'
import { createSignedBlobUrl } from '@synawood/creative'
import { isAuthoredComposition, loadProject } from '@synawood/creative/project'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const GET = async (
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const access = await requireStudioAccess({ projectId, minRole: 'viewer' })
    const { supabase, blobEnv } = access
    const { project } = await loadProject(supabase, projectId)
    if (!isAuthoredComposition(project.compositionId)) {
      return jsonError('This project is not an authored composition.', 400)
    }

    const source = project.compositionSource?.source ?? ''
    const compiled = compileAuthoredComposition(source)
    const compileError = compiled.ok ? null : compiled.compileError
    const nextSource = {
      source,
      motionSeed: project.compositionSource?.motionSeed ?? project.id,
      compileError,
      compiledAtRevision: compiled.ok
        ? project.revision
        : project.compositionSource?.compiledAtRevision,
    }

    if (
      authoredPreviewShouldPersist({
        existingCompileError: project.compositionSource?.compileError,
        existingCompiledAtRevision: project.compositionSource?.compiledAtRevision,
        nextCompileError: compileError,
        nextCompiledAtRevision: nextSource.compiledAtRevision,
      })
    ) {
      await supabase
        .from('studio_projects')
        .update({
          project_json: { ...project, compositionSource: nextSource },
          updated_at: new Date().toISOString(),
        })
        .eq('id', project.id)
        .eq('revision', project.revision)
    }

    const resolveUrl = (blobKey: string) =>
      createSignedBlobUrl({
        blobEnv,
        blobKey,
        expiresInSeconds: 60 * 60,
      })
    const inputProps = toAuthoredInputProps(project, resolveUrl)

    return Response.json({
      compileError,
      code: compiled.ok ? compiled.code : undefined,
      inputProps,
      fps: project.fps,
      width: project.width,
      height: project.height,
      durationInFrames: project.durationFrames,
      source,
      motionSeed: nextSource.motionSeed,
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to compile authored preview', (caught) => {
      const message =
        caught instanceof Error ? caught.message : 'Failed to compile authored preview'
      if (message.includes('not found')) return jsonError(message, 404)
      return null
    })
  }
}
