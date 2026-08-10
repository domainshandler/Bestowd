import { apiFetch } from './client.js'
import type { BestowdEvent, CreateEventBody, UpdateEventBody } from '@bestowd/types'

export function listEvents(): Promise<BestowdEvent[]> {
  return apiFetch('/events')
}

export function getEvent(id: string): Promise<BestowdEvent> {
  return apiFetch(`/events/${id}`)
}

export function createEvent(body: CreateEventBody): Promise<BestowdEvent> {
  return apiFetch('/events', { method: 'POST', body: JSON.stringify(body) })
}

export function updateEvent(id: string, body: UpdateEventBody): Promise<BestowdEvent> {
  return apiFetch(`/events/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function deleteEvent(id: string): Promise<void> {
  return apiFetch(`/events/${id}`, { method: 'DELETE' })
}
