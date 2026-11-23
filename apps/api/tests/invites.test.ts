import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { createTestApp, createTestUser, cleanupUser } from './helpers.js'
import { db } from '../src/db.js'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance
let a: Awaited<ReturnType<typeof createTestUser>>  // inviter
let b: Awaited<ReturnType<typeof createTestUser>>  // the Chens, accepting
let c: Awaited<ReturnType<typeof createTestUser>>  // outsider
let chenInA: string

beforeAll(async () => {
  app = await createTestApp()
  a = await createTestUser(app, { name: 'Alice' })
  b = await createTestUser(app, { name: 'Wei Chen' })
  c = await createTestUser(app, { name: 'Carol' })
  chenInA = (await db.family.create({ data: { groupId: a.groupId, name: 'Chen family' } })).id
  await db.person.create({
    data: { groupId: b.groupId, familyId: b.householdId, name: 'Lily', birthYear: 2018, birthMonth: 5, birthDay: 2, likes: ['Dinosaurs'], avoid: ['Glitter'], foodNotes: 'Vegetarian' },
  })
})

afterAll(async () => {
  for (const u of [a, b, c]) await cleanupUser(u.user.id)
  await app.close()
})

const api = () => supertest(app.server)
const invite = (user: typeof a, groupId: string, body: object) =>
  api().post(`/groups/${groupId}/invites`).set('Authorization', user.authHeader).send(body)
const accept = (user: typeof a, token: string, body: object = {}) =>
  api().post(`/invites/${token}/accept`).set('Authorization', user.authHeader).send(body)

describe('family invites and connections', () => {
  let token: string
  let connectionId: string

  it('creates a link and shows a public preview', async () => {
    const res = await invite(a, a.groupId, { kind: 'FAMILY', familyId: chenInA })
    expect(res.status).toBe(201)
    expect(res.body.url).toMatch(new RegExp(`/join/${res.body.token}$`))
    token = res.body.token

    const preview = await api().get(`/invites/${token}`)
    expect(preview.status).toBe(200)
    expect(preview.body).toMatchObject({ kind: 'FAMILY', inviterName: 'Alice', groupName: "Alice's group", familyName: 'Chen family' })
  })

  it('rejects unknown share fields and families the acceptor is not in', async () => {
    expect((await accept(b, token, { sourceFamilyId: b.householdId, sharedFields: ['email'] })).status).toBe(400)
    expect((await accept(b, token, { sourceFamilyId: chenInA })).status).toBe(400)
    expect((await accept(b, token, {})).status).toBe(400)
  })

  it('connects on accept and shows only the shared fields', async () => {
    const res = await accept(b, token, { sourceFamilyId: b.householdId, sharedFields: ['likes'] })
    expect(res.status).toBe(200)
    connectionId = res.body.connectionId

    const profile = await api().get(`/families/${chenInA}`).set('Authorization', a.authHeader)
    expect(profile.body.connection).toMatchObject({ id: connectionId, sourceFamilyName: "Wei's household", sharedFields: ['likes'] })
    expect(profile.body.connection.people).toEqual([{ id: expect.any(String), name: 'Wei Chen', likes: [] }, { id: expect.any(String), name: 'Lily', likes: ['Dinosaurs'] }])

    const list = await api().get(`/groups/${a.groupId}/families`).set('Authorization', a.authHeader)
    expect(list.body.find((f: any) => f.id === chenInA).onBestowd).toBe(true)
  })

  it('treats a used link as gone and refuses a second invite for a connected family', async () => {
    expect((await accept(b, token, { sourceFamilyId: b.householdId })).status).toBe(410)
    expect((await api().get(`/invites/${token}`)).status).toBe(410)
    expect((await invite(a, a.groupId, { kind: 'FAMILY', familyId: chenInA })).status).toBe(409)
  })

  it('lets either side revoke, but not an outsider', async () => {
    expect((await api().delete(`/family-connections/${connectionId}`).set('Authorization', c.authHeader)).status).toBe(404)
    expect((await api().delete(`/family-connections/${connectionId}`).set('Authorization', b.authHeader)).status).toBe(204)
    const profile = await api().get(`/families/${chenInA}`).set('Authorization', a.authHeader)
    expect(profile.body.connection).toBeNull()
  })

  it('defaults to sharing birthday, likes and avoid', async () => {
    const res = await invite(a, a.groupId, { kind: 'FAMILY', familyId: chenInA })
    await accept(b, res.body.token, { sourceFamilyId: b.householdId })
    const profile = await api().get(`/families/${chenInA}`).set('Authorization', a.authHeader)
    expect(profile.body.connection.people.find((p: any) => p.name === 'Lily')).toEqual({
      id: expect.any(String), name: 'Lily', birthMonth: 5, birthDay: 2, birthYear: 2018, likes: ['Dinosaurs'], avoid: ['Glitter'],
    })
  })
})

describe('invite rules', () => {
  it('expires links', async () => {
    const fam = await db.family.create({ data: { groupId: a.groupId, name: 'Expired family' } })
    const res = await invite(a, a.groupId, { kind: 'FAMILY', familyId: fam.id })
    await db.inviteLink.update({ where: { token: res.body.token }, data: { expiresAt: new Date(Date.now() - 1000) } })
    expect((await api().get(`/invites/${res.body.token}`)).status).toBe(410)
    expect((await accept(b, res.body.token, { sourceFamilyId: b.householdId })).status).toBe(410)
  })

  it("refuses the own household, other groups' families, unknown tokens and non-members", async () => {
    expect((await invite(a, a.groupId, { kind: 'FAMILY', familyId: a.householdId })).status).toBe(400)
    expect((await invite(a, a.groupId, { kind: 'FAMILY', familyId: b.householdId })).status).toBe(400)
    expect((await invite(a, a.groupId, { kind: 'FAMILY' })).status).toBe(400)
    expect((await invite(c, a.groupId, { kind: 'GROUP' })).status).toBe(404)
    expect((await api().get('/invites/not-a-token')).status).toBe(404)
  })

  it('cannot connect two families in the same group', async () => {
    const fam = await db.family.create({ data: { groupId: a.groupId, name: 'Same group' } })
    const res = await invite(a, a.groupId, { kind: 'FAMILY', familyId: fam.id })
    expect((await accept(a, res.body.token, { sourceFamilyId: a.householdId })).status).toBe(400)
  })
})

describe('group invites', () => {
  it('adds the acceptor as a MEMBER, in the household, and opens to the joined group', async () => {
    const res = await invite(a, a.groupId, { kind: 'GROUP' })
    expect(res.status).toBe(201)
    const preview = await api().get(`/invites/${res.body.token}`)
    expect(preview.body).toMatchObject({ kind: 'GROUP', familyName: null })

    const joined = await accept(c, res.body.token) // no body
    expect(joined.status).toBe(200)
    expect(joined.body).toEqual({ groupId: a.groupId, alreadyMember: false, movedGroupId: null })

    const me = await api().get('/me').set('Authorization', c.authHeader)
    expect(me.body.primaryGroupId).toBe(a.groupId)
    expect(me.body.memberships.map((m: any) => [m.groupId, m.role])).toEqual([[a.groupId, 'MEMBER'], [c.groupId, 'OWNER']])

    const people = await api().get(`/groups/${a.groupId}/people`).set('Authorization', c.authHeader)
    const holders = people.body.filter((p: any) => p.isAccountHolder).map((p: any) => [p.name, p.familyId])
    expect(holders).toEqual(expect.arrayContaining([['Alice', a.householdId], ['Carol', a.householdId]]))
  })

  it("reports an existing member without using up the link", async () => {
    const res = await invite(a, a.groupId, { kind: 'GROUP' })
    expect((await accept(a, res.body.token)).body).toEqual({ groupId: a.groupId, alreadyMember: true })
    expect((await api().get(`/invites/${res.body.token}`)).status).toBe(200)
  })

  it('rejects a family id on a group invite', async () => {
    expect((await invite(a, a.groupId, { kind: 'GROUP', familyId: chenInA })).status).toBe(400)
  })
})
