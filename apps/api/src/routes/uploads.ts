import type { FastifyInstance } from 'fastify'
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { env } from '../config.js'
import { badRequest, notFound } from '../http-error.js'
import { requireMember, userIdOf } from '../services/access.js'

/** Photos are re-encoded and shrunk by the app or browser before upload, which also drops location data. */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024
const TYPES: Record<string, { ext: string; magic: (b: Buffer) => boolean }> = {
  'image/jpeg': { ext: 'jpg', magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { ext: 'png', magic: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  'image/webp': { ext: 'webp', magic: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' },
}
const CONTENT_TYPE = Object.fromEntries(Object.entries(TYPES).map(([type, t]) => [t.ext, type]))
const NAME = /^[0-9a-f-]{36}\.(jpg|png|webp)$/
const ID = /^[a-z0-9]{10,40}$/

/** The signature in a photo link: knowing the link is what lets an <img> show it, without a login header. */
export function photoSig(groupId: string, name: string): string {
  return createHmac('sha256', env.JWT_SECRET).update(`photo:${groupId}/${name}`).digest('base64url').slice(0, 32)
}

/** The path a stored photo is served at (relative to the API). */
export const photoPath = (groupId: string, name: string) => `/files/${groupId}/${name}?sig=${photoSig(groupId, name)}`

export async function uploadRoutes(app: FastifyInstance) {
  app.addContentTypeParser(Object.keys(TYPES), { parseAs: 'buffer', bodyLimit: MAX_PHOTO_BYTES }, (_req, body, done) => done(null, body))

  // Upload a photo for the group; returns the link to store on an idea or gift.
  app.post<{ Params: { groupId: string }; Body: Buffer }>(
    '/groups/:groupId/photos',
    { preHandler: app.authenticate, bodyLimit: MAX_PHOTO_BYTES },
    async (request, reply) => {
      const { groupId } = request.params
      await requireMember(userIdOf(request), groupId)
      const type = TYPES[(request.headers['content-type'] ?? '').split(';')[0].trim()]
      const body = request.body
      if (!type || !Buffer.isBuffer(body) || body.length < 12 || !type.magic(body)) throw badRequest('Upload a JPEG, PNG or WebP photo')
      const name = `${randomUUID()}.${type.ext}`
      const dir = path.join(env.UPLOAD_DIR, groupId)
      await mkdir(dir, { recursive: true })
      await writeFile(path.join(dir, name), body)
      return reply.code(201).send({ url: photoPath(groupId, name) })
    },
  )

  app.get<{ Params: { groupId: string; name: string }; Querystring: { sig?: string } }>('/files/:groupId/:name', async (request, reply) => {
    const { groupId, name } = request.params
    if (!ID.test(groupId) || !NAME.test(name)) throw notFound()
    const expected = Buffer.from(photoSig(groupId, name))
    const given = Buffer.from(request.query.sig ?? '')
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw notFound()
    try {
      const file = await readFile(path.join(env.UPLOAD_DIR, groupId, name))
      return reply
        .header('content-type', CONTENT_TYPE[name.split('.').pop()!])
        .header('cache-control', 'private, max-age=31536000, immutable')
        .send(file)
    } catch {
      throw notFound()
    }
  })
}
