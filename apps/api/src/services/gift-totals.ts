import type { Prisma } from '@prisma/client'
import { db } from '../db.js'

export interface GiftTotals {
  givenCount: number
  receivedCount: number
  /** Sum of amounts over GIVEN gifts. */
  spent: number
  /** Sum of amounts over RECEIVED gifts whose value has been revealed. */
  receivedValue: number
  hiddenReceivedCount: number
  thankYouDueCount: number
}

export async function giftTotals(where: Prisma.GiftEntryWhereInput): Promise<GiftTotals> {
  const gifts = await db.giftEntry.findMany({
    where,
    select: { direction: true, amount: true, valueHidden: true, thankYouSent: true },
  })
  const totals: GiftTotals = { givenCount: 0, receivedCount: 0, spent: 0, receivedValue: 0, hiddenReceivedCount: 0, thankYouDueCount: 0 }
  for (const g of gifts) {
    const amount = g.amount === null ? 0 : Number(g.amount)
    if (g.direction === 'GIVEN') {
      totals.givenCount += 1
      totals.spent += amount
    } else {
      totals.receivedCount += 1
      if (g.valueHidden) totals.hiddenReceivedCount += 1
      else totals.receivedValue += amount
      if (!g.thankYouSent) totals.thankYouDueCount += 1
    }
  }
  totals.spent = round2(totals.spent)
  totals.receivedValue = round2(totals.receivedValue)
  return totals
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Gifts whose counterparty is the family, one of its people, or a person credited with the gift. */
export function familyGiftsWhere(familyId: string): Prisma.GiftEntryWhereInput {
  return {
    OR: [{ familyId }, { person: { is: { familyId } } }, { credits: { some: { person: { familyId } } } }],
  }
}

/** Gifts whose counterparty is the person, or that are credited to them. */
export function personGiftsWhere(personId: string): Prisma.GiftEntryWhereInput {
  return { OR: [{ personId }, { credits: { some: { personId } } }] }
}
