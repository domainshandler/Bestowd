import { apiFetch } from './client.js'
import type { Gift, CreateGiftBody, UpdateGiftBody, ProductListing, CreateListingBody } from '@bestowd/types'

export function listGifts(): Promise<Gift[]> {
  return apiFetch('/gifts')
}

export function getGift(id: string): Promise<Gift> {
  return apiFetch(`/gifts/${id}`)
}

export function createGift(body: CreateGiftBody): Promise<Gift> {
  return apiFetch('/gifts', { method: 'POST', body: JSON.stringify(body) })
}

export function updateGift(id: string, body: UpdateGiftBody): Promise<Gift> {
  return apiFetch(`/gifts/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function deleteGift(id: string): Promise<void> {
  return apiFetch(`/gifts/${id}`, { method: 'DELETE' })
}
