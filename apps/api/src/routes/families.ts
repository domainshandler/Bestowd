import type { FastifyInstance } from 'fastify'
import type { FamilyStatus, FamilyType } from '@prisma/client'
import { db } from '../db.js'
import { toFamilyDto, toPersonDto } from '../dto.js'
import { conflict } from '../http-error.js'
import { loadOr404, requireMember, userIdOf } from '../services/access.js'
import { ageOn } from '../services/age.js'
import { familyGiftsWhere, giftTotals } from '../services/gift-totals.js'
import { startOfUtcDay } from '../services/next-occurrence.js'
import { GROUP_WIDE, aboutFamilyWhere, occasionInclude, serialiseOccasions } from '../services/occasions.js'
import { sharedPersonView } from '../services/tokens.js'
import { nullableString } from './schemas.js'

interface FamilyBody {
  name?: string
  type?: FamilyType
  status?: FamilyStatus
  photoUrl?: string | null
  notes?: string | null
}

const familyProperties = {
  name: { type: 'string', minLength: 1, maxLength: 100 },
  type: { type: 'string', enum: ['FAMILY', 'FRIENDS', 'SCHOOL', 'NEIGHBOURS', 'OTHER'] },
  photoUrl: nullableString(2000),
  notes: nullableString(5000),
}

export async function familyRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  app.get<{ Params: { groupId: string }; Querystring: { status?: FamilyStatus } }>(
    '/groups/:groupId/families',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: { status: { type: 'string', enum: ['ACTIVE', 'PAUSED', 'ARCHIVED'] } },
        },
      },
    },
    async (request) => {
      const { groupId } = request.params
      await requireMember(userIdOf(request), groupId)
      const { status } = request.query

      const families = await db.family.findMany({
        where: { groupId, ...(status ? { status } : { status: { not: 'ARCHIVED' } }) },
        include: {
          _count: { select: { people: { where: { archivedAt: null } } } },
          connection: { select: { id: true } },
        },
      })
      families.sort((x, y) => Number(y.householdOfGroupId !== null) - Number(x.householdOfGroupId !== null) || x.name.localeCompare(y.name))

      const ids = families.map((f) => f.id)
      const upcoming = await db.occasion.findMany({
        where: {
          groupId,
          nextOccurrence: { gte: startOfUtcDay(new Date()) },
          OR: [
            { familyId: { in: ids } },
            { person: { is: { familyId: { in: ids }, archivedAt: null } } },
            { ...GROUP_WIDE, coverage: { some: { familyId: { in: ids } } } },
          ],
        },
        include: { person: { select: { name: true, familyId: true } }, coverage: { select: { familyId: true } } },
        orderBy: { nextOccurrence: 'asc' },
      })
      const nextByFamily = new Map<string, (typeof upcoming)[number]>()
      for (const o of upcoming) {
        // A group-wide occasion is next for every family it covers.
        const familyIds = o.familyId ? [o.familyId] : o.person ? [o.person.familyId] : o.coverage.map((c) => c.familyId)
        for (const familyId of familyIds) if (!nextByFamily.has(familyId)) nextByFamily.set(familyId, o)
      }

      return families.map((f) => {
        const next = nextByFamily.get(f.id)
        return {
          ...toFamilyDto(f),
          memberCount: f._count.people,
          onBestowd: f.connection !== null,
          nextOccasion: next
            ? { id: next.id, name: next.name, nextOccurrence: next.nextOccurrence!.toISOString(), personName: next.person?.name ?? null }
            : null,
        }
      })
    },
  )

  app.post<{ Params: { groupId: string }; Body: FamilyBody & { name: string } }>(
    '/groups/:groupId/families',
    {
      schema: { body: { type: 'object', additionalProperties: false, required: ['name'], properties: familyProperties } },
    },
    async (request, reply) => {
      const { groupId } = request.params
      await requireMember(userIdOf(request), groupId)
      const family = await db.family.create({ data: { ...request.body, groupId } })
      // Group-wide occasions that take new families (e.g. Christmas) cover this one too.
      const groupWide = await db.occasion.findMany({ where: { groupId, ...GROUP_WIDE, includeNewFamilies: true }, select: { id: true } })
      if (groupWide.length) await db.occasionFamily.createMany({ data: groupWide.map((o) => ({ occasionId: o.id, familyId: family.id })) })
      return reply.code(201).send(toFamilyDto(family))
    },
  )

  app.get<{ Params: { id: string } }>('/families/:id', async (request) => {
    const family = await loadOr404(userIdOf(request), await db.family.findUnique({ where: { id: request.params.id } }))
    return familyProfile(family.id)
  })

  app.patch<{ Params: { id: string }; Body: FamilyBody }>(
    '/families/:id',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          properties: { ...familyProperties, status: { type: 'string', enum: ['ACTIVE', 'PAUSED', 'ARCHIVED'] } },
        },
      },
    },
    async (request) => {
      const family = await loadOr404(userIdOf(request), await db.family.findUnique({ where: { id: request.params.id } }))
      const updated = await db.family.update({ where: { id: family.id }, data: request.body })
      return toFamilyDto(updated)
    },
  )

  app.delete<{ Params: { id: string } }>('/families/:id', async (request, reply) => {
    const family = await loadOr404(userIdOf(request), await db.family.findUnique({ where: { id: request.params.id } }))
    if (family.householdOfGroupId !== null) throw conflict("Can't delete your own household")
    await db.family.delete({ where: { id: family.id } })
    return reply.code(204).send()
  })
}

/** The family profile: people, upcoming occasions, gift totals and (Task 11) connection. */
export async function familyProfile(familyId: string) {
  const today = startOfUtcDay(new Date())
  const yearAhead = new Date(today.getTime() + 365 * 86_400_000)
  const family = await db.family.findUniqueOrThrow({
    where: { id: familyId },
    include: {
      people: {
        where: { archivedAt: null },
        orderBy: { createdAt: 'asc' },
        include: { occasions: { where: { type: 'BIRTHDAY', nextOccurrence: { not: null } }, orderBy: { nextOccurrence: 'asc' }, take: 1 } },
      },
    },
  })

  const occasions = await db.occasion.findMany({
    where: {
      nextOccurrence: { gte: today, lte: yearAhead },
      ...aboutFamilyWhere(familyId),
    },
    include: occasionInclude,
    orderBy: { nextOccurrence: 'asc' },
  })

  return {
    ...toFamilyDto(family),
    people: family.people.map(({ occasions: birthdays, ...p }) => ({
      ...toPersonDto(p),
      age: ageOn(p, today),
      nextBirthday: birthdays[0]?.nextOccurrence?.toISOString() ?? null,
    })),
    occasions: await serialiseOccasions(occasions, { forFamilyId: familyId }),
    totals: await giftTotals({ groupId: family.groupId, ...familyGiftsWhere(familyId) }),
    connection: await connectionView(familyId),
  }
}

/** What a connected family shares: its non-archived people, limited to the fields it chose. */
async function connectionView(familyId: string) {
  const connection = await db.familyConnection.findUnique({
    where: { familyId },
    include: { sourceFamily: { include: { people: { where: { archivedAt: null }, orderBy: { createdAt: 'asc' } } } } },
  })
  if (!connection) return null
  return {
    id: connection.id,
    sourceFamilyName: connection.sourceFamily.name,
    sharedFields: connection.sharedFields,
    createdAt: connection.createdAt.toISOString(),
    people: connection.sourceFamily.people.map((p) => sharedPersonView(p, connection.sharedFields)),
  }
}
