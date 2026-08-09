import type { FastifyInstance } from 'fastify'
import { db } from '../db.js'

export async function giftRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  app.get('/gifts', async (request) => {
    const { userId } = request.user as { userId: string }
    return db.gift.findMany({
      where: { createdById: userId },
      include: { listings: true, basketItems: true },
      orderBy: { createdAt: 'desc' },
    })
  })

  app.post<{
    Body: { title: string; type?: string; description?: string; imageUrl?: string; upc?: string; tags?: string[]; basketItemIds?: string[] }
  }>(
    '/gifts',
    {
      schema: {
        body: {
          type: 'object',
          required: ['title'],
          properties: {
            title: { type: 'string', minLength: 1 },
            type: { type: 'string', enum: ['product', 'basket'] },
            description: { type: 'string' },
            imageUrl: { type: 'string' },
            upc: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            basketItemIds: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.user as { userId: string }
      const { title, type = 'product', description, imageUrl, upc, tags = [], basketItemIds = [] } = request.body

      if (basketItemIds.length > 0) {
        const ownedCount = await db.gift.count({
          where: { id: { in: basketItemIds }, createdById: userId },
        })
        if (ownedCount !== basketItemIds.length) {
          return reply.status(403).send({ error: 'Some basket items do not belong to you' })
        }
      }

      const gift = await db.gift.create({
        data: {
          createdById: userId,
          title,
          type,
          description,
          imageUrl,
          upc,
          tags,
          ...(basketItemIds.length > 0
            ? { basketItems: { connect: basketItemIds.map(id => ({ id })) } }
            : {}),
        },
        include: { listings: true, basketItems: true },
      })
      return reply.status(201).send(gift)
    }
  )

  // Finding 1: use findFirst with both id AND createdById to enforce ownership
  app.get<{ Params: { id: string } }>('/gifts/:id', async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const gift = await db.gift.findFirst({
      where: { id: request.params.id, createdById: userId },
      include: { listings: true, basketItems: { include: { listings: true } } },
    })
    if (!gift) return reply.status(404).send({ error: 'Not found' })
    return gift
  })

  app.patch<{ Params: { id: string }; Body: { title?: string; type?: string; description?: string; imageUrl?: string; upc?: string; tags?: string[]; basketItemIds?: string[] } }>(
    '/gifts/:id',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            title: { type: 'string', minLength: 1 },
            type: { type: 'string', enum: ['product', 'basket'] },
            description: { type: 'string' },
            imageUrl: { type: 'string' },
            upc: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            basketItemIds: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.user as { userId: string }
      const existing = await db.gift.findFirst({ where: { id: request.params.id, createdById: userId } })
      if (!existing) return reply.status(404).send({ error: 'Not found' })

      const { title, type, description, imageUrl, upc, tags, basketItemIds } = request.body

      if (basketItemIds !== undefined && basketItemIds.length > 0) {
        const ownedCount = await db.gift.count({
          where: { id: { in: basketItemIds }, createdById: userId },
        })
        if (ownedCount !== basketItemIds.length) {
          return reply.status(403).send({ error: 'Some basket items do not belong to you' })
        }
      }

      return db.gift.update({
        where: { id: request.params.id },
        data: {
          title, type, description, imageUrl, upc, tags,
          ...(basketItemIds !== undefined
            ? { basketItems: { set: basketItemIds.map(id => ({ id })) } }
            : {}),
        },
        include: { listings: true, basketItems: true },
      })
    }
  )

  app.delete<{ Params: { id: string } }>('/gifts/:id', async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const existing = await db.gift.findFirst({ where: { id: request.params.id, createdById: userId } })
    if (!existing) return reply.status(404).send({ error: 'Not found' })
    await db.gift.delete({ where: { id: request.params.id } })
    return reply.status(204).send()
  })
}
