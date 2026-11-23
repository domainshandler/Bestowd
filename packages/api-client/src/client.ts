const API_BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000'
const TOKEN_KEY = 'bestowd_token'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

/** A path on the API as a full URL. */
export const apiUrl = (path: string) => `${API_BASE}${path}`

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      // Fastify rejects an empty body sent with a JSON content type (e.g. POST /contacts/:id/invite).
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(res.status, body.error ?? res.statusText)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}
