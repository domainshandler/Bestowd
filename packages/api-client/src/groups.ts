import { apiFetch } from './client.js'
import { json } from './query.js'
import type { Group, UpdateGroupBody } from '@bestowd/types'

export function getGroup(groupId: string): Promise<Group> {
  return apiFetch(`/groups/${groupId}`)
}

export function updateGroup(groupId: string, body: UpdateGroupBody): Promise<Group> {
  return apiFetch(`/groups/${groupId}`, { method: 'PATCH', body: json(body) })
}
