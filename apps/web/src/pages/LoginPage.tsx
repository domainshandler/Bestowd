import { useGoogleLogin } from '@react-oauth/google'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.ts'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      await login(tokenResponse.access_token)
      navigate('/dashboard')
    },
    onError: () => console.error('Google login failed'),
  })

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-light">
      <div className="bg-white rounded-2xl shadow-lg p-10 flex flex-col items-center gap-6 w-full max-w-sm">
        <h1 className="text-3xl font-bold text-brand-dark">Bestowd</h1>
        <p className="text-gray-500 text-sm text-center">Smart gift giving, made thoughtful.</p>
        <button
          onClick={() => handleGoogleLogin()}
          className="flex items-center gap-3 bg-white border border-gray-300 rounded-lg px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm w-full justify-center"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4" />
          Sign in with Google
        </button>
      </div>
    </div>
  )
}
