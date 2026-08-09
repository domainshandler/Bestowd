import type { FastifyInstance } from 'fastify'
import { db } from '../db.js'
import { encrypt } from '../crypto.js'

export async function userRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  app.patch<{
    Body: {
      name?: string
      avatarUrl?: string
      aiProviderConfig?: { provider: string; apiKey: string; model: string }
    }
  }>('/users/me', async (request) => {
    const { userId } = request.user as { userId: string }
    const { name, avatarUrl, aiProviderConfig } = request.body

    const user = await db.user.update({
      where: { id: userId },
      data: {
        name,
        avatarUrl,
        ...(aiProviderConfig
          ? { aiProviderConfig: encrypt(JSON.stringify(aiProviderConfig)) }
          : {}),
      },
    })

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      identitySource: user.identitySource,
      emailVerified: user.emailVerified,
      subscriptionStatus: user.subscriptionStatus,
      createdAt: user.createdAt.toISOString(),
    }
  })
}
