import type { FastifyInstance } from 'fastify'
import { db } from '../db.js'
import { computeNextOccurrence } from '../services/next-occurrence.js'

export async function eventRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  app.get('/events', async (request) => {
    const { userId } = request.user as { userId: string }
    const contacts = await db.contact.findMany({ where: { ownerId: userId }, select: { id: true } })
    const contactIds = contacts.map(c => c.id)
    return db.event.findMany({
      where: { contactId: { in: contactIds } },
      orderBy: { nextOccurrence: 'asc' },
    })
  })

  app.post<{
    Body: {
      contactId: string; type: string; name: string; date: string;
      recurrenceRule?: string; reminderDays?: number[]
    }
  }>(
    '/events',
    {
      schema: {
        body: {
          type: 'object',
          required: ['contactId', 'type', 'name', 'date'],
          properties: {
            contactId: { type: 'string' },
            type: { type: 'string' },
            name: { type: 'string' },
            date: { type: 'string' },
            recurrenceRule: { type: 'string' },
            reminderDays: { type: 'array', items: { type: 'integer' } },
          },
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.user as { userId: string }
      const { contactId, type, name, date, recurrenceRule = 'annual', reminderDays = [30, 7, 1] } = request.body

      const contact = await db.contact.findFirst({ where: { id: contactId, ownerId: userId } })
      if (!contact) return reply.status(403).send({ error: 'Contact not found or not owned by you' })

      const parsedDate = new Date(date)
      const nextOccurrence = computeNextOccurrence(parsedDate, recurrenceRule)

      const event = await db.event.create({
        data: { contactId, type, name, date: parsedDate, recurrenceRule, reminderDays, nextOccurrence },
      })
      return reply.status(201).send(event)
    }
  )

  app.get<{ Params: { id: string } }>('/events/:id', async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const event = await db.event.findUnique({
      where: { id: request.params.id },
      include: { contact: { select: { ownerId: true } } },
    })
    if (!event || event.contact.ownerId !== userId) return reply.status(404).send({ error: 'Not found' })
    return event
  })

  app.patch<{ Params: { id: string }; Body: { type?: string; name?: string; date?: string; recurrenceRule?: string; reminderDays?: number[] } }>(
    '/events/:id',
    async (request, reply) => {
      const { userId } = request.user as { userId: string }
      const event = await db.event.findUnique({
        where: { id: request.params.id },
        include: { contact: { select: { ownerId: true } } },
      })
      if (!event || event.contact.ownerId !== userId) return reply.status(404).send({ error: 'Not found' })

      const { type, name, date, recurrenceRule, reminderDays } = request.body
      const parsedDate = date ? new Date(date) : event.date
      const rule = recurrenceRule ?? event.recurrenceRule
      const nextOccurrence = computeNextOccurrence(parsedDate, rule)

      return db.event.update({
        where: { id: request.params.id },
        data: { type, name, date: parsedDate, recurrenceRule: rule, reminderDays, nextOccurrence },
      })
    }
  )

  app.delete<{ Params: { id: string } }>('/events/:id', async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const event = await db.event.findUnique({
      where: { id: request.params.id },
      include: { contact: { select: { ownerId: true } } },
    })
    if (!event || event.contact.ownerId !== userId) return reply.status(404).send({ error: 'Not found' })
    await db.event.delete({ where: { id: request.params.id } })
    return reply.status(204).send()
  })
}
