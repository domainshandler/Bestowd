import type { FastifyInstance } from 'fastify'
import { db } from '../db.js'

export async function assignmentRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  app.get<{ Querystring: { contactId?: string; eventId?: string } }>('/assignments', async (request) => {
    const { userId } = request.user as { userId: string }
    const { contactId, eventId } = request.query
    return db.giftAssignment.findMany({
      where: {
        giverId: userId,
        ...(contactId ? { contactId } : {}),
        ...(eventId ? { eventId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    })
  })

  app.post<{
    Body: { giftId: string; contactId: string; eventId?: string; status?: string; notes?: string }
  }>(
    '/assignments',
    {
      schema: {
        body: {
          type: 'object',
          required: ['giftId', 'contactId'],
          properties: {
            giftId: { type: 'string' },
            contactId: { type: 'string' },
            eventId: { type: 'string' },
            status: { type: 'string', enum: ['idea', 'purchased', 'given'] },
            notes: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.user as { userId: string }
      const { giftId, contactId, eventId, status = 'idea', notes } = request.body

      const contact = await db.contact.findFirst({ where: { id: contactId, ownerId: userId } })
      if (!contact) return reply.status(404).send({ error: 'Contact not found' })

      const gift = await db.gift.findFirst({ where: { id: giftId, createdById: userId } })
      if (!gift) return reply.status(404).send({ error: 'Gift not found' })

      const assignment = await db.giftAssignment.create({
        data: { giftId, giverId: userId, contactId, eventId, status, notes },
      })
      return reply.status(201).send(assignment)
    }
  )

  app.get<{ Params: { id: string } }>('/assignments/:id', async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const assignment = await db.giftAssignment.findFirst({
      where: { id: request.params.id, giverId: userId },
    })
    if (!assignment) return reply.status(404).send({ error: 'Not found' })
    return assignment
  })

  app.patch<{
    Params: { id: string }
    Body: { status?: string; givenAt?: string; purchasePrice?: string; notes?: string }
  }>('/assignments/:id', async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const existing = await db.giftAssignment.findFirst({ where: { id: request.params.id, giverId: userId } })
    if (!existing) return reply.status(404).send({ error: 'Not found' })

    const { status, givenAt, purchasePrice, notes } = request.body
    const updated = await db.giftAssignment.update({
      where: { id: request.params.id },
      data: {
        ...(status !== undefined ? { status } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(givenAt !== undefined ? { givenAt: new Date(givenAt) } : {}),
        ...(purchasePrice !== undefined ? { purchasePrice: parseFloat(purchasePrice) } : {}),
      },
    })
    // Return purchasePrice as string to match Decimal serialization
    return { ...updated, purchasePrice: updated.purchasePrice?.toString() ?? null }
  })

  app.delete<{ Params: { id: string } }>('/assignments/:id', async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const existing = await db.giftAssignment.findFirst({ where: { id: request.params.id, giverId: userId } })
    if (!existing) return reply.status(404).send({ error: 'Not found' })
    await db.giftAssignment.delete({ where: { id: request.params.id } })
    return reply.status(204).send()
  })
}
