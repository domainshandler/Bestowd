import { GoogleLogin } from '@react-oauth/google'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.ts'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-light">
      <div className="bg-white rounded-2xl shadow-lg p-10 flex flex-col items-center gap-6 w-full max-w-sm">
        <h1 className="text-3xl font-bold text-brand-dark">Bestowd</h1>
        <p className="text-gray-500 text-sm text-center">Smart gift giving, made thoughtful.</p>
        <GoogleLogin
          onSuccess={async (response) => {
            if (response.credential) {
              await login(response.credential)
              navigate('/dashboard')
            }
          }}
          onError={() => console.error('Google login failed')}
        />
      </div>
    </div>
  )
}
