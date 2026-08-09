import fp from 'fastify-plugin'
import fjwt from '@fastify/jwt'
import { env } from '../config.js'
import type { FastifyRequest, FastifyReply } from 'fastify'

export default fp(async (app) => {
  await app.register(fjwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: '7d' },
  })

  app.decorate('authenticate', async (request: any, reply: any) => {
    try {
      await request.jwtVerify()
    } catch {
      reply.status(401).send({ error: 'Unauthorized' })
    }
  })
})

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}
