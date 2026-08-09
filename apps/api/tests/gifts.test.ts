import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { createTestApp, createTestUser } from './helpers.js'
import { db } from '../src/db.js'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance
let authHeader: string
let userId: string

beforeAll(async () => {
  app = await createTestApp()
  const result = await createTestUser(app)
  authHeader = result.authHeader
  userId = result.user.id
})

afterAll(async () => {
  await db.gift.deleteMany({ where: { createdById: userId } })
  await db.user.delete({ where: { id: userId } })
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
})
