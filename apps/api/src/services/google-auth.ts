import { OAuth2Client } from 'google-auth-library'
import { env } from '../config.js'
import { HttpError } from '../http-error.js'

const client = new OAuth2Client()

export interface GoogleProfile {
  googleId: string
  email: string
  name: string
  avatarUrl: string | null
}

/** Client IDs whose ID tokens we accept: the web app's plus any mobile apps' (comma-separated GOOGLE_CLIENT_IDS). */
export function googleAudiences(primary: string, extra: string | undefined): string[] {
  const ids = [primary, ...(extra ?? '').split(',')].map((s) => s.trim()).filter(Boolean)
  return [...new Set(ids)]
}

export async function verifyGoogleToken(idToken: string): Promise<GoogleProfile> {
  let payload
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: googleAudiences(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_IDS) })
    payload = ticket.getPayload()
  } catch {
    throw new HttpError(401, 'Invalid Google sign-in')
  }
  if (!payload?.sub || !payload.email) throw new HttpError(401, 'Invalid Google sign-in')
  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name ?? payload.email,
    avatarUrl: payload.picture ?? null,
  }
}
