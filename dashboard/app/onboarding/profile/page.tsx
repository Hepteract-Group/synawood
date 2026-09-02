import type { Metadata } from 'next'
import { ProfileOnboardingForm } from './profile-form'

export const metadata: Metadata = {
  title: 'About you',
}

const ProfileOnboardingPage = () => <ProfileOnboardingForm />

export default ProfileOnboardingPage
