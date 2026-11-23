import { apiFetch } from './client.js'
import { json, toQuery } from './query.js'
import type {
  CreateGroupOccasionBody, CreateOccasionBody, GroupOccasions, Holiday, HomeOccasions, Occasion, OccasionQuery, UpdateOccasionBody,
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

/** A group-wide occasion: a built-in holiday or your own, covering families in the group. */
export function createGroupOccasion(groupId: string, body: CreateGroupOccasionBody): Promise<Occasion> {
  return apiFetch(`/groups/${groupId}/occasions`, { method: 'POST', body: json(body) })
}

/** The built-in holidays, each with its next date and the group's occasion for it (if added). */
export function listHolidays(groupId: string): Promise<Holiday[]> {
  return apiFetch(`/groups/${groupId}/holidays`)
}

/** Sets which families a group-wide occasion covers, with optional budget overrides (null = defaults). */
export function setOccasionFamilies(id: string, families: { familyId: string; budget?: number | null }[]): Promise<Occasion> {
  return apiFetch(`/occasions/${id}/families`, { method: 'PUT', body: json({ families }) })
}

export function updateOccasion(id: string, body: UpdateOccasionBody): Promise<Occasion> {
  return apiFetch(`/occasions/${id}`, { method: 'PATCH', body: json(body) })
}

export function deleteOccasion(id: string): Promise<void> {
  return apiFetch(`/occasions/${id}`, { method: 'DELETE' })
}
