import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { createTestApp, createTestUser, cleanupUser } from './helpers.js'
import { db } from '../src/db.js'
import { clearPopularCache, wordStarts } from '../src/suggest/suggest.js'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance
const users: Awaited<ReturnType<typeof createTestUser>>[] = []
const api = () => supertest(app.server)

beforeAll(async () => {
  app = await createTestApp()
  for (let i = 0; i < 6; i++) users.push(await createTestUser(app, { name: `Suggest ${i}` }))
  const [me] = users
  const fam = (await db.family.create({ data: { groupId: me!.groupId, name: 'Smiths' } })).id
  const gift = (brand: string, groupId = me!.groupId, familyId = fam, by = me!.user.id) =>
    db.giftEntry.create({ data: { groupId, familyId, direction: 'GIVEN', title: 'Thing', brand, date: new Date(), createdById: by } })
  await gift('Garmin'); await gift('garmin'); await gift('Gap')
  await db.idea.create({ data: { groupId: me!.groupId, title: 'Zygote Zebra plush', brand: 'Gazzle', createdById: me!.user.id } })
  // "Galaxy Toyz" is logged by 5 other groups: popular. "Gamma Goods" by 4: not.
  for (const [i, u] of users.slice(1).entries()) {
    const f = (await db.family.create({ data: { groupId: u.groupId, name: 'F' } })).id
    await gift('Galaxy Toyz', u.groupId, f, u.user.id)
    if (i < 4) await gift('Gamma Goods', u.groupId, f, u.user.id)
  }
  clearPopularCache()
})
afterAll(async () => {
  for (const u of users) await cleanupUser(u.user.id)
  await app.close()
})

const get = (field: string, q: string, u = users[0]!) =>
  api().get(`/groups/${u.groupId}/suggest?field=${field}&q=${encodeURIComponent(q)}`).set('Authorization', u.authHeader)

describe('autofill suggestions', () => {
  it('matches the start of any word, ignoring case and accents', () => {
    expect(wordStarts('The North Face', 'nor')).toBe(true)
    expect(wordStarts('Pokémon', 'poke')).toBe(true)
    expect(wordStarts('Garmin', 'arm')).toBe(false)
  })

  it('offers your own values first, then popular ones, then common ones, without repeats', async () => {
    const res = await get('brand', 'ga')
    expect(res.status).toBe(200)
    const s = res.body.suggestions as { value: string; source: string }[]
    expect(s.slice(0, 3)).toEqual([
      // Most used first, then most recent.
      { value: 'Garmin', source: 'yours' }, { value: 'Gazzle', source: 'yours' }, { value: 'Gap', source: 'yours' },
    ])
    expect(s).toContainEqual({ value: 'Galaxy Toyz', source: 'popular' })
    expect(s.map((x) => x.value)).not.toContain('Gamma Goods')
    expect(s.filter((x) => x.value.toLowerCase() === 'garmin')).toHaveLength(1)
    expect(s.length).toBeLessThanOrEqual(8)
  })

  it('searches idea and gift titles, falls back to common lists, and stays within the group', async () => {
    expect((await get('title', 'zebra')).body.suggestions).toEqual([{ value: 'Zygote Zebra plush', source: 'yours' }])
    expect((await get('store', 'best')).body.suggestions).toEqual([{ value: 'Best Buy', source: 'common' }])
    // Another group doesn't see the first group's own brand (it's not popular).
    expect((await get('brand', 'gazz', users[1])).body.suggestions).toEqual([])
    expect((await get('brand', '', users[0])).body.suggestions).toEqual([])
    expect((await api().get(`/groups/${users[0]!.groupId}/suggest?field=brand&q=ga`).set('Authorization', users[1]!.authHeader)).status).toBe(404)
    expect((await get('colour', 'r')).status).toBe(400)
  })
})
