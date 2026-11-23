import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { buildApp } from '../src/app.js'
import { conflict } from '../src/http-error.js'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance

beforeAll(async () => {
  app = await buildApp()
  app.get('/test-http-error', async () => {
    throw conflict('Already connected')
  })
  app.get('/test-crash', async () => {
    throw new Error('secret detail')
  })
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

describe('error handler', () => {
  it('sends HttpError status with an { error } body', async () => {
    const res = await supertest(app.server).get('/test-http-error')
    expect(res.status).toBe(409)
    expect(res.body).toEqual({ error: 'Already connected' })
  })

  it('sends validation failures as 400 with an { error } body', async () => {
    const res = await supertest(app.server).post('/auth/google').send({})
    expect(res.status).toBe(400)
    expect(typeof res.body.error).toBe('string')
  })

  it('hides the message of unexpected errors', async () => {
    const res = await supertest(app.server).get('/test-crash')
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: 'Internal Server Error' })
  })
})
