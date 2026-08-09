import { beforeAll, afterAll } from 'vitest'

// Override DATABASE_URL with test database before any imports load db
process.env['DATABASE_URL'] = process.env['DATABASE_URL_TEST'] ?? process.env['DATABASE_URL']!

beforeAll(async () => {
  // Migrations run via: pnpm prisma migrate deploy before tests
})

afterAll(async () => {
  try {
    const { db } = await import('../src/db.js')
    await db.$disconnect()
  } catch {
    // Prisma client may not be generated yet — safe to skip in scaffold phase
  }
})
