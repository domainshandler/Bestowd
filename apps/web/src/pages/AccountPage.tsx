import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.ts'

export default function AccountPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Account</h1>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex items-center gap-4">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name} className="w-14 h-14 rounded-full" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-brand-light flex items-center justify-center text-2xl font-bold text-brand">
              {user?.name[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-semibold text-gray-900">{user?.name}</p>
            <p className="text-sm text-gray-500">{user?.email}</p>
            <p className="text-xs mt-1 text-green-600 font-medium">
              {user?.emailVerified ? '✓ Google Verified' : 'Unverified'}
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={handleLogout}
        className="mt-6 text-sm text-red-500 hover:text-red-700 hover:underline"
      >
        Sign out
      </button>
    </div>
  )
}
