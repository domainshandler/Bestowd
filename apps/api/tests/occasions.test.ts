import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { createTestApp, createTestUser, cleanupUser } from './helpers.js'
import { db } from '../src/db.js'
import { advanceOccasionStatus } from '../src/services/occasion-status.js'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance
let a: Awaited<ReturnType<typeof createTestUser>>
let b: Awaited<ReturnType<typeof createTestUser>>
let mia: string
let leo: string

const inDays = (n: number) => {
  const t = new Date(Date.now() + n * 86_400_000)
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()))
}
const dateOnly = (d: Date) => d.toISOString().slice(0, 10)

beforeAll(async () => {
  app = await createTestApp()
  a = await createTestUser(app)
  b = await createTestUser(app)
  await db.group.update({ where: { id: a.groupId }, data: { defaultBudgets: { BIRTHDAY: 40, HOLIDAY: 30 } } })
  mia = (await db.person.create({ data: { groupId: a.groupId, familyId: a.householdId, name: 'Mia' } })).id
  leo = (await db.person.create({ data: { groupId: b.groupId, familyId: b.householdId, name: 'Leo' } })).id
})

afterAll(async () => {
  await cleanupUser(a.user.id)
  await cleanupUser(b.user.id)
  await app.close()
})

const api = () => supertest(app.server)
const post = (body: object) => api().post(`/groups/${a.groupId}/occasions`).set('Authorization', a.authHeader).send(body)

describe('POST /groups/:groupId/occasions', () => {
  it('creates a birthday with nextOccurrence and the group default budget', async () => {
    const res = await post({ type: 'BIRTHDAY', name: "Mia's birthday", date: dateOnly(inDays(10)), personId: mia })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      recursAnnually: true, nextOccurrence: inDays(10).toISOString(), budget: null, effectiveBudget: 40,
      spent: 0, overBudget: false, status: 'NOT_STARTED', subjectName: 'Mia', subjectFamilyId: a.householdId, rsvp: 'NONE',
    })
  })

  it('defaults a ONE_OFF to not recurring', async () => {
    const res = await post({ type: 'ONE_OFF', name: 'Party', date: dateOnly(inDays(3)), familyId: a.householdId, partyAt: inDays(3).toISOString(), location: 'Park' })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ recursAnnually: false, effectiveBudget: null, location: 'Park' })
  })

  it('requires exactly one subject from the same group', async () => {
    expect((await post({ type: 'BIRTHDAY', name: 'x', date: '2026-12-01', personId: mia, familyId: a.householdId })).status).toBe(400)
    expect((await post({ type: 'BIRTHDAY', name: 'x', date: '2026-12-01' })).status).toBe(400)
    expect((await post({ type: 'BIRTHDAY', name: 'x', date: '2026-12-01', personId: leo })).status).toBe(400)
  })

  it('rejects a bad date and a negative budget', async () => {
    expect((await post({ type: 'BIRTHDAY', name: 'x', date: 'soon', personId: mia })).status).toBe(400)
    expect((await post({ type: 'BIRTHDAY', name: 'x', date: '2026-12-01', personId: mia, budget: -1 })).status).toBe(400)
  })

  it("404s for a group you aren't in", async () => {
    const res = await api().post(`/groups/${b.groupId}/occasions`).set('Authorization', a.authHeader)
      .send({ type: 'BIRTHDAY', name: 'x', date: '2026-12-01', personId: leo })
    expect(res.status).toBe(404)
  })
})

describe('GET /groups/:groupId/occasions', () => {
  it('lists the next 30 days with planned spend, and filters by type', async () => {
    const res = await api().get(`/groups/${a.groupId}/occasions`).set('Authorization', a.authHeader)
    expect(res.status).toBe(200)
    expect(res.body.currency).toBe('CAD')
    const names = res.body.occasions.map((o: any) => o.name)
    expect(names).toEqual(['Party', "Mia's birthday"])
    expect(res.body.plannedSpend).toBe(40)

    const birthdays = await api().get(`/groups/${a.groupId}/occasions?type=BIRTHDAY`).set('Authorization', a.authHeader)
    expect(birthdays.body.occasions.map((o: any) => o.name)).toEqual(["Mia's birthday"])
  })

  it('leaves out occasions beyond the window and in paused families', async () => {
    const paused = await db.family.create({ data: { groupId: a.groupId, name: 'Paused', status: 'PAUSED' } })
    await db.occasion.create({ data: { groupId: a.groupId, familyId: paused.id, type: 'HOLIDAY', name: 'Paused holiday', date: inDays(5), nextOccurrence: inDays(5) } })
    await db.occasion.create({ data: { groupId: a.groupId, personId: mia, type: 'HOLIDAY', name: 'Far away', date: inDays(60), nextOccurrence: inDays(60) } })
    const res = await api().get(`/groups/${a.groupId}/occasions`).set('Authorization', a.authHeader)
    const names = res.body.occasions.map((o: any) => o.name)
    expect(names).not.toContain('Paused holiday')
    expect(names).not.toContain('Far away')

    const wide = await api().get(`/groups/${a.groupId}/occasions?to=${inDays(90).toISOString()}`).set('Authorization', a.authHeader)
    expect(wide.body.occasions.map((o: any) => o.name)).toContain('Far away')
  })

  it('counts spend only for gifts on the current occurrence and flags over budget', async () => {
    const occ = await db.occasion.create({ data: { groupId: a.groupId, personId: mia, type: 'BIRTHDAY', name: 'Spendy', date: inDays(7), nextOccurrence: inDays(7), budget: 20 } })
    const base = { groupId: a.groupId, createdById: a.user.id, direction: 'GIVEN' as const, personId: mia, occasionId: occ.id, date: new Date() }
    await db.giftEntry.create({ data: { ...base, title: 'Now', amount: 25, occasionDate: inDays(7) } })
    await db.giftEntry.create({ data: { ...base, title: 'Last year', amount: 99, occasionDate: new Date('2025-01-01') } })
    const res = await api().get(`/occasions/${occ.id}`).set('Authorization', a.authHeader)
    expect(res.body).toMatchObject({ effectiveBudget: 20, spent: 25, overBudget: true })
  })
})

describe('PATCH and DELETE /occasions/:id', () => {
  it('recomputes nextOccurrence when the date changes and allows any manual status', async () => {
    const occ = await db.occasion.create({ data: { groupId: a.groupId, personId: mia, type: 'BIRTHDAY', name: 'Move me', date: inDays(4), nextOccurrence: inDays(4), status: 'GIVEN' } })
    const res = await api().patch(`/occasions/${occ.id}`).set('Authorization', a.authHeader)
      .send({ date: dateOnly(inDays(12)), status: 'NOT_STARTED', cardDone: true })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ nextOccurrence: inDays(12).toISOString(), status: 'NOT_STARTED', cardDone: true })
  })

  it('switches the subject from a person to a family', async () => {
    const occ = await db.occasion.create({ data: { groupId: a.groupId, personId: mia, type: 'HOLIDAY', name: 'Switch', date: inDays(4), nextOccurrence: inDays(4) } })
    const res = await api().patch(`/occasions/${occ.id}`).set('Authorization', a.authHeader).send({ familyId: a.householdId })
    expect(res.body).toMatchObject({ personId: null, familyId: a.householdId })
    const bad = await api().patch(`/occasions/${occ.id}`).set('Authorization', a.authHeader).send({ personId: leo })
    expect(bad.status).toBe(400)
  })

  it("404s another group's occasion and deletes your own", async () => {
    const theirs = await db.occasion.create({ data: { groupId: b.groupId, personId: leo, type: 'BIRTHDAY', name: 'Theirs', date: inDays(4) } })
    expect((await api().patch(`/occasions/${theirs.id}`).set('Authorization', a.authHeader).send({ name: 'x' })).status).toBe(404)
    expect((await api().delete(`/occasions/${theirs.id}`).set('Authorization', a.authHeader)).status).toBe(404)

    const mine = await db.occasion.create({ data: { groupId: a.groupId, personId: mia, type: 'BIRTHDAY', name: 'Mine', date: inDays(4) } })
    expect((await api().delete(`/occasions/${mine.id}`).set('Authorization', a.authHeader)).status).toBe(204)
  })
})

describe('advanceOccasionStatus', () => {
  it('moves forward but never back', async () => {
    const occ = await db.occasion.create({ data: { groupId: a.groupId, personId: mia, type: 'BIRTHDAY', name: 'Status', date: inDays(4) } })
    await advanceOccasionStatus(occ.id, 'BOUGHT')
    expect((await db.occasion.findUniqueOrThrow({ where: { id: occ.id } })).status).toBe('BOUGHT')
    await advanceOccasionStatus(occ.id, 'IDEA_SAVED')
    expect((await db.occasion.findUniqueOrThrow({ where: { id: occ.id } })).status).toBe('BOUGHT')
    await advanceOccasionStatus(occ.id, 'GIVEN')
    await advanceOccasionStatus(occ.id, 'BOUGHT')
    expect((await db.occasion.findUniqueOrThrow({ where: { id: occ.id } })).status).toBe('GIVEN')
  })
})
