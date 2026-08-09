import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { createTestApp, createTestUser } from './helpers.js'
import { db } from '../src/db.js'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance
let authHeader: string
let userId: string
let giftId: string

beforeAll(async () => {
  app = await createTestApp()
  const result = await createTestUser(app)
  authHeader = result.authHeader
  userId = result.user.id
  const gift = await db.gift.create({ data: { createdById: userId, title: 'Watch', type: 'product' } })
  giftId = gift.id
})

afterAll(async () => {
  await db.productListing.deleteMany({ where: { giftId } })
  await db.gift.delete({ where: { id: giftId } })
  await db.user.delete({ where: { id: userId } })
  await app.close()
})

describe('POST /gifts/:giftId/listings', () => {
  it('adds a vendor listing to a gift', async () => {
    const res = await supertest(app.server)
      .post(`/gifts/${giftId}/listings`)
      .set('Authorization', authHeader)
      .send({
        vendor: 'amazon',
        vendorProductId: 'B0ABC123',
        vendorUrl: 'https://amazon.com/dp/B0ABC123',
        listedPrice: '49.99',
        currency: 'USD',
      })

    expect(res.status).toBe(201)
    expect(res.body.vendor).toBe('amazon')
    expect(res.body.giftId).toBe(giftId)
  })
})

describe('GET /gifts/:giftId/listings', () => {
  it('returns all listings for a gift', async () => {
    const res = await supertest(app.server)
      .get(`/gifts/${giftId}/listings`)
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })
})
