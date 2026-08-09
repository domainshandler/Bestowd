import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { createTestApp, createTestUser } from './helpers.js'
import { db } from '../src/db.js'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance
let authHeader: string
let userId: string
let contactId: string
let giftId: string

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

  const contact = await db.contact.create({ data: { ownerId: userId, name: 'Recipient' } })
  contactId = contact.id
  const gift = await db.gift.create({ data: { createdById: userId, title: 'Headphones' } })
  giftId = gift.id
})

afterAll(async () => {
  await db.giftAssignment.deleteMany({ where: { giverId: otherUserId } })
  await db.giftAssignment.deleteMany({ where: { giverId: userId } })
  await db.gift.deleteMany({ where: { createdById: otherUserId } })
  await db.gift.deleteMany({ where: { createdById: userId } })
  await db.contact.deleteMany({ where: { ownerId: otherUserId } })
  await db.contact.deleteMany({ where: { ownerId: userId } })
  await db.user.delete({ where: { id: otherUserId } })
  await db.user.delete({ where: { id: userId } })
  await app.close()
})

describe('POST /assignments', () => {
  it('creates a gift assignment', async () => {
    const res = await supertest(app.server)
      .post('/assignments')
      .set('Authorization', authHeader)
      .send({ giftId, contactId, status: 'idea', notes: 'For Christmas' })

    expect(res.status).toBe(201)
    expect(res.body.giftId).toBe(giftId)
    expect(res.body.contactId).toBe(contactId)
    expect(res.body.giverId).toBe(userId)
    expect(res.body.status).toBe('idea')
  })

  it('returns 404 when contact not owned by user', async () => {
    const other = await createTestUser(app)
    const otherContact = await db.contact.create({ data: { ownerId: other.user.id, name: 'Z' } })

    const res = await supertest(app.server)
      .post('/assignments')
      .set('Authorization', authHeader)
      .send({ giftId, contactId: otherContact.id })

    expect(res.status).toBe(404)
    await db.contact.delete({ where: { id: otherContact.id } })
    await db.user.delete({ where: { id: other.user.id } })
  })
})

describe('GET /assignments', () => {
  it('returns assignments filtered by contactId', async () => {
    const res = await supertest(app.server)
      .get(`/assignments?contactId=${contactId}`)
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    res.body.forEach((a: any) => expect(a.contactId).toBe(contactId))
  })
})

describe('GET /assignments/:id', () => {
  it('returns the assignment with correct fields', async () => {
    const assignment = await db.giftAssignment.create({
      data: { giftId, giverId: userId, contactId, status: 'idea' },
    })

    const res = await supertest(app.server)
      .get(`/assignments/${assignment.id}`)
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(assignment.id)
    expect(res.body.giftId).toBe(giftId)
    expect(res.body.contactId).toBe(contactId)
    expect(res.body.giverId).toBe(userId)
    expect(res.body.status).toBe('idea')
  })

  it('returns 404 when another user requests the assignment', async () => {
    const assignment = await db.giftAssignment.create({
      data: { giftId, giverId: userId, contactId, status: 'idea' },
    })

    const res = await supertest(app.server)
      .get(`/assignments/${assignment.id}`)
      .set('Authorization', otherAuthHeader)

    expect(res.status).toBe(404)
  })
})

describe('PATCH /assignments/:id', () => {
  it('updates assignment status to given with givenAt timestamp', async () => {
    const assignment = await db.giftAssignment.create({
      data: { giftId, giverId: userId, contactId, status: 'purchased' },
    })
    const givenAt = new Date().toISOString()

    const res = await supertest(app.server)
      .patch(`/assignments/${assignment.id}`)
      .set('Authorization', authHeader)
      .send({ status: 'given', givenAt, purchasePrice: '79.99' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('given')
    expect(typeof res.body.purchasePrice).toBe('string')
    expect(res.body.purchasePrice).toBe('79.99')
  })

  it('returns 404 when another user tries to patch the assignment', async () => {
    const assignment = await db.giftAssignment.create({
      data: { giftId, giverId: userId, contactId, status: 'idea' },
    })

    const res = await supertest(app.server)
      .patch(`/assignments/${assignment.id}`)
      .set('Authorization', otherAuthHeader)
      .send({ status: 'purchased' })

    expect(res.status).toBe(404)
  })
})

describe('DELETE /assignments/:id', () => {
  it('deletes the assignment and returns 204', async () => {
    const assignment = await db.giftAssignment.create({
      data: { giftId, giverId: userId, contactId, status: 'idea' },
    })

    const res = await supertest(app.server)
      .delete(`/assignments/${assignment.id}`)
      .set('Authorization', authHeader)

    expect(res.status).toBe(204)

    const gone = await db.giftAssignment.findUnique({ where: { id: assignment.id } })
    expect(gone).toBeNull()
  })

  it('returns 404 when another user tries to delete the assignment', async () => {
    const assignment = await db.giftAssignment.create({
      data: { giftId, giverId: userId, contactId, status: 'idea' },
    })

    const res = await supertest(app.server)
      .delete(`/assignments/${assignment.id}`)
      .set('Authorization', otherAuthHeader)

    expect(res.status).toBe(404)

    // Assignment should still exist
    const still = await db.giftAssignment.findUnique({ where: { id: assignment.id } })
    expect(still).not.toBeNull()
  })
})
