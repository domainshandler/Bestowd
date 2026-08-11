import { apiFetch } from './client.js'
import type { GiftAssignment, CreateAssignmentBody, UpdateAssignmentBody } from '@bestowd/types'

export function listAssignments(params: { contactId?: string; eventId?: string; giftId?: string } = {}): Promise<GiftAssignment[]> {
  const qs = new URLSearchParams(params as Record<string, string>).toString()
  return apiFetch(`/assignments${qs ? `?${qs}` : ''}`)
}

export function createAssignment(body: CreateAssignmentBody): Promise<GiftAssignment> {
  return apiFetch('/assignments', { method: 'POST', body: JSON.stringify(body) })
}

export function updateAssignment(id: string, body: UpdateAssignmentBody): Promise<GiftAssignment> {
  return apiFetch(`/assignments/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function deleteAssignment(id: string): Promise<void> {
  return apiFetch(`/assignments/${id}`, { method: 'DELETE' })
}
