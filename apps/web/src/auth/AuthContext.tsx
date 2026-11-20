import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { googleLogin, getAuthMe } from '@bestowd/api-client'
import type { User } from '@bestowd/types'

const TOKEN_KEY = 'bestowd_token'

export interface AuthContextValue {
  user: User | null
  token: string | null
  login: (idToken: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))

  useEffect(() => {
    if (token && !user) {
      getAuthMe().then(setUser).catch(() => {
        localStorage.removeItem(TOKEN_KEY)
        setToken(null)
      })
    }
  }, [token, user])

  async function login(idToken: string) {
    const result = await googleLogin(idToken)
    localStorage.setItem(TOKEN_KEY, result.token)
    setToken(result.token)
    setUser(result.user)
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export { AuthContext }
