import type { FastifyInstance } from 'fastify'
import { db } from '../db.js'

export async function listingRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  app.get<{ Params: { giftId: string } }>('/gifts/:giftId/listings', async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const giftId = request.params.giftId
    const gift = await db.gift.findFirst({ where: { id: giftId, createdById: userId } })
    if (!gift) return reply.status(404).send({ error: 'Not found' })
    return db.productListing.findMany({ where: { giftId } })
  })

  app.post<{
    Params: { giftId: string }
    Body: { vendor: string; vendorProductId?: string; vendorUrl: string; listedPrice?: string; currency?: string }
  }>(
    '/gifts/:giftId/listings',
    {
      schema: {
        body: {
          type: 'object',
          required: ['vendor', 'vendorUrl'],
          properties: {
            vendor: { type: 'string', enum: ['amazon', 'etsy', 'target', 'custom'] },
            vendorProductId: { type: 'string' },
            vendorUrl: { type: 'string' },
            listedPrice: { type: 'string' },
            currency: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.user as { userId: string }
      const gift = await db.gift.findFirst({ where: { id: request.params.giftId, createdById: userId } })
      if (!gift) return reply.status(404).send({ error: 'Gift not found' })

      const { vendor, vendorProductId, vendorUrl, listedPrice, currency = 'USD' } = request.body
      const listing = await db.productListing.create({
        data: {
          giftId: gift.id,
          vendor,
          vendorProductId,
          vendorUrl,
          listedPrice: listedPrice ? parseFloat(listedPrice) : undefined,
          currency,
        },
      })
      return reply.status(201).send(listing)
    }
  )

  app.patch<{
    Params: { giftId: string; id: string }
    Body: { vendor?: string; vendorProductId?: string; vendorUrl?: string; listedPrice?: string; currency?: string }
  }>(
    '/gifts/:giftId/listings/:id',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            vendor: { type: 'string', enum: ['amazon', 'etsy', 'target', 'custom'] },
            vendorProductId: { type: 'string' },
            vendorUrl: { type: 'string' },
            listedPrice: { type: 'string' },
            currency: { type: 'string' },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.user as { userId: string }
      const { giftId, id: listingId } = request.params

      const gift = await db.gift.findFirst({ where: { id: giftId, createdById: userId } })
      if (!gift) return reply.status(404).send({ error: 'Not found' })

      const listing = await db.productListing.findFirst({ where: { id: listingId, giftId } })
      if (!listing) return reply.status(404).send({ error: 'Not found' })

      const { vendor, vendorProductId, vendorUrl, listedPrice, currency } = request.body
      return db.productListing.update({
        where: { id: listingId },
        data: {
          vendor, vendorProductId, vendorUrl, currency,
          listedPrice: listedPrice ? parseFloat(listedPrice) : undefined,
        },
      })
    }
  )

  app.delete<{ Params: { giftId: string; id: string } }>('/gifts/:giftId/listings/:id', async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { giftId, id: listingId } = request.params

    const gift = await db.gift.findFirst({ where: { id: giftId, createdById: userId } })
    if (!gift) return reply.status(404).send({ error: 'Not found' })

    const listing = await db.productListing.findFirst({ where: { id: listingId, giftId } })
    if (!listing) return reply.status(404).send({ error: 'Not found' })

    await db.productListing.delete({ where: { id: listingId } })
    return reply.status(204).send()
  })
}
