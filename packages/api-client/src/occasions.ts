import { apiFetch } from './client.js'
import { json, toQuery } from './query.js'
import type {
  CreateOccasionBody, GroupOccasions, HomeOccasions, Occasion, OccasionQuery, UpdateOccasionBody,
} from '@bestowd/types'

/** Home: upcoming occasions across all of the user's groups (default: next 30 days). */
export function listHomeOccasions(query: OccasionQuery = {}): Promise<HomeOccasions> {
  return apiFetch(`/me/occasions${toQuery(query)}`)
}

export function listOccasions(groupId: string, query: OccasionQuery & { personId?: string; familyId?: string } = {}): Promise<GroupOccasions> {
  return apiFetch(`/groups/${groupId}/occasions${toQuery(query)}`)
}

export function getOccasion(id: string): Promise<Occasion> {
  return apiFetch(`/occasions/${id}`)
}

export function createOccasion(groupId: string, body: CreateOccasionBody): Promise<Occasion> {
  return apiFetch(`/groups/${groupId}/occasions`, { method: 'POST', body: json(body) })
}

export function updateOccasion(id: string, body: UpdateOccasionBody): Promise<Occasion> {
  return apiFetch(`/occasions/${id}`, { method: 'PATCH', body: json(body) })
}

export function deleteOccasion(id: string): Promise<void> {
  return apiFetch(`/occasions/${id}`, { method: 'DELETE' })
}
