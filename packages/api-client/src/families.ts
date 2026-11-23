import { apiFetch } from './client.js'
import { json, toQuery } from './query.js'
import type {
  CreateFamilyBody,
  CreatePersonBody,
  Family,
  FamilyListItem,
  FamilyProfile,
  FamilyStatus,
  Person,
  PersonDetail,
  PersonListItem,
  UpdateFamilyBody,
  UpdatePersonBody,
} from '@bestowd/types'

export function listFamilies(groupId: string, query: { status?: FamilyStatus } = {}): Promise<FamilyListItem[]> {
  return apiFetch(`/groups/${groupId}/families${toQuery(query)}`)
}

export function createFamily(groupId: string, body: CreateFamilyBody): Promise<Family> {
  return apiFetch(`/groups/${groupId}/families`, { method: 'POST', body: json(body) })
}

export function getFamily(id: string): Promise<FamilyProfile> {
  return apiFetch(`/families/${id}`)
}

export function updateFamily(id: string, body: UpdateFamilyBody): Promise<Family> {
  return apiFetch(`/families/${id}`, { method: 'PATCH', body: json(body) })
}

export function deleteFamily(id: string): Promise<void> {
  return apiFetch(`/families/${id}`, { method: 'DELETE' })
}

export function createPerson(familyId: string, body: CreatePersonBody): Promise<Person> {
  return apiFetch(`/families/${familyId}/people`, { method: 'POST', body: json(body) })
}

export function getPerson(id: string): Promise<PersonDetail> {
  return apiFetch(`/people/${id}`)
}

export function updatePerson(id: string, body: UpdatePersonBody): Promise<Person> {
  return apiFetch(`/people/${id}`, { method: 'PATCH', body: json(body) })
}

export function deletePerson(id: string): Promise<void> {
  return apiFetch(`/people/${id}`, { method: 'DELETE' })
}

/** Everyone in the group, sorted by name. */
export function listPeople(groupId: string, query: { includeArchived?: boolean } = {}): Promise<PersonListItem[]> {
  return apiFetch(`/groups/${groupId}/people${toQuery(query)}`)
}
