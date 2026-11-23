import type { Gift } from './gift.js'

export type IdeaStatus = 'SAVED' | 'BOUGHT' | 'DISMISSED'

export interface Repeat {
  giftEntryId: string
  title: string
  date: string
}

export interface Idea {
  id: string
  groupId: string
  title: string
  brand: string | null
  store: string | null
  category: string | null
  url: string | null
  imageUrl: string | null
  price: number | null
  notes: string | null
  ageMin: number | null
  ageMax: number | null
  status: IdeaStatus
  occasionId: string | null
  people: { id: string; name: string }[]
  createdById: string
  createdAt: string
  updatedAt: string
  /** Set when listing for a person and they were already given a gift in this category. */
  repeat: Repeat | null
}

export interface IdeaQuery {
  personId?: string
  /** Ideas tagged with anyone in this family. */
  familyId?: string
  occasionId?: string
  status?: IdeaStatus
}

/** GET /groups/:groupId/ideas */
export interface IdeaList {
  person: { id: string; name: string; age: number | null } | null
  ideas: Idea[]
}

export interface CreateIdeaBody {
  title: string
  brand?: string | null
  store?: string | null
  category?: string | null
  url?: string | null
  imageUrl?: string | null
  price?: number | null
  notes?: string | null
  ageMin?: number | null
  ageMax?: number | null
  personIds?: string[]
  occasionId?: string | null
}

export interface UpdateIdeaBody extends Partial<CreateIdeaBody> {
  status?: IdeaStatus
}

export interface BuyIdeaBody {
  personId?: string | null
  familyId?: string | null
  occasionId?: string | null
  amount?: number | null
  date?: string
}

export interface BuyIdeaResult {
  idea: Omit<Idea, 'repeat'>
  gift: Gift
}

export type SuggestField = 'title' | 'brand' | 'store' | 'category'
/** yours = logged in your group before; popular = across Bestowd lately; common = a built-in list. */
export interface Suggestion { value: string; source: 'yours' | 'popular' | 'common' }
