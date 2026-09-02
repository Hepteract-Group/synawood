import { createProject, summarizeProject } from '@synawood/creative/project'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

/** Create a Studio project for this slot (or return the linked one). */
export const POST = async (_request: Request, context: { params: Promise<{ slotId: string }> }) => {
  try {
    const { slotId } = await context.params
    const access = await requireStudioAccess({ slotId, minRole: 'editor' })
    const { supabase } = access

    const { data: slot, error: slotError } = await supabase
      .from('content_slots')
      .select('*')
      .eq('id', slotId)
      .maybeSingle()
    if (slotError) {
      return jsonError(`Failed to load slot: ${slotError.message}`, 500)
    }
    if (!slot) {
      return jsonError('Slot not found', 404)
    }

    const row = slot as {
      id: string
      product_id: string
      project_id: string | null
      status: string
    }

    if (row.project_id) {
      return Response.json({
        projectId: row.project_id,
        href: `/studio/${row.project_id}`,
        created: false,
      })
    }

    const { project } = await createProject(supabase, {
      productId: row.product_id,
    })

    const { error: updateError } = await supabase
      .from('content_slots')
      .update({ project_id: project.id, status: 'in_studio' })
      .eq('id', slotId)
    if (updateError) {
      return jsonError(`Failed to link Studio project: ${updateError.message}`, 500)
    }

    return Response.json(
      {
        projectId: project.id,
        href: `/studio/${project.id}`,
        created: true,
        summary: summarizeProject(project),
      },
      { status: 201 },
    )
  } catch (error) {
    return handleRouteError(error, 'Failed to open Studio')
  }
}
