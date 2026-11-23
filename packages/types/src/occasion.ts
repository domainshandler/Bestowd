import type { FamilyType } from './family.js'

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
  /** GROUP: no person or family of its own; covers families (see coverage). */
  scope: OccasionScope
  /** A built-in holiday (group-wide only), e.g. "christmas". */
  holidayKey: string | null
  type: OccasionType
  name: string
  date: string
  recursAnnually: boolean
  recurrenceEndsAt: string | null
  nextOccurrence: string | null
  budget: number | null
  /** Group-wide: budget per family type, overriding `budget`. */
  familyTypeBudgets: Partial<Record<FamilyType, number>>
  /** Group-wide: families added later are covered too. */
  includeNewFamilies: boolean
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
  /** Group-wide only: the covered families (active ones), each with its budget and progress. */
  coverage: OccasionCoverage | null
}

export type OccasionScope = 'GROUP' | 'SUBJECT'

export interface FamilyShare {
  familyId: string
  name: string
  type: FamilyType
  /** This family's own budget, if set. */
  budgetOverride: number | null
  /** The budget that applies: override, else family type budget, else the occasion's, else the group default. */
  budget: number | null
  spent: number
  /** A gift for this family is bought or given. */
  covered: boolean
  given: boolean
}

export interface OccasionCoverage {
  familyCount: number
  coveredCount: number
  families: FamilyShare[]
}

/** GET /groups/:groupId/holidays: the built-in holidays and whether the group has added each. */
export interface Holiday {
  key: string
  name: string
  note: string | null
  nextDate: string | null
  occasionId: string | null
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
  familyTypeBudgets?: Partial<Record<FamilyType, number>>
  includeNewFamilies?: boolean
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

/** A group-wide occasion: a built-in holiday (name, type, date from the catalog) or your own. */
export type CreateGroupOccasionBody =
  | ({ groupWide: true; holidayKey: string; familyIds?: string[] } & Partial<Omit<CreateOccasionBody, 'personId' | 'familyId'>>)
  | ({ groupWide: true; holidayKey?: undefined; familyIds?: string[] } & Omit<CreateOccasionBody, 'personId' | 'familyId'>)

export interface UpdateOccasionBody extends Partial<CreateOccasionBody> {
  status?: OccasionStatus
  cardDone?: boolean
}
