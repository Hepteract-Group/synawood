import { Suspense } from 'react'
import { LoginForm } from './login-form'

const LoginPage = () => (
  <Suspense
    fallback={
      <div className="auth-shell" role="status" aria-live="polite">
        Loading sign-in…
      </div>
    }
  >
    <LoginForm />
  </Suspense>
)

export default LoginPage
