import { apiFetch, apiUrl } from './client.js'

/** Uploads a photo (already shrunk by the caller) for the group; returns the link to save on an idea or gift. */
export function uploadPhoto(groupId: string, photo: Blob): Promise<{ url: string }> {
  return apiFetch(`/groups/${groupId}/photos`, { method: 'POST', body: photo, headers: { 'Content-Type': photo.type || 'image/jpeg' } })
}

/** An image link as an <img> can load it: photos uploaded to Bestowd are served by the API. */
export function photoSrc(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  return url.startsWith('/files/') ? apiUrl(url) : url
}
