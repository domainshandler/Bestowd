import type { Person } from './person.js'
import type { Occasion } from './occasion.js'
import type { GiftTotals } from './gift.js'

export type FamilyType = 'FAMILY' | 'FRIENDS' | 'SCHOOL' | 'OTHER'
export type FamilyStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED'

export interface Family {
  id: string
  groupId: string
  name: string
  type: FamilyType
  status: FamilyStatus
  isOwnHousehold: boolean
  photoUrl: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

/** GET /groups/:groupId/families */
export interface FamilyListItem extends Family {
  memberCount: number
  onBestowd: boolean
  nextOccasion: { id: string; name: string; nextOccurrence: string; personName: string | null } | null
}

export type ShareableField = 'birthday' | 'likes' | 'avoid' | 'sizes' | 'foodNotes' | 'photo'

/** A person seen through a connection: only the fields the other family chose to share are present. */
export interface SharedPerson {
  id: string
  name: string
  birthMonth?: number | null
  birthDay?: number | null
  birthYear?: number | null
  likes?: string[]
  avoid?: string[]
  sizes?: Record<string, string>
  foodNotes?: string | null
  photoUrl?: string | null
}

export interface FamilyConnectionView {
  id: string
  sourceFamilyName: string
  sharedFields: ShareableField[]
  createdAt: string
  people: SharedPerson[]
}

/** GET /families/:id */
export interface FamilyProfile extends Family {
  people: (Person & { age: number | null; nextBirthday: string | null })[]
  occasions: Occasion[]
  totals: GiftTotals
  connection: FamilyConnectionView | null
}

export interface CreateFamilyBody {
  name: string
  type?: FamilyType
  photoUrl?: string | null
  notes?: string | null
}

export interface UpdateFamilyBody extends Partial<CreateFamilyBody> {
  status?: FamilyStatus
}
