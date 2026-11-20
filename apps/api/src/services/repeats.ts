import { db } from '../db.js'
import { personGiftsWhere } from './gift-totals.js'

export interface Repeat {
  giftEntryId: string
  title: string
  date: string
}

/** The most recent GIVEN gift to the person (direct or credited) in the same category, ignoring case. */
export async function findRepeat(personId: string, category: string | null): Promise<Repeat | null> {
  const trimmed = category?.trim()
  if (!trimmed) return null
  const gift = await db.giftEntry.findFirst({
    where: {
      direction: 'GIVEN',
      category: { equals: trimmed, mode: 'insensitive' },
      ...personGiftsWhere(personId),
    },
    orderBy: { date: 'desc' },
  })
  return gift ? { giftEntryId: gift.id, title: gift.title, date: gift.date.toISOString() } : null
}
