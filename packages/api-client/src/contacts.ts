import { apiFetch } from './client.js'
import type { Contact, CreateContactBody, UpdateContactBody } from '@bestowd/types'

export function listContacts(): Promise<Contact[]> {
  return apiFetch('/contacts')
}

export function getContact(id: string): Promise<Contact> {
  return apiFetch(`/contacts/${id}`)
}

export function createContact(body: CreateContactBody): Promise<Contact> {
  return apiFetch('/contacts', { method: 'POST', body: JSON.stringify(body) })
}

export function updateContact(id: string, body: UpdateContactBody): Promise<Contact> {
  return apiFetch(`/contacts/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function deleteContact(id: string): Promise<void> {
  return apiFetch(`/contacts/${id}`, { method: 'DELETE' })
}

export function claimContact(id: string): Promise<Contact> {
  return apiFetch(`/contacts/${id}/claim`, { method: 'POST' })
}

export function sendInvite(id: string): Promise<Contact> {
  return apiFetch(`/contacts/${id}/invite`, { method: 'POST' })
}
