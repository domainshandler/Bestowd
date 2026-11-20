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

const api = () => supertest(app.server)

describe('families', () => {
  it('creates a family and lists it after the own household', async () => {
    const created = await api().post(`/groups/${a.groupId}/families`).set('Authorization', a.authHeader)
      .send({ name: 'Chen family', type: 'FRIENDS' })
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({ name: 'Chen family', type: 'FRIENDS', status: 'ACTIVE', isOwnHousehold: false })

    const list = await api().get(`/groups/${a.groupId}/families`).set('Authorization', a.authHeader)
    expect(list.status).toBe(200)
    expect(list.body[0]).toMatchObject({ id: a.householdId, isOwnHousehold: true })
    expect(list.body.find((f: any) => f.id === created.body.id)).toMatchObject({ memberCount: 0, nextOccasion: null, onBestowd: false })
  })

  it('rejects a family without a name', async () => {
    const res = await api().post(`/groups/${a.groupId}/families`).set('Authorization', a.authHeader).send({ type: 'FAMILY' })
    expect(res.status).toBe(400)
  })

  it("404s another group's family on list, GET, PATCH and DELETE", async () => {
    const list = await api().get(`/groups/${b.groupId}/families`).set('Authorization', a.authHeader)
    expect(list.status).toBe(404)
    expect((await api().get(`/families/${b.householdId}`).set('Authorization', a.authHeader)).status).toBe(404)
    expect((await api().patch(`/families/${b.householdId}`).set('Authorization', a.authHeader).send({ name: 'x' })).status).toBe(404)
    expect((await api().delete(`/families/${b.householdId}`).set('Authorization', a.authHeader)).status).toBe(404)
  })

  it('hides archived families unless asked for them', async () => {
    const fam = await db.family.create({ data: { groupId: a.groupId, name: 'Old friends' } })
    await api().patch(`/families/${fam.id}`).set('Authorization', a.authHeader).send({ status: 'ARCHIVED' })

    const active = await api().get(`/groups/${a.groupId}/families`).set('Authorization', a.authHeader)
    expect(active.body.map((f: any) => f.id)).not.toContain(fam.id)
    const archived = await api().get(`/groups/${a.groupId}/families?status=ARCHIVED`).set('Authorization', a.authHeader)
    expect(archived.body.map((f: any) => f.id)).toEqual([fam.id])
  })

  it("refuses to delete the own household and deletes other families", async () => {
    const own = await api().delete(`/families/${a.householdId}`).set('Authorization', a.authHeader)
    expect(own.status).toBe(409)
    const fam = await db.family.create({ data: { groupId: a.groupId, name: 'Temp' } })
    const res = await api().delete(`/families/${fam.id}`).set('Authorization', a.authHeader)
    expect(res.status).toBe(204)
    expect(await db.family.findUnique({ where: { id: fam.id } })).toBeNull()
  })

  it('shows the next occasion across the family and its people', async () => {
    const fam = await db.family.create({ data: { groupId: a.groupId, name: 'Patel family' } })
    const kid = await db.person.create({ data: { groupId: a.groupId, familyId: fam.id, name: 'Ravi' } })
    const soon = new Date(Date.now() + 5 * 86_400_000)
    const later = new Date(Date.now() + 40 * 86_400_000)
    await db.occasion.create({ data: { groupId: a.groupId, familyId: fam.id, type: 'HOLIDAY', name: 'Diwali', date: later, nextOccurrence: later } })
    await db.occasion.create({ data: { groupId: a.groupId, personId: kid.id, type: 'BIRTHDAY', name: "Ravi's birthday", date: soon, nextOccurrence: soon } })

    const list = await api().get(`/groups/${a.groupId}/families`).set('Authorization', a.authHeader)
    const row = list.body.find((f: any) => f.id === fam.id)
    expect(row.memberCount).toBe(1)
    expect(row.nextOccasion).toMatchObject({ name: "Ravi's birthday", personName: 'Ravi' })
  })

  it('profile lists people with age and next birthday, upcoming occasions, and totals', async () => {
    const fam = await db.family.create({ data: { groupId: a.groupId, name: 'Kim family' } })
    const mia = await db.person.create({ data: { groupId: a.groupId, familyId: fam.id, name: 'Mia', birthYear: 2019, birthMonth: 3, birthDay: 9 } })
    const bday = new Date(Date.now() + 10 * 86_400_000)
    await db.occasion.create({ data: { groupId: a.groupId, personId: mia.id, type: 'BIRTHDAY', name: "Mia's birthday", date: bday, nextOccurrence: bday } })
    const base = { groupId: a.groupId, createdById: a.user.id, date: new Date('2026-01-10') }
    await db.giftEntry.create({ data: { ...base, direction: 'GIVEN', title: 'Puzzle', personId: mia.id, amount: 25, status: 'GIVEN' } })
    await db.giftEntry.create({ data: { ...base, direction: 'RECEIVED', title: 'Book', familyId: fam.id, amount: 30, valueHidden: true } })
    await db.giftEntry.create({ data: { ...base, direction: 'RECEIVED', title: 'Mug', familyId: fam.id, amount: 12, valueHidden: false, thankYouSent: true } })

    const res = await api().get(`/families/${fam.id}`).set('Authorization', a.authHeader)
    expect(res.status).toBe(200)
    expect(res.body.people).toHaveLength(1)
    expect(res.body.people[0]).toMatchObject({ name: 'Mia', nextBirthday: bday.toISOString() })
    expect(typeof res.body.people[0].age).toBe('number')
    expect(res.body.occasions[0]).toMatchObject({ name: "Mia's birthday", subjectName: 'Mia', needsGift: true })
    expect(res.body.totals).toEqual({
      givenCount: 1, receivedCount: 2, spent: 25, receivedValue: 12, hiddenReceivedCount: 1, thankYouDueCount: 1,
    })
    expect(res.body.connection).toBeNull()
  })
})
