import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { createTestApp, createTestUser, cleanupUser } from './helpers.js'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance
let a: Awaited<ReturnType<typeof createTestUser>>
let b: Awaited<ReturnType<typeof createTestUser>>
const api = () => supertest(app.server)
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)])

beforeAll(async () => {
  app = await createTestApp()
  a = await createTestUser(app, { name: 'Ana' })
  b = await createTestUser(app, { name: 'Ben' })
})
afterAll(async () => {
  await cleanupUser(a.user.id)
  await cleanupUser(b.user.id)
  await app.close()
})

describe('photos', () => {
  it('stores a photo and serves it only with its signed link', async () => {
    const res = await api()
      .post(`/groups/${a.groupId}/photos`)
      .set('Authorization', a.authHeader)
      .set('Content-Type', 'image/jpeg')
      .send(jpeg)
    expect(res.status).toBe(201)
    expect(res.body.url).toMatch(new RegExp(`^/files/${a.groupId}/[0-9a-f-]{36}\\.jpg\\?sig=`))

    const got = await api().get(res.body.url).buffer(true)
    expect(got.status).toBe(200)
    expect(got.headers['content-type']).toBe('image/jpeg')
    expect(Buffer.compare(got.body as Buffer, jpeg)).toBe(0)

    const [bare] = res.body.url.split('?')
    expect((await api().get(bare)).status).toBe(404)
    expect((await api().get(`${bare}?sig=wrong`)).status).toBe(404)
  })

  it('refuses non-members, files that are not images, and the wrong type', async () => {
    expect(
      (await api().post(`/groups/${a.groupId}/photos`).set('Authorization', b.authHeader).set('Content-Type', 'image/jpeg').send(jpeg))
        .status,
    ).toBe(404)
    expect(
      (await api().post(`/groups/${a.groupId}/photos`).set('Authorization', a.authHeader).set('Content-Type', 'image/png').send(jpeg))
        .status,
    ).toBe(400)
    expect(
      (await api().post(`/groups/${a.groupId}/photos`).set('Authorization', a.authHeader).set('Content-Type', 'text/plain').send('hello'))
        .status,
    ).toBe(400)
  })

  it('lets an idea use an uploaded photo', async () => {
    const up = await api()
      .post(`/groups/${a.groupId}/photos`)
      .set('Authorization', a.authHeader)
      .set('Content-Type', 'image/jpeg')
      .send(jpeg)
    const idea = await api()
      .post(`/groups/${a.groupId}/ideas`)
      .set('Authorization', a.authHeader)
      .send({ title: 'Lamp', imageUrl: up.body.url })
    expect(idea.status).toBe(201)
    expect(idea.body.imageUrl).toBe(up.body.url)
  })
})
