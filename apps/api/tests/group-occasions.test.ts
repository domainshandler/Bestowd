import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import supertest from 'supertest'
import { createTestApp, createTestUser, cleanupUser } from './helpers.js'
import { db } from '../src/db.js'
import { runReminderScan } from '../src/services/reminder-job.js'
import { findHoliday, nextHolidayDate } from '../src/holidays/catalog.js'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance
let a: Awaited<ReturnType<typeof createTestUser>>
let b: Awaited<ReturnType<typeof createTestUser>>
let smiths: string
let teacher: string
let neighbours: string
let archived: string
let mia: string

beforeAll(async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  app = await createTestApp()
  a = await createTestUser(app)
  b = await createTestUser(app)
  await db.group.update({ where: { id: a.groupId }, data: { defaultBudgets: { HOLIDAY: 30 } } })
  smiths = (await db.family.create({ data: { groupId: a.groupId, name: 'Smiths', type: 'FAMILY' } })).id
  teacher = (await db.family.create({ data: { groupId: a.groupId, name: 'Ms Park', type: 'SCHOOL' } })).id
  neighbours = (await db.family.create({ data: { groupId: a.groupId, name: 'Next door', type: 'NEIGHBOURS' } })).id
  archived = (await db.family.create({ data: { groupId: a.groupId, name: 'Old friends', status: 'ARCHIVED' } })).id
  mia = (await db.person.create({ data: { groupId: a.groupId, familyId: smiths, name: 'Mia' } })).id
})

afterAll(async () => {
  await cleanupUser(a.user.id)
  await cleanupUser(b.user.id)
  await app.close()
  vi.restoreAllMocks()
})

const api = () => supertest(app.server)
const auth = (req: supertest.Test, who = a) => req.set('Authorization', who.authHeader)
const create = (body: object) => auth(api().post(`/groups/${a.groupId}/occasions`)).send(body)
const share = (dto: { coverage: { families: { familyId: string }[] } }, familyId: string) =>
  dto.coverage.families.find((f) => f.familyId === familyId) as Record<string, unknown> | undefined

describe('built-in holidays', () => {
  it('lists the catalog with next dates and whether the group has added each', async () => {
    const res = await auth(api().get(`/groups/${a.groupId}/holidays`))
    expect(res.status).toBe(200)
    expect(res.body.chosen).toBe(false)
    const christmas = res.body.holidays.find((h: { key: string }) => h.key === 'christmas')
    expect(christmas).toMatchObject({ name: 'Christmas', occasionId: null, dismissed: false })
    expect(christmas.nextDate).toBe(nextHolidayDate(findHoliday('christmas')!.rule, new Date())!.toISOString())
    expect((await auth(api().get(`/groups/${a.groupId}/holidays`), b)).status).toBe(404)
  })

  it('adds a holiday as a group-wide occasion covering every non-archived family', async () => {
    const res = await create({ groupWide: true, holidayKey: 'christmas' })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      scope: 'GROUP', holidayKey: 'christmas', type: 'HOLIDAY', name: 'Christmas', recursAnnually: true,
      personId: null, familyId: null, includeNewFamilies: true,
    })
    expect(res.body.nextOccurrence).toBe(nextHolidayDate(findHoliday('christmas')!.rule, new Date())!.toISOString())
    const ids = res.body.coverage.families.map((f: { familyId: string }) => f.familyId).sort()
    expect(ids).toEqual([a.householdId, smiths, teacher, neighbours].sort())
    expect(ids).not.toContain(archived)
    expect(res.body.coverage).toMatchObject({ familyCount: 4, coveredCount: 0 })
    // Every family falls back to the group's Holiday default: 4 × 30.
    expect(res.body.effectiveBudget).toBe(120)
    expect(res.body.needsGift).toBe(true)

    const listed = await auth(api().get(`/groups/${a.groupId}/holidays`))
    expect(listed.body.holidays.find((h: { key: string }) => h.key === 'christmas').occasionId).toBe(res.body.id)
  })

  it('refuses the same holiday twice, unknown holidays, and holidays on a person', async () => {
    expect((await create({ groupWide: true, holidayKey: 'christmas' })).status).toBe(409)
    expect((await create({ groupWide: true, holidayKey: 'not-a-holiday' })).status).toBe(400)
    expect((await create({ holidayKey: 'easter', personId: mia })).status).toBe(400)
  })

  it("keeps a holiday's date tied to its rule", async () => {
    const occ = await db.occasion.findFirstOrThrow({ where: { groupId: a.groupId, holidayKey: 'christmas' } })
    expect((await auth(api().patch(`/occasions/${occ.id}`)).send({ date: '2026-12-24' })).status).toBe(400)
  })
})

describe('custom group-wide occasions', () => {
  let id: string

  it('creates one for chosen families', async () => {
    const res = await create({ groupWide: true, type: 'HOLIDAY', name: 'Teacher appreciation', date: '2027-05-04', familyIds: [teacher, smiths], budget: 15 })
    expect(res.status).toBe(201)
    id = res.body.id
    expect(res.body).toMatchObject({ scope: 'GROUP', holidayKey: null, subjectName: '2 families', effectiveBudget: 30 })
  })

  it('needs a name and date, and families from the same group', async () => {
    expect((await create({ groupWide: true, type: 'HOLIDAY', name: 'x' })).status).toBe(400)
    const other = await db.family.findUniqueOrThrow({ where: { householdOfGroupId: b.groupId } })
    expect((await create({ groupWide: true, type: 'HOLIDAY', name: 'x', date: '2027-01-01', familyIds: [other.id] })).status).toBe(400)
    expect((await create({ groupWide: true, type: 'HOLIDAY', name: 'x', date: '2027-01-01', familyId: smiths })).status).toBe(400)
  })

  it("can't be moved onto a person", async () => {
    expect((await auth(api().patch(`/occasions/${id}`)).send({ personId: mia })).status).toBe(400)
  })
})

describe('budgets for a group-wide occasion', () => {
  it('resolves family override, then family type, then occasion budget, then group default', async () => {
    const occ = await db.occasion.findFirstOrThrow({ where: { groupId: a.groupId, holidayKey: 'christmas' } })
    // No occasion budget yet: everyone gets the group default (30).
    let res = await auth(api().patch(`/occasions/${occ.id}`)).send({ budget: 50, familyTypeBudgets: { SCHOOL: 20, NEIGHBOURS: 10 } })
    expect(res.status).toBe(200)
    expect(share(res.body, smiths)).toMatchObject({ budget: 50, budgetOverride: null })
    expect(share(res.body, teacher)).toMatchObject({ budget: 20 })
    expect(share(res.body, neighbours)).toMatchObject({ budget: 10 })

    res = await auth(api().put(`/occasions/${occ.id}/families`)).send({
      families: [{ familyId: a.householdId }, { familyId: smiths, budget: 120 }, { familyId: teacher }, { familyId: neighbours }],
    })
    expect(res.status).toBe(200)
    expect(share(res.body, smiths)).toMatchObject({ budget: 120, budgetOverride: 120 })
    expect(res.body.effectiveBudget).toBe(50 + 120 + 20 + 10)
  })

  it('rejects unknown family types and duplicate families', async () => {
    const occ = await db.occasion.findFirstOrThrow({ where: { groupId: a.groupId, holidayKey: 'christmas' } })
    expect((await auth(api().patch(`/occasions/${occ.id}`)).send({ familyTypeBudgets: { COWORKERS: 5 } })).status).toBe(400)
    expect((await auth(api().put(`/occasions/${occ.id}/families`)).send({ families: [{ familyId: smiths }, { familyId: smiths }] })).status).toBe(400)
  })

  it('only group-wide occasions cover families', async () => {
    const own = await create({ type: 'BIRTHDAY', name: 'Mia', date: '2027-03-01', personId: mia })
    expect((await auth(api().put(`/occasions/${own.body.id}/families`)).send({ families: [] })).status).toBe(400)
  })
})

describe('progress', () => {
  it('counts a family as covered once a gift for them (or one of their people) is bought or given', async () => {
    const occ = await db.occasion.findFirstOrThrow({ where: { groupId: a.groupId, holidayKey: 'christmas' } })
    const gift = (body: object) => auth(api().post(`/groups/${a.groupId}/gifts`)).send({ direction: 'GIVEN', date: '2026-12-01', occasionId: occ.id, ...body })
    expect((await gift({ title: 'Lego', personId: mia, status: 'BOUGHT', amount: 40 })).status).toBe(201)
    expect((await gift({ title: 'Card', familyId: teacher, status: 'GIVEN', amount: 5 })).status).toBe(201)

    const res = await auth(api().get(`/occasions/${occ.id}`))
    expect(res.body.coverage).toMatchObject({ familyCount: 4, coveredCount: 2 })
    expect(share(res.body, smiths)).toMatchObject({ covered: true, given: false, spent: 40 })
    expect(share(res.body, teacher)).toMatchObject({ covered: true, given: true, spent: 5 })
    expect(res.body).toMatchObject({ spent: 45, status: 'NOT_STARTED', needsGift: true })
    // The occasion's own status isn't advanced by gifts: progress is per family.
    expect((await db.occasion.findUniqueOrThrow({ where: { id: occ.id } })).status).toBe('NOT_STARTED')
  })

  it("shows a family's share on its profile and in its occasion list", async () => {
    const profile = await auth(api().get(`/families/${smiths}`))
    const christmas = profile.body.occasions.find((o: { holidayKey: string }) => o.holidayKey === 'christmas')
    expect(christmas).toMatchObject({ scope: 'GROUP', effectiveBudget: 120, spent: 40, status: 'BOUGHT', needsGift: false, subjectName: 'Smiths' })

    const to = new Date(Date.now() + 400 * 86_400_000).toISOString().slice(0, 10)
    const list = await auth(api().get(`/groups/${a.groupId}/occasions?familyId=${neighbours}&to=${to}`))
    expect(list.body.occasions.find((o: { holidayKey: string }) => o.holidayKey === 'christmas'))
      .toMatchObject({ effectiveBudget: 10, needsGift: true, subjectFamilyId: neighbours })
    const forMia = await auth(api().get(`/groups/${a.groupId}/occasions?personId=${mia}&to=${to}`))
    expect(forMia.body.occasions.some((o: { holidayKey: string }) => o.holidayKey === 'christmas')).toBe(true)
  })

  it('appears on Home and as each covered family’s next occasion', async () => {
    const to = new Date(Date.now() + 400 * 86_400_000).toISOString().slice(0, 10)
    const home = await auth(api().get(`/me/occasions?to=${to}`))
    expect(home.body.occasions.some((o: { holidayKey: string }) => o.holidayKey === 'christmas')).toBe(true)
  })
})

describe('new families', () => {
  it('join group-wide occasions that include new families, and not ones that don’t', async () => {
    const custom = await db.occasion.findFirstOrThrow({ where: { groupId: a.groupId, name: 'Teacher appreciation' } })
    await auth(api().patch(`/occasions/${custom.id}`)).send({ includeNewFamilies: false })
    const res = await auth(api().post(`/groups/${a.groupId}/families`)).send({ name: 'New cousins' })
    expect(res.status).toBe(201)
    const christmas = await db.occasion.findFirstOrThrow({ where: { groupId: a.groupId, holidayKey: 'christmas' }, include: { coverage: true } })
    expect(christmas.coverage.map((c) => c.familyId)).toContain(res.body.id)
    const after = await db.occasion.findUniqueOrThrow({ where: { id: custom.id }, include: { coverage: true } })
    expect(after.coverage.map((c) => c.familyId)).not.toContain(res.body.id)
  })
})

describe('reminders', () => {
  it('say how many families still need a gift and tap through to the occasion', async () => {
    const day = (offset: number) => new Date(Date.UTC(2026, 10, 18 + offset))
    const occ = await db.occasion.create({
      data: {
        groupId: a.groupId, type: 'HOLIDAY', name: 'Lantern night', date: day(14), nextOccurrence: day(14),
        coverage: { create: [{ familyId: smiths }, { familyId: teacher }] },
      },
    })
    const due = (await runReminderScan(new Date('2026-11-18T09:00:00Z'))).filter((r) => r.occasionId === occ.id)
    expect(due).toHaveLength(1)
    expect(due[0]).toMatchObject({ kind: 'OCCASION', body: 'Lantern night is in 14 days and 2 of 2 families still need a gift.' })
    expect(due[0]!.data).toMatchObject({ occasionId: occ.id, scope: 'GROUP' })
  })
})

describe('choosing holidays', () => {
  let c: Awaited<ReturnType<typeof createTestUser>>
  beforeAll(async () => { c = await createTestUser(app) })
  afterAll(async () => { await cleanupUser(c.user.id) })
  const holidays = () => auth(api().get(`/groups/${c.groupId}/holidays`), c)
  const byKey = (body: { holidays: { key: string }[] }, key: string) => body.holidays.find((h) => h.key === key) as Record<string, unknown>

  it('adds the picked holidays, covering every family, and stops suggesting the rest', async () => {
    const res = await auth(api().post(`/groups/${c.groupId}/holidays/choose`), c).send({ keys: ['christmas', 'mothers-day'] })
    expect(res.status).toBe(200)
    expect(res.body.chosen).toBe(true)
    expect(byKey(res.body, 'christmas')).toMatchObject({ dismissed: false, occasionId: expect.any(String) })
    expect(byKey(res.body, 'mothers-day').occasionId).toEqual(expect.any(String))
    expect(byKey(res.body, 'diwali')).toMatchObject({ dismissed: true, occasionId: null })

    const christmas = await db.occasion.findFirstOrThrow({ where: { groupId: c.groupId, holidayKey: 'christmas' }, include: { coverage: true } })
    expect(christmas.coverage.map((f) => f.familyId)).toEqual([c.householdId])
    expect(christmas.nextOccurrence).toEqual(nextHolidayDate(findHoliday('christmas')!.rule, new Date()))
  })

  it('answering again keeps holidays already added and adds new picks', async () => {
    const res = await auth(api().post(`/groups/${c.groupId}/holidays/choose`), c).send({ keys: ['christmas', 'easter'] })
    expect(byKey(res.body, 'easter').occasionId).toEqual(expect.any(String))
    // Mother's Day was already added, so it stays (and isn't dismissed).
    expect(byKey(res.body, 'mothers-day')).toMatchObject({ dismissed: false, occasionId: expect.any(String) })
    expect(await db.occasion.count({ where: { groupId: c.groupId, holidayKey: 'christmas' } })).toBe(1)
  })

  it('dismisses one suggestion, and adding it later undoes the dismissal', async () => {
    const dismissed = await auth(api().post(`/groups/${c.groupId}/holidays/valentines/dismiss`), c)
    expect(dismissed.status).toBe(200)
    expect(byKey(dismissed.body, 'valentines').dismissed).toBe(true)

    await auth(api().post(`/groups/${c.groupId}/occasions`), c).send({ groupWide: true, holidayKey: 'valentines' })
    expect(byKey((await holidays()).body, 'valentines')).toMatchObject({ dismissed: false, occasionId: expect.any(String) })
  })

  it('rejects unknown holidays and non-members', async () => {
    expect((await auth(api().post(`/groups/${c.groupId}/holidays/choose`), c).send({ keys: ['nope'] })).status).toBe(400)
    expect((await auth(api().post(`/groups/${c.groupId}/holidays/nope/dismiss`), c)).status).toBe(400)
    expect((await auth(api().post(`/groups/${c.groupId}/holidays/choose`), a).send({ keys: [] })).status).toBe(404)
  })
})
