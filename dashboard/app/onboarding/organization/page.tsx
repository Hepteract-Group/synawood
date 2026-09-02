import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { listMembershipsForUser } from '../../../lib/product-onboarding'
import { requireUser } from '../../../lib/require-user'
import { getStudioClients } from '../../../lib/studio-server'
import { OrganizationOnboardingForm } from './organization-form'

export const metadata: Metadata = {
  title: 'Your organization',
}

export const dynamic = 'force-dynamic'

const OrganizationOnboardingPage = async () => {
  const user = await requireUser()
  const { supabase } = getStudioClients()
  const memberships = await listMembershipsForUser(supabase, user.id)
  // Org already exists (e.g. create succeeded then stale gate bounced back) — #1171.
  if (memberships.length > 0) {
    redirect('/settings/members')
  }
  return <OrganizationOnboardingForm />
}

export default OrganizationOnboardingPage
