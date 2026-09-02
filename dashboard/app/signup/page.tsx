import { Suspense } from 'react'
import { SignupForm } from './signup-form'

const SignupPage = () => (
  <Suspense
    fallback={
      <div className="auth-shell" role="status" aria-live="polite">
        Loading create account…
      </div>
    }
  >
    <SignupForm />
  </Suspense>
)

export default SignupPage
