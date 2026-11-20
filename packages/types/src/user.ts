export type IdentitySource = 'google' | 'email'

export interface User {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  identitySource: IdentitySource
  emailVerified: boolean
  createdAt: string
}

export interface UpdateUserBody {
  name?: string
  avatarUrl?: string
}
