import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { createTestApp, createTestUser } from './helpers.js'
import { db } from '../src/db.js'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance
let authHeader: string
let userId: string

let otherAuthHeader: string
let otherUserId: string

beforeAll(async () => {
  app = await createTestApp()
  const result = await createTestUser(app)
  authHeader = result.authHeader
  userId = result.user.id

  const otherResult = await createTestUser(app)
  otherAuthHeader = otherResult.authHeader
  otherUserId = otherResult.user.id
})

afterAll(async () => {
  await db.gift.deleteMany({ where: { createdById: userId } })
  await db.gift.deleteMany({ where: { createdById: otherUserId } })
  await db.user.delete({ where: { id: userId } })
  await db.user.delete({ where: { id: otherUserId } })
  await app.close()
})

describe('POST /gifts', () => {
  it('creates a product gift', async () => {
    const res = await supertest(app.server)
      .post('/gifts')
      .set('Authorization', authHeader)
      .send({ title: 'Kindle Paperwhite', tags: ['reading', 'tech'], type: 'product' })

    expect(res.status).toBe(201)
    expect(res.body.title).toBe('Kindle Paperwhite')
    expect(res.body.type).toBe('product')
    expect(res.body.createdById).toBe(userId)
  })

  it('creates a basket gift containing other gifts', async () => {
    const item1 = await db.gift.create({ data: { createdById: userId, title: 'Book', type: 'product' } })
    const item2 = await db.gift.create({ data: { createdById: userId, title: 'Mug', type: 'product' } })

    const res = await supertest(app.server)
      .post('/gifts')
      .set('Authorization', authHeader)
      .send({ title: 'Book + Mug Bundle', type: 'basket', basketItemIds: [item1.id, item2.id] })

    expect(res.status).toBe(201)
    expect(res.body.type).toBe('basket')
    expect(res.body.basketItems).toHaveLength(2)
  })

  it('returns 400 when title is missing', async () => {
    const res = await supertest(app.server)
      .post('/gifts')
      .set('Authorization', authHeader)
      .send({ tags: ['x'] })
    expect(res.status).toBe(400)
  })

  it('returns 403 when basketItemIds belong to another user', async () => {
    const otherItem = await db.gift.create({ data: { createdById: otherUserId, title: 'Other Book', type: 'product' } })

    const res = await supertest(app.server)
      .post('/gifts')
      .set('Authorization', authHeader)
      .send({ title: 'Bad Basket', type: 'basket', basketItemIds: [otherItem.id] })

    expect(res.status).toBe(403)
    expect(res.body.error).toMatch(/basket items/)
  })
})

describe('GET /gifts', () => {
  it('returns only the calling user\'s gifts', async () => {
    // Create gifts for both users
    await db.gift.create({ data: { createdById: userId, title: 'My Gift', type: 'product' } })
    await db.gift.create({ data: { createdById: otherUserId, title: 'Their Gift', type: 'product' } })

    const res = await supertest(app.server)
      .get('/gifts')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    // All returned gifts must belong to the calling user
    for (const gift of res.body) {
      expect(gift.createdById).toBe(userId)
    }
    // Must not include the other user's gift
    expect(res.body.some((g: { title: string }) => g.title === 'Their Gift')).toBe(false)
  })
})

describe('GET /gifts/:id', () => {
  it('returns gift with listings and basketItems', async () => {
    const gift = await db.gift.create({ data: { createdById: userId, title: 'Test Gift', type: 'product' } })

    const res = await supertest(app.server)
      .get(`/gifts/${gift.id}`)
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.listings).toBeDefined()
    expect(res.body.basketItems).toBeDefined()
  })

  it('returns 404 when accessing another user\'s gift (cross-user ownership)', async () => {
    const otherGift = await db.gift.create({ data: { createdById: otherUserId, title: 'Private Gift', type: 'product' } })

    const res = await supertest(app.server)
      .get(`/gifts/${otherGift.id}`)
      .set('Authorization', authHeader)

    expect(res.status).toBe(404)
  })
})

describe('PATCH /gifts/:id', () => {
  it('updates gift fields and returns the updated gift', async () => {
    const gift = await db.gift.create({ data: { createdById: userId, title: 'Old Title', type: 'product' } })

    const res = await supertest(app.server)
      .patch(`/gifts/${gift.id}`)
      .set('Authorization', authHeader)
      .send({ title: 'New Title', description: 'Updated description' })

    expect(res.status).toBe(200)
    expect(res.body.title).toBe('New Title')
    expect(res.body.description).toBe('Updated description')
    expect(res.body.id).toBe(gift.id)
  })

  it('returns 404 when patching another user\'s gift', async () => {
    const otherGift = await db.gift.create({ data: { createdById: otherUserId, title: 'Other Gift', type: 'product' } })

    const res = await supertest(app.server)
      .patch(`/gifts/${otherGift.id}`)
      .set('Authorization', authHeader)
      .send({ title: 'Hacked Title' })

    expect(res.status).toBe(404)
  })

  it('returns 403 when patching basketItemIds that belong to another user', async () => {
    const myGift = await db.gift.create({ data: { createdById: userId, title: 'My Basket', type: 'basket' } })
    const otherItem = await db.gift.create({ data: { createdById: otherUserId, title: 'Other Item', type: 'product' } })

    const res = await supertest(app.server)
      .patch(`/gifts/${myGift.id}`)
      .set('Authorization', authHeader)
      .send({ basketItemIds: [otherItem.id] })

    expect(res.status).toBe(403)
    expect(res.body.error).toMatch(/basket items/)
  })

  it('returns 400 when patch body fails schema validation', async () => {
    const gift = await db.gift.create({ data: { createdById: userId, title: 'Schema Test Gift', type: 'product' } })

    const res = await supertest(app.server)
      .patch(`/gifts/${gift.id}`)
      .set('Authorization', authHeader)
      .send({ type: 'invalid_type' })

    expect(res.status).toBe(400)
  })
})

describe('DELETE /gifts/:id', () => {
  it('returns 204 and the gift no longer exists', async () => {
    const gift = await db.gift.create({ data: { createdById: userId, title: 'To Be Deleted', type: 'product' } })

    const deleteRes = await supertest(app.server)
      .delete(`/gifts/${gift.id}`)
      .set('Authorization', authHeader)

    expect(deleteRes.status).toBe(204)

    // Verify the gift is gone
    const getRes = await supertest(app.server)
      .get(`/gifts/${gift.id}`)
      .set('Authorization', authHeader)

    expect(getRes.status).toBe(404)
  })

  it('returns 404 when deleting another user\'s gift', async () => {
    const otherGift = await db.gift.create({ data: { createdById: otherUserId, title: 'Other Delete Gift', type: 'product' } })

    const res = await supertest(app.server)
      .delete(`/gifts/${otherGift.id}`)
      .set('Authorization', authHeader)

    expect(res.status).toBe(404)
  })
})
