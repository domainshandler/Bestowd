import { apiFetch } from './client.js'
import { json, toQuery } from './query.js'
import type { BuyIdeaBody, BuyIdeaResult, CreateIdeaBody, Idea, IdeaList, IdeaQuery, UpdateIdeaBody } from '@bestowd/types'

/** With personId: ideas matching that person, each with a repeat flag. */
export function listIdeas(groupId: string, query: IdeaQuery = {}): Promise<IdeaList> {
  return apiFetch(`/groups/${groupId}/ideas${toQuery(query)}`)
}

export function createIdea(groupId: string, body: CreateIdeaBody): Promise<Omit<Idea, 'repeat'>> {
  return apiFetch(`/groups/${groupId}/ideas`, { method: 'POST', body: json(body) })
}

export function updateIdea(id: string, body: UpdateIdeaBody): Promise<Omit<Idea, 'repeat'>> {
  return apiFetch(`/ideas/${id}`, { method: 'PATCH', body: json(body) })
}

/** Logs a BOUGHT gift from the idea and marks it bought. */
export function buyIdea(id: string, body: BuyIdeaBody = {}): Promise<BuyIdeaResult> {
  return apiFetch(`/ideas/${id}/buy`, { method: 'POST', body: json(body) })
}

export function deleteIdea(id: string): Promise<void> {
  return apiFetch(`/ideas/${id}`, { method: 'DELETE' })
}
