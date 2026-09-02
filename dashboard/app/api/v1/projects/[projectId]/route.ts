import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleRouteError, jsonError } from '../../../../../lib/studio-server'
import { withApiKey } from '../../../../../lib/with-api-key'
import {
  recordV1MutationIdempotency,
  replayIfStored,
  requireIdempotencyKey,
} from '../../../../../lib/v1-idempotency'
import {
  loadV1ProjectForKey,
  patchV1Project,
  RevisionConflictError,
  v1ProjectReadBody,
} from '../../../../../lib/v1-project'

export const GET = async (
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const access = await withApiKey(request)
    const { project } = await loadV1ProjectForKey(access, projectId)
    return NextResponse.json(v1ProjectReadBody(project))
  } catch (error) {
    return handleRouteError(error, 'Failed to load project', (error) => {
      const message = error instanceof Error ? error.message : 'Failed to load project'
      if (message.includes('not found')) return jsonError(message, 404)
      return null
    })
  }
}

export const PATCH = async (
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const access = await withApiKey(request)
    requireIdempotencyKey(request)
    const raw = await request.json().catch(() => ({}))
    const replay = await replayIfStored(request, access, raw)
    if (replay) return replay
    const result = await patchV1Project(access, projectId, raw)
    return recordV1MutationIdempotency(request, access, raw, NextResponse.json(result))
  } catch (error) {
    return handleRouteError(error, 'Failed to save project', (error) => {
      if (error instanceof RevisionConflictError) {
        return jsonError(error.message, 409)
      }
      if (error instanceof z.ZodError) {
        return jsonError(error.issues.map((issue) => issue.message).join('; '), 400)
      }
      const message = error instanceof Error ? error.message : ''
      if (message.includes('not found')) return jsonError(message, 404)
      if (message.includes('must match URL')) return jsonError(message, 400)
      if (message.includes('name')) return jsonError(message, 400)
      return null
    })
  }
}
