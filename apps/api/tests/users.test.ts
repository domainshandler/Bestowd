import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { createTestApp, createTestUser } from './helpers.js'
import { db } from '../src/db.js'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance
let authHeader: string
let userId: string

beforeAll(async () => {
  app = await createTestApp()
  const result = await createTestUser(app)
  authHeader = result.authHeader
  userId = result.user.id
})

afterAll(async () => {
  await db.user.delete({ where: { id: userId } })
  await app.close()
})

describe('PATCH /users/me', () => {
  it('updates user name', async () => {
    const res = await supertest(app.server)
      .patch('/users/me')
      .set('Authorization', authHeader)
      .send({ name: 'Updated Name' })

    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Updated Name')
  })

  it('stores aiProviderConfig encrypted and does not return the raw apiKey', async () => {
    const res = await supertest(app.server)
      .patch('/users/me')
      .set('Authorization', authHeader)
      .send({ aiProviderConfig: { provider: 'openai', apiKey: 'sk-secret', model: 'gpt-4o' } })

    expect(res.status).toBe(200)
    // aiProviderConfig is not returned in user DTO
    expect(res.body.aiProviderConfig).toBeUndefined()

    // Verify it was encrypted in DB
    const dbUser = await db.user.findUnique({ where: { id: userId } })
    expect(dbUser?.aiProviderConfig).not.toBe('sk-secret')
    expect(dbUser?.aiProviderConfig).toContain(':') // AES format: iv:cipher
  })
})
