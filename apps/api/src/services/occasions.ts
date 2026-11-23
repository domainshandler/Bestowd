import type { OccasionStatus, Prisma } from '@prisma/client'
import { db } from '../db.js'
import { iso, money } from '../dto.js'
import { effectiveBudget, familyBudget } from './budgets.js'
import { round2 } from './gift-totals.js'

export const occasionInclude = {
  person: { select: { name: true, familyId: true, family: { select: { name: true } } } },
  family: { select: { name: true } },
  group: { select: { name: true, currency: true, defaultBudgets: true } },
  coverage: { include: { family: { select: { id: true, name: true, type: true, status: true } } } },
} satisfies Prisma.OccasionInclude

export type OccasionRow = Prisma.OccasionGetPayload<{ include: typeof occasionInclude }>

const ACTIVE = { status: 'ACTIVE' } as const

/** Group-wide occasions have no person or family of their own; they cover families instead. */
export const GROUP_WIDE = { personId: null, familyId: null } as const

export function isGroupWide(o: { personId: string | null; familyId: string | null }): boolean {
  return o.personId === null && o.familyId === null
}

/** Occasions whose family is active and whose person (if any) isn't archived, plus group-wide occasions. */
export const activeSubjectWhere: Prisma.OccasionWhereInput = {
  OR: [
    { family: { is: ACTIVE } },
    { person: { is: { archivedAt: null, family: { is: ACTIVE } } } },
    GROUP_WIDE,
  ],
}

/** Occasions about a family: its own, its people's, and group-wide ones that cover it. */
export function aboutFamilyWhere(familyId: string): Prisma.OccasionWhereInput {
  return {
    OR: [
      { familyId },
      { person: { is: { familyId, archivedAt: null } } },
      { ...GROUP_WIDE, coverage: { some: { familyId } } },
    ],
  }
}

/** A gift for a group-wide occasion counts toward a family once it's bought or given. */
const COVERING: OccasionStatus[] = ['BOUGHT', 'GIVEN']

export interface FamilyShare {
  familyId: string
  name: string
  type: string
  /** The family's own budget override, if set. */
  budgetOverride: number | null
  /** The budget that applies to this family (override, type budget, occasion budget or group default). */
  budget: number | null
  spent: number
  /** A gift for this family is bought or given for the current occurrence. */
  covered: boolean
  given: boolean
}

/**
 * Serialises occasions with subject names, effective budget and spend on the current occurrence.
 * Group-wide occasions also carry `coverage`, one share per active covered family. With `forFamilyId`,
 * a group-wide occasion's budget, spend and status are that family's share (for a family's own pages).
 */
export async function serialiseOccasions(occasions: OccasionRow[], options: { forFamilyId?: string } = {}) {
  const gifts = occasions.length === 0 ? [] : await db.giftEntry.findMany({
    where: { occasionId: { in: occasions.map((o) => o.id) }, direction: 'GIVEN' },
    select: { occasionId: true, occasionDate: true, amount: true, status: true, familyId: true, person: { select: { familyId: true } } },
  })
  const current = new Map<string, typeof gifts>()
  const byId = new Map(occasions.map((o) => [o.id, o]))
  for (const g of gifts) {
    const o = byId.get(g.occasionId!)
    if (!o?.nextOccurrence || g.occasionDate?.getTime() !== o.nextOccurrence.getTime()) continue
    current.set(o.id, [...(current.get(o.id) ?? []), g])
  }
  const amount = (g: (typeof gifts)[number]) => (g.amount === null ? 0 : Number(g.amount))

  return occasions.map((o) => {
    const occasionGifts = current.get(o.id) ?? []
    const groupWide = isGroupWide(o)

    let coverage: { familyCount: number; coveredCount: number; families: FamilyShare[] } | null = null
    let budget: number | null
    let spent: number
    let status = o.status
    let subjectName = o.person?.name ?? o.family?.name ?? ''
    let subjectFamilyId = o.familyId ?? o.person?.familyId ?? null
    let subjectFamilyName = o.family?.name ?? o.person?.family.name ?? null

    if (groupWide) {
      const families: FamilyShare[] = o.coverage
        .filter((c) => c.family.status === 'ACTIVE')
        .map((c) => {
          const forFamily = occasionGifts.filter((g) => (g.familyId ?? g.person?.familyId) === c.familyId)
          return {
            familyId: c.familyId,
            name: c.family.name,
            type: c.family.type,
            budgetOverride: money(c.budget),
            budget: familyBudget(o, c.family.type, c.budget, o.group.defaultBudgets),
            spent: round2(forFamily.reduce((sum, g) => sum + amount(g), 0)),
            covered: forFamily.some((g) => g.status !== null && COVERING.includes(g.status)),
            given: forFamily.some((g) => g.status === 'GIVEN'),
          }
        })
        .sort((a, b) => a.name.localeCompare(b.name))
      coverage = { familyCount: families.length, coveredCount: families.filter((f) => f.covered).length, families }

      const share = options.forFamilyId ? families.find((f) => f.familyId === options.forFamilyId) : undefined
      if (share) {
        budget = share.budget
        spent = share.spent
        status = share.given ? 'GIVEN' : share.covered ? 'BOUGHT' : 'NOT_STARTED'
        subjectName = share.name
        subjectFamilyId = share.familyId
        subjectFamilyName = share.name
      } else {
        const budgets = families.map((f) => f.budget).filter((b): b is number => b !== null)
        budget = budgets.length ? round2(budgets.reduce((sum, b) => sum + b, 0)) : null
        spent = round2(occasionGifts.reduce((sum, g) => sum + amount(g), 0))
        status = families.length > 0 && families.every((f) => f.given) ? 'GIVEN'
          : families.length > 0 && families.every((f) => f.covered) ? 'BOUGHT'
          : 'NOT_STARTED'
        subjectName = `${families.length} ${families.length === 1 ? 'family' : 'families'}`
        subjectFamilyId = null
        subjectFamilyName = null
      }
    } else {
      budget = effectiveBudget(o.budget, o.type, o.group.defaultBudgets)
      spent = round2(occasionGifts.reduce((sum, g) => sum + amount(g), 0))
    }

    return {
      id: o.id,
      groupId: o.groupId,
      groupName: o.group.name,
      currency: o.group.currency,
      personId: o.personId,
      familyId: o.familyId,
      scope: groupWide ? ('GROUP' as const) : ('SUBJECT' as const),
      holidayKey: o.holidayKey,
      type: o.type,
      name: o.name,
      date: iso(o.date),
      recursAnnually: o.recursAnnually,
      recurrenceEndsAt: iso(o.recurrenceEndsAt),
      nextOccurrence: iso(o.nextOccurrence),
      budget: money(o.budget),
      familyTypeBudgets: (o.familyTypeBudgets ?? {}) as Record<string, number>,
      includeNewFamilies: o.includeNewFamilies,
      status,
      needsCard: o.needsCard,
      cardDone: o.cardDone,
      reminderDays: o.reminderDays,
      partyAt: iso(o.partyAt),
      location: o.location,
      rsvp: o.rsvp,
      hostGiftRequest: o.hostGiftRequest,
      createdAt: iso(o.createdAt),
      updatedAt: iso(o.updatedAt),
      subjectName,
      subjectFamilyId,
      subjectFamilyName,
      effectiveBudget: budget,
      spent,
      overBudget: budget !== null && spent > budget,
      needsGift: status === 'NOT_STARTED' || (coverage !== null && !options.forFamilyId && coverage.coveredCount < coverage.familyCount),
      coverage,
    }
  })
}

export type OccasionDto = Awaited<ReturnType<typeof serialiseOccasions>>[number]

/** Sum of effective budgets. */
export function plannedSpend(occasions: OccasionDto[]): number {
  return round2(occasions.reduce((sum, o) => sum + (o.effectiveBudget ?? 0), 0))
}
