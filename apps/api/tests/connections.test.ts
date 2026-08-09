import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { createTestApp, createTestUser } from './helpers.js'
import { db } from '../src/db.js'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance
let userA: { user: any; authHeader: string }
let userB: { user: any; authHeader: string }

beforeAll(async () => {
  app = await createTestApp()
  userA = await createTestUser(app)
  userB = await createTestUser(app)
})

afterAll(async () => {
  await db.userConnection.deleteMany({
    where: { OR: [{ requesterId: userA.user.id }, { addresseeId: userA.user.id }] }
  })
  await db.user.deleteMany({ where: { id: { in: [userA.user.id, userB.user.id] } } })
  await app.close()
})

describe('POST /connections', () => {
  it('creates a pending connection request', async () => {
    const res = await supertest(app.server)
      .post('/connections')
      .set('Authorization', userA.authHeader)
      .send({ addresseeEmail: userB.user.email })

    expect(res.status).toBe(201)
    expect(res.body.requesterId).toBe(userA.user.id)
    expect(res.body.addresseeId).toBe(userB.user.id)
    expect(res.body.status).toBe('pending')
  })

  it('returns 404 when addressee email not found', async () => {
    const res = await supertest(app.server)
      .post('/connections')
      .set('Authorization', userA.authHeader)
      .send({ addresseeEmail: 'nobody@example.com' })
    expect(res.status).toBe(404)
  })

  it('returns 409 when connection already exists', async () => {
    const res = await supertest(app.server)
      .post('/connections')
      .set('Authorization', userA.authHeader)
      .send({ addresseeEmail: userB.user.email })
    expect(res.status).toBe(409)
  })
})

describe('PATCH /connections/:requesterId', () => {
  it('addressee can accept the connection', async () => {
    const res = await supertest(app.server)
      .patch(`/connections/${userA.user.id}`)
      .set('Authorization', userB.authHeader)
      .send({ status: 'accepted' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('accepted')
  })

  it('requester cannot accept their own outgoing connection', async () => {
    const userC = await createTestUser(app)
    const userD = await createTestUser(app)

    await supertest(app.server)
      .post('/connections')
      .set('Authorization', userC.authHeader)
      .send({ addresseeEmail: userD.user.email })

    const res = await supertest(app.server)
      .patch(`/connections/${userC.user.id}`)
      .set('Authorization', userC.authHeader)
      .send({ status: 'accepted' })

    expect(res.status).toBe(404)

    await db.userConnection.deleteMany({
      where: { OR: [{ requesterId: userC.user.id }, { addresseeId: userC.user.id }] }
    })
    await db.user.deleteMany({ where: { id: { in: [userC.user.id, userD.user.id] } } })
  })
})

describe('GET /connections', () => {
  it('returns connections for the authenticated user', async () => {
    const res = await supertest(app.server)
      .get('/connections')
      .set('Authorization', userA.authHeader)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThan(0)
  })
})
