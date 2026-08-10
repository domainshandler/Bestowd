import { apiFetch } from './client.js'
import type { ProductListing, CreateListingBody } from '@bestowd/types'

export function listListings(giftId: string): Promise<ProductListing[]> {
  return apiFetch(`/gifts/${giftId}/listings`)
}

export function createListing(giftId: string, body: CreateListingBody): Promise<ProductListing> {
  return apiFetch(`/gifts/${giftId}/listings`, { method: 'POST', body: JSON.stringify(body) })
}

export function deleteListing(giftId: string, id: string): Promise<void> {
  return apiFetch(`/gifts/${giftId}/listings/${id}`, { method: 'DELETE' })
}
