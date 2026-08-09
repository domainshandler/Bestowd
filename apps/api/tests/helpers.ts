import { buildApp } from '../src/app.js'
import { db } from '../src/db.js'
import type { FastifyInstance } from 'fastify'

export async function createTestApp(): Promise<FastifyInstance> {
  const app = await buildApp()
  await app.ready()
  return app
}

export async function createTestUser(app: FastifyInstance, overrides: Partial<{
  googleId: string; email: string; name: string
}> = {}) {
  const user = await db.user.create({
    data: {
      googleId: overrides.googleId ?? `test-${Math.random().toString(36).slice(2)}-${Date.now()}`,
      email: overrides.email ?? `test-${Date.now()}@example.com`,
      name: overrides.name ?? 'Test User',
      identitySource: 'google',
      emailVerified: true,
    },
  })
  const token = app.jwt.sign({ userId: user.id })
  return { user, token, authHeader: `Bearer ${token}` }
}
