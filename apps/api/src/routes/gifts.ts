import type { FastifyInstance } from 'fastify'
import type { GiftDirection, GiftStatus, Prisma, Reaction } from '@prisma/client'
import { db } from '../db.js'
import { assertSubject, loadOr404, requireMember, userIdOf } from '../services/access.js'
import {
  advanceForGift, checkDirectionFields, checkGiftRefs, createGiftEntry, giftInclude, toGiftDto, type GiftInput,
} from '../services/gift-log.js'
import { familyGiftsWhere, giftTotals, personGiftsWhere, round2 } from '../services/gift-totals.js'
import { id, idList, isoDate, money, nullableId, nullableIsoDate, nullableString, parseDate } from './schemas.js'

interface GiftBody {
  direction?: GiftDirection
  title?: string
  brand?: string | null
  url?: string | null
  date?: string
  personId?: string | null
  familyId?: string | null
  category?: string | null
  occasionId?: string | null
  occasionDate?: string | null
  amount?: number | null
  status?: GiftStatus
  valueHidden?: boolean
  hasGiftReceipt?: boolean
  returnBy?: string | null
  thankYouSent?: boolean
  thankYouDueAt?: string | null
  reaction?: Reaction | null
  photoUrl?: string | null
  notes?: string | null
  ideaId?: string | null
  creditPersonIds?: string[]
}

const giftProperties = {
  title: { type: 'string', minLength: 1, maxLength: 200 },
  brand: nullableString(80),
  url: { type: ['string', 'null'], maxLength: 2000, pattern: '^https?://' },
  date: isoDate,
  personId: nullableId,
  familyId: nullableId,
  category: nullableString(60),
  occasionId: nullableId,
  occasionDate: nullableIsoDate,
  amount: money,
  status: { type: 'string', enum: ['BOUGHT', 'GIVEN'] },
  valueHidden: { type: 'boolean' },
  hasGiftReceipt: { type: 'boolean' },
  returnBy: nullableIsoDate,
  thankYouSent: { type: 'boolean' },
  thankYouDueAt: nullableIsoDate,
  reaction: { type: ['string', 'null'], enum: ['LOVED_IT', 'LIKED_IT', 'ALREADY_HAD_IT', 'NOT_A_HIT', null] },
  photoUrl: nullableString(2000),
  notes: nullableString(5000),
  ideaId: nullableId,
  creditPersonIds: idList,
}

/** Turns the body's date strings into Dates. */
function parseGiftDates<T extends GiftBody>(body: T) {
  const { date, occasionDate, returnBy, thankYouDueAt, ...rest } = body
  return {
    ...rest,
    ...(date !== undefined ? { date: parseDate(date) } : {}),
    ...(occasionDate !== undefined ? { occasionDate: parseDate(occasionDate) } : {}),
    ...(returnBy !== undefined ? { returnBy: parseDate(returnBy) } : {}),
    ...(thankYouDueAt !== undefined ? { thankYouDueAt: parseDate(thankYouDueAt) } : {}),
  }
}

interface ListQuery {
  year?: number
  direction?: GiftDirection
  personId?: string
  familyId?: string
  status?: GiftStatus
}

function yearRange(year: number): Prisma.DateTimeFilter {
  return { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) }
}

export async function giftRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  app.post<{ Params: { groupId: string }; Body: GiftBody & { direction: GiftDirection; title: string; date: string } }>('/groups/:groupId/gifts', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['direction', 'title', 'date'],
        properties: { ...giftProperties, direction: { type: 'string', enum: ['GIVEN', 'RECEIVED'] } },
      },
    },
  }, async (request, reply) => {
    const { groupId } = request.params
    const userId = userIdOf(request)
    await requireMember(userId, groupId)
    const gift = await createGiftEntry(groupId, userId, parseGiftDates(request.body) as GiftInput)
    await advanceForGift(gift)
    return reply.code(201).send(toGiftDto(gift))
  })

  app.get<{ Params: { groupId: string }; Querystring: ListQuery }>('/groups/:groupId/gifts', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          year: { type: 'integer', minimum: 1900, maximum: 2200 },
          direction: { type: 'string', enum: ['GIVEN', 'RECEIVED'] },
          personId: id,
          familyId: id,
          status: { type: 'string', enum: ['BOUGHT', 'GIVEN'] },
        },
      },
    },
  }, async (request) => {
    const { groupId } = request.params
    await requireMember(userIdOf(request), groupId)
    const { year, direction, personId, familyId, status } = request.query

    // Totals use the same filters except direction, so the Given/Received toggle keeps the header stable.
    const base: Prisma.GiftEntryWhereInput = {
      groupId,
      AND: [
        ...(personId ? [personGiftsWhere(personId)] : []),
        ...(familyId ? [familyGiftsWhere(familyId)] : []),
      ],
      ...(year ? { date: yearRange(year) } : {}),
    }
    const [group, gifts, totals] = await Promise.all([
      db.group.findUniqueOrThrow({ where: { id: groupId } }),
      db.giftEntry.findMany({
        where: { ...base, ...(direction ? { direction } : {}), ...(status ? { status } : {}) },
        include: giftInclude,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
      giftTotals(base),
    ])
    return { currency: group.currency, gifts: gifts.map(toGiftDto), totals }
  })

  app.get<{ Params: { id: string } }>('/gifts/:id', async (request) => {
    const gift = await loadOr404(userIdOf(request), await db.giftEntry.findUnique({ where: { id: request.params.id }, include: giftInclude }))
    return toGiftDto(gift)
  })

  app.patch<{ Params: { id: string }; Body: GiftBody }>('/gifts/:id', {
    schema: { body: { type: 'object', additionalProperties: false, properties: giftProperties } },
  }, async (request) => {
    const existing = await loadOr404(userIdOf(request), await db.giftEntry.findUnique({ where: { id: request.params.id } }))
    const { creditPersonIds, personId, familyId, ...rest } = parseGiftDates(request.body)
    checkDirectionFields(existing.direction, request.body)
    await checkGiftRefs(existing.groupId, { ...rest, creditPersonIds })

    const subjectChange = personId || familyId ? { personId: personId ?? null, familyId: familyId ?? null } : {}
    if (personId || familyId) await assertSubject(existing.groupId, subjectChange)

    const gift = await db.$transaction(async (tx) => {
      if (creditPersonIds) {
        await tx.giftCredit.deleteMany({ where: { giftEntryId: existing.id } })
        await tx.giftCredit.createMany({ data: [...new Set(creditPersonIds)].map((p) => ({ giftEntryId: existing.id, personId: p })) })
      }
      return tx.giftEntry.update({
        where: { id: existing.id },
        data: { ...rest, ...subjectChange } as Prisma.GiftEntryUncheckedUpdateInput,
        include: giftInclude,
      })
    })
    await advanceForGift(gift)
    return toGiftDto(gift)
  })

  app.delete<{ Params: { id: string } }>('/gifts/:id', async (request, reply) => {
    const gift = await loadOr404(userIdOf(request), await db.giftEntry.findUnique({ where: { id: request.params.id } }))
    await db.giftEntry.delete({ where: { id: gift.id } })
    return reply.code(204).send()
  })

  app.get<{ Params: { groupId: string }; Querystring: { year?: number } }>('/groups/:groupId/spend', {
    schema: { querystring: { type: 'object', properties: { year: { type: 'integer', minimum: 1900, maximum: 2200 } } } },
  }, async (request) => {
    const { groupId } = request.params
    await requireMember(userIdOf(request), groupId)
    const year = request.query.year ?? new Date().getUTCFullYear()

    const [group, gifts] = await Promise.all([
      db.group.findUniqueOrThrow({ where: { id: groupId } }),
      db.giftEntry.findMany({
        where: { groupId, direction: 'GIVEN', date: yearRange(year) },
        select: {
          date: true, amount: true, familyId: true,
          family: { select: { name: true } },
          person: { select: { familyId: true, family: { select: { name: true } } } },
        },
      }),
    ])

    const byMonth = Array<number>(12).fill(0)
    const byFamily = new Map<string, { familyId: string; familyName: string; total: number }>()
    let total = 0
    for (const g of gifts) {
      const amount = g.amount === null ? 0 : Number(g.amount)
      total += amount
      byMonth[g.date.getUTCMonth()]! += amount
      const famId = g.familyId ?? g.person!.familyId
      const famName = g.family?.name ?? g.person!.family.name
      const row = byFamily.get(famId) ?? { familyId: famId, familyName: famName, total: 0 }
      row.total += amount
      byFamily.set(famId, row)
    }

    return {
      currency: group.currency,
      year,
      total: round2(total),
      byMonth: byMonth.map(round2),
      byFamily: [...byFamily.values()].map((r) => ({ ...r, total: round2(r.total) })).sort((x, y) => y.total - x.total),
    }
  })
}
