import type { GiftDirection, GiftStatus, Prisma, PrismaClient, Reaction } from '@prisma/client'
import { db } from '../db.js'
import { iso, money } from '../dto.js'
import { badRequest } from '../http-error.js'
import { assertInGroup, assertSubject } from './access.js'
import { addDays } from './next-occurrence.js'
import { advanceOccasionStatus } from './occasion-status.js'

export interface GiftInput {
  direction: GiftDirection
  title: string
  brand?: string | null
  store?: string | null
  url?: string | null
  date: Date
  personId?: string | null
  familyId?: string | null
  category?: string | null
  occasionId?: string | null
  occasionDate?: Date | null
  amount?: number | null
  status?: GiftStatus
  valueHidden?: boolean
  hasGiftReceipt?: boolean
  returnBy?: Date | null
  thankYouSent?: boolean
  thankYouDueAt?: Date | null
  reaction?: Reaction | null
  photoUrl?: string | null
  notes?: string | null
  ideaId?: string | null
  creditPersonIds?: string[]
}

const RECEIVED_ONLY = ['valueHidden', 'hasGiftReceipt', 'returnBy', 'thankYouSent', 'thankYouDueAt'] as const

/** Direction-specific fields: status is for GIVEN gifts; receipt, thank-you and hidden value are for RECEIVED. */
export function checkDirectionFields(direction: GiftDirection, input: { status?: unknown } & Partial<Record<(typeof RECEIVED_ONLY)[number], unknown>>): void {
  if (direction === 'RECEIVED' && input.status !== undefined) throw badRequest('status is only for given gifts')
  if (direction === 'GIVEN') {
    const wrong = RECEIVED_ONLY.filter((k) => input[k] !== undefined)
    if (wrong.length) throw badRequest(`${wrong.join(', ')} only apply to received gifts`)
  }
}

export const giftInclude = {
  person: { select: { name: true } },
  family: { select: { name: true } },
  occasion: { select: { name: true } },
  credits: { select: { person: { select: { id: true, name: true } } } },
} satisfies Prisma.GiftEntryInclude

export type GiftRow = Prisma.GiftEntryGetPayload<{ include: typeof giftInclude }>

export function toGiftDto(g: GiftRow) {
  return {
    id: g.id,
    groupId: g.groupId,
    direction: g.direction,
    title: g.title,
    brand: g.brand,
    store: g.store,
    url: g.url,
    category: g.category,
    occasionId: g.occasionId,
    occasionDate: iso(g.occasionDate),
    occasionName: g.occasion?.name ?? null,
    date: iso(g.date),
    personId: g.personId,
    familyId: g.familyId,
    counterpartyName: g.person?.name ?? g.family?.name ?? '',
    amount: money(g.amount),
    status: g.status,
    valueHidden: g.valueHidden,
    hasGiftReceipt: g.hasGiftReceipt,
    returnBy: iso(g.returnBy),
    thankYouSent: g.thankYouSent,
    thankYouDueAt: iso(g.thankYouDueAt),
    reaction: g.reaction,
    photoUrl: g.photoUrl,
    notes: g.notes,
    ideaId: g.ideaId,
    credits: g.credits.map((c) => ({ personId: c.person.id, name: c.person.name })),
    createdById: g.createdById,
    createdAt: iso(g.createdAt),
    updatedAt: iso(g.updatedAt),
  }
}

/** Checks that every id in the input belongs to the group. */
export async function checkGiftRefs(groupId: string, input: Partial<GiftInput>): Promise<void> {
  if (input.occasionId) await assertInGroup('occasion', groupId, [input.occasionId])
  if (input.ideaId) await assertInGroup('idea', groupId, [input.ideaId])
  if (input.creditPersonIds) await assertInGroup('person', groupId, input.creditPersonIds)
}

/** A given gift logged against an occasion's current occurrence moves its status forward. */
export async function advanceForGift(gift: { direction: GiftDirection; status: GiftStatus | null; occasionId: string | null; occasionDate: Date | null }) {
  if (gift.direction !== 'GIVEN' || !gift.occasionId || !gift.occasionDate || !gift.status) return
  const occasion = await db.occasion.findUnique({ where: { id: gift.occasionId } })
  // Group-wide occasions track progress per family from their gifts, not with the occasion's own status.
  if (occasion && occasion.personId === null && occasion.familyId === null) return
  if (occasion?.nextOccurrence?.getTime() === gift.occasionDate.getTime()) {
    await advanceOccasionStatus(occasion.id, gift.status)
  }
}

type Client = PrismaClient | Prisma.TransactionClient

/**
 * Validates and creates a gift entry, applying the defaults (status GIVEN, received value hidden,
 * thank-you due in 14 days, occasionDate = the occasion's current occurrence).
 * The caller runs advanceForGift afterwards (outside any transaction).
 */
export async function createGiftEntry(groupId: string, userId: string, input: GiftInput, client: Client = db): Promise<GiftRow> {
  checkDirectionFields(input.direction, input)
  await assertSubject(groupId, input)
  await checkGiftRefs(groupId, input)

  const { creditPersonIds, ...data } = input
  let occasionDate = data.occasionDate ?? null
  if (data.occasionId && !occasionDate) {
    const occasion = await db.occasion.findUniqueOrThrow({ where: { id: data.occasionId } })
    occasionDate = occasion.nextOccurrence ?? occasion.date
  }
  const received = data.direction === 'RECEIVED'

  return client.giftEntry.create({
    data: {
      ...data,
      groupId,
      createdById: userId,
      occasionDate,
      status: received ? null : (data.status ?? 'GIVEN'),
      valueHidden: received ? (data.valueHidden ?? true) : false,
      thankYouDueAt: received && !data.thankYouSent ? (data.thankYouDueAt ?? addDays(data.date, 14)) : (data.thankYouDueAt ?? null),
      ...(creditPersonIds?.length ? { credits: { create: [...new Set(creditPersonIds)].map((personId) => ({ personId })) } } : {}),
    },
    include: giftInclude,
  })
}
