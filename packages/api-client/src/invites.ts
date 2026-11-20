import { apiFetch } from './client.js'
import { json } from './query.js'
import type { AcceptInviteBody, AcceptInviteResult, CreateInviteBody, InviteLink, InvitePreview } from '@bestowd/types'

export function createInvite(groupId: string, body: CreateInviteBody): Promise<InviteLink> {
  return apiFetch(`/groups/${groupId}/invites`, { method: 'POST', body: json(body) })
}

/** Public: works before sign-in. */
export function getInvite(token: string): Promise<InvitePreview> {
  return apiFetch(`/invites/${encodeURIComponent(token)}`)
}

export function acceptInvite(token: string, body: AcceptInviteBody = {}): Promise<AcceptInviteResult> {
  return apiFetch(`/invites/${encodeURIComponent(token)}/accept`, { method: 'POST', body: json(body) })
}

export function revokeConnection(id: string): Promise<void> {
  return apiFetch(`/family-connections/${id}`, { method: 'DELETE' })
}
