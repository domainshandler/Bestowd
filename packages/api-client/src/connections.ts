import { apiFetch } from './client.js'

export interface UserConnection {
  requesterId: string
  addresseeId: string
  status: 'pending' | 'accepted' | 'blocked'
  createdAt: string
}

export function listConnections(): Promise<UserConnection[]> {
  return apiFetch('/connections')
}

export function createConnection(addresseeEmail: string): Promise<UserConnection> {
  return apiFetch('/connections', { method: 'POST', body: JSON.stringify({ addresseeEmail }) })
}

export function updateConnection(requesterId: string, status: 'accepted' | 'blocked'): Promise<UserConnection> {
  return apiFetch(`/connections/${requesterId}`, { method: 'PATCH', body: JSON.stringify({ status }) })
}
