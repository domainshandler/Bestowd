import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import supertest from 'supertest'
import { createTestApp, createTestUser, cleanupUser } from './helpers.js'
import { db } from '../src/db.js'
import { isPrivateAddress, readProductPage } from '../src/capture/link.js'
import { readProductPhoto } from '../src/capture/ai.js'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance
let owner: Awaited<ReturnType<typeof createTestUser>>
let member: Awaited<ReturnType<typeof createTestUser>>
const api = () => supertest(app.server)
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100, 1)])
const realFetch = globalThis.fetch

beforeAll(async () => {
  app = await createTestApp()
  owner = await createTestUser(app, { name: 'Olga Owner' })
  member = await createTestUser(app, { name: 'Max Member' })
  const t = (await api().post(`/groups/${owner.groupId}/invites`).set('Authorization', owner.authHeader).send({ kind: 'GROUP' })).body.token
  await api().post(`/invites/${t}/accept`).set('Authorization', member.authHeader).send({})
})
afterAll(async () => {
  await cleanupUser(member.user.id)
  await cleanupUser(owner.user.id)
  await app.close()
})
afterEach(() => {
  globalThis.fetch = realFetch
})

describe('reading a store page', () => {
  it('uses the schema.org product data', () => {
    const html = `<html><head><title>Ignore me</title><meta property="og:site_name" content="Best Buy">
      <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"BreadcrumbList"},
      {"@type":"Product","name":"Forerunner 165 Smartwatch","brand":{"@type":"Brand","name":"Garmin"},"image":["https://cdn.example/w.jpg"],
       "offers":{"@type":"Offer","price":"329.99","priceCurrency":"CAD"}}]}</script></head></html>`
    expect(readProductPage(html, 'https://www.bestbuy.ca/item/1')).toEqual({
      title: 'Forerunner 165 Smartwatch',
      brand: 'Garmin',
      price: 329.99,
      currency: 'CAD',
      store: 'Best Buy',
      url: 'https://www.bestbuy.ca/item/1',
      imageUrl: 'https://cdn.example/w.jpg',
    })
  })

  it('falls back to Open Graph tags and the site name', () => {
    const html = `<meta property="og:title" content="Wooden Rainbow Stacker &amp; Blocks"><meta property="og:image" content="https://shop.example/r.png">
      <meta property="product:price:amount" content="45.00"><meta property="product:price:currency" content="usd">`
    expect(readProductPage(html, 'https://www.shop.example/p')).toMatchObject({
      title: 'Wooden Rainbow Stacker & Blocks',
      price: 45,
      currency: 'USD',
      store: 'shop.example',
      imageUrl: 'https://shop.example/r.png',
      brand: null,
    })
  })

  it('never fetches private or local addresses', async () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.1.103', '172.20.0.1', '169.254.169.254', '::1', '::ffff:127.0.0.1', 'fd00::1'])
      expect(isPrivateAddress(ip)).toBe(true)
    for (const ip of ['8.8.8.8', '172.32.0.1', '2606:4700::1']) expect(isPrivateAddress(ip)).toBe(false)
    const res = await api()
      .post(`/groups/${owner.groupId}/capture/link`)
      .set('Authorization', owner.authHeader)
      .send({ url: 'http://127.0.0.1:3000/health' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe("That link isn't a public website")
  })
})

describe('AI settings', () => {
  it('lets only the owner set the key, and never shows it', async () => {
    const put = (u: typeof owner, body: object) => api().put(`/groups/${owner.groupId}/ai`).set('Authorization', u.authHeader).send(body)
    expect((await put(member, { provider: 'anthropic', apiKey: 'sk-ant-secret-1234' })).status).toBe(403)
    expect((await put(owner, { provider: 'anthropic' })).status).toBe(400) // no key yet
    expect((await put(owner, { provider: 'openai', apiKey: 'sk-openai' })).status).toBe(400) // OpenAI needs a model

    const res = await put(owner, { provider: 'anthropic', apiKey: 'sk-ant-secret-1234' })
    expect(res.body).toEqual({ provider: 'anthropic', model: null, defaultModel: 'claude-opus-5-5', keyHint: '1234', configured: true })
    expect(JSON.stringify((await api().get(`/groups/${owner.groupId}/ai`).set('Authorization', member.authHeader)).body)).not.toContain(
      'secret',
    )
    const stored = await db.group.findUniqueOrThrow({ where: { id: owner.groupId } })
    expect(stored.aiKeyEnc).not.toContain('secret')

    // Changing the model keeps the saved key.
    expect((await put(owner, { provider: 'anthropic', model: 'claude-haiku-5-5' })).body).toMatchObject({
      model: 'claude-haiku-5-5',
      keyHint: '1234',
    })
  })
})

describe('reading a photo', () => {
  it('sends the photo to Claude with structured output and returns a draft', async () => {
    const calls: { url: string; headers: Headers; body: any }[] = []
    globalThis.fetch = vi.fn(async (input: any, init?: any) => {
      const url = String(input instanceof Request ? input.url : input)
      if (!url.startsWith('https://api.anthropic.com')) return realFetch(input, init)
      const req = new Request(input, init)
      calls.push({ url, headers: req.headers, body: JSON.parse(await req.text()) })
      return new Response(
        JSON.stringify({
          id: 'msg_1',
          type: 'message',
          role: 'assistant',
          model: 'claude-opus-5-5',
          stop_reason: 'end_turn',
          stop_sequence: null,
          content: [{ type: 'text', text: '{"title":"Forerunner 165","brand":"Garmin","price":329.99,"currency":"cad","store":null}' }],
          usage: { input_tokens: 900, output_tokens: 40 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }) as typeof fetch

    await db.group.update({ where: { id: owner.groupId }, data: { aiModel: null } })
    const up = await api()
      .post(`/groups/${owner.groupId}/photos`)
      .set('Authorization', member.authHeader)
      .set('Content-Type', 'image/jpeg')
      .send(jpeg)
    const res = await api()
      .post(`/groups/${owner.groupId}/capture/photo`)
      .set('Authorization', member.authHeader)
      .send({ photoUrl: up.body.url })
    expect(res.status).toBe(200)
    expect(res.body.draft).toEqual({
      title: 'Forerunner 165',
      brand: 'Garmin',
      price: 329.99,
      currency: 'CAD',
      store: null,
      url: null,
      imageUrl: up.body.url,
    })

    expect(calls).toHaveLength(1)
    const { body, headers } = calls[0]!
    // The owner's own key, and nothing else.
    expect(headers.get('authorization')).toBe('Bearer sk-ant-secret-1234')
    expect(headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01')
    expect(body).toMatchObject({
      model: 'claude-opus-5-5',
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema' } },
    })
    expect(body.messages[0].content[0]).toEqual({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: jpeg.toString('base64') },
    })
  })

  it('needs a key, an uploaded photo from this group, and explains a rejected key', async () => {
    const other = await createTestUser(app, { name: 'No Key' })
    const up = await api()
      .post(`/groups/${other.groupId}/photos`)
      .set('Authorization', other.authHeader)
      .set('Content-Type', 'image/jpeg')
      .send(jpeg)
    expect(
      (await api().post(`/groups/${other.groupId}/capture/photo`).set('Authorization', other.authHeader).send({ photoUrl: up.body.url }))
        .status,
    ).toBe(409)
    expect(
      (await api().post(`/groups/${owner.groupId}/capture/photo`).set('Authorization', owner.authHeader).send({ photoUrl: up.body.url }))
        .status,
    ).toBe(400)
    await cleanupUser(other.user.id)

    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
    ) as typeof fetch
    await expect(
      readProductPhoto({ base64: 'AA==', mediaType: 'image/jpeg' }, { provider: 'anthropic', model: null, apiKey: 'bad' }),
    ).rejects.toThrow('The Anthropic API key was rejected. Check it in Settings.')
  })

  it('reads with OpenAI and Gemini using their JSON modes', async () => {
    const seen: string[] = []
    globalThis.fetch = vi.fn(async (input: any, init?: any) => {
      const url = String(input)
      seen.push(url)
      const json = JSON.parse(init.body)
      if (url.includes('openai')) {
        expect(json.response_format.type).toBe('json_schema')
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"title":"Mug","brand":null,"price":12,"currency":"USD","store":"Target"}' } }],
          }),
        )
      }
      expect(json.generationConfig.responseMimeType).toBe('application/json')
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: '{"title":"Mug","brand":null,"price":12,"currency":"USD","store":null}' }] } }],
        }),
      )
    }) as typeof fetch
    const photo = { base64: 'AA==', mediaType: 'image/jpeg' as const }
    expect(await readProductPhoto(photo, { provider: 'openai', model: 'gpt-test', apiKey: 'k' })).toMatchObject({
      title: 'Mug',
      store: 'Target',
    })
    expect(await readProductPhoto(photo, { provider: 'google', model: 'gemini-test', apiKey: 'k' })).toMatchObject({
      title: 'Mug',
      price: 12,
    })
    expect(seen[0]).toBe('https://api.openai.com/v1/chat/completions')
    expect(seen[1]).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent')
  })
})
