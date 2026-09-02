import type { SupabaseClient } from '@supabase/supabase-js'
import { isProductRole, type ProductRole } from './product-membership'
import {
  defaultFunctionalRole,
  isFunctionalRole,
  isInviteFunctionalRole,
  resolveInviteFunctionalRole,
  type FunctionalRole,
} from './functional-roles'
import { ensureTrialBilling } from '@synawood/creative/billing/ensure-trial'
import { recordBillingEvent } from '@synawood/creative/billing/events'
import { logAuditEvent } from './audit'
import { isValidProductSlug, slugifyProductName } from './product-slug'

export type ProductSummary = {
  id: string
  slug: string
  name: string
}

export type MembershipWithProduct = {
  productId: string
  role: ProductRole
  product: ProductSummary
}

export type ProductMember = {
  userId: string
  role: ProductRole
  functionalRole: FunctionalRole
  createdAt: string
}

export type ProductInvite = {
  id: string
  productId: string
  email: string
  role: 'editor' | 'viewer'
  functionalRole: FunctionalRole
  token: string
  expiresAt: string | null
  acceptedAt: string | null
  createdAt: string
}

export {
  INVITE_FUNCTIONAL_ROLES,
  isInviteFunctionalRole,
  resolveInviteFunctionalRole,
} from './functional-roles'

const mapInviteRow = (row: {
  id: unknown
  product_id: unknown
  email: unknown
  role: unknown
  functional_role?: unknown
  token: unknown
  expires_at: unknown
  accepted_at: unknown
  created_at: unknown
}): ProductInvite => {
  const role = row.role as 'editor' | 'viewer'
  return {
    id: row.id as string,
    productId: row.product_id as string,
    email: row.email as string,
    role,
    functionalRole: resolveInviteFunctionalRole(
      role,
      (row.functional_role as string | null) ?? null,
    ),
    token: row.token as string,
    expiresAt: (row.expires_at as string | null) ?? null,
    acceptedAt: (row.accepted_at as string | null) ?? null,
    createdAt: row.created_at as string,
  }
}

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 14

/** Edge/middleware-safe token (no node:crypto — that breaks Next webpack). */
const randomInviteToken = (): string => {
  const bytes = new Uint8Array(24)
  globalThis.crypto.getRandomValues(bytes)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const normalizeEmail = (email: string): string => email.trim().toLowerCase()

export { hasPendingInviteForEmail, userMayAccessApp } from './product-access-gate'

export const listMembershipsForUser = async (
  supabase: SupabaseClient,
  userId: string,
): Promise<MembershipWithProduct[]> => {
  const { data, error } = await supabase
    .from('product_members')
    .select('product_id, role, products ( id, slug, name )')
    .eq('user_id', userId)

  if (error) {
    throw new Error(`Failed to load memberships: ${error.message}`)
  }

  const rows = data ?? []
  const out: MembershipWithProduct[] = []
  for (const row of rows) {
    if (!isProductRole(row.role)) continue
    const productRaw = row.products
    const product = Array.isArray(productRaw) ? productRaw[0] : productRaw
    if (!product || typeof product !== 'object') continue
    const p = product as { id?: unknown; slug?: unknown; name?: unknown }
    if (typeof p.id !== 'string' || typeof p.slug !== 'string' || typeof p.name !== 'string') {
      continue
    }
    out.push({
      productId: row.product_id as string,
      role: row.role,
      product: { id: p.id, slug: p.slug, name: p.name },
    })
  }
  return out
}

export const createProductAsOwner = async (
  supabase: SupabaseClient,
  input: { userId: string; name: string; slug?: string },
): Promise<ProductSummary> => {
  const name = input.name.trim()
  if (name.length < 2 || name.length > 80) {
    throw new Error('Product name must be between 2 and 80 characters.')
  }
  const slug = (input.slug?.trim() || slugifyProductName(name)).toLowerCase()
  if (!isValidProductSlug(slug)) {
    throw new Error('Use a slug with lowercase letters, numbers, and hyphens (2–64 chars).')
  }

  const { data: product, error: productError } = await supabase
    .from('products')
    .insert({ id: slug, slug, name })
    .select('id, slug, name')
    .single()

  if (productError) {
    if (productError.code === '23505') {
      throw new Error('That organization URL is already taken. Choose another.')
    }
    throw new Error(`Could not create Product: ${productError.message}`)
  }

  const { error: memberError } = await supabase.from('product_members').insert({
    user_id: input.userId,
    product_id: product.id,
    role: 'owner',
    functional_role: defaultFunctionalRole('owner'),
  })

  if (memberError) {
    await supabase.from('products').delete().eq('id', product.id)
    throw new Error(`Could not assign owner: ${memberError.message}`)
  }

  try {
    await ensureTrialBilling(supabase, { productId: product.id })
  } catch (error) {
    await supabase.from('products').delete().eq('id', product.id)
    throw error instanceof Error ? error : new Error('Could not create trial billing.')
  }

  await logAuditEvent(supabase, {
    productId: product.id,
    actorUserId: input.userId,
    action: 'member.created',
    payload: { role: 'owner', functionalRole: defaultFunctionalRole('owner') },
  })

  await recordBillingEvent(supabase, {
    productId: product.id,
    actorUserId: input.userId,
    name: 'org_created',
    payload: { slug: product.slug, name: product.name },
  })

  return product as ProductSummary
}

export const listMembersForProduct = async (
  supabase: SupabaseClient,
  productId: string,
): Promise<ProductMember[]> => {
  const { data, error } = await supabase
    .from('product_members')
    .select('user_id, role, functional_role, created_at')
    .eq('product_id', productId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to list members: ${error.message}`)
  }

  return (data ?? [])
    .filter((row) => isProductRole(row.role) && isFunctionalRole(row.functional_role))
    .map((row) => ({
      userId: row.user_id as string,
      role: row.role as ProductRole,
      functionalRole: row.functional_role as FunctionalRole,
      createdAt: row.created_at as string,
    }))
}

export const findMemberForRoleChange = (
  members: ProductMember[],
  userId: string,
  nextRole: FunctionalRole,
): ProductMember => {
  const current = members.find((member) => member.userId === userId)
  if (!current) {
    throw new Error('Member not found on this Product.')
  }
  if (
    current.functionalRole === 'founder' &&
    nextRole !== 'founder' &&
    members.filter((member) => member.functionalRole === 'founder').length <= 1
  ) {
    throw new Error('Keep at least one founder on this Product.')
  }
  return current
}

export const updateMemberFunctionalRole = async (
  supabase: SupabaseClient,
  input: {
    productId: string
    userId: string
    functionalRole: FunctionalRole
    actorUserId: string
  },
): Promise<ProductMember> => {
  if (!isFunctionalRole(input.functionalRole)) {
    throw new Error('Job function must be founder, editor, reviewer, publisher, or analyst.')
  }

  const members = await listMembersForProduct(supabase, input.productId)
  const current = findMemberForRoleChange(members, input.userId, input.functionalRole)

  const { data, error } = await supabase
    .from('product_members')
    .update({ functional_role: input.functionalRole })
    .eq('user_id', input.userId)
    .eq('product_id', input.productId)
    .select('user_id, role, functional_role, created_at')
    .single()

  if (error || !data || !isProductRole(data.role) || !isFunctionalRole(data.functional_role)) {
    throw new Error(`Could not update job function: ${error?.message ?? 'invalid member row'}`)
  }

  await logAuditEvent(supabase, {
    productId: input.productId,
    actorUserId: input.actorUserId,
    action: 'member.functional_role.changed',
    payload: {
      userId: input.userId,
      from: current.functionalRole,
      to: input.functionalRole,
    },
  })

  return {
    userId: data.user_id as string,
    role: data.role,
    functionalRole: data.functional_role,
    createdAt: data.created_at as string,
  }
}

export const listInvitesForProduct = async (
  supabase: SupabaseClient,
  productId: string,
): Promise<ProductInvite[]> => {
  const { data, error } = await supabase
    .from('product_invites')
    .select(
      'id, product_id, email, role, functional_role, token, expires_at, accepted_at, created_at',
    )
    .eq('product_id', productId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to list invites: ${error.message}`)
  }

  return (data ?? []).map(mapInviteRow)
}

export const createProductInvite = async (
  supabase: SupabaseClient,
  input: {
    productId: string
    email: string
    role: 'editor' | 'viewer'
    functionalRole?: FunctionalRole
    invitedBy: string
  },
): Promise<ProductInvite> => {
  const email = normalizeEmail(input.email)
  if (!email.includes('@')) {
    throw new Error('Enter a valid email address.')
  }
  if (input.role !== 'editor' && input.role !== 'viewer') {
    throw new Error('Invite role must be editor or viewer.')
  }
  if (input.functionalRole && !isInviteFunctionalRole(input.functionalRole)) {
    throw new Error('Invite job function must be editor, reviewer, publisher, or analyst.')
  }
  const functionalRole = resolveInviteFunctionalRole(input.role, input.functionalRole ?? null)

  const token = randomInviteToken()
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString()

  const { data, error } = await supabase
    .from('product_invites')
    .insert({
      product_id: input.productId,
      email,
      role: input.role,
      functional_role: functionalRole,
      token,
      invited_by: input.invitedBy,
      expires_at: expiresAt,
    })
    .select(
      'id, product_id, email, role, functional_role, token, expires_at, accepted_at, created_at',
    )
    .single()

  if (error) {
    throw new Error(`Could not create invite: ${error.message}`)
  }

  await logAuditEvent(supabase, {
    productId: input.productId,
    actorUserId: input.invitedBy,
    action: 'invite.created',
    payload: { email, role: input.role, functionalRole, inviteId: data.id },
  })

  return mapInviteRow(data)
}

export const revokeProductInvite = async (
  supabase: SupabaseClient,
  input: { productId: string; inviteId: string; actorUserId: string },
): Promise<void> => {
  const { error } = await supabase
    .from('product_invites')
    .delete()
    .eq('id', input.inviteId)
    .eq('product_id', input.productId)
    .is('accepted_at', null)

  if (error) {
    throw new Error(`Could not revoke invite: ${error.message}`)
  }

  await logAuditEvent(supabase, {
    productId: input.productId,
    actorUserId: input.actorUserId,
    action: 'invite.revoked',
    payload: { inviteId: input.inviteId },
  })
}

export const loadInviteByToken = async (
  supabase: SupabaseClient,
  token: string,
): Promise<(ProductInvite & { productName: string }) | null> => {
  const { data, error } = await supabase
    .from('product_invites')
    .select(
      'id, product_id, email, role, functional_role, token, expires_at, accepted_at, created_at, products ( name )',
    )
    .eq('token', token)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load invite: ${error.message}`)
  }
  if (!data) return null

  const productRaw = data.products
  const product = Array.isArray(productRaw) ? productRaw[0] : productRaw
  const productName =
    product &&
    typeof product === 'object' &&
    typeof (product as { name?: unknown }).name === 'string'
      ? (product as { name: string }).name
      : data.product_id

  return {
    ...mapInviteRow(data),
    productName: productName as string,
  }
}

export const acceptProductInvite = async (
  supabase: SupabaseClient,
  input: { token: string; userId: string; email: string },
): Promise<{ productId: string; role: ProductRole }> => {
  const invite = await loadInviteByToken(supabase, input.token)
  if (!invite) {
    throw new Error('Invite not found. Ask an owner for a new link.')
  }
  if (invite.acceptedAt) {
    throw new Error('This invite was already accepted.')
  }
  if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
    throw new Error('This invite expired. Ask an owner for a new link.')
  }
  if (normalizeEmail(invite.email) !== normalizeEmail(input.email)) {
    throw new Error(`Sign in as ${invite.email} to accept this invite.`)
  }

  const { error: memberError } = await supabase.from('product_members').upsert(
    {
      user_id: input.userId,
      product_id: invite.productId,
      role: invite.role,
      functional_role: invite.functionalRole,
    },
    { onConflict: 'user_id,product_id', ignoreDuplicates: true },
  )

  if (memberError) {
    throw new Error(`Could not join Product: ${memberError.message}`)
  }

  const { error: acceptError } = await supabase
    .from('product_invites')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id)

  if (acceptError) {
    throw new Error(`Joined, but could not mark invite accepted: ${acceptError.message}`)
  }

  await logAuditEvent(supabase, {
    productId: invite.productId,
    actorUserId: input.userId,
    action: 'invite.accepted',
    payload: {
      inviteId: invite.id,
      role: invite.role,
      functionalRole: invite.functionalRole,
    },
  })

  return { productId: invite.productId, role: invite.role }
}
