import { apiFetch } from './client.js'
import { json } from './query.js'
import type { Me, User, UpdateUserBody } from '@bestowd/types'

export function googleLogin(idToken: string): Promise<{ token: string; user: User }> {
  return apiFetch('/auth/google', { method: 'POST', body: json({ idToken }) })
}

export function getAuthMe(): Promise<User> {
  return apiFetch('/auth/me')
}

export function updateMe(body: UpdateUserBody): Promise<User> {
  return apiFetch('/users/me', { method: 'PATCH', body: json(body) })
}

/** The user plus their groups (primary first). */
export function getMe(): Promise<Me> {
  return apiFetch('/me')
}
