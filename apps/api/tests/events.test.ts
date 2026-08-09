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
  // Delete events first (FK: events -> contacts), then contacts, then users
  await db.event.deleteMany({ where: { contact: { ownerId: userId } } })
  await db.contact.deleteMany({ where: { ownerId: userId } })
  await db.user.delete({ where: { id: userId } })
  await app.close()
})

describe('POST /events', () => {
  it('creates an event with recurrence and computes nextOccurrence', async () => {
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
    expect(res.body.nextOccurrence).not.toBeNull()
  })

  it('creates an event without recurrence and nextOccurrence is null', async () => {
    const res = await supertest(app.server)
      .post('/events')
      .set('Authorization', authHeader)
      .send({
        contactId,
        type: 'custom',
        name: 'One-time event',
        date: '2030-06-01T00:00:00.000Z',
      })

    expect(res.status).toBe(201)
    expect(res.body.nextOccurrence).toBeNull()
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

describe('GET /events/:id', () => {
  let eventId: string

  beforeAll(async () => {
    const res = await supertest(app.server)
      .post('/events')
      .set('Authorization', authHeader)
      .send({
        contactId,
        type: 'anniversary',
        name: 'Test Anniversary',
        date: '2000-05-20T00:00:00.000Z',
        recurrenceRule: 'annual',
      })
    eventId = res.body.id
  })

  it('returns the correct event for the owner', async () => {
    const res = await supertest(app.server)
      .get(`/events/${eventId}`)
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(eventId)
    expect(res.body.name).toBe('Test Anniversary')
  })

  it('returns 404 when event belongs to another user', async () => {
    const other = await createTestUser(app)
    const otherContact = await db.contact.create({ data: { ownerId: other.user.id, name: 'Y' } })
    const otherEvent = await db.event.create({
      data: {
        contactId: otherContact.id,
        type: 'birthday',
        name: "Other's Birthday",
        date: new Date('2000-01-01'),
        recurrenceRule: 'annual',
        nextOccurrence: new Date('2027-01-01'),
      },
    })

    const res = await supertest(app.server)
      .get(`/events/${otherEvent.id}`)
      .set('Authorization', authHeader)

    expect(res.status).toBe(404)

    await db.event.delete({ where: { id: otherEvent.id } })
    await db.contact.delete({ where: { id: otherContact.id } })
    await db.user.delete({ where: { id: other.user.id } })
  })
})

describe('PATCH /events/:id', () => {
  let eventId: string

  beforeAll(async () => {
    const res = await supertest(app.server)
      .post('/events')
      .set('Authorization', authHeader)
      .send({
        contactId,
        type: 'custom',
        name: 'Original Name',
        date: '2000-08-10T00:00:00.000Z',
        recurrenceRule: 'annual',
      })
    eventId = res.body.id
  })

  it('updates fields and returns updated event', async () => {
    const res = await supertest(app.server)
      .patch(`/events/${eventId}`)
      .set('Authorization', authHeader)
      .send({ name: 'Updated Name', type: 'birthday' })

    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Updated Name')
    expect(res.body.type).toBe('birthday')
    expect(res.body.id).toBe(eventId)
  })

  it('returns 404 when patching an event owned by another user', async () => {
    const other = await createTestUser(app)
    const otherContact = await db.contact.create({ data: { ownerId: other.user.id, name: 'Z' } })
    const otherEvent = await db.event.create({
      data: {
        contactId: otherContact.id,
        type: 'birthday',
        name: "Other's Event",
        date: new Date('2000-01-01'),
        recurrenceRule: 'annual',
        nextOccurrence: new Date('2027-01-01'),
      },
    })

    const res = await supertest(app.server)
      .patch(`/events/${otherEvent.id}`)
      .set('Authorization', authHeader)
      .send({ name: 'Hacked' })

    expect(res.status).toBe(404)

    await db.event.delete({ where: { id: otherEvent.id } })
    await db.contact.delete({ where: { id: otherContact.id } })
    await db.user.delete({ where: { id: other.user.id } })
  })
})

describe('DELETE /events/:id', () => {
  it('returns 204 and removes the event', async () => {
    const createRes = await supertest(app.server)
      .post('/events')
      .set('Authorization', authHeader)
      .send({
        contactId,
        type: 'custom',
        name: 'To Be Deleted',
        date: '2025-01-01T00:00:00.000Z',
        recurrenceRule: 'annual',
      })
    const eventId = createRes.body.id
    expect(createRes.status).toBe(201)

    const deleteRes = await supertest(app.server)
      .delete(`/events/${eventId}`)
      .set('Authorization', authHeader)

    expect(deleteRes.status).toBe(204)

    // Verify it's gone
    const getRes = await supertest(app.server)
      .get(`/events/${eventId}`)
      .set('Authorization', authHeader)
    expect(getRes.status).toBe(404)
  })

  it('returns 404 when deleting an event owned by another user', async () => {
    const other = await createTestUser(app)
    const otherContact = await db.contact.create({ data: { ownerId: other.user.id, name: 'W' } })
    const otherEvent = await db.event.create({
      data: {
        contactId: otherContact.id,
        type: 'birthday',
        name: "Other's Event",
        date: new Date('2000-01-01'),
        recurrenceRule: 'annual',
        nextOccurrence: new Date('2027-01-01'),
      },
    })

    const res = await supertest(app.server)
      .delete(`/events/${otherEvent.id}`)
      .set('Authorization', authHeader)

    expect(res.status).toBe(404)

    await db.event.delete({ where: { id: otherEvent.id } })
    await db.contact.delete({ where: { id: otherContact.id } })
    await db.user.delete({ where: { id: other.user.id } })
  })
})
