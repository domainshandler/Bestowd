import type { FastifyInstance } from 'fastify'
import { db } from '../db.js'

export async function contactRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  app.get('/contacts', async (request) => {
    const { userId } = request.user as { userId: string }
    return db.contact.findMany({ where: { ownerId: userId }, orderBy: { name: 'asc' } })
  })

  app.post<{ Body: { name: string; email?: string; avatarUrl?: string; notes?: string; attributes?: unknown[] } }>(
    '/contacts',
    {
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1 },
            email: { type: 'string' },
            avatarUrl: { type: 'string' },
            notes: { type: 'string' },
            attributes: { type: 'array' },
          },
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.user as { userId: string }
      const { name, email, avatarUrl, notes, attributes } = request.body
      const contact = await db.contact.create({
        data: {
          ownerId: userId,
          name,
          email,
          avatarUrl,
          notes,
          attributes: (attributes as any) ?? [],
          isManaged: true,
        },
      })
      return reply.status(201).send(contact)
    }
  )

  app.get<{ Params: { id: string } }>('/contacts/:id', async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const contact = await db.contact.findFirst({
      where: { id: request.params.id, ownerId: userId },
    })
    if (!contact) return reply.status(404).send({ error: 'Not found' })
    return contact
  })

  app.patch<{ Params: { id: string }; Body: { name?: string; email?: string; avatarUrl?: string; notes?: string; attributes?: unknown[] } }>(
    '/contacts/:id',
    async (request, reply) => {
      const { userId } = request.user as { userId: string }
      const existing = await db.contact.findFirst({
        where: { id: request.params.id, ownerId: userId },
      })
      if (!existing) return reply.status(404).send({ error: 'Not found' })
      const { name, email, avatarUrl, notes, attributes } = request.body
      return db.contact.update({
        where: { id: request.params.id },
        data: { name, email, avatarUrl, notes, ...(attributes !== undefined ? { attributes: attributes as any } : {}) },
      })
    }
  )

  app.delete<{ Params: { id: string } }>('/contacts/:id', async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const existing = await db.contact.findFirst({
      where: { id: request.params.id, ownerId: userId },
    })
    if (!existing) return reply.status(404).send({ error: 'Not found' })
    await db.contact.delete({ where: { id: request.params.id } })
    return reply.status(204).send()
  })

  // Claim flow: link unmanaged contact to current user if emails match
  app.post<{ Params: { id: string } }>('/contacts/:id/claim', async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } })
    const contact = await db.contact.findUnique({ where: { id: request.params.id } })

    if (!contact) return reply.status(404).send({ error: 'Not found' })
    if (!contact.isManaged) return reply.status(409).send({ error: 'Contact already linked' })
    if (contact.email?.toLowerCase() !== user.email.toLowerCase()) {
      return reply.status(403).send({ error: 'Email does not match contact record' })
    }

    const updated = await db.contact.update({
      where: { id: contact.id },
      data: { linkedUserId: userId, isManaged: false },
    })
    return updated
  })
}
