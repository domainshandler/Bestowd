import fp from 'fastify-plugin'
import fjwt from '@fastify/jwt'
import { env } from '../config.js'
import type { FastifyRequest, FastifyReply, preHandlerAsyncHookHandler } from 'fastify'

export default fp(async (app) => {
  await app.register(fjwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: '7d' },
  })

  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify()
    } catch {
      await reply.status(401).send({ error: 'Unauthorized' })
    }
  })
})

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: preHandlerAsyncHookHandler
  }
}
