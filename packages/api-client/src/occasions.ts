import { apiFetch } from './client.js'
import { json, toQuery } from './query.js'
import type {
  CreateGroupOccasionBody, CreateOccasionBody, GroupOccasions, HolidayChoices, HomeOccasions, Occasion, OccasionQuery, UpdateOccasionBody,
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

/** The built-in holidays: next dates, the group's occasion for each (if added), and what it dismissed. */
export function listHolidays(groupId: string): Promise<HolidayChoices> {
  return apiFetch(`/groups/${groupId}/holidays`)
}

/** Answers "Which holidays do you celebrate?": adds the picked ones and stops suggesting the rest. */
export function chooseHolidays(groupId: string, keys: string[]): Promise<HolidayChoices> {
  return apiFetch(`/groups/${groupId}/holidays/choose`, { method: 'POST', body: json({ keys }) })
}

/** "Not for us": stop suggesting a holiday. */
export function dismissHoliday(groupId: string, key: string): Promise<HolidayChoices> {
  return apiFetch(`/groups/${groupId}/holidays/${key}/dismiss`, { method: 'POST' })
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
