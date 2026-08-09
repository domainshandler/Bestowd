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

  app.get<{ Params: { id: string } }>('/gifts/:id', async (request, reply) => {
    const gift = await db.gift.findUnique({
      where: { id: request.params.id },
      include: { listings: true, basketItems: { include: { listings: true } } },
    })
    if (!gift) return reply.status(404).send({ error: 'Not found' })
    return gift
  })

  app.patch<{ Params: { id: string }; Body: { title?: string; description?: string; imageUrl?: string; upc?: string; tags?: string[]; basketItemIds?: string[] } }>(
    '/gifts/:id',
    async (request, reply) => {
      const { userId } = request.user as { userId: string }
      const existing = await db.gift.findFirst({ where: { id: request.params.id, createdById: userId } })
      if (!existing) return reply.status(404).send({ error: 'Not found' })

      const { title, description, imageUrl, upc, tags, basketItemIds } = request.body
      return db.gift.update({
        where: { id: request.params.id },
        data: {
          title, description, imageUrl, upc, tags,
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
