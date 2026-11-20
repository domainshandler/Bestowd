import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { createTestApp, createTestUser, cleanupUser } from './helpers.js'
import { db } from '../src/db.js'
import { ageOn } from '../src/services/age.js'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance
let a: Awaited<ReturnType<typeof createTestUser>>
let b: Awaited<ReturnType<typeof createTestUser>>

beforeAll(async () => {
  app = await createTestApp()
  a = await createTestUser(app)
  b = await createTestUser(app)
})

afterAll(async () => {
  await cleanupUser(a.user.id)
  await cleanupUser(b.user.id)
  await app.close()
})

const api = () => supertest(app.server)

describe('ageOn', () => {
  const mia = { birthYear: 2019, birthMonth: 3, birthDay: 9 }
  it('counts a birthday only once it has happened', () => {
    expect(ageOn(mia, new Date('2026-03-08T12:00:00Z'))).toBe(6)
    expect(ageOn(mia, new Date('2026-03-09T00:00:00Z'))).toBe(7)
  })
  it('returns null without a birth year and subtracts years when only the year is known', () => {
    expect(ageOn({ birthYear: null, birthMonth: 3, birthDay: 9 }, new Date())).toBeNull()
    expect(ageOn({ birthYear: 2019, birthMonth: null, birthDay: null }, new Date('2026-01-01'))).toBe(7)
  })
})

describe('people', () => {
  it('adds a person to a family and returns them with age and family name', async () => {
    const created = await api().post(`/families/${a.householdId}/people`).set('Authorization', a.authHeader).send({
      name: 'Mia', relationship: 'Daughter', birthMonth: 3, birthDay: 9, birthYear: 2019,
      likes: ['Lego', 'Unicorns'], avoid: ['Slime'], sizes: { Shirt: '6T' }, foodNotes: 'No nuts',
    })
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({ groupId: a.groupId, familyId: a.householdId, likes: ['Lego', 'Unicorns'], sizes: { Shirt: '6T' } })

    const res = await api().get(`/people/${created.body.id}`).set('Authorization', a.authHeader)
    expect(res.status).toBe(200)
    expect(res.body.age).toBe(ageOn({ birthYear: 2019, birthMonth: 3, birthDay: 9 }, new Date()))
    expect(res.body.familyName).toBeTruthy()
    expect(res.body.history).toEqual([])
  })

  it('rejects a birthDay without birthMonth, a bad month, and a future birth year', async () => {
    for (const body of [{ name: 'X', birthDay: 4 }, { name: 'X', birthMonth: 13 }, { name: 'X', birthYear: 2999 }]) {
      const res = await api().post(`/families/${a.householdId}/people`).set('Authorization', a.authHeader).send(body)
      expect(res.status).toBe(400)
    }
  })

  it("404s adding to or reading another group's family and people", async () => {
    const add = await api().post(`/families/${b.householdId}/people`).set('Authorization', a.authHeader).send({ name: 'X' })
    expect(add.status).toBe(404)
    const other = await db.person.create({ data: { groupId: b.groupId, familyId: b.householdId, name: 'Leo' } })
    expect((await api().get(`/people/${other.id}`).set('Authorization', a.authHeader)).status).toBe(404)
    expect((await api().patch(`/people/${other.id}`).set('Authorization', a.authHeader).send({ name: 'Y' })).status).toBe(404)
    expect((await api().delete(`/people/${other.id}`).set('Authorization', a.authHeader)).status).toBe(404)
  })

  it('archives, unarchives and moves a person within the group only', async () => {
    const person = await db.person.create({ data: { groupId: a.groupId, familyId: a.householdId, name: 'Sam' } })
    const archived = await api().patch(`/people/${person.id}`).set('Authorization', a.authHeader).send({ archived: true })
    expect(archived.body.archivedAt).not.toBeNull()
    const restored = await api().patch(`/people/${person.id}`).set('Authorization', a.authHeader).send({ archived: false })
    expect(restored.body.archivedAt).toBeNull()

    const other = await db.family.create({ data: { groupId: a.groupId, name: 'Grandparents' } })
    const moved = await api().patch(`/people/${person.id}`).set('Authorization', a.authHeader).send({ familyId: other.id })
    expect(moved.body.familyId).toBe(other.id)

    const cross = await api().patch(`/people/${person.id}`).set('Authorization', a.authHeader).send({ familyId: b.householdId })
    expect(cross.status).toBe(400)
  })

  it('shows gift history including gifts credited to the person', async () => {
    const person = await db.person.create({ data: { groupId: a.groupId, familyId: a.householdId, name: 'Nora' } })
    const fam = await db.family.create({ data: { groupId: a.groupId, name: 'Givers' } })
    const credited = await db.giftEntry.create({
      data: { groupId: a.groupId, createdById: a.user.id, direction: 'RECEIVED', title: 'Kite', date: new Date('2026-06-01'), familyId: fam.id, credits: { create: { personId: person.id } } },
    })
    const res = await api().get(`/people/${person.id}`).set('Authorization', a.authHeader)
    expect(res.body.history.map((h: any) => h.id)).toEqual([credited.id])
  })

  it('deletes a person', async () => {
    const person = await db.person.create({ data: { groupId: a.groupId, familyId: a.householdId, name: 'Gone' } })
    expect((await api().delete(`/people/${person.id}`).set('Authorization', a.authHeader)).status).toBe(204)
  })
})
