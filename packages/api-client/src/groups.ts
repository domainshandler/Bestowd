import { apiFetch } from './client.js'
import { json } from './query.js'
import type { Group, LeaveGroupBody, UpdateGroupBody } from '@bestowd/types'

export function getGroup(groupId: string): Promise<Group> {
  return apiFetch(`/groups/${groupId}`)
}

export function updateGroup(groupId: string, body: UpdateGroupBody): Promise<Group> {
  return apiFetch(`/groups/${groupId}`, { method: 'PATCH', body: json(body) })
}

/** Start a new group of your own. It becomes the one the app opens to. */
export function createGroup(name?: string): Promise<Group> {
  return apiFetch('/groups', { method: 'POST', body: json(name ? { name } : {}) })
}

/** Leave a group. Returns the group to open next (a fresh one if this was your last). */
export function leaveGroup(groupId: string, body: LeaveGroupBody = {}): Promise<{ primaryGroupId: string }> {
  return apiFetch(`/groups/${groupId}/leave`, { method: 'POST', body: json(body) })
}
