import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { createTestApp, createTestUser, cleanupUser } from './helpers.js'
import { db } from '../src/db.js'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance
let a: Awaited<ReturnType<typeof createTestUser>>
let b: Awaited<ReturnType<typeof createTestUser>>
let mia: string // turns 7 in ten days
let leo: string // 9
let chen: string

const DAY = 86_400_000
const utcDay = (t: number) => {
  const d = new Date(t)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}
const birthdayIn10 = utcDay(Date.now() + 10 * DAY)

beforeAll(async () => {
  app = await createTestApp()
  a = await createTestUser(app)
  b = await createTestUser(app)
  chen = (await db.family.create({ data: { groupId: a.groupId, name: 'Chen family' } })).id
  mia = (
    await db.person.create({
      data: {
        groupId: a.groupId,
        familyId: chen,
        name: 'Mia',
        birthYear: birthdayIn10.getUTCFullYear() - 7,
        birthMonth: birthdayIn10.getUTCMonth() + 1,
        birthDay: birthdayIn10.getUTCDate(),
      },
    })
  ).id
  leo = (
    await db.person.create({
      data: { groupId: a.groupId, familyId: chen, name: 'Leo', birthYear: new Date().getUTCFullYear() - 9, birthMonth: 1, birthDay: 1 },
    })
  ).id
})

afterAll(async () => {
  await cleanupUser(a.user.id)
  await cleanupUser(b.user.id)
  await app.close()
})

const api = () => supertest(app.server)
const auth = (req: supertest.Test) => req.set('Authorization', a.authHeader)
const createIdea = (body: object) => auth(api().post(`/groups/${a.groupId}/ideas`)).send(body)
const titlesFor = async (q: string) => (await auth(api().get(`/groups/${a.groupId}/ideas${q}`))).body.ideas.map((i: any) => i.title)

describe('ideas', () => {
  it('creates an idea tagged to people', async () => {
    const res = await createIdea({ title: 'Unicorn kit', personIds: [mia], price: 24.5, url: 'https://shop.example/unicorn' })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ status: 'SAVED', price: 24.5, people: [{ id: mia, name: 'Mia' }] })
  })

  it('matches tagged ideas to that person only', async () => {
    await createIdea({ title: 'Leo telescope', personIds: [leo] })
    expect(await titlesFor(`?personId=${mia}`)).toContain('Unicorn kit')
    expect(await titlesFor(`?personId=${mia}`)).not.toContain('Leo telescope')
  })

  it('filters to ideas tagged with anyone in a family', async () => {
    const other = (await db.family.create({ data: { groupId: a.groupId, name: 'Parks' } })).id
    const kim = (await db.person.create({ data: { groupId: a.groupId, familyId: other, name: 'Kim' } })).id
    const forKim = await createIdea({ title: 'For Kim', personIds: [kim] })
    const res = await auth(api().get(`/groups/${a.groupId}/ideas?familyId=${other}`))
    expect(res.body.ideas.map((i: any) => i.id)).toEqual([forKim.body.id])
    expect((await auth(api().get(`/groups/${a.groupId}/ideas?familyId=${b.householdId}`))).status).toBe(400)
  })

  it('matches age ranges, measured on the occasion date when given', async () => {
    await createIdea({ title: 'Ages 5-6', ageMin: 5, ageMax: 6 })
    await createIdea({ title: 'Ages 7-9', ageMin: 7, ageMax: 9 })
    const today = await auth(api().get(`/groups/${a.groupId}/ideas?personId=${mia}`))
    expect(today.body.person).toMatchObject({ name: 'Mia', age: 6 })
    expect(today.body.ideas.map((i: any) => i.title)).toContain('Ages 5-6')
    expect(today.body.ideas.map((i: any) => i.title)).not.toContain('Ages 7-9')

    const occ = await db.occasion.create({
      data: {
        groupId: a.groupId,
        personId: mia,
        type: 'BIRTHDAY',
        name: "Mia's birthday",
        date: birthdayIn10,
        nextOccurrence: birthdayIn10,
      },
    })
    const onBirthday = await titlesFor(`?personId=${mia}&occasionId=${occ.id}`)
    expect(onBirthday).toContain('Ages 7-9')
    expect(onBirthday).not.toContain('Ages 5-6')

    expect(await titlesFor(`?personId=${leo}`)).toContain('Ages 7-9')
  })

  it('flags repeats by category, including gifts credited to the person', async () => {
    await db.giftEntry.create({
      data: {
        groupId: a.groupId,
        createdById: a.user.id,
        direction: 'GIVEN',
        title: '500-piece puzzle',
        category: 'Puzzle',
        date: new Date('2025-12-20'),
        personId: mia,
      },
    })
    await createIdea({ title: 'Jigsaw', category: 'puzzle', personIds: [mia, leo] })
    await createIdea({ title: 'Paint set', category: 'Art', personIds: [mia] })

    const forMia = (await auth(api().get(`/groups/${a.groupId}/ideas?personId=${mia}`))).body.ideas
    expect(forMia.find((i: any) => i.title === 'Jigsaw').repeat).toMatchObject({
      title: '500-piece puzzle',
      date: '2025-12-20T00:00:00.000Z',
    })
    expect(forMia.find((i: any) => i.title === 'Paint set').repeat).toBeNull()

    // Leo has no direct puzzle, until a family gift credited to him.
    const forLeoBefore = (await auth(api().get(`/groups/${a.groupId}/ideas?personId=${leo}`))).body.ideas
    expect(forLeoBefore.find((i: any) => i.title === 'Jigsaw').repeat).toBeNull()
    await db.giftEntry.create({
      data: {
        groupId: a.groupId,
        createdById: a.user.id,
        direction: 'GIVEN',
        title: 'Family puzzle',
        category: 'PUZZLE',
        date: new Date('2026-01-02'),
        familyId: chen,
        credits: { create: { personId: leo } },
      },
    })
    const forLeoAfter = (await auth(api().get(`/groups/${a.groupId}/ideas?personId=${leo}`))).body.ideas
    expect(forLeoAfter.find((i: any) => i.title === 'Jigsaw').repeat).toMatchObject({ title: 'Family puzzle' })
  })

  it('validates age ranges, urls and people from other groups', async () => {
    expect((await createIdea({ title: 'x', ageMin: 9, ageMax: 3 })).status).toBe(400)
    expect((await createIdea({ title: 'x', url: 'javascript:alert(1)' })).status).toBe(400)
    const outsider = await db.person.create({ data: { groupId: b.groupId, familyId: b.householdId, name: 'Out' } })
    expect((await createIdea({ title: 'x', personIds: [outsider.id] })).status).toBe(400)
    expect((await auth(api().get(`/groups/${a.groupId}/ideas?personId=${outsider.id}`))).status).toBe(400)
  })

  it('saving an idea to an occasion marks it IDEA_SAVED', async () => {
    const occ = await db.occasion.create({
      data: { groupId: a.groupId, personId: leo, type: 'HOLIDAY', name: 'Holiday', date: birthdayIn10, nextOccurrence: birthdayIn10 },
    })
    const res = await createIdea({ title: 'Sled', occasionId: occ.id })
    expect(res.status).toBe(201)
    expect((await db.occasion.findUniqueOrThrow({ where: { id: occ.id } })).status).toBe('IDEA_SAVED')

    const other = await createIdea({ title: 'Later assigned' })
    const occ2 = await db.occasion.create({
      data: { groupId: a.groupId, personId: leo, type: 'HOLIDAY', name: 'Holiday 2', date: birthdayIn10, nextOccurrence: birthdayIn10 },
    })
    const patched = await auth(api().patch(`/ideas/${other.body.id}`)).send({ occasionId: occ2.id, personIds: [leo] })
    expect(patched.body).toMatchObject({ occasionId: occ2.id, people: [{ id: leo, name: 'Leo' }] })
    expect((await db.occasion.findUniqueOrThrow({ where: { id: occ2.id } })).status).toBe('IDEA_SAVED')
  })

  it('buying logs a BOUGHT gift for the occasion subject and marks idea and occasion bought', async () => {
    const occ = await db.occasion.create({
      data: {
        groupId: a.groupId,
        personId: mia,
        type: 'ONE_OFF',
        name: 'Recital',
        date: birthdayIn10,
        nextOccurrence: birthdayIn10,
        recursAnnually: false,
      },
    })
    const idea = await createIdea({ title: 'Flowers', category: 'Flowers', price: 18, occasionId: occ.id })

    const res = await auth(api().post(`/ideas/${idea.body.id}/buy`)) // no body at all, as apiFetch sends it
    expect(res.status).toBe(200)
    expect(res.body.idea.status).toBe('BOUGHT')
    expect(res.body.gift).toMatchObject({
      direction: 'GIVEN',
      status: 'BOUGHT',
      ideaId: idea.body.id,
      personId: mia,
      amount: 18,
      category: 'Flowers',
      occasionDate: birthdayIn10.toISOString(),
    })
    expect((await db.occasion.findUniqueOrThrow({ where: { id: occ.id } })).status).toBe('BOUGHT')

    expect((await auth(api().post(`/ideas/${idea.body.id}/buy`)).send({})).status).toBe(409)
  })

  it("buying carries the idea's brand, link, photo and notes into the gift", async () => {
    const idea = await createIdea({
      title: 'Smartwatch',
      brand: 'Garmin',
      url: 'https://shop.example/watch',
      imageUrl: 'https://shop.example/watch.jpg',
      notes: 'The green strap',
      price: 199,
    })
    expect(idea.body.brand).toBe('Garmin')
    const res = await auth(api().post(`/ideas/${idea.body.id}/buy`)).send({ personId: leo })
    expect(res.body.gift).toMatchObject({
      title: 'Smartwatch',
      brand: 'Garmin',
      url: 'https://shop.example/watch',
      photoUrl: 'https://shop.example/watch.jpg',
      notes: 'The green strap',
      amount: 199,
    })
  })

  it('buying without an occasion needs a recipient', async () => {
    const idea = await createIdea({ title: 'No recipient' })
    expect((await auth(api().post(`/ideas/${idea.body.id}/buy`)).send({})).status).toBe(400)
    const ok = await auth(api().post(`/ideas/${idea.body.id}/buy`)).send({ personId: leo, amount: 5 })
    expect(ok.body.gift).toMatchObject({ personId: leo, amount: 5 })
    // The failed attempt left the idea unbought.
  })

  it('reads and edits an idea with nobody tagged', async () => {
    const idea = await createIdea({ title: 'Untagged lamp' })
    expect((await auth(api().get(`/ideas/${idea.body.id}`))).body).toMatchObject({ title: 'Untagged lamp', people: [] })
    const res = await auth(api().patch(`/ideas/${idea.body.id}`)).send({ title: 'Reading lamp', brand: 'IKEA', personIds: [mia] })
    expect(res.body).toMatchObject({ title: 'Reading lamp', brand: 'IKEA', people: [{ id: mia }] })
  })

  it('logging a given gift from an idea marks the idea bought; a received one does not', async () => {
    const given = await createIdea({ title: 'Kite' })
    const res = await auth(api().post(`/groups/${a.groupId}/gifts`)).send({
      direction: 'GIVEN',
      title: 'Kite',
      date: '2026-11-01',
      personId: leo,
      ideaId: given.body.id,
    })
    expect(res.status).toBe(201)
    expect(res.body.ideaId).toBe(given.body.id)
    expect((await db.idea.findUniqueOrThrow({ where: { id: given.body.id } })).status).toBe('BOUGHT')

    const received = await createIdea({ title: 'Scarf' })
    await auth(api().post(`/groups/${a.groupId}/gifts`)).send({
      direction: 'RECEIVED',
      title: 'Scarf',
      date: '2026-11-01',
      personId: leo,
      ideaId: received.body.id,
    })
    expect((await db.idea.findUniqueOrThrow({ where: { id: received.body.id } })).status).toBe('SAVED')
  })

  it("404s another group's ideas and deletes your own", async () => {
    const theirs = await db.idea.create({ data: { groupId: b.groupId, createdById: b.user.id, title: 'Theirs' } })
    expect((await auth(api().get(`/ideas/${theirs.id}`))).status).toBe(404)
    expect((await auth(api().patch(`/ideas/${theirs.id}`)).send({ title: 'x' })).status).toBe(404)
    expect((await auth(api().post(`/ideas/${theirs.id}/buy`)).send({})).status).toBe(404)
    expect((await auth(api().delete(`/ideas/${theirs.id}`))).status).toBe(404)
    expect((await auth(api().get(`/groups/${b.groupId}/ideas`))).status).toBe(404)

    const mine = await createIdea({ title: 'Delete me' })
    expect((await auth(api().delete(`/ideas/${mine.body.id}`))).status).toBe(204)
  })
})
