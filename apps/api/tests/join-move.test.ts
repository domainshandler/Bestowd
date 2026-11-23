import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { createTestApp, createTestUser, cleanupUser } from './helpers.js'
import { db } from '../src/db.js'
import { normalName } from '../src/services/move.js'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance
type U = Awaited<ReturnType<typeof createTestUser>>
const users: U[] = []
const api = () => supertest(app.server)
const user = async (name: string) => { const u = await createTestUser(app, { name }); users.push(u); return u }
const as = (u: U) => ({
  get: (url: string) => api().get(url).set('Authorization', u.authHeader),
  post: (url: string, body: object = {}) => api().post(url).set('Authorization', u.authHeader).send(body),
})
const inviteToken = async (owner: U) => (await as(owner).post(`/groups/${owner.groupId}/invites`, { kind: 'GROUP' })).body.token as string

beforeAll(async () => { app = await createTestApp() })
afterAll(async () => {
  for (const u of users) await cleanupUser(u.user.id)
  await app.close()
})

describe('names that count as the same', () => {
  it('ignores case, accents, "the" and "family"', () => {
    expect(normalName('The Chen Family')).toBe('chen')
    expect(normalName('  chén ')).toBe('chen')
    expect(normalName('The Chens')).toBe('chen')
    expect(normalName("Renny's household")).toBe('renny s')
  })
})

describe('account holders', () => {
  it('puts a new user in their household and lists the household with one member', async () => {
    const u = await user('Renny Saldanha')
    const families = await as(u).get(`/groups/${u.groupId}/families`)
    expect(families.body.find((f: any) => f.isOwnHousehold).memberCount).toBe(1)
    const people = await as(u).get(`/groups/${u.groupId}/people`)
    expect(people.body).toEqual([expect.objectContaining({ name: 'Renny Saldanha', isAccountHolder: true, familyId: u.householdId })])
    const me = await db.person.findFirstOrThrow({ where: { groupId: u.groupId, userId: u.user.id } })
    expect((await api().delete(`/people/${me.id}`).set('Authorization', u.authHeader)).status).toBe(409)
  })
})

describe('bringing your things when you join', () => {
  let host: U, joiner: U
  const ids: Record<string, string> = {}

  beforeAll(async () => {
    host = await user('Renny Host')
    joiner = await user('Sheldon Joiner')
    const g = joiner.groupId

    // The host's group: Grandma (in the Mirandas), the Parks, and Christmas with a $50 budget.
    ids.hostMirandas = (await as(host).post(`/groups/${host.groupId}/families`, { name: 'Miranda family' })).body.id
    ids.hostGrandma = (await db.person.create({ data: { groupId: host.groupId, familyId: ids.hostMirandas, name: 'Grandma', likes: ['Tea'] } })).id
    ids.hostParks = (await as(host).post(`/groups/${host.groupId}/families`, { name: 'The Parks' })).body.id
    ids.hostXmas = (await as(host).post(`/groups/${host.groupId}/occasions`, { groupWide: true, holidayKey: 'christmas', budget: 50 })).body.id

    // The joiner's group.
    ids.mirandas = (await db.family.create({ data: { groupId: g, name: 'The Mirandas' } })).id
    ids.grandma = (await db.person.create({ data: { groupId: g, familyId: ids.mirandas, name: 'grandma', birthMonth: 5, birthDay: 1 } })).id
    ids.uncle = (await db.person.create({ data: { groupId: g, familyId: ids.mirandas, name: 'Uncle Joe' } })).id
    ids.daycare = (await db.family.create({ data: { groupId: g, name: 'Hugo toddler room', type: 'SCHOOL' } })).id
    ids.teacher = (await db.person.create({ data: { groupId: g, familyId: ids.daycare, name: 'Ms Ana' } })).id
    ids.book = (await db.family.create({ data: { groupId: g, name: 'Book club', type: 'FRIENDS' } })).id
    ids.kid = (await db.person.create({ data: { groupId: g, familyId: joiner.householdId, name: 'Hugo' } })).id
    ids.xmas = (await as(joiner).post(`/groups/${g}/occasions`, { groupWide: true, holidayKey: 'christmas', budget: 80 })).body.id
    ids.easter = (await as(joiner).post(`/groups/${g}/occasions`, { groupWide: true, holidayKey: 'easter' })).body.id

    const gift = (title: string, data: object) => db.giftEntry.create({ data: { groupId: g, direction: 'GIVEN', title, date: new Date('2026-11-01'), createdById: joiner.user.id, ...data } })
    ids.crayons = (await gift('Crayons', { familyId: ids.daycare, occasionId: ids.xmas })).id
    ids.scarf = (await gift('Scarf', { personId: ids.grandma, occasionId: ids.xmas })).id
    ids.truck = (await gift('Truck', { personId: ids.kid })).id
    ids.bookmark = (await gift('Bookmark', { familyId: ids.book, occasionId: ids.easter })).id
    ids.idea = (await db.idea.create({ data: { groupId: g, title: 'Puzzle', createdById: joiner.user.id, tags: { create: [{ personId: ids.kid }, { personId: ids.teacher }] } } })).id
  })

  it('lists what you could bring, and nothing for someone without their own things', async () => {
    const t = await inviteToken(host)
    const { movable } = (await as(joiner).get(`/invites/${t}/movable`)).body
    expect(movable.groupName).toBe("Sheldon's group")
    expect(movable.families.map((f: any) => [f.name, f.isOwnHousehold, f.people, f.gifts])).toEqual([
      ["Sheldon's household", true, 1, 1], ['Book club', false, 0, 1], ['Hugo toddler room', false, 1, 1], ['The Mirandas', false, 2, 1],
    ])
    expect(movable.occasions.map((o: any) => o.name)).toEqual(['Christmas', 'Easter'])
    expect(movable.ideas).toBe(1)
    const empty = await user('Emma Empty')
    expect((await as(empty).get(`/invites/${t}/movable`)).body.movable).toBeNull()
  })

  let requestId: string
  it('joins at once, and what you chose waits for the owner', async () => {
    const res = await as(joiner).post(`/invites/${await inviteToken(host)}/accept`, {
      bring: { familyIds: [joiner.householdId, ids.mirandas, ids.daycare], occasionIds: [ids.xmas], ideas: true },
    })
    expect(res.status).toBe(200)
    requestId = res.body.moveRequestId
    expect(requestId).toEqual(expect.any(String))
    // Nothing has moved yet.
    expect((await db.family.findUniqueOrThrow({ where: { id: ids.mirandas } })).groupId).toBe(joiner.groupId)

    const list = (await as(host).get(`/groups/${host.groupId}/move-requests`)).body
    expect(list).toEqual([expect.objectContaining({
      id: requestId, fromGroupName: "Sheldon's group", requestedBy: { userId: joiner.user.id, name: 'Sheldon Joiner' },
      counts: { families: 2, people: 4, gifts: 3, occasions: 1, ideas: 1 },
    })])
    // The joiner sees their own request; asking twice from the same group is refused.
    expect((await as(joiner).get(`/groups/${host.groupId}/move-requests`)).body).toHaveLength(1)
    expect((await as(joiner).post(`/groups/${host.groupId}/move-requests`, { familyIds: [ids.book], occasionIds: [], ideas: false })).status).toBe(409)
  })

  it('shows the owner the look-alikes and the budget to choose', async () => {
    const res = await as(host).get(`/move-requests/${requestId}`)
    expect(res.body.canDecide).toBe(true)
    const review = res.body.review
    expect(review.currency).toBeNull()
    expect(review.families.map((f: any) => [f.name, f.match?.name ?? null])).toEqual([
      ["Sheldon's household", null], ['Hugo toddler room', null], ['The Mirandas', 'Miranda family'],
    ])
    expect(review.people).toEqual([expect.objectContaining({ id: ids.grandma, name: 'grandma', match: { id: ids.hostGrandma, name: 'Grandma' } })])
    expect(review.occasions).toEqual([expect.objectContaining({ id: ids.xmas, match: { id: ids.hostXmas, name: 'Christmas' }, budgetDiffers: true, theirBudget: 80, ourBudget: 50 })])
    expect(review.ideas).toBe(1)
    // Only the owner decides.
    expect((await as(joiner).get(`/move-requests/${requestId}`)).body.canDecide).toBe(false)
    expect((await as(joiner).post(`/move-requests/${requestId}/approve`, { familyIds: [], occasionIds: [], ideas: false })).status).toBe(403)
  })

  it('applies the owner’s choices', async () => {
    const res = await as(host).post(`/move-requests/${requestId}/approve`, {
      familyIds: [joiner.householdId, ids.mirandas, ids.daycare, ids.book], // Book club wasn't asked for: ignored
      occasionIds: [ids.xmas], ideas: true,
      keepBothFamilies: [], keepBothPeople: [], useTheirBudget: [ids.xmas],
    })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'APPROVED', sourceRemoved: false })

    // The Mirandas merged into the host's: one Grandma with both details, Uncle Joe came along.
    expect(await db.family.findUnique({ where: { id: ids.mirandas } })).toBeNull()
    const mirandas = await db.person.findMany({ where: { familyId: ids.hostMirandas }, orderBy: { name: 'asc' } })
    expect(mirandas.map((p) => p.name)).toEqual(['Grandma', 'Uncle Joe'])
    expect(mirandas[0]).toMatchObject({ likes: ['Tea'], birthMonth: 5, birthDay: 1 })
    expect((await db.giftEntry.findUniqueOrThrow({ where: { id: ids.scarf } })).personId).toBe(ids.hostGrandma)

    // The daycare moved as is, and Hugo joined the host's household.
    expect((await db.family.findUniqueOrThrow({ where: { id: ids.daycare } })).groupId).toBe(host.groupId)
    expect((await db.person.findUniqueOrThrow({ where: { id: ids.kid } })).familyId).toBe(host.householdId)

    // One Christmas, with the joiner's budget, covering the host's families and the ones that came.
    const xmas = await db.occasion.findUniqueOrThrow({ where: { id: ids.hostXmas }, include: { coverage: true } })
    expect(Number(xmas.budget)).toBe(80)
    expect(xmas.coverage.map((c) => c.familyId).sort()).toEqual([host.householdId, ids.hostMirandas, ids.hostParks, ids.daycare].sort())
    expect(await db.occasion.findUnique({ where: { id: ids.xmas } })).toBeNull()
    expect((await db.giftEntry.findUniqueOrThrow({ where: { id: ids.crayons } })).occasionId).toBe(ids.hostXmas)

    // The idea came; its tags still point at people in the group.
    const idea = await db.idea.findUniqueOrThrow({ where: { id: ids.idea }, include: { tags: true } })
    expect(idea.groupId).toBe(host.groupId)
    expect(idea.tags.map((t) => t.personId).sort()).toEqual([ids.kid, ids.teacher].sort())

    // What wasn't chosen stays in the joiner's group: Book club, its gift and Easter.
    expect((await db.family.findUniqueOrThrow({ where: { id: ids.book } })).groupId).toBe(joiner.groupId)
    expect((await db.giftEntry.findUniqueOrThrow({ where: { id: ids.bookmark } })).groupId).toBe(joiner.groupId)
    expect((await db.occasion.findUniqueOrThrow({ where: { id: ids.easter } })).groupId).toBe(joiner.groupId)
    expect((await as(host).post(`/move-requests/${requestId}/approve`, { familyIds: [], occasionIds: [], ideas: false })).status).toBe(409)
  })

  it('brings the rest later, keeping a look-alike separate, and removes the emptied group', async () => {
    await db.family.update({ where: { id: ids.book }, data: { name: 'The Parks' } })
    const created = await as(joiner).post(`/groups/${host.groupId}/move-requests`, { familyIds: [ids.book], occasionIds: [ids.easter], ideas: false })
    expect(created.status).toBe(201)
    const review = (await as(host).get(`/move-requests/${created.body.id}`)).body.review
    expect(review.families[0].match).toEqual({ id: ids.hostParks, name: 'The Parks' })

    const res = await as(host).post(`/move-requests/${created.body.id}/approve`, {
      familyIds: [ids.book], occasionIds: [ids.easter], ideas: false, keepBothFamilies: [ids.book],
    })
    expect(res.body.sourceRemoved).toBe(true)
    expect(await db.group.findUnique({ where: { id: joiner.groupId } })).toBeNull()
    expect(await db.family.count({ where: { groupId: host.groupId, name: 'The Parks' } })).toBe(2)
    const me = (await as(joiner).get('/me')).body
    expect(me.primaryGroupId).toBe(host.groupId)
    expect(me.memberships.map((m: any) => m.groupId)).toEqual([host.groupId])
  })
})

describe('declining and cancelling', () => {
  it('leaves everything where it was', async () => {
    const host = await user('Hana Host')
    const joiner = await user('Jo Joiner')
    const fam = (await db.family.create({ data: { groupId: joiner.groupId, name: 'Neighbours' } })).id
    const bring = { familyIds: [fam], occasionIds: [], ideas: false }
    const r1 = (await as(joiner).post(`/invites/${await inviteToken(host)}/accept`, { bring })).body.moveRequestId
    expect((await as(host).post(`/move-requests/${r1}/decline`)).body.status).toBe('DECLINED')
    expect((await db.family.findUniqueOrThrow({ where: { id: fam } })).groupId).toBe(joiner.groupId)

    const r2 = (await as(joiner).post(`/groups/${host.groupId}/move-requests`, bring)).body.id
    expect((await as(host).post(`/move-requests/${r2}/cancel`)).status).toBe(403)
    expect((await as(joiner).post(`/move-requests/${r2}/cancel`)).body.status).toBe('CANCELLED')
    expect((await as(host).get(`/groups/${host.groupId}/move-requests`)).body).toEqual([])
  })
})

describe('leaving a group', () => {
  let owner: U, member: U
  beforeAll(async () => {
    owner = await user('Olive Owner')
    member = await user('Mo Member')
    await as(member).post(`/invites/${await inviteToken(owner)}/accept`)
  })

  it('keeps a leaving member as a plain person and opens to their own group', async () => {
    const res = await as(member).post(`/groups/${owner.groupId}/leave`)
    expect(res.status).toBe(200)
    expect(res.body.primaryGroupId).toBe(member.groupId)
    const left = await db.person.findFirstOrThrow({ where: { groupId: owner.groupId, name: 'Mo Member' } })
    expect(left.userId).toBeNull()
    expect((await as(member).get(`/groups/${owner.groupId}`)).status).toBe(404)

    // Coming back reclaims the same household entry.
    await as(member).post(`/invites/${await inviteToken(owner)}/accept`)
    expect((await db.person.findUniqueOrThrow({ where: { id: left.id } })).userId).toBe(member.user.id)
    expect(await db.person.count({ where: { groupId: owner.groupId, name: 'Mo Member' } })).toBe(1)
  })

  it('makes an owner hand the group over first', async () => {
    expect((await as(owner).post(`/groups/${owner.groupId}/leave`)).status).toBe(409)
    const res = await as(owner).post(`/groups/${owner.groupId}/leave`, { newOwnerId: member.user.id })
    expect(res.status).toBe(200)
    const group = (await as(member).get(`/groups/${owner.groupId}`)).body
    expect(group.members).toEqual([expect.objectContaining({ userId: member.user.id, role: 'OWNER' })])
    // The owner had no other group, so they get a fresh one.
    const me = (await as(owner).get('/me')).body
    expect(me.memberships).toEqual([expect.objectContaining({ groupId: res.body.primaryGroupId, role: 'OWNER' })])
    expect(res.body.primaryGroupId).not.toBe(owner.groupId)
  })

  it('deletes a group its only member leaves, once confirmed', async () => {
    const solo = await user('Sol Solo')
    expect((await as(solo).post(`/groups/${solo.groupId}/leave`)).status).toBe(409)
    const res = await as(solo).post(`/groups/${solo.groupId}/leave`, { deleteGroup: true })
    expect(res.status).toBe(200)
    expect(await db.group.findUnique({ where: { id: solo.groupId } })).toBeNull()
    expect(res.body.primaryGroupId).not.toBe(solo.groupId)
  })
})

describe('starting a new group', () => {
  it('creates an empty group with your household and opens to it', async () => {
    const u = await user('Nina New')
    const res = await as(u).post('/groups', { name: 'Fresh start' })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ name: 'Fresh start', members: [expect.objectContaining({ userId: u.user.id, role: 'OWNER' })] })
    expect((await as(u).get('/me')).body.primaryGroupId).toBe(res.body.id)
    const people = (await as(u).get(`/groups/${res.body.id}/people`)).body
    expect(people).toEqual([expect.objectContaining({ name: 'Nina New', isAccountHolder: true })])
  })
})
