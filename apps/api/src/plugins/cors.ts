import fp from 'fastify-plugin'
import cors from '@fastify/cors'
import { env } from '../config.js'

export default fp(async (app) => {
  await app.register(cors, {
    origin: env.ALLOWED_ORIGINS.split(',').map(o => o.trim()),
    credentials: true,
  })
})
