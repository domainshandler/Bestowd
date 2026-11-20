import type { FastifyInstance } from 'fastify'
import type { OccasionStatus, OccasionType, Prisma, Rsvp } from '@prisma/client'
import { db } from '../db.js'
import { assertSubject, loadOr404, requireMember, userIdOf } from '../services/access.js'
import { addDays, computeNextOccurrence, startOfUtcDay } from '../services/next-occurrence.js'
import { activeSubjectWhere, occasionInclude, plannedSpend, serialiseOccasions } from '../services/occasions.js'
import { isoDate, money, nullableId, nullableIsoDate, nullableString, parseDate } from './schemas.js'

interface OccasionBody {
  type?: OccasionType
  name?: string
  date?: string
  personId?: string | null
  familyId?: string | null
  recursAnnually?: boolean
  recurrenceEndsAt?: string | null
  budget?: number | null
  needsCard?: boolean
  reminderDays?: number[]
  partyAt?: string | null
  location?: string | null
  rsvp?: Rsvp
  hostGiftRequest?: string | null
}

const occasionProperties = {
  type: { type: 'string', enum: ['BIRTHDAY', 'HOLIDAY', 'ONE_OFF'] },
  name: { type: 'string', minLength: 1, maxLength: 120 },
  date: isoDate,
  personId: nullableId,
  familyId: nullableId,
  recursAnnually: { type: 'boolean' },
  recurrenceEndsAt: nullableIsoDate,
  budget: money,
  needsCard: { type: 'boolean' },
  reminderDays: { type: 'array', maxItems: 5, items: { type: 'integer', minimum: 0, maximum: 365 } },
  partyAt: nullableIsoDate,
  location: nullableString(300),
  rsvp: { type: 'string', enum: ['NONE', 'YES', 'NO', 'MAYBE'] },
  hostGiftRequest: nullableString(1000),
}

interface ListQuery {
  from?: string
  to?: string
  type?: OccasionType
  personId?: string
  familyId?: string
}

export const listQuerySchema = {
  type: 'object',
  properties: {
    from: isoDate,
    to: isoDate,
    type: { type: 'string', enum: ['BIRTHDAY', 'HOLIDAY', 'ONE_OFF'] },
    personId: { type: 'string' },
    familyId: { type: 'string' },
  },
}

/** Window on nextOccurrence: defaults to today through today + 30 days. */
export function windowWhere(query: { from?: string; to?: string }): Prisma.DateTimeFilter {
  const from = query.from ? startOfUtcDay(parseDate(query.from)) : startOfUtcDay(new Date())
  const to = query.to ? parseDate(query.to) : addDays(from, 30)
  return { gte: from, lte: to }
}

function dates(body: OccasionBody) {
  return {
    ...(body.date !== undefined ? { date: parseDate(body.date) } : {}),
    ...(body.recurrenceEndsAt !== undefined ? { recurrenceEndsAt: parseDate(body.recurrenceEndsAt) } : {}),
    ...(body.partyAt !== undefined ? { partyAt: parseDate(body.partyAt) } : {}),
  }
}

function withoutDates<T extends OccasionBody>(body: T) {
  const { date: _d, recurrenceEndsAt: _r, partyAt: _p, ...rest } = body
  return rest
}

export async function occasionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  app.post<{ Params: { groupId: string }; Body: OccasionBody & { type: OccasionType; name: string; date: string } }>('/groups/:groupId/occasions', {
    schema: { body: { type: 'object', additionalProperties: false, required: ['type', 'name', 'date'], properties: occasionProperties } },
  }, async (request, reply) => {
    const { groupId } = request.params
    await requireMember(userIdOf(request), groupId)
    const body = request.body
    await assertSubject(groupId, body)

    const recursAnnually = body.recursAnnually ?? body.type !== 'ONE_OFF'
    const { date, recurrenceEndsAt, partyAt } = dates(body)
    const created = await db.occasion.create({
      data: {
        ...withoutDates(body),
        groupId,
        recursAnnually,
        date: date!,
        recurrenceEndsAt,
        partyAt,
        nextOccurrence: computeNextOccurrence({ date: date!, recursAnnually, recurrenceEndsAt: recurrenceEndsAt ?? null }),
      },
      include: occasionInclude,
    })
    const [dto] = await serialiseOccasions([created])
    return reply.code(201).send(dto)
  })

  app.get<{ Params: { groupId: string }; Querystring: ListQuery }>('/groups/:groupId/occasions', {
    schema: { querystring: listQuerySchema },
  }, async (request) => {
    const { groupId } = request.params
    await requireMember(userIdOf(request), groupId)
    const { type, personId, familyId } = request.query

    const where: Prisma.OccasionWhereInput = {
      groupId,
      nextOccurrence: windowWhere(request.query),
      AND: [
        activeSubjectWhere,
        ...(familyId ? [{ OR: [{ familyId }, { person: { is: { familyId } } }] }] : []),
      ],
      ...(type ? { type } : {}),
      ...(personId ? { personId } : {}),
    }
    const [group, rows] = await Promise.all([
      db.group.findUniqueOrThrow({ where: { id: groupId } }),
      db.occasion.findMany({ where, include: occasionInclude, orderBy: { nextOccurrence: 'asc' } }),
    ])
    const occasions = await serialiseOccasions(rows)
    return { currency: group.currency, occasions, plannedSpend: plannedSpend(occasions) }
  })

  app.get<{ Params: { id: string } }>('/occasions/:id', async (request) => {
    const occasion = await loadOr404(userIdOf(request), await db.occasion.findUnique({ where: { id: request.params.id }, include: occasionInclude }))
    const [dto] = await serialiseOccasions([occasion])
    return dto
  })

  app.patch<{ Params: { id: string }; Body: OccasionBody & { status?: OccasionStatus; cardDone?: boolean } }>('/occasions/:id', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ...occasionProperties,
          status: { type: 'string', enum: ['NOT_STARTED', 'IDEA_SAVED', 'BOUGHT', 'GIVEN'] },
          cardDone: { type: 'boolean' },
        },
      },
    },
  }, async (request) => {
    const occasion = await loadOr404(userIdOf(request), await db.occasion.findUnique({ where: { id: request.params.id } }))
    const body = request.body

    // A new subject replaces the old one entirely.
    const subjectChange = body.personId || body.familyId
      ? { personId: body.personId ?? null, familyId: body.familyId ?? null }
      : {}
    if (body.personId || body.familyId) await assertSubject(occasion.groupId, subjectChange)
    const { personId: _p, familyId: _f, date: _d, recurrenceEndsAt: _r, partyAt: _pa, ...rest } = body

    const merged = { ...occasion, ...rest, ...dates(body) }
    const scheduleChanged = body.date !== undefined || body.recursAnnually !== undefined || body.recurrenceEndsAt !== undefined
    const updated = await db.occasion.update({
      where: { id: occasion.id },
      data: {
        ...rest,
        ...dates(body),
        ...subjectChange,
        ...(scheduleChanged ? { nextOccurrence: computeNextOccurrence(merged) } : {}),
      },
      include: occasionInclude,
    })
    const [dto] = await serialiseOccasions([updated])
    return dto
  })

  app.delete<{ Params: { id: string } }>('/occasions/:id', async (request, reply) => {
    const occasion = await loadOr404(userIdOf(request), await db.occasion.findUnique({ where: { id: request.params.id } }))
    await db.occasion.delete({ where: { id: occasion.id } })
    return reply.code(204).send()
  })
}
