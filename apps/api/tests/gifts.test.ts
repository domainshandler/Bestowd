import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { createTestApp, createTestUser, cleanupUser } from './helpers.js'
import { db } from '../src/db.js'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance
let a: Awaited<ReturnType<typeof createTestUser>>
let b: Awaited<ReturnType<typeof createTestUser>>
let chen: string
let mia: string
let leo: string
let leoB: string

const inDays = (n: number) => {
  const t = new Date(Date.now() + n * 86_400_000)
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()))
}

beforeAll(async () => {
  app = await createTestApp()
  a = await createTestUser(app)
  b = await createTestUser(app)
  chen = (await db.family.create({ data: { groupId: a.groupId, name: 'Chen family' } })).id
  mia = (await db.person.create({ data: { groupId: a.groupId, familyId: chen, name: 'Mia' } })).id
  leo = (await db.person.create({ data: { groupId: a.groupId, familyId: chen, name: 'Leo' } })).id
  leoB = (await db.person.create({ data: { groupId: b.groupId, familyId: b.householdId, name: 'Other Leo' } })).id
})

afterAll(async () => {
  await cleanupUser(a.user.id)
  await cleanupUser(b.user.id)
  await app.close()
})

const api = () => supertest(app.server)
const post = (body: object) => api().post(`/groups/${a.groupId}/gifts`).set('Authorization', a.authHeader).send(body)
const list = (q = '') => api().get(`/groups/${a.groupId}/gifts${q}`).set('Authorization', a.authHeader)

describe('received gifts', () => {
  it('hide their value by default and set a thank-you due date', async () => {
    const res = await post({ direction: 'RECEIVED', title: 'Board game', date: '2026-02-01', familyId: chen, amount: 30 })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ valueHidden: true, status: null, thankYouSent: false, thankYouDueAt: '2026-02-15T00:00:00.000Z', counterpartyName: 'Chen family' })

    const before = await list('?year=2026')
    expect(before.body.totals).toMatchObject({ receivedCount: 1, receivedValue: 0, hiddenReceivedCount: 1, thankYouDueCount: 1 })

    await api().patch(`/gifts/${res.body.id}`).set('Authorization', a.authHeader).send({ valueHidden: false, thankYouSent: true })
    const after = await list('?year=2026')
    expect(after.body.totals).toMatchObject({ receivedValue: 30, hiddenReceivedCount: 0, thankYouDueCount: 0 })
  })

  it('reject a status, and given gifts reject receipt fields', async () => {
    expect((await post({ direction: 'RECEIVED', title: 'x', date: '2026-02-01', familyId: chen, status: 'GIVEN' })).status).toBe(400)
    expect((await post({ direction: 'GIVEN', title: 'x', date: '2026-02-01', personId: mia, hasGiftReceipt: true })).status).toBe(400)
  })
})

describe('given gifts and occasion status', () => {
  it('advance the occasion for its current occurrence: BOUGHT, then GIVEN', async () => {
    const occ = await db.occasion.create({ data: { groupId: a.groupId, personId: mia, type: 'BIRTHDAY', name: "Mia's birthday", date: inDays(9), nextOccurrence: inDays(9) } })
    const bought = await post({ direction: 'GIVEN', title: 'Lego', date: '2026-03-01', personId: mia, occasionId: occ.id, status: 'BOUGHT', amount: 35, category: 'Lego' })
    expect(bought.status).toBe(201)
    expect(bought.body).toMatchObject({ occasionDate: inDays(9).toISOString(), occasionName: "Mia's birthday", status: 'BOUGHT' })
    expect((await db.occasion.findUniqueOrThrow({ where: { id: occ.id } })).status).toBe('BOUGHT')

    await post({ direction: 'GIVEN', title: 'Card', date: '2026-03-02', personId: mia, occasionId: occ.id })
    expect((await db.occasion.findUniqueOrThrow({ where: { id: occ.id } })).status).toBe('GIVEN')
  })

  it("don't change status when logged against a past year", async () => {
    const occ = await db.occasion.create({ data: { groupId: a.groupId, personId: leo, type: 'BIRTHDAY', name: "Leo's birthday", date: inDays(20), nextOccurrence: inDays(20) } })
    await post({ direction: 'GIVEN', title: 'Old gift', date: '2025-06-01', personId: leo, occasionId: occ.id, occasionDate: '2025-06-01' })
    expect((await db.occasion.findUniqueOrThrow({ where: { id: occ.id } })).status).toBe('NOT_STARTED')
  })
})

describe('credits and filters', () => {
  it('credit a family gift to members, so it shows for each person', async () => {
    const res = await post({ direction: 'GIVEN', title: 'Family pass', date: '2026-05-10', familyId: chen, amount: 80, creditPersonIds: [mia, leo] })
    expect(res.body.credits.map((c: any) => c.name).sort()).toEqual(['Leo', 'Mia'])

    const forLeo = await list(`?personId=${leo}`)
    expect(forLeo.body.gifts.map((g: any) => g.title)).toContain('Family pass')

    const patched = await api().patch(`/gifts/${res.body.id}`).set('Authorization', a.authHeader).send({ creditPersonIds: [mia] })
    expect(patched.body.credits).toEqual([{ personId: mia, name: 'Mia' }])
  })

  it('reject credits, occasions or subjects from another group', async () => {
    expect((await post({ direction: 'GIVEN', title: 'x', date: '2026-05-10', familyId: chen, creditPersonIds: [leoB] })).status).toBe(400)
    expect((await post({ direction: 'GIVEN', title: 'x', date: '2026-05-10', personId: leoB })).status).toBe(400)
  })

  it('filter by year and direction while totals ignore direction', async () => {
    await post({ direction: 'GIVEN', title: 'Last year', date: '2025-12-20', personId: mia, amount: 10 })
    const y2025 = await list('?year=2025')
    expect(y2025.body.gifts.map((g: any) => g.title)).toEqual(['Last year', 'Old gift'])

    const given = await list('?year=2026&direction=GIVEN')
    expect(given.body.gifts.every((g: any) => g.direction === 'GIVEN')).toBe(true)
    expect(given.body.totals.receivedCount).toBe(1)
    expect(given.body.totals.spent).toBe(115)
    expect(given.body.currency).toBe('CAD')
  })
})

describe('GET /groups/:groupId/spend', () => {
  it('splits given spend by month and family', async () => {
    const res = await api().get(`/groups/${a.groupId}/spend?year=2026`).set('Authorization', a.authHeader)
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(115)
    expect(res.body.byMonth[2]).toBe(35)
    expect(res.body.byMonth[4]).toBe(80)
    expect(res.body.byFamily).toEqual([{ familyId: chen, familyName: 'Chen family', total: 115 }])
  })
})

describe('access', () => {
  it("404s another group's gifts", async () => {
    const theirs = await db.giftEntry.create({ data: { groupId: b.groupId, createdById: b.user.id, direction: 'GIVEN', title: 'Secret', date: new Date(), personId: leoB } })
    expect((await api().get(`/gifts/${theirs.id}`).set('Authorization', a.authHeader)).status).toBe(404)
    expect((await api().patch(`/gifts/${theirs.id}`).set('Authorization', a.authHeader).send({ title: 'x' })).status).toBe(404)
    expect((await api().delete(`/gifts/${theirs.id}`).set('Authorization', a.authHeader)).status).toBe(404)
    expect((await api().get(`/groups/${b.groupId}/gifts`).set('Authorization', a.authHeader)).status).toBe(404)
    expect((await api().get(`/groups/${b.groupId}/spend`).set('Authorization', a.authHeader)).status).toBe(404)
  })

  it('deletes your own gift', async () => {
    const mine = await post({ direction: 'GIVEN', title: 'Delete me', date: '2024-01-01', personId: mia })
    expect((await api().delete(`/gifts/${mine.body.id}`).set('Authorization', a.authHeader)).status).toBe(204)
  })
})
