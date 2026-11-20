import { buildApp } from '../src/app.js'
import { db } from '../src/db.js'
import { provisionPersonalGroup } from '../src/services/groups.js'
import type { FastifyInstance } from 'fastify'

export async function createTestApp(): Promise<FastifyInstance> {
  const app = await buildApp()
  await app.ready()
  return app
}

/** A user with a provisioned personal group and household, as after a first sign-in. */
export async function createTestUser(app: FastifyInstance, overrides: Partial<{
  googleId: string; email: string; name: string
}> = {}) {
  const unique = `${Math.random().toString(36).slice(2)}-${Date.now()}`
  const user = await db.user.create({
    data: {
      googleId: overrides.googleId ?? `test-${unique}`,
      email: overrides.email ?? `test-${unique}@example.com`,
      name: overrides.name ?? 'Test User',
      identitySource: 'google',
      emailVerified: true,
    },
  })
  const groupId = await provisionPersonalGroup(user)
  const household = await db.family.findUniqueOrThrow({ where: { householdOfGroupId: groupId } })
  const token = app.jwt.sign({ userId: user.id })
  return { user, token, authHeader: `Bearer ${token}`, groupId, householdId: household.id }
}

/** Deletes the groups the user owns (cascading to everything in them), then the user. */
export async function cleanupUser(userId: string): Promise<void> {
  await db.group.deleteMany({ where: { memberships: { some: { userId, role: 'OWNER' } } } })
  await db.user.deleteMany({ where: { id: userId } })
}
