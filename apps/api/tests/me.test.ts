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
  a = await createTestUser(app, { name: 'Alice Smith' })
  b = await createTestUser(app, { name: 'Bob Jones' })
})

afterAll(async () => {
  await cleanupUser(a.user.id)
  await cleanupUser(b.user.id)
  await app.close()
})

describe('GET /me', () => {
  it('returns the user and their provisioned group', async () => {
    const res = await supertest(app.server).get('/me').set('Authorization', a.authHeader)
    expect(res.status).toBe(200)
    expect(res.body.user.id).toBe(a.user.id)
    expect(res.body.primaryGroupId).toBe(a.groupId)
    expect(res.body.memberships).toEqual([
      { groupId: a.groupId, groupName: "Alice's group", role: 'OWNER', memberCount: 1 },
    ])
  })

  it('lists the primary group first when the user is in several', async () => {
    await db.groupMembership.create({ data: { groupId: a.groupId, userId: b.user.id, role: 'MEMBER' } })
    const res = await supertest(app.server).get('/me').set('Authorization', b.authHeader)
    expect(res.body.memberships.map((m: any) => m.groupId)).toEqual([b.groupId, a.groupId])
    expect(res.body.memberships[1]).toMatchObject({ role: 'MEMBER', memberCount: 2 })
    await db.groupMembership.delete({ where: { groupId_userId: { groupId: a.groupId, userId: b.user.id } } })
  })

  it('returns 401 without a token', async () => {
    const res = await supertest(app.server).get('/me')
    expect(res.status).toBe(401)
  })
})
