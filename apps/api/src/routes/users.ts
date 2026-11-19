import type { FastifyInstance } from 'fastify'
import { db } from '../db.js'

export async function userRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  app.patch<{ Body: { name?: string; avatarUrl?: string } }>('/users/me', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          avatarUrl: { type: 'string', maxLength: 2000 },
        },
      },
    },
  }, async (request) => {
    const { userId } = request.user as { userId: string }
    const { name, avatarUrl } = request.body

    const user = await db.user.update({ where: { id: userId }, data: { name, avatarUrl } })

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      identitySource: user.identitySource,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt.toISOString(),
    }
  })
}
