import Fastify from 'fastify'
import corsPlugin from './plugins/cors.js'
import { healthRoutes } from './routes/health.js'

export async function buildApp() {
  const app = Fastify({ logger: process.env['NODE_ENV'] !== 'test' })

  await app.register(corsPlugin)
  await app.register(healthRoutes)

  return app
}
