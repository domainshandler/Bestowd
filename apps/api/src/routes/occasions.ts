import type { FastifyInstance } from 'fastify'
import type { OccasionStatus, OccasionType, Prisma, Rsvp } from '@prisma/client'
import { db } from '../db.js'
import { HOLIDAYS, findHoliday, nextHolidayDate } from '../holidays/catalog.js'
import { badRequest, conflict } from '../http-error.js'
import { assertInGroup, assertSubject, loadOr404, requireMember, userIdOf } from '../services/access.js'
import { addDays, computeNextOccurrence, startOfUtcDay } from '../services/next-occurrence.js'
import {
  GROUP_WIDE,
  aboutFamilyWhere,
  activeSubjectWhere,
  isGroupWide,
  occasionInclude,
  plannedSpend,
  serialiseOccasions,
} from '../services/occasions.js'
import { idList, isoDate, money, nullableId, nullableIsoDate, nullableString, parseDate } from './schemas.js'

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
  familyTypeBudgets?: Record<string, number>
  includeNewFamilies?: boolean
}

interface CreateBody extends OccasionBody {
  /** No person or family: the occasion covers families in the group (all non-archived ones unless familyIds). */
  groupWide?: boolean
  /** A built-in holiday (group-wide only). Name, type and dates come from the catalog unless given. */
  holidayKey?: string
  familyIds?: string[]
}

const FAMILY_TYPES = ['FAMILY', 'FRIENDS', 'SCHOOL', 'NEIGHBOURS', 'OTHER']

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
  // propertyNames (not additionalProperties) so an unknown family type is rejected, not silently dropped.
  familyTypeBudgets: {
    type: 'object',
    propertyNames: { enum: FAMILY_TYPES },
    additionalProperties: { type: 'number', minimum: 0, maximum: 99_999_999 },
  },
  includeNewFamilies: { type: 'boolean' },
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

/** The families a new group-wide occasion covers: the ones given, or every non-archived family. */
async function initialCoverage(groupId: string, familyIds: string[] | undefined): Promise<string[]> {
  if (familyIds) {
    await assertInGroup('family', groupId, familyIds)
    return [...new Set(familyIds)]
  }
  const families = await db.family.findMany({ where: { groupId, status: { not: 'ARCHIVED' } }, select: { id: true } })
  return families.map((f) => f.id)
}

/** The built-in holidays for a group, with next dates, the group's occasion for each, and what it dismissed. */
export async function holidayChoices(groupId: string) {
  const [group, added] = await Promise.all([
    db.group.findUniqueOrThrow({ where: { id: groupId }, select: { holidaysChosenAt: true, dismissedHolidays: true } }),
    db.occasion.findMany({ where: { groupId, holidayKey: { not: null } }, select: { id: true, holidayKey: true } }),
  ])
  const today = startOfUtcDay(new Date())
  return {
    chosen: group.holidaysChosenAt !== null,
    holidays: HOLIDAYS.map((h) => ({
      key: h.key,
      name: h.name,
      note: h.note ?? null,
      nextDate: nextHolidayDate(h.rule, today)?.toISOString() ?? null,
      occasionId: added.find((o) => o.holidayKey === h.key)?.id ?? null,
      dismissed: group.dismissedHolidays.includes(h.key),
    })),
  }
}

/** Adds a built-in holiday as a group-wide occasion covering every non-archived family. */
async function createHolidayOccasion(groupId: string, key: string) {
  const holiday = findHoliday(key)!
  const next = nextHolidayDate(holiday.rule, new Date())
  if (!next) return
  const families = await initialCoverage(groupId, undefined)
  await db.occasion.create({
    data: {
      groupId,
      holidayKey: key,
      type: 'HOLIDAY',
      name: holiday.name,
      date: next,
      recursAnnually: true,
      nextOccurrence: next,
      ...(families.length ? { coverage: { create: families.map((familyId) => ({ familyId })) } } : {}),
    },
  })
}

/** A holiday that's been added is no longer dismissed. */
async function undismiss(groupId: string, key: string) {
  const group = await db.group.findUniqueOrThrow({ where: { id: groupId }, select: { dismissedHolidays: true } })
  if (group.dismissedHolidays.includes(key)) {
    await db.group.update({ where: { id: groupId }, data: { dismissedHolidays: group.dismissedHolidays.filter((k) => k !== key) } })
  }
}

export async function occasionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // The built-in holidays: each one's next date, the group's occasion for it (if added), and whether the group
  // said it doesn't celebrate it. `chosen` is false until the group answers "Which holidays do you celebrate?".
  app.get<{ Params: { groupId: string } }>('/groups/:groupId/holidays', async (request) => {
    const { groupId } = request.params
    await requireMember(userIdOf(request), groupId)
    return holidayChoices(groupId)
  })

  // Sets "Which holidays do you celebrate?": adds the picked ones (covering every family), removes built-in
  // holidays that were added but are no longer picked (gifts logged for them stay in the history), and stops
  // suggesting everything not picked.
  app.post<{ Params: { groupId: string }; Body: { keys: string[] } }>(
    '/groups/:groupId/holidays/choose',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['keys'],
          properties: { keys: { type: 'array', maxItems: 100, items: { type: 'string', maxLength: 64 } } },
        },
      },
    },
    async (request) => {
      const { groupId } = request.params
      await requireMember(userIdOf(request), groupId)
      const keys = new Set(request.body.keys)
      for (const key of keys) if (!findHoliday(key)) throw badRequest(`Unknown holiday: ${key}`)
      const added = new Set(
        (await db.occasion.findMany({ where: { groupId, holidayKey: { not: null } }, select: { holidayKey: true } })).map(
          (o) => o.holidayKey!,
        ),
      )
      for (const key of keys) if (!added.has(key)) await createHolidayOccasion(groupId, key)
      const removed = [...added].filter((k) => !keys.has(k))
      if (removed.length) await db.occasion.deleteMany({ where: { groupId, holidayKey: { in: removed } } })
      await db.group.update({
        where: { id: groupId },
        data: { holidaysChosenAt: new Date(), dismissedHolidays: HOLIDAYS.map((h) => h.key).filter((k) => !keys.has(k)) },
      })
      return holidayChoices(groupId)
    },
  )

  // "Not for us" on a suggested holiday: stop suggesting it. It can still be added from the holiday list.
  app.post<{ Params: { groupId: string; key: string } }>('/groups/:groupId/holidays/:key/dismiss', async (request) => {
    const { groupId, key } = request.params
    await requireMember(userIdOf(request), groupId)
    if (!findHoliday(key)) throw badRequest(`Unknown holiday: ${key}`)
    const group = await db.group.findUniqueOrThrow({ where: { id: groupId } })
    if (!group.dismissedHolidays.includes(key)) {
      await db.group.update({ where: { id: groupId }, data: { dismissedHolidays: [...group.dismissedHolidays, key] } })
    }
    return holidayChoices(groupId)
  })

  app.post<{ Params: { groupId: string }; Body: CreateBody }>(
    '/groups/:groupId/occasions',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ...occasionProperties,
            groupWide: { type: 'boolean' },
            holidayKey: { type: 'string', maxLength: 64 },
            familyIds: idList,
          },
        },
      },
    },
    async (request, reply) => {
      const { groupId } = request.params
      await requireMember(userIdOf(request), groupId)
      const { groupWide = false, holidayKey, familyIds, ...body } = request.body

      let coverage: string[] = []
      if (groupWide) {
        if (body.personId || body.familyId) throw badRequest('A group-wide occasion has no person or family')
        coverage = await initialCoverage(groupId, familyIds)
      } else {
        if (holidayKey || familyIds) throw badRequest('holidayKey and familyIds are for group-wide occasions')
        await assertSubject(groupId, body)
      }

      if (holidayKey) {
        const holiday = findHoliday(holidayKey)
        if (!holiday) throw badRequest(`Unknown holiday: ${holidayKey}`)
        const next = nextHolidayDate(holiday.rule, new Date())
        if (!next) throw badRequest(`${holiday.name} has no upcoming date`)
        if (await db.occasion.findFirst({ where: { groupId, holidayKey } })) throw conflict(`${holiday.name} is already in this group`)
        body.type = 'HOLIDAY'
        body.name ??= holiday.name
        body.date = next.toISOString()
        body.recursAnnually = true
      }
      if (!body.type || !body.name || !body.date) throw badRequest('type, name and date are required')

      const recursAnnually = body.recursAnnually ?? body.type !== 'ONE_OFF'
      const { date, recurrenceEndsAt, partyAt } = dates(body)
      const created = await db.occasion.create({
        data: {
          ...withoutDates(body),
          type: body.type,
          name: body.name,
          groupId,
          holidayKey: holidayKey ?? null,
          recursAnnually,
          date: date!,
          recurrenceEndsAt,
          partyAt,
          nextOccurrence: computeNextOccurrence({ date: date!, recursAnnually, recurrenceEndsAt: recurrenceEndsAt ?? null, holidayKey }),
          ...(coverage.length ? { coverage: { create: coverage.map((familyId) => ({ familyId })) } } : {}),
        },
        include: occasionInclude,
      })
      if (holidayKey) await undismiss(groupId, holidayKey)
      const [dto] = await serialiseOccasions([created])
      return reply.code(201).send(dto)
    },
  )

  app.get<{ Params: { groupId: string }; Querystring: ListQuery }>(
    '/groups/:groupId/occasions',
    {
      schema: { querystring: listQuerySchema },
    },
    async (request) => {
      const { groupId } = request.params
      await requireMember(userIdOf(request), groupId)
      const { type, personId, familyId } = request.query

      // A person's occasions include group-wide ones covering their family, shown as that family's share.
      const personFamilyId = personId
        ? (await db.person.findFirst({ where: { id: personId, groupId }, select: { familyId: true } }))?.familyId
        : undefined
      const forFamilyId = familyId ?? personFamilyId

      const where: Prisma.OccasionWhereInput = {
        groupId,
        nextOccurrence: windowWhere(request.query),
        AND: [
          activeSubjectWhere,
          ...(familyId ? [aboutFamilyWhere(familyId)] : []),
          ...(personId
            ? [{ OR: [{ personId }, ...(personFamilyId ? [{ ...GROUP_WIDE, coverage: { some: { familyId: personFamilyId } } }] : [])] }]
            : []),
        ],
        ...(type ? { type } : {}),
      }
      const [group, rows] = await Promise.all([
        db.group.findUniqueOrThrow({ where: { id: groupId } }),
        db.occasion.findMany({ where, include: occasionInclude, orderBy: { nextOccurrence: 'asc' } }),
      ])
      const occasions = await serialiseOccasions(rows, { forFamilyId })
      return { currency: group.currency, occasions, plannedSpend: plannedSpend(occasions) }
    },
  )

  app.get<{ Params: { id: string } }>('/occasions/:id', async (request) => {
    const occasion = await loadOr404(
      userIdOf(request),
      await db.occasion.findUnique({ where: { id: request.params.id }, include: occasionInclude }),
    )
    const [dto] = await serialiseOccasions([occasion])
    return dto
  })

  app.patch<{ Params: { id: string }; Body: OccasionBody & { status?: OccasionStatus; cardDone?: boolean } }>(
    '/occasions/:id',
    {
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
    },
    async (request) => {
      const occasion = await loadOr404(userIdOf(request), await db.occasion.findUnique({ where: { id: request.params.id } }))
      const body = request.body
      const groupWide = isGroupWide(occasion)

      if (groupWide && (body.personId || body.familyId)) throw badRequest("A group-wide occasion can't move to a person or family")
      if (occasion.holidayKey && (body.date !== undefined || body.recursAnnually !== undefined)) {
        throw badRequest("A built-in holiday's date comes from its rule")
      }

      // A new subject replaces the old one entirely.
      const subjectChange = body.personId || body.familyId ? { personId: body.personId ?? null, familyId: body.familyId ?? null } : {}
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
    },
  )

  // Group-wide occasions: the covered families and each one's budget override (null = use the defaults).
  app.put<{ Params: { id: string }; Body: { families: { familyId: string; budget?: number | null }[] } }>(
    '/occasions/:id/families',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['families'],
          properties: {
            families: {
              type: 'array',
              maxItems: 500,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['familyId'],
                properties: { familyId: { type: 'string', minLength: 1, maxLength: 64 }, budget: money },
              },
            },
          },
        },
      },
    },
    async (request) => {
      const occasion = await loadOr404(userIdOf(request), await db.occasion.findUnique({ where: { id: request.params.id } }))
      if (!isGroupWide(occasion)) throw badRequest('Only group-wide occasions cover families')
      const families = request.body.families
      const ids = families.map((f) => f.familyId)
      if (new Set(ids).size !== ids.length) throw badRequest('A family is listed twice')
      await assertInGroup('family', occasion.groupId, ids)

      await db.$transaction([
        db.occasionFamily.deleteMany({ where: { occasionId: occasion.id } }),
        db.occasionFamily.createMany({
          data: families.map((f) => ({ occasionId: occasion.id, familyId: f.familyId, budget: f.budget ?? null })),
        }),
      ])
      const updated = await db.occasion.findUniqueOrThrow({ where: { id: occasion.id }, include: occasionInclude })
      const [dto] = await serialiseOccasions([updated])
      return dto
    },
  )

  app.delete<{ Params: { id: string } }>('/occasions/:id', async (request, reply) => {
    const occasion = await loadOr404(userIdOf(request), await db.occasion.findUnique({ where: { id: request.params.id } }))
    await db.occasion.delete({ where: { id: occasion.id } })
    return reply.code(204).send()
  })
}
