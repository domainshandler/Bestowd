import { OAuth2Client } from 'google-auth-library'
import { env } from '../config.js'

const client = new OAuth2Client(env.GOOGLE_CLIENT_ID)

export interface GoogleProfile {
  googleId: string
  email: string
  name: string
  avatarUrl: string | null
}

export async function verifyGoogleToken(idToken: string): Promise<GoogleProfile> {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: env.GOOGLE_CLIENT_ID,
  })
  const payload = ticket.getPayload()
  if (!payload?.sub || !payload.email) {
    throw new Error('Invalid Google token payload')
  }
  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name ?? payload.email,
    avatarUrl: payload.picture ?? null,
  }
}
