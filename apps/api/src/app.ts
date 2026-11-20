import Fastify from 'fastify'
import corsPlugin from './plugins/cors.js'
import jwtPlugin from './plugins/jwt.js'
import { healthRoutes } from './routes/health.js'
import { authRoutes } from './routes/auth.js'
import { userRoutes } from './routes/users.js'
import { meRoutes } from './routes/me.js'
import { groupRoutes } from './routes/groups.js'
import { familyRoutes } from './routes/families.js'
import { personRoutes } from './routes/people.js'
import { occasionRoutes } from './routes/occasions.js'
import { giftRoutes } from './routes/gifts.js'
import { ideaRoutes } from './routes/ideas.js'
import { inviteRoutes } from './routes/invites.js'

export async function buildApp() {
  const app = Fastify({ logger: process.env['NODE_ENV'] !== 'test' })

  app.setErrorHandler((err, _request, reply) => {
    const status = (err as { statusCode?: number }).statusCode ?? 500
    if (status >= 500) app.log.error(err)
    reply.code(status).send({ error: status >= 500 ? 'Internal Server Error' : err.message })
  })

  // apiFetch sends bodyless POSTs without a content type; validate those as an empty object.
  app.addHook('preValidation', async (request) => {
    if (request.body === undefined && request.method !== 'GET' && request.method !== 'DELETE') request.body = {}
  })

  await app.register(corsPlugin)
  await app.register(jwtPlugin)
  await app.register(healthRoutes)
  await app.register(authRoutes)
  await app.register(userRoutes)
  await app.register(meRoutes)
  await app.register(groupRoutes)
  await app.register(familyRoutes)
  await app.register(personRoutes)
  await app.register(occasionRoutes)
  await app.register(giftRoutes)
  await app.register(ideaRoutes)
  await app.register(inviteRoutes)

  return app
}
