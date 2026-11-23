import { apiFetch } from './client.js'
import { json } from './query.js'
import type { AiProvider, AiSettings, ProductDraft } from '@bestowd/types'

export function getAiSettings(groupId: string): Promise<AiSettings> {
  return apiFetch(`/groups/${groupId}/ai`)
}

/** Owner only. Leave apiKey empty to keep the saved key. */
export function saveAiSettings(groupId: string, body: { provider: AiProvider; model?: string | null; apiKey?: string | null }): Promise<AiSettings> {
  return apiFetch(`/groups/${groupId}/ai`, { method: 'PUT', body: json(body) })
}

export function removeAiSettings(groupId: string): Promise<void> {
  return apiFetch(`/groups/${groupId}/ai`, { method: 'DELETE' })
}

/** Reads the product on a store page. */
export async function captureLink(groupId: string, url: string): Promise<ProductDraft> {
  return (await apiFetch<{ draft: ProductDraft }>(`/groups/${groupId}/capture/link`, { method: 'POST', body: json({ url }) })).draft
}

/** Reads an uploaded photo of an item or price tag with the group's AI. */
export async function capturePhoto(groupId: string, photoUrl: string): Promise<ProductDraft> {
  return (await apiFetch<{ draft: ProductDraft }>(`/groups/${groupId}/capture/photo`, { method: 'POST', body: json({ photoUrl }) })).draft
}
