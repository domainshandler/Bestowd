import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { createTestApp, createTestUser } from './helpers.js'
import { db } from '../src/db.js'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance
let authHeader: string
let userId: string
let contactId: string

beforeAll(async () => {
  app = await createTestApp()
  const result = await createTestUser(app)
  authHeader = result.authHeader
  userId = result.user.id
  const contact = await db.contact.create({ data: { ownerId: userId, name: 'Eve' } })
  contactId = contact.id
})

afterAll(async () => {
  await db.contact.delete({ where: { id: contactId } })
  await db.user.delete({ where: { id: userId } })
  await app.close()
})

describe('POST /events', () => {
  it('creates an event and computes nextOccurrence', async () => {
    const res = await supertest(app.server)
      .post('/events')
      .set('Authorization', authHeader)
      .send({
        contactId,
        type: 'birthday',
        name: "Eve's Birthday",
        date: '1990-03-15T00:00:00.000Z',
        recurrenceRule: 'annual',
        reminderDays: [30, 7],
      })

    expect(res.status).toBe(201)
    expect(res.body.name).toBe("Eve's Birthday")
    expect(res.body.nextOccurrence).toBeDefined()
  })

  it('returns 403 when contactId belongs to another user', async () => {
    const other = await createTestUser(app)
    const otherContact = await db.contact.create({ data: { ownerId: other.user.id, name: 'X' } })

    const res = await supertest(app.server)
      .post('/events')
      .set('Authorization', authHeader)
      .send({ contactId: otherContact.id, type: 'custom', name: 'Test', date: '2027-01-01T00:00:00.000Z' })

    expect(res.status).toBe(403)
    await db.contact.delete({ where: { id: otherContact.id } })
    await db.user.delete({ where: { id: other.user.id } })
  })
})

describe('GET /events', () => {
  it('returns events for the user contacts', async () => {
    const res = await supertest(app.server)
      .get('/events')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })
})
