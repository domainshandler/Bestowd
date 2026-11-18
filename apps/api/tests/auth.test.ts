import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import supertest from 'supertest'
import { buildApp } from '../src/app.js'
import { db } from '../src/db.js'
import { verifyGoogleToken } from '../src/services/google-auth.js'
import { createTestUser } from './helpers.js'
import type { FastifyInstance } from 'fastify'

vi.mock('../src/services/google-auth.js', () => ({
  verifyGoogleToken: vi.fn().mockResolvedValue({
    googleId: 'google-123',
    email: 'alice@example.com',
    name: 'Alice',
    avatarUrl: 'https://example.com/avatar.jpg',
  }),
}))

let app: FastifyInstance

beforeAll(async () => {
  app = await buildApp()
  await app.ready()
})

afterAll(async () => {
  await db.user.deleteMany({ where: { email: 'alice@example.com' } })
  await app.close()
})

describe('POST /auth/google', () => {
  it('creates a user and returns a JWT token', async () => {
    const res = await supertest(app.server)
      .post('/auth/google')
      .send({ idToken: 'fake-google-token' })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('token')
    expect(res.body.user.email).toBe('alice@example.com')
    expect(res.body.user.identitySource).toBe('google')
    expect(res.body.user.emailVerified).toBe(true)
  })

  it('returns 400 when idToken is missing', async () => {
    const res = await supertest(app.server).post('/auth/google').send({})
    expect(res.status).toBe(400)
  })
})

describe('GET /auth/me', () => {
  it('returns the authenticated user', async () => {
    const loginRes = await supertest(app.server)
      .post('/auth/google')
      .send({ idToken: 'fake-google-token' })
    const token: string = loginRes.body.token

    const res = await supertest(app.server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.email).toBe('alice@example.com')
  })

  it('returns 401 without token', async () => {
    const res = await supertest(app.server).get('/auth/me')
    expect(res.status).toBe(401)
  })
})

describe('POST /auth/google auto-link', () => {
  it('auto-links an unmanaged contact with a matching email on sign-in', async () => {
    const owner = await createTestUser(app)
    const contact = await db.contact.create({
      data: { ownerId: owner.user.id, name: 'Bob', email: 'bob-invite@example.com' },
    })

    vi.mocked(verifyGoogleToken).mockResolvedValueOnce({
      googleId: 'google-bob',
      email: 'bob-invite@example.com',
      name: 'Bob',
      avatarUrl: null,
    })

    const res = await supertest(app.server)
      .post('/auth/google')
      .send({ idToken: 'fake-bob-token' })

    expect(res.status).toBe(200)

    const updated = await db.contact.findUniqueOrThrow({ where: { id: contact.id } })
    expect(updated.isManaged).toBe(false)
    expect(updated.linkedUserId).toBe(res.body.user.id)

    await db.contact.delete({ where: { id: contact.id } })
    await db.user.deleteMany({ where: { id: { in: [owner.user.id, res.body.user.id] } } })
  })

  it('is idempotent when the already-linked user logs in again', async () => {
    const owner = await createTestUser(app)
    const linkedUser = await createTestUser(app, { googleId: 'google-linked-repeat', email: 'carol-linked@example.com' })
    const contact = await db.contact.create({
      data: {
        ownerId: owner.user.id,
        name: 'Carol',
        email: 'carol-linked@example.com',
        isManaged: false,
        linkedUserId: linkedUser.user.id,
      },
    })

    vi.mocked(verifyGoogleToken).mockResolvedValueOnce({
      googleId: 'google-linked-repeat',
      email: 'carol-linked@example.com',
      name: 'Carol',
      avatarUrl: null,
    })

    const res = await supertest(app.server)
      .post('/auth/google')
      .send({ idToken: 'fake-carol-repeat-token' })

    expect(res.status).toBe(200)
    expect(res.body.user.id).toBe(linkedUser.user.id)

    const unchanged = await db.contact.findUniqueOrThrow({ where: { id: contact.id } })
    expect(unchanged.linkedUserId).toBe(linkedUser.user.id)
    expect(unchanged.isManaged).toBe(false)

    await db.contact.delete({ where: { id: contact.id } })
    await db.user.deleteMany({ where: { id: { in: [owner.user.id, linkedUser.user.id] } } })
  })

  it('still signs in when the user is already linked and another matching contact exists', async () => {
    const ownerA = await createTestUser(app)
    const ownerB = await createTestUser(app)
    const linkedUser = await createTestUser(app, { googleId: 'google-dave', email: 'dave-multi@example.com' })
    const linked = await db.contact.create({
      data: {
        ownerId: ownerA.user.id,
        name: 'Dave',
        email: 'dave-multi@example.com',
        isManaged: false,
        linkedUserId: linkedUser.user.id,
      },
    })
    const other = await db.contact.create({
      data: { ownerId: ownerB.user.id, name: 'Dave', email: 'dave-multi@example.com' },
    })

    vi.mocked(verifyGoogleToken).mockResolvedValueOnce({
      googleId: 'google-dave',
      email: 'dave-multi@example.com',
      name: 'Dave',
      avatarUrl: null,
    })

    const res = await supertest(app.server)
      .post('/auth/google')
      .send({ idToken: 'fake-dave-token' })

    expect(res.status).toBe(200)

    const otherAfter = await db.contact.findUniqueOrThrow({ where: { id: other.id } })
    expect(otherAfter.linkedUserId).toBeNull()
    expect(otherAfter.isManaged).toBe(true)

    await db.contact.deleteMany({ where: { id: { in: [linked.id, other.id] } } })
    await db.user.deleteMany({ where: { id: { in: [ownerA.user.id, ownerB.user.id, linkedUser.user.id] } } })
  })
})
