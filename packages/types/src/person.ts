import type { GiftDirection, Reaction } from './gift.js'

export interface Person {
  id: string
  groupId: string
  familyId: string
  name: string
  relationship: string | null
  birthMonth: number | null
  birthDay: number | null
  birthYear: number | null
  likes: string[]
  avoid: string[]
  sizes: Record<string, string>
  foodNotes: string | null
  photoUrl: string | null
  notes: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

/** GET /people/:id */
export interface PersonDetail extends Person {
  age: number | null
  familyName: string
  /** The 10 most recent gifts to, from or credited to this person. */
  history: { id: string; direction: GiftDirection; title: string; date: string; reaction: Reaction | null }[]
}

export interface CreatePersonBody {
  name: string
  relationship?: string | null
  birthMonth?: number | null
  birthDay?: number | null
  birthYear?: number | null
  likes?: string[]
  avoid?: string[]
  sizes?: Record<string, string>
  foodNotes?: string | null
  photoUrl?: string | null
  notes?: string | null
}

export interface UpdatePersonBody extends Partial<CreatePersonBody> {
  archived?: boolean
  /** Move to another family in the same group. */
  familyId?: string
}
