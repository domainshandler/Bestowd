import { apiFetch } from './client.js'
import { json, toQuery } from './query.js'
import type { CreateGiftBody, Gift, GiftList, GiftQuery, Spend, UpdateGiftBody } from '@bestowd/types'

export function listGifts(groupId: string, query: GiftQuery = {}): Promise<GiftList> {
  return apiFetch(`/groups/${groupId}/gifts${toQuery(query)}`)
}

export function getGift(id: string): Promise<Gift> {
  return apiFetch(`/gifts/${id}`)
}

export function createGift(groupId: string, body: CreateGiftBody): Promise<Gift> {
  return apiFetch(`/groups/${groupId}/gifts`, { method: 'POST', body: json(body) })
}

export function updateGift(id: string, body: UpdateGiftBody): Promise<Gift> {
  return apiFetch(`/gifts/${id}`, { method: 'PATCH', body: json(body) })
}

export function deleteGift(id: string): Promise<void> {
  return apiFetch(`/gifts/${id}`, { method: 'DELETE' })
}

export function getSpend(groupId: string, year?: number): Promise<Spend> {
  return apiFetch(`/groups/${groupId}/spend${toQuery({ year })}`)
}
