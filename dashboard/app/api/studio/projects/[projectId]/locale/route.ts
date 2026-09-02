import { localeCodeSchema } from '@synawood/creative/locale/schema'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import {
  jsonFromToolOutcome,
  mapStudioRouteError,
  runStudioProjectTool,
} from '@/lib/studio-tool-route'
import type { StudioToolName } from '@synawood/creative/tools'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LOCALE_ACTION_TOOLS = {
  set: 'set_active_locale',
  translate: 'translate_all_missing',
  dub: 'dub_project_for_locale',
  money: 'apply_locale_money',
} as const satisfies Record<string, StudioToolName>

const revisionFields = {
  expectedRevision: z.number().int().positive(),
}

const bodySchema = z.discriminatedUnion('action', [
  z
    .object({
      ...revisionFields,
      action: z.literal('set'),
      locale: localeCodeSchema,
      confirmSpend: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      ...revisionFields,
      action: z.literal('translate'),
      locale: localeCodeSchema,
      confirmSpend: z.boolean().optional(),
      applyToPreview: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      ...revisionFields,
      action: z.literal('dub'),
      locale: localeCodeSchema,
      confirmSpend: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      ...revisionFields,
      action: z.literal('money'),
      currency: z
        .string()
        .trim()
        .regex(/^[A-Z]{3}$/),
      amountMinor: z.number().int().nonnegative().optional(),
      applyToCta: z.boolean().optional(),
    })
    .strict(),
])

const toolInputForBody = (body: z.infer<typeof bodySchema>): Record<string, unknown> => {
  if (body.action === 'money') {
    return {
      currency: body.currency,
      amountMinor: body.amountMinor,
      applyToCta: body.applyToCta,
    }
  }
  if (body.action === 'translate') {
    return {
      locale: body.locale,
      confirmSpend: body.confirmSpend,
      applyToPreview: body.applyToPreview,
    }
  }
  return { locale: body.locale, confirmSpend: body.confirmSpend }
}

/** POST — set_active_locale / translate_all_missing / dub_project_for_locale / apply_locale_money. */
export const POST = async (
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const body = bodySchema.parse(await request.json())
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    const { outcome, project, traceWarning } = await runStudioProjectTool(
      access,
      projectId,
      body.expectedRevision,
      LOCALE_ACTION_TOOLS[body.action],
      toolInputForBody(body),
    )
    return jsonFromToolOutcome(outcome, { project, traceWarning })
  } catch (error) {
    return handleRouteError(error, 'Failed to update locale', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return mapStudioRouteError(err)
    })
  }
}
