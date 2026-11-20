import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { createTestApp, createTestUser, cleanupUser } from './helpers.js'
import { db } from '../src/db.js'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance
let a: Awaited<ReturnType<typeof createTestUser>>
let b: Awaited<ReturnType<typeof createTestUser>>

beforeAll(async () => {
  app = await createTestApp()
  a = await createTestUser(app, { name: 'Alice' })
  b = await createTestUser(app, { name: 'Bob' })
})

afterAll(async () => {
  await cleanupUser(a.user.id)
  await cleanupUser(b.user.id)
  await app.close()
})

describe('GET /groups/:groupId', () => {
  it('returns settings with CAD and 14/3-day defaults, and the members', async () => {
    const res = await supertest(app.server).get(`/groups/${a.groupId}`).set('Authorization', a.authHeader)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ id: a.groupId, currency: 'CAD', defaultBudgets: {}, defaultReminderDays: [14, 3] })
    expect(res.body.members).toEqual([{ userId: a.user.id, name: 'Alice', avatarUrl: null, role: 'OWNER' }])
  })

  it("returns 404 for another user's group", async () => {
    const res = await supertest(app.server).get(`/groups/${b.groupId}`).set('Authorization', a.authHeader)
    expect(res.status).toBe(404)
  })
})

describe('PATCH /groups/:groupId', () => {
  it('lets the OWNER update currency, budgets and reminder days', async () => {
    const res = await supertest(app.server)
      .patch(`/groups/${a.groupId}`)
      .set('Authorization', a.authHeader)
      .send({ currency: 'USD', defaultBudgets: { BIRTHDAY: 40, HOLIDAY: 30 }, defaultReminderDays: [21, 7] })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ currency: 'USD', defaultBudgets: { BIRTHDAY: 40, HOLIDAY: 30 }, defaultReminderDays: [21, 7] })
  })

  it('returns 403 for a MEMBER', async () => {
    await db.groupMembership.create({ data: { groupId: a.groupId, userId: b.user.id, role: 'MEMBER' } })
    const res = await supertest(app.server).patch(`/groups/${a.groupId}`).set('Authorization', b.authHeader).send({ name: 'Mine now' })
    expect(res.status).toBe(403)
    await db.groupMembership.delete({ where: { groupId_userId: { groupId: a.groupId, userId: b.user.id } } })
  })

  it('returns 404 for a non-member', async () => {
    const res = await supertest(app.server).patch(`/groups/${a.groupId}`).set('Authorization', b.authHeader).send({ name: 'x' })
    expect(res.status).toBe(404)
  })

  it('rejects a lowercase currency and a negative budget', async () => {
    const lower = await supertest(app.server).patch(`/groups/${a.groupId}`).set('Authorization', a.authHeader).send({ currency: 'cad' })
    expect(lower.status).toBe(400)
    const negative = await supertest(app.server).patch(`/groups/${a.groupId}`).set('Authorization', a.authHeader).send({ defaultBudgets: { BIRTHDAY: -5 } })
    expect(negative.status).toBe(400)
  })
})
