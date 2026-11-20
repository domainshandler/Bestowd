import type { Prisma } from '@prisma/client'
import { db } from '../db.js'
import { iso, money } from '../dto.js'
import { effectiveBudget } from './budgets.js'
import { round2 } from './gift-totals.js'

export const occasionInclude = {
  person: { select: { name: true, familyId: true, family: { select: { name: true } } } },
  family: { select: { name: true } },
  group: { select: { name: true, currency: true, defaultBudgets: true } },
} satisfies Prisma.OccasionInclude

export type OccasionRow = Prisma.OccasionGetPayload<{ include: typeof occasionInclude }>

const ACTIVE = { status: 'ACTIVE' } as const

/** Occasions whose family is active and whose person (if any) isn't archived. */
export const activeSubjectWhere: Prisma.OccasionWhereInput = {
  OR: [
    { family: { is: ACTIVE } },
    { person: { is: { archivedAt: null, family: { is: ACTIVE } } } },
  ],
}

/** Serialises occasions with subject names, effective budget and spend on the current occurrence. */
export async function serialiseOccasions(occasions: OccasionRow[]) {
  const gifts = occasions.length === 0 ? [] : await db.giftEntry.findMany({
    where: { occasionId: { in: occasions.map((o) => o.id) }, direction: 'GIVEN' },
    select: { occasionId: true, occasionDate: true, amount: true },
  })
  const spentById = new Map<string, number>()
  for (const o of occasions) spentById.set(o.id, 0)
  const byId = new Map(occasions.map((o) => [o.id, o]))
  for (const g of gifts) {
    const o = byId.get(g.occasionId!)
    if (!o?.nextOccurrence || g.occasionDate?.getTime() !== o.nextOccurrence.getTime()) continue
    spentById.set(o.id, spentById.get(o.id)! + (g.amount === null ? 0 : Number(g.amount)))
  }

  return occasions.map((o) => {
    const budget = effectiveBudget(o.budget, o.type, o.group.defaultBudgets)
    const spent = round2(spentById.get(o.id)!)
    return {
      id: o.id,
      groupId: o.groupId,
      groupName: o.group.name,
      personId: o.personId,
      familyId: o.familyId,
      type: o.type,
      name: o.name,
      date: iso(o.date),
      recursAnnually: o.recursAnnually,
      recurrenceEndsAt: iso(o.recurrenceEndsAt),
      nextOccurrence: iso(o.nextOccurrence),
      budget: money(o.budget),
      status: o.status,
      needsCard: o.needsCard,
      cardDone: o.cardDone,
      reminderDays: o.reminderDays,
      partyAt: iso(o.partyAt),
      location: o.location,
      rsvp: o.rsvp,
      hostGiftRequest: o.hostGiftRequest,
      createdAt: iso(o.createdAt),
      updatedAt: iso(o.updatedAt),
      subjectName: o.person?.name ?? o.family?.name ?? '',
      subjectFamilyId: o.familyId ?? o.person?.familyId ?? null,
      subjectFamilyName: o.family?.name ?? o.person?.family.name ?? null,
      effectiveBudget: budget,
      spent,
      overBudget: budget !== null && spent > budget,
      needsGift: o.status === 'NOT_STARTED',
    }
  })
}

export type OccasionDto = Awaited<ReturnType<typeof serialiseOccasions>>[number]

/** Sum of effective budgets. */
export function plannedSpend(occasions: OccasionDto[]): number {
  return round2(occasions.reduce((sum, o) => sum + (o.effectiveBudget ?? 0), 0))
}
