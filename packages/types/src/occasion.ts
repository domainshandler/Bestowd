export type OccasionType = 'BIRTHDAY' | 'HOLIDAY' | 'ONE_OFF'
export type OccasionStatus = 'NOT_STARTED' | 'IDEA_SAVED' | 'BOUGHT' | 'GIVEN'
export type Rsvp = 'NONE' | 'YES' | 'NO' | 'MAYBE'

export interface Occasion {
  id: string
  groupId: string
  groupName: string
  /** The group's currency. */
  currency: string
  personId: string | null
  familyId: string | null
  type: OccasionType
  name: string
  date: string
  recursAnnually: boolean
  recurrenceEndsAt: string | null
  nextOccurrence: string | null
  budget: number | null
  status: OccasionStatus
  needsCard: boolean
  cardDone: boolean
  /** Empty means the group default applies. */
  reminderDays: number[]
  partyAt: string | null
  location: string | null
  rsvp: Rsvp
  hostGiftRequest: string | null
  createdAt: string
  updatedAt: string
  subjectName: string
  subjectFamilyId: string | null
  subjectFamilyName: string | null
  /** The occasion's budget, else the group default for its type. */
  effectiveBudget: number | null
  /** Given-gift spend on the current occurrence. */
  spent: number
  overBudget: boolean
  needsGift: boolean
}

export interface OccasionQuery {
  from?: string
  to?: string
  type?: OccasionType
}

/** GET /groups/:groupId/occasions */
export interface GroupOccasions {
  currency: string
  occasions: Occasion[]
  plannedSpend: number
}

/** GET /me/occasions (Home) */
export interface HomeOccasions {
  occasions: Occasion[]
  plannedSpend: { currency: string; amount: number }[]
  /** Show group labels only when true. */
  multipleGroups: boolean
}

export interface CreateOccasionBody {
  type: OccasionType
  name: string
  /** "YYYY-MM-DD" or an ISO timestamp. */
  date: string
  personId?: string | null
  familyId?: string | null
  recursAnnually?: boolean
  recurrenceEndsAt?: string | null
  budget?: number | null
  needsCard?: boolean
  reminderDays?: number[]
  partyAt?: string | null
  location?: string | null
  rsvp?: Rsvp
  hostGiftRequest?: string | null
}

export interface UpdateOccasionBody extends Partial<CreateOccasionBody> {
  status?: OccasionStatus
  cardDone?: boolean
}
