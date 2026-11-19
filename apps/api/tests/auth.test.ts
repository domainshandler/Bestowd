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
