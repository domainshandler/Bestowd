import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestApp, createTestUser, cleanupUser } from './helpers.js'
import { db } from '../src/db.js'
import { provisionPersonalGroup, firstName } from '../src/services/groups.js'
import { googleAudiences, verifyGoogleToken } from '../src/services/google-auth.js'
import { assertSubject, assertInGroup, requireMember, requireOwner, loadOr404 } from '../src/services/access.js'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance
let a: Awaited<ReturnType<typeof createTestUser>>
let b: Awaited<ReturnType<typeof createTestUser>>
let personA: string
let personB: string

beforeAll(async () => {
  app = await createTestApp()
  a = await createTestUser(app)
  b = await createTestUser(app)
  personA = (await db.person.create({ data: { groupId: a.groupId, familyId: a.householdId, name: 'Mia' } })).id
  personB = (await db.person.create({ data: { groupId: b.groupId, familyId: b.householdId, name: 'Leo' } })).id
})

afterAll(async () => {
  await cleanupUser(a.user.id)
  await cleanupUser(b.user.id)
  await app.close()
})

describe('firstName', () => {
  it('takes the first word, or "My" for a blank name', () => {
    expect(firstName('  Alice  Smith ')).toBe('Alice')
    expect(firstName('   ')).toBe('My')
  })
})

describe('provisionPersonalGroup', () => {
  it('creates exactly one group when called in parallel', async () => {
    const user = await db.user.create({ data: { email: `race-${Date.now()}@example.com`, name: 'Race' } })
    const ids = await Promise.all([provisionPersonalGroup(user), provisionPersonalGroup(user), provisionPersonalGroup(user)])
    expect(new Set(ids).size).toBe(1)
    expect(await db.groupMembership.count({ where: { userId: user.id } })).toBe(1)
    expect(await db.group.count({ where: { name: "Race's group" } })).toBe(1)
    await cleanupUser(user.id)
  })
})

describe('requireMember / requireOwner / loadOr404', () => {
  it('returns the role for members and 404 for non-members', async () => {
    expect(await requireMember(a.user.id, a.groupId)).toBe('OWNER')
    await expect(requireMember(a.user.id, b.groupId)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('gives 403 to a member who is not OWNER', async () => {
    await db.groupMembership.create({ data: { groupId: b.groupId, userId: a.user.id, role: 'MEMBER' } })
    await expect(requireOwner(a.user.id, b.groupId)).rejects.toMatchObject({ statusCode: 403 })
    await db.groupMembership.delete({ where: { groupId_userId: { groupId: b.groupId, userId: a.user.id } } })
  })

  it('404s a missing row or a row in another group', async () => {
    await expect(loadOr404(a.user.id, null)).rejects.toMatchObject({ statusCode: 404 })
    const other = await db.person.findUnique({ where: { id: personB } })
    await expect(loadOr404(a.user.id, other)).rejects.toMatchObject({ statusCode: 404 })
    const own = await db.person.findUnique({ where: { id: personA } })
    await expect(loadOr404(a.user.id, own)).resolves.toMatchObject({ id: personA })
  })
})

describe('assertSubject', () => {
  it('requires exactly one of personId or familyId', async () => {
    await expect(assertSubject(a.groupId, {})).rejects.toMatchObject({ statusCode: 400 })
    await expect(assertSubject(a.groupId, { personId: personA, familyId: a.householdId })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejects a person or family from another group', async () => {
    await expect(assertSubject(a.groupId, { personId: personB })).rejects.toMatchObject({ statusCode: 400 })
    await expect(assertSubject(a.groupId, { familyId: b.householdId })).rejects.toMatchObject({ statusCode: 400 })
    await expect(assertSubject(a.groupId, { personId: 'no-such-id' })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('accepts a person or family in the same group', async () => {
    await expect(assertSubject(a.groupId, { personId: personA })).resolves.toBeUndefined()
    await expect(assertSubject(a.groupId, { familyId: a.householdId })).resolves.toBeUndefined()
  })
})

describe('assertInGroup', () => {
  it('passes for ids in the group (duplicates allowed) and an empty list', async () => {
    await expect(assertInGroup('person', a.groupId, [personA, personA])).resolves.toBeUndefined()
    await expect(assertInGroup('person', a.groupId, [])).resolves.toBeUndefined()
  })

  it('rejects any id outside the group', async () => {
    await expect(assertInGroup('person', a.groupId, [personA, personB])).rejects.toMatchObject({ statusCode: 400 })
  })
})

describe('Google sign-in', () => {
  it('accepts the web client ID plus any extra mobile client IDs', () => {
    expect(googleAudiences('web.apps', undefined)).toEqual(['web.apps'])
    expect(googleAudiences('web.apps', ' android.apps, ios.apps,,web.apps ')).toEqual(['web.apps', 'android.apps', 'ios.apps'])
  })

  it('answers 401 for a token that does not verify', async () => {
    await expect(verifyGoogleToken('not-a-real-token')).rejects.toMatchObject({ statusCode: 401 })
  })
})
