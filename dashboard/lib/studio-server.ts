import { createServiceSupabase, readBlobEnv, readSupabaseEnv } from '@synawood/creative'
import {
  ProductAccessError,
  requireProductRole,
  type ProductMembership,
  type ProductRole,
} from './product-membership'
import { AuthRequiredError, requireUser } from './require-user'

export const getStudioClients = () => {
  const supabaseEnv = readSupabaseEnv(process.env)
  const blobEnv = readBlobEnv(process.env)
  const supabase = createServiceSupabase(supabaseEnv)
  return { supabase, blobEnv, supabaseEnv }
}

export const jsonError = (message: string, status = 400) =>
  Response.json({ error: message }, { status })

export const jsonAccessError = (error: unknown): Response | null => {
  if (error instanceof AuthRequiredError) {
    return jsonError(error.message, error.status)
  }
  if (error instanceof ProductAccessError) {
    return jsonError(error.message, error.status)
  }
  return null
}

/** Central catch for route handlers — access errors first, then optional domain maps. */
export const handleRouteError = (
  error: unknown,
  fallbackMessage: string,
  mapOther?: (error: unknown) => Response | null,
): Response => {
  const denied = jsonAccessError(error)
  if (denied) return denied
  const mapped = mapOther?.(error) ?? null
  if (mapped) return mapped
  return jsonError(error instanceof Error ? error.message : fallbackMessage, 500)
}

type ProductIdTable =
  | 'studio_projects'
  | 'content_slots'
  | 'render_jobs'
  | 'publish_records'
  | 'final_assets'
  | 'generation_jobs'

const lookupRowProductId = async (
  supabase: ReturnType<typeof createServiceSupabase>,
  table: ProductIdTable,
  id: string,
  label: string,
): Promise<string> => {
  const { data, error } = await supabase.from(table).select('product_id').eq('id', id).maybeSingle()
  if (error) {
    throw new Error(`Failed to load ${label.toLowerCase()}: ${error.message}`)
  }
  if (!data?.product_id) {
    throw new ProductAccessError(`${label} not found`, 404)
  }
  return data.product_id as string
}

type AccessInput = {
  productId?: string
  projectId?: string
  slotId?: string
  renderJobId?: string
  generationJobId?: string
  publishId?: string
  finalAssetId?: string
  minRole?: ProductRole
}

export type StudioAccess = {
  userId: string
  productId: string
  membership: ProductMembership
  supabase: ReturnType<typeof createServiceSupabase>
  blobEnv: ReturnType<typeof readBlobEnv>
}

/** Authenticated user + product membership (fail closed). */
export const requireStudioAccess = async (input: AccessInput): Promise<StudioAccess> => {
  const user = await requireUser()
  const { supabase, blobEnv } = getStudioClients()
  const minRole = input.minRole ?? 'viewer'

  let productId = input.productId
  if (!productId && input.projectId) {
    productId = await lookupRowProductId(supabase, 'studio_projects', input.projectId, 'Project')
  }
  if (!productId && input.slotId) {
    productId = await lookupRowProductId(supabase, 'content_slots', input.slotId, 'Content slot')
  }
  if (!productId && input.renderJobId) {
    productId = await lookupRowProductId(supabase, 'render_jobs', input.renderJobId, 'Render job')
  }
  if (!productId && input.generationJobId) {
    productId = await lookupRowProductId(
      supabase,
      'generation_jobs',
      input.generationJobId,
      'Generation job',
    )
  }
  if (!productId && input.publishId) {
    productId = await lookupRowProductId(
      supabase,
      'publish_records',
      input.publishId,
      'Publish record',
    )
  }
  if (!productId && input.finalAssetId) {
    productId = await lookupRowProductId(
      supabase,
      'final_assets',
      input.finalAssetId,
      'Final asset',
    )
  }
  if (!productId) {
    throw new ProductAccessError('productId is required', 400)
  }

  const membership = await requireProductRole(supabase, {
    userId: user.id,
    productId,
    minRole,
  })

  return {
    userId: user.id,
    productId,
    membership,
    supabase,
    blobEnv,
  }
}
