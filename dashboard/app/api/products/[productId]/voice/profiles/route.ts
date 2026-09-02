import { NextResponse } from 'next/server'
import { z } from 'zod'
import { DEFAULT_MODEL_PROFILE_ID } from '@synawood/creative/model-profiles'
import {
  createProductVoiceProfile,
  isVoiceOperatorError,
  listVoiceProfiles,
} from '@synawood/creative/voice'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const createSchema = z
  .object({
    name: z.string().min(1).max(80),
    locale: z.string().min(2).max(16).optional(),
    kind: z.enum(['synth', 'clone']),
    consentRecorded: z.boolean(),
  })
  .strict()

const activeModelProfileId = (): string =>
  process.env.MODEL_PROFILE?.trim() || DEFAULT_MODEL_PROFILE_ID

export const GET = async (
  _request: Request,
  context: { params: Promise<{ productId: string }> },
) => {
  try {
    const { productId } = await context.params
    const access = await requireStudioAccess({ productId, minRole: 'editor' })
    const profiles = await listVoiceProfiles(access.supabase, productId)
    return NextResponse.json({ profiles })
  } catch (error) {
    return handleRouteError(error, 'Could not load voice profiles.')
  }
}

export const POST = async (
  request: Request,
  context: { params: Promise<{ productId: string }> },
) => {
  try {
    const { productId } = await context.params
    const access = await requireStudioAccess({ productId, minRole: 'editor' })
    const contentType = request.headers.get('content-type') ?? ''
    const modelProfileId = activeModelProfileId()

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const name = String(form.get('name') ?? '').trim()
      const locale = String(form.get('locale') ?? 'en').trim() || 'en'
      const kindRaw = String(form.get('kind') ?? 'synth')
      const kind = kindRaw === 'clone' ? 'clone' : 'synth'
      const consentRecorded = String(form.get('consentRecorded') ?? '') === 'true'
      if (!name) return jsonError('Name is required.', 400)
      const file = form.get('file')
      const sample =
        file instanceof File && file.size > 0
          ? {
              bytes: new Uint8Array(await file.arrayBuffer()),
              contentType: file.type || 'audio/webm',
              fileName: file.name || 'voice-sample.webm',
            }
          : null
      const profile = await createProductVoiceProfile({
        supabase: access.supabase,
        blobEnv: access.blobEnv,
        productId,
        name,
        locale,
        kind,
        consentRecorded,
        sample,
        modelProfileId,
      })
      return NextResponse.json({ profile })
    }

    const body = createSchema.parse(await request.json())
    const profile = await createProductVoiceProfile({
      supabase: access.supabase,
      blobEnv: access.blobEnv,
      productId,
      name: body.name,
      locale: body.locale,
      kind: body.kind,
      consentRecorded: body.consentRecorded,
      sample: null,
      modelProfileId,
    })
    return NextResponse.json({ profile })
  } catch (error) {
    return handleRouteError(error, 'Could not create voice profile.', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      if (isVoiceOperatorError(err)) {
        return jsonError(err.message, 400)
      }
      return null
    })
  }
}
