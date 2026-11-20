import { GoogleLogin } from '@react-oauth/google'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.ts'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  return (
    <div className="min-h-screen flex items-center justify-center bg-ground px-5">
      <div className="bg-white border border-line rounded-3xl p-10 flex flex-col items-center gap-6 w-full max-w-sm">
        <h1 className="text-3xl font-bold text-brand">Bestowd</h1>
        <p className="text-muted text-sm text-center">Remember every birthday, and every gift, both ways.</p>
        <GoogleLogin
          onSuccess={async (response) => {
            if (response.credential) {
              await login(response.credential)
              navigate(from, { replace: true })
            }
          }}
          onError={() => console.error('Google login failed')}
        />
      </div>
    </div>
  )
}
