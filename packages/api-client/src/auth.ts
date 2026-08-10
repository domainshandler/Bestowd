import { apiFetch } from './client.js'
import type { User } from '@bestowd/types'

export function googleLogin(idToken: string): Promise<{ token: string; user: User }> {
  return apiFetch('/auth/google', { method: 'POST', body: JSON.stringify({ idToken }) })
}

export function getMe(): Promise<User> {
  return apiFetch('/auth/me')
}
