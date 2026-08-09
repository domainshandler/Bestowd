import { buildApp } from './app.js'
import { env } from './config.js'
import { startReminderJob } from './services/reminder-job.js'

const app = await buildApp()
startReminderJob()
await app.listen({ port: env.PORT, host: '0.0.0.0' })
