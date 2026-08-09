import Fastify from 'fastify'
import corsPlugin from './plugins/cors.js'
import jwtPlugin from './plugins/jwt.js'
import { healthRoutes } from './routes/health.js'
import { authRoutes } from './routes/auth.js'
import { contactRoutes } from './routes/contacts.js'
import { connectionRoutes } from './routes/connections.js'
import { eventRoutes } from './routes/events.js'
import { giftRoutes } from './routes/gifts.js'
import { listingRoutes } from './routes/listings.js'
import { assignmentRoutes } from './routes/assignments.js'
import { userRoutes } from './routes/users.js'

export async function buildApp() {
  const app = Fastify({ logger: process.env['NODE_ENV'] !== 'test' })

  await app.register(corsPlugin)
  await app.register(jwtPlugin)
  await app.register(healthRoutes)
  await app.register(authRoutes)
  await app.register(contactRoutes)
  await app.register(connectionRoutes)
  await app.register(eventRoutes)
  await app.register(giftRoutes)
  await app.register(listingRoutes)
  await app.register(assignmentRoutes)
  await app.register(userRoutes)

  return app
}
