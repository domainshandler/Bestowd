import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.ts'
import { apiFetch } from '@bestowd/api-client'

export default function AccountPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [aiProvider, setAiProvider] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [saved, setSaved] = useState(false)

  const saveAi = useMutation({
    mutationFn: () =>
      apiFetch('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ aiProviderConfig: { provider: aiProvider, apiKey, model } }),
      }),
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2000) },
    onError: () => { setTimeout(() => saveAi.reset(), 2000) },
  })

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

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
        <h2 className="font-semibold text-gray-800 mb-4">AI Provider</h2>
        <p className="text-xs text-gray-400 mb-4">
          Your API key is encrypted and stored securely. It is never shared with other users.
        </p>
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={aiProvider} onChange={e => setAiProvider(e.target.value)}
            >
              <option value="">Select provider…</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="gemini">Google Gemini</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
            <input
              type="password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="sk-…" value={apiKey} onChange={e => setApiKey(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. gpt-4o, claude-sonnet-4-6" value={model} onChange={e => setModel(e.target.value)}
            />
          </div>
          <button
            onClick={() => saveAi.mutate()}
            disabled={!aiProvider || !apiKey || !model || saveAi.isPending}
            className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium disabled:opacity-50 self-start"
          >
            {saved ? '✓ Saved' : saveAi.isPending ? 'Saving…' : 'Save AI Config'}
          </button>
          {saved && <p className="text-sm text-green-600 mt-2">Configuration saved successfully</p>}
          {saveAi.isError && <p className="text-sm text-red-600 mt-2">{(saveAi.error as Error)?.message ?? 'Failed to save. Please try again.'}</p>}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-gray-800 mb-4">Subscription</h2>
        <p className="text-sm text-gray-600 mb-1">
          Plan: <span className="font-medium capitalize">{user?.subscriptionStatus ?? 'free'}</span>
        </p>
        <p className="text-xs text-gray-400">Upgrade to Premium to unlock Amazon price history.</p>
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
