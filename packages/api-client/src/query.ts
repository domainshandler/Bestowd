/** Builds "?a=1&b=2" from the defined values, or "" when there are none. */
export function toQuery(params: object = {}): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  }
  const s = search.toString()
  return s ? `?${s}` : ''
}

export const json = (body: unknown) => JSON.stringify(body)
