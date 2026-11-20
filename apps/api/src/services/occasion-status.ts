import type { OccasionStatus } from '@prisma/client'
import { db } from '../db.js'

export const STATUS_ORDER: OccasionStatus[] = ['NOT_STARTED', 'IDEA_SAVED', 'BOUGHT', 'GIVEN']

/** Moves the status forward to `to`. Never moves it backwards. */
export async function advanceOccasionStatus(occasionId: string, to: OccasionStatus): Promise<void> {
  const lower = STATUS_ORDER.slice(0, STATUS_ORDER.indexOf(to))
  if (lower.length === 0) return
  await db.occasion.updateMany({ where: { id: occasionId, status: { in: lower } }, data: { status: to } })
}
