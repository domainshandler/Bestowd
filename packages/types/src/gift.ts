export type GiftDirection = 'GIVEN' | 'RECEIVED'
export type GiftStatus = 'BOUGHT' | 'GIVEN'
export type Reaction = 'LOVED_IT' | 'LIKED_IT' | 'ALREADY_HAD_IT' | 'NOT_A_HIT'

export interface Gift {
  id: string
  groupId: string
  direction: GiftDirection
  title: string
  brand: string | null
  store: string | null
  /** Product page. */
  url: string | null
  category: string | null
  occasionId: string | null
  occasionDate: string | null
  occasionName: string | null
  date: string
  personId: string | null
  familyId: string | null
  /** Recipient for given gifts, giver for received gifts. */
  counterpartyName: string
  amount: number | null
  /** Given gifts only. */
  status: GiftStatus | null
  /** Received gifts: show the value only once revealed. */
  valueHidden: boolean
  hasGiftReceipt: boolean
  returnBy: string | null
  thankYouSent: boolean
  thankYouDueAt: string | null
  reaction: Reaction | null
  photoUrl: string | null
  notes: string | null
  ideaId: string | null
  credits: { personId: string; name: string }[]
  createdById: string
  createdAt: string
  updatedAt: string
}

export interface GiftTotals {
  givenCount: number
  receivedCount: number
  spent: number
  /** Revealed received values only. */
  receivedValue: number
  hiddenReceivedCount: number
  thankYouDueCount: number
}

export interface GiftQuery {
  year?: number
  direction?: GiftDirection
  personId?: string
  familyId?: string
  status?: GiftStatus
}

/** GET /groups/:groupId/gifts */
export interface GiftList {
  currency: string
  gifts: Gift[]
  totals: GiftTotals
}

/** GET /groups/:groupId/spend */
export interface Spend {
  currency: string
  year: number
  total: number
  /** January first. */
  byMonth: number[]
  byFamily: { familyId: string; familyName: string; total: number }[]
}

interface GiftFields {
  title: string
  brand?: string | null
  store?: string | null
  url?: string | null
  date: string
  personId?: string | null
  familyId?: string | null
  category?: string | null
  occasionId?: string | null
  occasionDate?: string | null
  amount?: number | null
  reaction?: Reaction | null
  photoUrl?: string | null
  notes?: string | null
  ideaId?: string | null
  creditPersonIds?: string[]
}

export interface ReceivedOnlyFields {
  valueHidden?: boolean
  hasGiftReceipt?: boolean
  returnBy?: string | null
  thankYouSent?: boolean
  thankYouDueAt?: string | null
}

export type CreateGiftBody =
  (GiftFields & { direction: 'GIVEN'; status?: GiftStatus }) | (GiftFields & ReceivedOnlyFields & { direction: 'RECEIVED' })

export type UpdateGiftBody = Partial<GiftFields> & ReceivedOnlyFields & { status?: GiftStatus }
