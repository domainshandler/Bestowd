import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { buildApp } from '../src/app.js'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance

beforeAll(async () => {
  app = await buildApp()
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await supertest(app.server).get('/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })
})
