import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { createTestApp, createTestUser } from './helpers.js'
import { db } from '../src/db.js'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance
let authHeader: string
let userId: string
let giftId: string
let listingId: string

let otherAuthHeader: string
let otherUserId: string

beforeAll(async () => {
  app = await createTestApp()

  // Primary user
  const result = await createTestUser(app)
  authHeader = result.authHeader
  userId = result.user.id
  const gift = await db.gift.create({ data: { createdById: userId, title: 'Watch', type: 'product' } })
  giftId = gift.id

  // Second user for cross-user authorization tests
  const other = await createTestUser(app)
  otherAuthHeader = other.authHeader
  otherUserId = other.user.id
})

afterAll(async () => {
  await db.productListing.deleteMany({ where: { giftId } })
  await db.gift.delete({ where: { id: giftId } })
  await db.user.delete({ where: { id: userId } })
  await db.user.delete({ where: { id: otherUserId } })
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
    expect(typeof res.body.listedPrice).toBe('string')
    expect(res.body.listedPrice).toBe('49.99')

    listingId = res.body.id
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

  it('returns 404 when another user tries to GET listings from someone else\'s gift', async () => {
    const res = await supertest(app.server)
      .get(`/gifts/${giftId}/listings`)
      .set('Authorization', otherAuthHeader)

    expect(res.status).toBe(404)
  })
})

describe('PATCH /gifts/:giftId/listings/:id', () => {
  it('updates a listing field and returns the updated listing', async () => {
    const res = await supertest(app.server)
      .patch(`/gifts/${giftId}/listings/${listingId}`)
      .set('Authorization', authHeader)
      .send({ listedPrice: '39.99' })

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(listingId)
    expect(res.body.listedPrice).toBe('39.99')
  })

  it('returns 404 when listing belongs to another gift', async () => {
    // Create a second gift with a listing, then try to PATCH using the first gift's id
    const otherGift = await db.gift.create({ data: { createdById: userId, title: 'Other Gift', type: 'product' } })
    const otherListing = await db.productListing.create({
      data: { giftId: otherGift.id, vendor: 'etsy', vendorUrl: 'https://etsy.com/x', currency: 'USD' },
    })

    const res = await supertest(app.server)
      .patch(`/gifts/${giftId}/listings/${otherListing.id}`)
      .set('Authorization', authHeader)
      .send({ vendor: 'target' })

    expect(res.status).toBe(404)

    // Cleanup
    await db.productListing.delete({ where: { id: otherListing.id } })
    await db.gift.delete({ where: { id: otherGift.id } })
  })
})

describe('DELETE /gifts/:giftId/listings/:id', () => {
  it('deletes a listing and returns 204, confirming it is gone', async () => {
    // Create a fresh listing to delete so we don't affect other tests
    const toDelete = await db.productListing.create({
      data: { giftId, vendor: 'target', vendorUrl: 'https://target.com/x', currency: 'USD' },
    })

    const deleteRes = await supertest(app.server)
      .delete(`/gifts/${giftId}/listings/${toDelete.id}`)
      .set('Authorization', authHeader)

    expect(deleteRes.status).toBe(204)

    // Confirm it is gone
    const getRes = await supertest(app.server)
      .get(`/gifts/${giftId}/listings`)
      .set('Authorization', authHeader)

    expect(getRes.status).toBe(200)
    const ids = getRes.body.map((l: { id: string }) => l.id)
    expect(ids).not.toContain(toDelete.id)
  })
})
