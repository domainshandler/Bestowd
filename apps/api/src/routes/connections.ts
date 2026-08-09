import type { FastifyInstance } from 'fastify'
import { db } from '../db.js'

export async function connectionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  app.post<{ Body: { addresseeEmail: string } }>(
    '/connections',
    {
      schema: {
        body: {
          type: 'object',
          required: ['addresseeEmail'],
          properties: { addresseeEmail: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.user as { userId: string }
      const addressee = await db.user.findUnique({ where: { email: request.body.addresseeEmail } })
      if (!addressee) return reply.status(404).send({ error: 'User not found' })
      if (addressee.id === userId) return reply.status(400).send({ error: 'Cannot connect to yourself' })

      const existing = await db.userConnection.findUnique({
        where: { requesterId_addresseeId: { requesterId: userId, addresseeId: addressee.id } },
      })
      if (existing) return reply.status(409).send({ error: 'Connection already exists' })

      const reverseExisting = await db.userConnection.findUnique({
        where: { requesterId_addresseeId: { requesterId: addressee.id, addresseeId: userId } },
      })
      if (reverseExisting) return reply.status(409).send({ error: 'Connection already exists' })

      const connection = await db.userConnection.create({
        data: { requesterId: userId, addresseeId: addressee.id, status: 'pending' },
      })
      return reply.status(201).send(connection)
    }
  )

  app.patch<{ Params: { requesterId: string }; Body: { status: 'accepted' | 'blocked' } }>(
    '/connections/:requesterId',
    {
      schema: {
        body: {
          type: 'object',
          required: ['status'],
          properties: {
            status: { type: 'string', enum: ['accepted', 'blocked'] },
          },
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.user as { userId: string }
      const connection = await db.userConnection.findUnique({
        where: { requesterId_addresseeId: { requesterId: request.params.requesterId, addresseeId: userId } },
      })
      if (!connection) return reply.status(404).send({ error: 'Not found' })

      const updated = await db.userConnection.update({
        where: { requesterId_addresseeId: { requesterId: request.params.requesterId, addresseeId: userId } },
        data: { status: request.body.status },
      })
      return updated
    }
  )

  app.get('/connections', async (request) => {
    const { userId } = request.user as { userId: string }
    return db.userConnection.findMany({
      where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
    })
  })
}
