import { randomBytes } from 'node:crypto'

export const newToken = () => randomBytes(32).toString('base64url')
export const INVITE_TTL_MS = 14 * 86_400_000

/** Person fields a connected family can choose to share. Name is always shared. */
export const SHAREABLE_FIELDS = ['birthday', 'likes', 'avoid', 'sizes', 'foodNotes', 'photo'] as const
export type ShareableField = (typeof SHAREABLE_FIELDS)[number]
export const DEFAULT_SHARED_FIELDS: ShareableField[] = ['birthday', 'likes', 'avoid']

/** A person as seen through a family connection: id and name plus only the shared fields. */
export function sharedPersonView(
  person: {
    id: string
    name: string
    birthMonth: number | null
    birthDay: number | null
    birthYear: number | null
    likes: string[]
    avoid: string[]
    sizes: unknown
    foodNotes: string | null
    photoUrl: string | null
  },
  fields: string[],
) {
  const view: Record<string, unknown> = { id: person.id, name: person.name }
  for (const field of fields) {
    switch (field) {
      case 'birthday':
        Object.assign(view, { birthMonth: person.birthMonth, birthDay: person.birthDay, birthYear: person.birthYear })
        break
      case 'photo':
        view['photoUrl'] = person.photoUrl
        break
      case 'likes':
      case 'avoid':
      case 'sizes':
      case 'foodNotes':
        view[field] = person[field]
        break
    }
  }
  return view
}
