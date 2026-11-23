import type { FastifyInstance } from 'fastify'
import type { IdeaStatus, Prisma } from '@prisma/client'
import { db } from '../db.js'
import { iso, money } from '../dto.js'
import { badRequest, conflict } from '../http-error.js'
import { assertInGroup, loadOr404, requireMember, userIdOf } from '../services/access.js'
import { ageOn } from '../services/age.js'
import { advanceForGift, createGiftEntry, toGiftDto } from '../services/gift-log.js'
import { startOfUtcDay } from '../services/next-occurrence.js'
import { advanceOccasionStatus } from '../services/occasion-status.js'
import { findRepeat } from '../services/repeats.js'
import { id, idList, isoDate, money as moneySchema, nullableId, nullableString, parseDate } from './schemas.js'

interface IdeaBody {
  title?: string
  brand?: string | null
  store?: string | null
  category?: string | null
  url?: string | null
  imageUrl?: string | null
  price?: number | null
  notes?: string | null
  ageMin?: number | null
  ageMax?: number | null
  personIds?: string[]
  occasionId?: string | null
  status?: IdeaStatus
}

const age = { type: ['integer', 'null'], minimum: 0, maximum: 120 }
const ideaProperties = {
  title: { type: 'string', minLength: 1, maxLength: 200 },
  brand: nullableString(80),
  store: nullableString(80),
  category: nullableString(60),
  url: { type: ['string', 'null'], maxLength: 2000, pattern: '^https?://' },
  // A web image, or a photo uploaded to Bestowd.
  imageUrl: { type: ['string', 'null'], maxLength: 2000, pattern: '^(https?://|/files/)' },
  price: moneySchema,
  notes: nullableString(5000),
  ageMin: age,
  ageMax: age,
  personIds: idList,
  occasionId: nullableId,
}

const ideaInclude = { tags: { select: { person: { select: { id: true, name: true } } } } } satisfies Prisma.IdeaInclude
type IdeaRow = Prisma.IdeaGetPayload<{ include: typeof ideaInclude }>

function toIdeaDto(idea: IdeaRow) {
  return {
    id: idea.id,
    groupId: idea.groupId,
    title: idea.title,
    brand: idea.brand,
    store: idea.store,
    category: idea.category,
    url: idea.url,
    imageUrl: idea.imageUrl,
    price: money(idea.price),
    notes: idea.notes,
    ageMin: idea.ageMin,
    ageMax: idea.ageMax,
    status: idea.status,
    occasionId: idea.occasionId,
    people: idea.tags.map((t) => t.person),
    createdById: idea.createdById,
    createdAt: iso(idea.createdAt),
    updatedAt: iso(idea.updatedAt),
  }
}

function checkAgeRange(ageMin: number | null | undefined, ageMax: number | null | undefined) {
  if (ageMin != null && ageMax != null && ageMin > ageMax) throw badRequest('ageMin must not exceed ageMax')
}

/** True when the idea is tagged to the person, or the person's age falls in the idea's age range. */
export function ideaMatches(idea: { ageMin: number | null; ageMax: number | null; tags: { person: { id: string } }[] }, personId: string, personAge: number | null): boolean {
  if (idea.tags.some((t) => t.person.id === personId)) return true
  if (personAge === null || (idea.ageMin === null && idea.ageMax === null)) return false
  return personAge >= (idea.ageMin ?? 0) && personAge <= (idea.ageMax ?? 120)
}

export async function ideaRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  app.post<{ Params: { groupId: string }; Body: IdeaBody & { title: string } }>('/groups/:groupId/ideas', {
    schema: { body: { type: 'object', additionalProperties: false, required: ['title'], properties: ideaProperties } },
  }, async (request, reply) => {
    const { groupId } = request.params
    const userId = userIdOf(request)
    await requireMember(userId, groupId)
    const { personIds = [], ...data } = request.body
    checkAgeRange(data.ageMin, data.ageMax)
    await assertInGroup('person', groupId, personIds)
    if (data.occasionId) await assertInGroup('occasion', groupId, [data.occasionId])

    const idea = await db.idea.create({
      data: {
        ...data,
        groupId,
        createdById: userId,
        tags: { create: [...new Set(personIds)].map((personId) => ({ personId })) },
      },
      include: ideaInclude,
    })
    if (idea.occasionId) await advanceOccasionStatus(idea.occasionId, 'IDEA_SAVED')
    return reply.code(201).send(toIdeaDto(idea))
  })

  app.get<{ Params: { groupId: string }; Querystring: { personId?: string; familyId?: string; occasionId?: string; status?: IdeaStatus } }>('/groups/:groupId/ideas', {
    schema: {
      querystring: {
        type: 'object',
        properties: { personId: id, familyId: id, occasionId: id, status: { type: 'string', enum: ['SAVED', 'BOUGHT', 'DISMISSED'] } },
      },
    },
  }, async (request) => {
    const { groupId } = request.params
    await requireMember(userIdOf(request), groupId)
    const { personId, familyId, occasionId, status = 'SAVED' } = request.query

    const occasion = occasionId ? await db.occasion.findUnique({ where: { id: occasionId } }) : null
    if (occasionId && occasion?.groupId !== groupId) throw badRequest('occasion not in this group')

    if (familyId) {
      const family = await db.family.findUnique({ where: { id: familyId } })
      if (!family || family.groupId !== groupId) throw badRequest('family not in this group')
    }

    if (!personId) {
      // A family: ideas tagged with anyone in it.
      const ideas = await db.idea.findMany({
        where: { groupId, status, ...(occasionId ? { occasionId } : {}), ...(familyId ? { tags: { some: { person: { familyId } } } } : {}) },
        include: ideaInclude,
        orderBy: { createdAt: 'desc' },
      })
      return { person: null, ideas: ideas.map((i) => ({ ...toIdeaDto(i), repeat: null })) }
    }

    const person = await db.person.findUnique({ where: { id: personId } })
    if (!person || person.groupId !== groupId) throw badRequest('person not in this group')
    const on = occasion ? (occasion.nextOccurrence ?? occasion.date) : startOfUtcDay(new Date())
    const personAge = ageOn(person, on)

    const candidates = await db.idea.findMany({ where: { groupId, status }, include: ideaInclude, orderBy: { createdAt: 'desc' } })
    const matching = candidates.filter((i) => ideaMatches(i, person.id, personAge))
    const ideas = await Promise.all(matching.map(async (i) => ({ ...toIdeaDto(i), repeat: await findRepeat(person.id, i.category) })))
    return { person: { id: person.id, name: person.name, age: personAge }, ideas }
  })

  app.get<{ Params: { id: string } }>('/ideas/:id', async (request) => {
    const idea = await loadOr404(userIdOf(request), await db.idea.findUnique({ where: { id: request.params.id }, include: ideaInclude }))
    return toIdeaDto(idea)
  })

  app.patch<{ Params: { id: string }; Body: IdeaBody }>('/ideas/:id', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        properties: { ...ideaProperties, status: { type: 'string', enum: ['SAVED', 'BOUGHT', 'DISMISSED'] } },
      },
    },
  }, async (request) => {
    const existing = await loadOr404(userIdOf(request), await db.idea.findUnique({ where: { id: request.params.id } }))
    const { personIds, ...data } = request.body
    checkAgeRange(data.ageMin === undefined ? existing.ageMin : data.ageMin, data.ageMax === undefined ? existing.ageMax : data.ageMax)
    if (personIds) await assertInGroup('person', existing.groupId, personIds)
    if (data.occasionId) await assertInGroup('occasion', existing.groupId, [data.occasionId])

    const idea = await db.$transaction(async (tx) => {
      if (personIds) {
        await tx.ideaPerson.deleteMany({ where: { ideaId: existing.id } })
        await tx.ideaPerson.createMany({ data: [...new Set(personIds)].map((personId) => ({ ideaId: existing.id, personId })) })
      }
      return tx.idea.update({ where: { id: existing.id }, data, include: ideaInclude })
    })
    if (data.occasionId) await advanceOccasionStatus(data.occasionId, 'IDEA_SAVED')
    return toIdeaDto(idea)
  })

  app.post<{ Params: { id: string }; Body: { personId?: string | null; familyId?: string | null; occasionId?: string | null; amount?: number | null; date?: string } }>('/ideas/:id/buy', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        properties: { personId: nullableId, familyId: nullableId, occasionId: nullableId, amount: moneySchema, date: isoDate },
      },
    },
  }, async (request) => {
    const userId = userIdOf(request)
    const idea = await loadOr404(userId, await db.idea.findUnique({ where: { id: request.params.id } }))
    if (idea.status === 'BOUGHT') throw conflict('Idea already bought')
    const body = request.body

    const occasionId = body.occasionId === undefined ? idea.occasionId : body.occasionId
    let subject = { personId: body.personId ?? null, familyId: body.familyId ?? null }
    if (!subject.personId && !subject.familyId && occasionId) {
      // Default the recipient to the occasion's subject.
      const occasion = await db.occasion.findUnique({ where: { id: occasionId } })
      if (occasion && occasion.groupId === idea.groupId) subject = { personId: occasion.personId, familyId: occasion.familyId }
    }

    const { gift, updated } = await db.$transaction(async (tx) => {
      const gift = await createGiftEntry(idea.groupId, userId, {
        direction: 'GIVEN',
        status: 'BOUGHT',
        title: idea.title,
        // The idea's details carry over to the gift.
        brand: idea.brand,
        store: idea.store,
        category: idea.category,
        url: idea.url,
        photoUrl: idea.imageUrl,
        notes: idea.notes,
        ideaId: idea.id,
        occasionId,
        amount: body.amount === undefined ? (idea.price === null ? null : Number(idea.price)) : body.amount,
        date: body.date ? parseDate(body.date) : startOfUtcDay(new Date()),
        ...subject,
      }, tx)
      const updated = await tx.idea.update({ where: { id: idea.id }, data: { status: 'BOUGHT' }, include: ideaInclude })
      return { gift, updated }
    })
    await advanceForGift(gift)
    return { idea: toIdeaDto(updated), gift: toGiftDto(gift) }
  })

  app.delete<{ Params: { id: string } }>('/ideas/:id', async (request, reply) => {
    const idea = await loadOr404(userIdOf(request), await db.idea.findUnique({ where: { id: request.params.id } }))
    await db.idea.delete({ where: { id: idea.id } })
    return reply.code(204).send()
  })
}
