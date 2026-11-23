import type { FastifyInstance } from 'fastify'
import type { Prisma } from '@prisma/client'
import { db } from '../db.js'
import { iso, toPersonDto } from '../dto.js'
import { badRequest, conflict } from '../http-error.js'
import { loadOr404, requireMember, userIdOf } from '../services/access.js'
import { ageOn } from '../services/age.js'
import { personGiftsWhere } from '../services/gift-totals.js'
import { id, nullableString, stringList } from './schemas.js'

interface PersonBody {
  name?: string
  relationship?: string | null
  birthMonth?: number | null
  birthDay?: number | null
  birthYear?: number | null
  likes?: string[]
  avoid?: string[]
  sizes?: Record<string, string>
  foodNotes?: string | null
  photoUrl?: string | null
  notes?: string | null
}

const personProperties = {
  name: { type: 'string', minLength: 1, maxLength: 100 },
  relationship: nullableString(100),
  birthMonth: { type: ['integer', 'null'], minimum: 1, maximum: 12 },
  birthDay: { type: ['integer', 'null'], minimum: 1, maximum: 31 },
  birthYear: { type: ['integer', 'null'], minimum: 1900, maximum: 2100 },
  likes: stringList,
  avoid: stringList,
  sizes: { type: 'object', maxProperties: 20, additionalProperties: { type: 'string', maxLength: 50 } },
  foodNotes: nullableString(1000),
  photoUrl: nullableString(2000),
  notes: nullableString(5000),
}

function checkBirth(p: { birthMonth?: number | null; birthDay?: number | null; birthYear?: number | null }) {
  if (p.birthDay != null && p.birthMonth == null) throw badRequest('birthDay needs birthMonth')
  if (p.birthYear != null && p.birthYear > new Date().getUTCFullYear()) throw badRequest('birthYear is in the future')
}

function toData(body: PersonBody): Prisma.PersonUncheckedUpdateInput {
  const { sizes, ...rest } = body
  return { ...rest, ...(sizes ? { sizes: sizes } : {}) }
}

export async function personRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // Everyone in the group (not archived, in active families unless asked), for the People "Everyone" view and pickers.
  app.get<{ Params: { groupId: string }; Querystring: { includeArchived?: boolean } }>(
    '/groups/:groupId/people',
    {
      schema: { querystring: { type: 'object', properties: { includeArchived: { type: 'boolean' } } } },
    },
    async (request) => {
      const { groupId } = request.params
      await requireMember(userIdOf(request), groupId)
      const people = await db.person.findMany({
        where: {
          groupId,
          ...(request.query.includeArchived ? {} : { archivedAt: null, family: { status: { not: 'ARCHIVED' } } }),
        },
        include: { family: { select: { name: true } } },
        orderBy: { name: 'asc' },
      })
      const today = new Date()
      return people.map(({ family, ...p }) => ({ ...toPersonDto(p), age: ageOn(p, today), familyName: family.name }))
    },
  )

  app.post<{ Params: { id: string }; Body: PersonBody & { name: string } }>(
    '/families/:id/people',
    {
      schema: { body: { type: 'object', additionalProperties: false, required: ['name'], properties: personProperties } },
    },
    async (request, reply) => {
      const family = await loadOr404(userIdOf(request), await db.family.findUnique({ where: { id: request.params.id } }))
      checkBirth(request.body)
      const person = await db.person.create({
        data: {
          ...(toData(request.body) as Prisma.PersonUncheckedCreateInput),
          name: request.body.name,
          familyId: family.id,
          groupId: family.groupId,
        },
      })
      return reply.code(201).send(toPersonDto(person))
    },
  )

  app.get<{ Params: { id: string } }>('/people/:id', async (request) => {
    const person = await loadOr404(
      userIdOf(request),
      await db.person.findUnique({ where: { id: request.params.id }, include: { family: { select: { name: true } } } }),
    )
    const history = await db.giftEntry.findMany({
      where: personGiftsWhere(person.id),
      orderBy: { date: 'desc' },
      take: 10,
      select: { id: true, direction: true, title: true, date: true, reaction: true },
    })
    const { family, ...rest } = person
    return {
      ...toPersonDto(rest),
      age: ageOn(person, new Date()),
      familyName: family.name,
      history: history.map((g) => ({ ...g, date: iso(g.date) })),
    }
  })

  app.patch<{ Params: { id: string }; Body: PersonBody & { archived?: boolean; familyId?: string } }>(
    '/people/:id',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          properties: { ...personProperties, archived: { type: 'boolean' }, familyId: id },
        },
      },
    },
    async (request) => {
      const person = await loadOr404(userIdOf(request), await db.person.findUnique({ where: { id: request.params.id } }))
      const { archived, familyId, ...body } = request.body
      checkBirth({ birthMonth: person.birthMonth, birthDay: person.birthDay, birthYear: person.birthYear, ...body })

      if (familyId && familyId !== person.familyId) {
        const target = await db.family.findUnique({ where: { id: familyId } })
        if (!target || target.groupId !== person.groupId) throw badRequest('Family not in this group')
      }

      const updated = await db.person.update({
        where: { id: person.id },
        data: {
          ...toData(body),
          ...(familyId ? { familyId } : {}),
          ...(archived === undefined ? {} : { archivedAt: archived ? (person.archivedAt ?? new Date()) : null }),
        },
      })
      return toPersonDto(updated)
    },
  )

  app.delete<{ Params: { id: string } }>('/people/:id', async (request, reply) => {
    const person = await loadOr404(userIdOf(request), await db.person.findUnique({ where: { id: request.params.id } }))
    if (person.userId) throw conflict("This person signs in to the group, so they can't be deleted")
    await db.person.delete({ where: { id: person.id } })
    return reply.code(204).send()
  })
}
