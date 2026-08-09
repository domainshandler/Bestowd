import { z } from 'zod'

const schema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().length(64),
  GOOGLE_CLIENT_ID: z.string(),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
