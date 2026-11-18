import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import supertest from 'supertest'
import { createTestApp, createTestUser } from './helpers.js'
import { db } from '../src/db.js'
import { sendContactInvite } from '../src/services/mailer.js'
import type { FastifyInstance } from 'fastify'

vi.mock('../src/services/mailer.js', () => ({
  sendContactInvite: vi.fn().mockResolvedValue(undefined),
}))

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

describe('POST /contacts/:id/invite', () => {
  it('sends an invite and sets invitedAt', async () => {
    const contact = await db.contact.create({
      data: { ownerId: userId, name: 'Dana', email: 'dana@example.com' },
    })

    const res = await supertest(app.server)
      .post(`/contacts/${contact.id}/invite`)
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.invitedAt).not.toBeNull()

    await db.contact.delete({ where: { id: contact.id } })
  })

  it('returns 400 when the contact has no email', async () => {
    const contact = await db.contact.create({
      data: { ownerId: userId, name: 'NoEmail' },
    })

    const res = await supertest(app.server)
      .post(`/contacts/${contact.id}/invite`)
      .set('Authorization', authHeader)

    expect(res.status).toBe(400)
    await db.contact.delete({ where: { id: contact.id } })
  })

  it('returns 404 for a contact owned by another user', async () => {
    const other = await createTestUser(app)
    const contact = await db.contact.create({
      data: { ownerId: other.user.id, name: 'Private', email: 'private@example.com' },
    })

    const res = await supertest(app.server)
      .post(`/contacts/${contact.id}/invite`)
      .set('Authorization', authHeader)

    expect(res.status).toBe(404)
    await db.contact.delete({ where: { id: contact.id } })
    await db.user.delete({ where: { id: other.user.id } })
  })

  it('does not set invitedAt when sending the email fails', async () => {
    const contact = await db.contact.create({
      data: { ownerId: userId, name: 'SmtpFail', email: 'smtp-fail@example.com' },
    })
    vi.mocked(sendContactInvite).mockRejectedValueOnce(new Error('SMTP down'))

    const res = await supertest(app.server)
      .post(`/contacts/${contact.id}/invite`)
      .set('Authorization', authHeader)

    expect(res.status).toBe(500)
    const after = await db.contact.findUniqueOrThrow({ where: { id: contact.id } })
    expect(after.invitedAt).toBeNull()
    await db.contact.delete({ where: { id: contact.id } })
  })

  it('returns 409 when the contact is already linked', async () => {
    const contact = await db.contact.create({
      data: { ownerId: userId, name: 'Linked', email: 'linked@example.com', isManaged: false },
    })

    const res = await supertest(app.server)
      .post(`/contacts/${contact.id}/invite`)
      .set('Authorization', authHeader)

    expect(res.status).toBe(409)
    await db.contact.delete({ where: { id: contact.id } })
  })
})
