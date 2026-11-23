import { apiFetch } from './client.js'
import { json } from './query.js'
import type {
  AcceptInviteBody,
  AcceptInviteResult,
  ApproveMoveBody,
  CreateInviteBody,
  InviteLink,
  InvitePreview,
  MovableItems,
  MoveRequestDetail,
  MoveRequestSummary,
  MoveSelection,
} from '@bestowd/types'

export function createInvite(groupId: string, body: CreateInviteBody): Promise<InviteLink> {
  return apiFetch(`/groups/${groupId}/invites`, { method: 'POST', body: json(body) })
}

/** Public: works before sign-in. */
export function getInvite(token: string): Promise<InvitePreview> {
  return apiFetch(`/invites/${encodeURIComponent(token)}`)
}

/** Group invites: what you could bring from your own group, or null. */
export async function getMovable(token: string): Promise<MovableItems | null> {
  return (await apiFetch<{ movable: MovableItems | null }>(`/invites/${encodeURIComponent(token)}/movable`)).movable
}

export function acceptInvite(token: string, body: AcceptInviteBody = {}): Promise<AcceptInviteResult> {
  return apiFetch(`/invites/${encodeURIComponent(token)}/accept`, { method: 'POST', body: json(body) })
}

export function revokeConnection(id: string): Promise<void> {
  return apiFetch(`/family-connections/${id}`, { method: 'DELETE' })
}

/** What you could still bring into a group you're in, and whether a request is already waiting. */
export function getGroupMovable(groupId: string): Promise<{ movable: MovableItems | null; pending: boolean }> {
  return apiFetch(`/groups/${groupId}/movable`)
}

export function requestMove(groupId: string, body: MoveSelection): Promise<MoveRequestSummary> {
  return apiFetch(`/groups/${groupId}/move-requests`, { method: 'POST', body: json(body) })
}

/** Pending requests into the group: all of them for the owner, your own for anyone else. */
export function listMoveRequests(groupId: string): Promise<MoveRequestSummary[]> {
  return apiFetch(`/groups/${groupId}/move-requests`)
}

export function getMoveRequest(id: string): Promise<MoveRequestDetail> {
  return apiFetch(`/move-requests/${id}`)
}

export function approveMove(id: string, body: ApproveMoveBody): Promise<{ status: 'APPROVED'; sourceRemoved: boolean }> {
  return apiFetch(`/move-requests/${id}/approve`, { method: 'POST', body: json(body) })
}

export function declineMove(id: string): Promise<{ status: 'DECLINED' }> {
  return apiFetch(`/move-requests/${id}/decline`, { method: 'POST', body: json({}) })
}

export function cancelMove(id: string): Promise<{ status: 'CANCELLED' }> {
  return apiFetch(`/move-requests/${id}/cancel`, { method: 'POST', body: json({}) })
}
