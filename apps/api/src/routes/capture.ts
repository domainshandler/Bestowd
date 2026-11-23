import type { FastifyInstance } from 'fastify'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { db } from '../db.js'
import { env } from '../config.js'
import { decrypt, encrypt } from '../crypto.js'
import { badRequest, conflict } from '../http-error.js'
import { requireMember, requireOwner, userIdOf } from '../services/access.js'
import { AI_PROVIDERS, AiError, DEFAULT_MODEL, readProductPhoto, type AiProvider } from '../capture/ai.js'
import { cleanDraft } from '../capture/draft.js'
import { fetchPage, LinkError, readProductPage } from '../capture/link.js'
import { photoSig } from './uploads.js'

/** What clients see of the group's AI settings: never the key itself. */
function aiView(g: { aiProvider: string | null; aiModel: string | null; aiKeyHint: string | null; aiKeyEnc: string | null }) {
  const provider = g.aiProvider as AiProvider | null
  return {
    provider,
    model: g.aiModel,
    defaultModel: provider ? (DEFAULT_MODEL[provider] ?? null) : null,
    keyHint: g.aiKeyHint,
    configured: Boolean(provider && g.aiKeyEnc),
  }
}

/** The stored photo behind a /files/… link from this group, or null. */
async function loadPhoto(groupId: string, link: string) {
  const m = link.match(/^\/files\/([a-z0-9]+)\/([0-9a-f-]{36}\.(jpg|png|webp))\?sig=([A-Za-z0-9_-]+)$/)
  if (!m || m[1] !== groupId || photoSig(m[1], m[2]) !== m[4]) return null
  const mediaType = ({ jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const)[m[3] as 'jpg' | 'png' | 'webp']
  try {
    return { base64: (await readFile(path.join(env.UPLOAD_DIR, m[1], m[2]))).toString('base64'), mediaType }
  } catch {
    return null
  }
}

export async function captureRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  app.get<{ Params: { groupId: string } }>('/groups/:groupId/ai', async (request) => {
    await requireMember(userIdOf(request), request.params.groupId)
    return aiView(await db.group.findUniqueOrThrow({ where: { id: request.params.groupId } }))
  })

  // The owner sets which AI reads photos, and the API key it uses. A blank key keeps the saved one.
  app.put<{ Params: { groupId: string }; Body: { provider: AiProvider; model?: string | null; apiKey?: string | null } }>(
    '/groups/:groupId/ai',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['provider'],
          properties: {
            provider: { type: 'string', enum: [...AI_PROVIDERS] },
            model: { type: ['string', 'null'], maxLength: 100, pattern: '^[A-Za-z0-9._:/-]*$' },
            apiKey: { type: ['string', 'null'], maxLength: 500 },
          },
        },
      },
    },
    async (request) => {
      const { groupId } = request.params
      await requireOwner(userIdOf(request), groupId)
      const { provider, model, apiKey } = request.body
      const group = await db.group.findUniqueOrThrow({ where: { id: groupId } })
      const key = apiKey?.trim()
      if (!key && (!group.aiKeyEnc || group.aiProvider !== provider)) throw badRequest('Enter the API key for this provider')
      if (!model?.trim() && !DEFAULT_MODEL[provider]) throw badRequest('Enter the model to use for this provider')
      const updated = await db.group.update({
        where: { id: groupId },
        data: {
          aiProvider: provider,
          aiModel: model?.trim() || null,
          ...(key ? { aiKeyEnc: encrypt(key), aiKeyHint: key.slice(-4) } : {}),
        },
      })
      return aiView(updated)
    },
  )

  app.delete<{ Params: { groupId: string } }>('/groups/:groupId/ai', async (request, reply) => {
    await requireOwner(userIdOf(request), request.params.groupId)
    await db.group.update({
      where: { id: request.params.groupId },
      data: { aiProvider: null, aiModel: null, aiKeyEnc: null, aiKeyHint: null },
    })
    return reply.code(204).send()
  })

  // Fill in an idea or gift from a store link.
  app.post<{ Params: { groupId: string }; Body: { url: string } }>(
    '/groups/:groupId/capture/link',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['url'],
          properties: { url: { type: 'string', maxLength: 2000, pattern: '^https?://' } },
        },
      },
    },
    async (request) => {
      await requireMember(userIdOf(request), request.params.groupId)
      try {
        const page = await fetchPage(request.body.url)
        return { draft: readProductPage(page.html, page.url) }
      } catch (err) {
        if (err instanceof LinkError) throw badRequest(err.message)
        if (err instanceof TypeError || (err as Error).name === 'TimeoutError') throw badRequest("Couldn't open that page")
        throw err
      }
    },
  )

  // Fill in an idea or gift from a photo of the item or its price tag, read by the group's AI.
  app.post<{ Params: { groupId: string }; Body: { photoUrl: string } }>(
    '/groups/:groupId/capture/photo',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['photoUrl'],
          properties: { photoUrl: { type: 'string', maxLength: 2000 } },
        },
      },
    },
    async (request) => {
      const { groupId } = request.params
      await requireMember(userIdOf(request), groupId)
      const group = await db.group.findUniqueOrThrow({ where: { id: groupId } })
      if (!group.aiProvider || !group.aiKeyEnc) throw conflict("Reading photos needs an AI key. The group's owner can add one in Settings.")
      const photo = await loadPhoto(groupId, request.body.photoUrl)
      if (!photo) throw badRequest('Upload the photo first')
      try {
        const reading = await readProductPhoto(photo, {
          provider: group.aiProvider as AiProvider,
          model: group.aiModel,
          apiKey: decrypt(group.aiKeyEnc),
        })
        return { draft: cleanDraft({ ...reading, url: null, imageUrl: request.body.photoUrl }) }
      } catch (err) {
        if (err instanceof AiError) throw badRequest(err.message)
        throw err
      }
    },
  )
}
