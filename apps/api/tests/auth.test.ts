import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import supertest from 'supertest'
import { buildApp } from '../src/app.js'
import { db } from '../src/db.js'
import { verifyGoogleToken } from '../src/services/google-auth.js'
import { cleanupUser } from './helpers.js'
import type { FastifyInstance } from 'fastify'

vi.mock('../src/services/google-auth.js', () => ({
  verifyGoogleToken: vi.fn().mockResolvedValue({
    googleId: 'google-123',
    email: 'alice@example.com',
    name: 'Alice Smith',
    avatarUrl: 'https://example.com/avatar.jpg',
  }),
}))

let app: FastifyInstance

beforeAll(async () => {
  app = await buildApp()
  await app.ready()
})

afterAll(async () => {
  const alice = await db.user.findUnique({ where: { email: 'alice@example.com' } })
  if (alice) await cleanupUser(alice.id)
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

describe('first sign-in provisioning', () => {
  it('creates a personal group with the user as OWNER and an own-household family', async () => {
    const res = await supertest(app.server).post('/auth/google').send({ idToken: 'fake-google-token' })
    expect(res.status).toBe(200)

    const user = await db.user.findUniqueOrThrow({ where: { id: res.body.user.id } })
    expect(user.primaryGroupId).not.toBeNull()

    const memberships = await db.groupMembership.findMany({ where: { userId: user.id }, include: { group: true } })
    expect(memberships).toHaveLength(1)
    expect(memberships[0]!.role).toBe('OWNER')
    expect(memberships[0]!.groupId).toBe(user.primaryGroupId)
    expect(memberships[0]!.group.name).toBe("Alice's group")

    const families = await db.family.findMany({ where: { groupId: user.primaryGroupId! } })
    expect(families).toHaveLength(1)
    expect(families[0]!.householdOfGroupId).toBe(user.primaryGroupId)
  })

  it('does not create another group on a later sign-in', async () => {
    const first = await supertest(app.server).post('/auth/google').send({ idToken: 'fake-google-token' })
    const second = await supertest(app.server).post('/auth/google').send({ idToken: 'fake-google-token' })
    expect(second.body.user.id).toBe(first.body.user.id)

    const count = await db.groupMembership.count({ where: { userId: first.body.user.id } })
    expect(count).toBe(1)
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
