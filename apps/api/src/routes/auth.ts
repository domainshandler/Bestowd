import type { FastifyInstance } from 'fastify'
import { db } from '../db.js'
import { verifyGoogleToken } from '../services/google-auth.js'

export async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: { idToken: string } }>('/auth/google', {
    schema: {
      body: {
        type: 'object',
        required: ['idToken'],
        properties: { idToken: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const { idToken } = request.body
    const profile = await verifyGoogleToken(idToken)

    const user = await db.user.upsert({
      where: { googleId: profile.googleId },
      create: {
        googleId: profile.googleId,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        identitySource: 'google',
        emailVerified: true,
      },
      update: {
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        email: profile.email,
      },
    })

    const token = app.jwt.sign({ userId: user.id })
    return reply.send({ token, user: toUserDto(user) })
  })

  app.get('/auth/me', { preHandler: [app.authenticate] }, async (request) => {
    const { userId } = request.user as { userId: string }
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } })
    return toUserDto(user)
  })
}

function toUserDto(user: { id: string; email: string; name: string; avatarUrl: string | null; identitySource: string; emailVerified: boolean; subscriptionStatus: string; createdAt: Date }) {
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
}
