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

describe('GET /me/occasions', () => {
  const inDays = (n: number) => { const t = new Date(Date.now() + n * 86_400_000); return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate())) }

  it('covers every group the user is in, labelled with the group', async () => {
    const mia = await db.person.create({ data: { groupId: a.groupId, familyId: a.householdId, name: 'Mia' } })
    const leo = await db.person.create({ data: { groupId: b.groupId, familyId: b.householdId, name: 'Leo' } })
    await db.group.update({ where: { id: b.groupId }, data: { currency: 'USD', defaultBudgets: { BIRTHDAY: 25 } } })
    await db.group.update({ where: { id: a.groupId }, data: { defaultBudgets: { BIRTHDAY: 40 } } })
    await db.occasion.create({ data: { groupId: a.groupId, personId: mia.id, type: 'BIRTHDAY', name: 'Mia bday', date: inDays(3), nextOccurrence: inDays(3) } })
    await db.occasion.create({ data: { groupId: b.groupId, personId: leo.id, type: 'BIRTHDAY', name: 'Leo bday', date: inDays(5), nextOccurrence: inDays(5) } })
    const paused = await db.family.create({ data: { groupId: b.groupId, name: 'Paused', status: 'PAUSED' } })
    await db.occasion.create({ data: { groupId: b.groupId, familyId: paused.id, type: 'HOLIDAY', name: 'Paused hol', date: inDays(4), nextOccurrence: inDays(4) } })

    const solo = await supertest(app.server).get('/me/occasions').set('Authorization', a.authHeader)
    expect(solo.body.multipleGroups).toBe(false)
    expect(solo.body.occasions.map((o: any) => o.name)).toEqual(['Mia bday'])

    await db.groupMembership.create({ data: { groupId: b.groupId, userId: a.user.id, role: 'MEMBER' } })
    const res = await supertest(app.server).get('/me/occasions').set('Authorization', a.authHeader)
    expect(res.status).toBe(200)
    expect(res.body.multipleGroups).toBe(true)
    expect(res.body.occasions.map((o: any) => [o.name, o.groupName])).toEqual([['Mia bday', "Alice's group"], ['Leo bday', "Bob's group"]])
    expect(res.body.plannedSpend).toEqual([{ currency: 'CAD', amount: 40 }, { currency: 'USD', amount: 25 }])
    await db.groupMembership.delete({ where: { groupId_userId: { groupId: b.groupId, userId: a.user.id } } })
  })
})

describe('/me/devices', () => {
  it('registers a device, moves a reused token to the new user, and removes only your own', async () => {
    const res = await supertest(app.server).post('/me/devices').set('Authorization', a.authHeader).send({ platform: 'ANDROID', token: 'fcm-1' })
    expect(res.status).toBe(201)
    expect(res.body.platform).toBe('ANDROID')

    await supertest(app.server).post('/me/devices').set('Authorization', b.authHeader).send({ platform: 'ANDROID', token: 'fcm-1' })
    expect((await db.device.findUniqueOrThrow({ where: { token: 'fcm-1' } })).userId).toBe(b.user.id)

    await supertest(app.server).delete('/me/devices/fcm-1').set('Authorization', a.authHeader)
    expect(await db.device.findUnique({ where: { token: 'fcm-1' } })).not.toBeNull()
    expect((await supertest(app.server).delete('/me/devices/fcm-1').set('Authorization', b.authHeader)).status).toBe(204)
    expect(await db.device.findUnique({ where: { token: 'fcm-1' } })).toBeNull()
  })

  it('rejects an unknown platform', async () => {
    const res = await supertest(app.server).post('/me/devices').set('Authorization', a.authHeader).send({ platform: 'WEB', token: 'x' })
    expect(res.status).toBe(400)
  })
})
