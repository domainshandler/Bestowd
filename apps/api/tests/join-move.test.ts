import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { createTestApp, createTestUser, cleanupUser } from './helpers.js'
import { db } from '../src/db.js'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance
let host: Awaited<ReturnType<typeof createTestUser>>   // owns the group being joined
let joiner: Awaited<ReturnType<typeof createTestUser>> // has their own data
let empty: Awaited<ReturnType<typeof createTestUser>>  // nothing of their own
const api = () => supertest(app.server)

const token = async () =>
  (await api().post(`/groups/${host.groupId}/invites`).set('Authorization', host.authHeader).send({ kind: 'GROUP' })).body.token as string

beforeAll(async () => {
  app = await createTestApp()
  host = await createTestUser(app, { name: 'Renny Saldanha' })
  joiner = await createTestUser(app, { name: 'Sheldon Miranda' })
  empty = await createTestUser(app, { name: 'Emma Empty' })
})

afterAll(async () => {
  for (const u of [host, joiner, empty]) await cleanupUser(u.user.id)
  await app.close()
})

describe('account holders', () => {
  it('puts a new user in their household and lists the household with one member', async () => {
    const families = await api().get(`/groups/${host.groupId}/families`).set('Authorization', host.authHeader)
    const household = families.body.find((f: any) => f.isOwnHousehold)
    expect(household.memberCount).toBe(1)
    const people = await api().get(`/groups/${host.groupId}/people`).set('Authorization', host.authHeader)
    expect(people.body).toEqual([expect.objectContaining({ name: 'Renny Saldanha', isAccountHolder: true, familyId: host.householdId })])
  })

  it("won't delete a person who signs in", async () => {
    const me = await db.person.findFirstOrThrow({ where: { groupId: host.groupId, userId: host.user.id } })
    expect((await api().delete(`/people/${me.id}`).set('Authorization', host.authHeader)).status).toBe(409)
  })
})

describe('bringing your data when you join a group', () => {
  let daycare: string
  let kid: string
  let gift: string
  let idea: string
  let hostChristmas: string
  let hostFriends: string

  beforeAll(async () => {
    const g = joiner.groupId
    daycare = (await db.family.create({ data: { groupId: g, name: 'Hugo toddler room', type: 'SCHOOL' } })).id
    await db.person.create({ data: { groupId: g, familyId: daycare, name: 'Ms Ana' } })
    kid = (await db.person.create({ data: { groupId: g, familyId: joiner.householdId, name: 'Hugo', birthMonth: 3, birthDay: 4 } })).id
    const me = await db.person.findFirstOrThrow({ where: { groupId: g, userId: joiner.user.id } })
    await db.person.update({ where: { id: me.id }, data: { likes: ['Coffee'] } })

    // Both groups track Christmas; the joiner's covers the daycare and their household.
    const christmas = await api().post(`/groups/${g}/occasions`).set('Authorization', joiner.authHeader).send({ groupWide: true, holidayKey: 'christmas' })
    expect(christmas.status).toBe(201)
    hostFriends = (await db.family.create({ data: { groupId: host.groupId, name: 'The Parks', type: 'FRIENDS' } })).id
    const hostXmas = await api().post(`/groups/${host.groupId}/occasions`).set('Authorization', host.authHeader).send({ groupWide: true, holidayKey: 'christmas' })
    hostChristmas = hostXmas.body.id
    // Easter only the joiner tracks; it should come to cover the host's own families too.
    expect((await api().post(`/groups/${g}/occasions`).set('Authorization', joiner.authHeader).send({ groupWide: true, holidayKey: 'easter' })).status).toBe(201)

    gift = (await db.giftEntry.create({
      data: { groupId: g, direction: 'GIVEN', title: 'Crayons', date: new Date('2026-11-01'), familyId: daycare, occasionId: christmas.body.id, createdById: joiner.user.id },
    })).id
    await db.giftEntry.create({ data: { groupId: g, direction: 'GIVEN', title: 'Truck', date: new Date('2026-03-04'), personId: kid, createdById: joiner.user.id } })
    await db.giftEntry.create({ data: { groupId: g, direction: 'RECEIVED', title: 'Mug', date: new Date('2026-06-01'), personId: me.id, createdById: joiner.user.id } })
    idea = (await db.idea.create({ data: { groupId: g, title: 'Puzzle', createdById: joiner.user.id, tags: { create: { personId: kid } } } })).id
  })

  it('says what would come along, and nothing for someone with no data', async () => {
    const t = await token()
    const res = await api().get(`/invites/${t}/movable`).set('Authorization', joiner.authHeader)
    expect(res.body.movable).toEqual({ groupId: joiner.groupId, groupName: "Sheldon's group", families: 1, people: 2, gifts: 3, ideas: 1, occasions: 2 })
    expect((await api().get(`/invites/${t}/movable`).set('Authorization', empty.authHeader)).body.movable).toBeNull()
    expect((await api().get(`/invites/${t}/movable`)).status).toBe(401)
  })

  it('moves everything into the joined group and removes the emptied one', async () => {
    const res = await api().post(`/invites/${await token()}/accept`).set('Authorization', joiner.authHeader).send({ bringData: true })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ groupId: host.groupId, alreadyMember: false, movedGroupId: joiner.groupId })

    expect(await db.group.findUnique({ where: { id: joiner.groupId } })).toBeNull()
    const me = await api().get('/me').set('Authorization', joiner.authHeader)
    expect(me.body.primaryGroupId).toBe(host.groupId)
    expect(me.body.memberships.map((m: any) => m.groupId)).toEqual([host.groupId])

    expect((await db.family.findUniqueOrThrow({ where: { id: daycare } })).groupId).toBe(host.groupId)
    const household = await db.person.findMany({ where: { familyId: host.householdId }, orderBy: { name: 'asc' } })
    expect(household.map((p) => [p.name, p.userId !== null])).toEqual([['Hugo', false], ['Renny Saldanha', true], ['Sheldon Miranda', true]])
    expect(household.find((p) => p.name === 'Sheldon Miranda')!.likes).toEqual(['Coffee'])

    const gifts = await db.giftEntry.findMany({ where: { groupId: host.groupId }, orderBy: { title: 'asc' } })
    expect(gifts.map((x) => x.title)).toEqual(['Crayons', 'Mug', 'Truck'])
    // The joiner's Christmas merged into the host's.
    expect(gifts.find((x) => x.id === gift)!.occasionId).toBe(hostChristmas)
    expect(await db.occasion.count({ where: { groupId: host.groupId, holidayKey: 'christmas' } })).toBe(1)
    const coverage = await db.occasionFamily.findMany({ where: { occasionId: hostChristmas } })
    expect(coverage.map((c) => c.familyId).sort()).toEqual([daycare, host.householdId, hostFriends].sort())
    const easter = await db.occasion.findFirstOrThrow({ where: { groupId: host.groupId, holidayKey: 'easter' }, include: { coverage: true } })
    expect(easter.coverage.map((c) => c.familyId).sort()).toEqual([daycare, host.householdId, hostFriends].sort())

    expect((await db.idea.findUniqueOrThrow({ where: { id: idea } })).groupId).toBe(host.groupId)
    expect((await db.person.findUniqueOrThrow({ where: { id: kid } })).groupId).toBe(host.groupId)
  })

  it('keeps your own group when you choose not to bring anything', async () => {
    await db.family.create({ data: { groupId: empty.groupId, name: 'Book club', type: 'FRIENDS' } })
    const res = await api().post(`/invites/${await token()}/accept`).set('Authorization', empty.authHeader).send({ bringData: false })
    expect(res.body.movedGroupId).toBeNull()
    expect(await db.family.count({ where: { groupId: empty.groupId } })).toBe(2)
    expect(await db.person.count({ where: { groupId: host.groupId, userId: empty.user.id, familyId: host.householdId } })).toBe(1)
  })
})
