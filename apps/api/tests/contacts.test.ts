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
  await db.contact.deleteMany({ where: { ownerId: userId } })
  await db.user.delete({ where: { id: userId } })
  await app.close()
})

describe('POST /contacts', () => {
  it('creates a contact', async () => {
    const res = await supertest(app.server)
      .post('/contacts')
      .set('Authorization', authHeader)
      .send({ name: 'Bob', email: 'bob@example.com', attributes: [{ label: 'Loves', value: 'hiking', visible: true }] })

    expect(res.status).toBe(201)
    expect(res.body.name).toBe('Bob')
    expect(res.body.ownerId).toBe(userId)
    expect(res.body.isManaged).toBe(true)
    expect(res.body.attributes).toHaveLength(1)
  })

  it('returns 401 without token', async () => {
    const res = await supertest(app.server).post('/contacts').send({ name: 'Bob' })
    expect(res.status).toBe(401)
  })

  it('returns 400 when name is missing', async () => {
    const res = await supertest(app.server)
      .post('/contacts')
      .set('Authorization', authHeader)
      .send({ email: 'bob@example.com' })
    expect(res.status).toBe(400)
  })
})

describe('GET /contacts', () => {
  it('returns only contacts owned by the user', async () => {
    const res = await supertest(app.server)
      .get('/contacts')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    res.body.forEach((c: any) => expect(c.ownerId).toBe(userId))
  })
})

describe('GET /contacts/:id', () => {
  it('returns 404 for a contact owned by another user', async () => {
    const other = await createTestUser(app)
    const contact = await db.contact.create({
      data: { ownerId: other.user.id, name: 'Private' }
    })

    const res = await supertest(app.server)
      .get(`/contacts/${contact.id}`)
      .set('Authorization', authHeader)

    expect(res.status).toBe(404)
    await db.contact.delete({ where: { id: contact.id } })
    await db.user.delete({ where: { id: other.user.id } })
  })
})

describe('PATCH /contacts/:id', () => {
  it('updates a contact', async () => {
    const contact = await db.contact.create({
      data: { ownerId: userId, name: 'Charlie' }
    })

    const res = await supertest(app.server)
      .patch(`/contacts/${contact.id}`)
      .set('Authorization', authHeader)
      .send({ name: 'Charles', notes: 'Updated' })

    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Charles')
    expect(res.body.notes).toBe('Updated')
  })
})

describe('DELETE /contacts/:id', () => {
  it('deletes a contact', async () => {
    const contact = await db.contact.create({
      data: { ownerId: userId, name: 'ToDelete' }
    })

    const res = await supertest(app.server)
      .delete(`/contacts/${contact.id}`)
      .set('Authorization', authHeader)

    expect(res.status).toBe(204)
    const found = await db.contact.findUnique({ where: { id: contact.id } })
    expect(found).toBeNull()
  })
})
