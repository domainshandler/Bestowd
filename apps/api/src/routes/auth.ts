import type { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
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

    await autoLinkContact(user.id, user.email)

    const token = app.jwt.sign({ userId: user.id })
    return reply.send({ token, user: toUserDto(user) })
  })

  app.get('/auth/me', { preHandler: [app.authenticate] }, async (request) => {
    const { userId } = request.user as { userId: string }
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } })
    return toUserDto(user)
  })
}

async function autoLinkContact(userId: string, email: string): Promise<void> {
  // Contact.linkedUserId is @unique, so a user can be linked to at most one contact.
  const alreadyLinked = await db.contact.findUnique({ where: { linkedUserId: userId } })
  if (alreadyLinked) return

  const linkableContact = await db.contact.findFirst({
    where: {
      email: { equals: email, mode: 'insensitive' },
      isManaged: true,
      linkedUserId: null,
    },
    orderBy: { createdAt: 'asc' },
  })

  if (!linkableContact) return

  try {
    await db.contact.update({
      where: { id: linkableContact.id },
      data: { linkedUserId: userId, isManaged: false },
    })
  } catch (err) {
    // A concurrent sign-in linked this user first; auto-link must never block login.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return
    throw err
  }
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
