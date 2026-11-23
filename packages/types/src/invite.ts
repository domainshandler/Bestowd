import type { ShareableField } from './family.js'

export type InviteKind = 'FAMILY' | 'GROUP'

export interface CreateInviteBody {
  kind: InviteKind
  familyId?: string | null
}

export interface InviteLink {
  token: string
  /** Share this, e.g. by WhatsApp or text. */
  url: string
  expiresAt: string
}

/** GET /invites/:token (public) */
export interface InvitePreview {
  kind: InviteKind
  inviterName: string
  groupName: string
  familyName: string | null
  expiresAt: string
}

export interface AcceptInviteBody {
  /** Family invites: which of your families to connect. */
  sourceFamilyId?: string
  sharedFields?: ShareableField[]
  /** Group invites: what to bring from your own group. The group's owner approves it. */
  bring?: MoveSelection
}

export type AcceptInviteResult = { connectionId: string } | { groupId: string; alreadyMember: boolean; moveRequestId?: string | null }

/** What to bring from your own group into another. */
export interface MoveSelection {
  familyIds: string[]
  occasionIds: string[]
  ideas: boolean
}

export interface MovableFamily { id: string; name: string; isOwnHousehold: boolean; people: number; gifts: number }

/** What you could bring from your own group (one you own and are alone in). */
export interface MovableItems {
  groupId: string
  groupName: string
  families: MovableFamily[]
  occasions: { id: string; name: string }[]
  ideas: number
}

export type MoveStatus = 'PENDING' | 'APPROVED' | 'DECLINED' | 'CANCELLED'

export interface MoveRequestSummary {
  id: string
  groupId: string
  fromGroupName: string
  requestedBy: { userId: string; name: string }
  status: MoveStatus
  createdAt: string
  counts: { families: number; people: number; gifts: number; occasions: number; ideas: number }
}

export interface NameMatch { id: string; name: string }

/** The owner's view of a pending request: items, look-alikes and differences to decide on. */
export interface MoveReview {
  /** Set when the two groups use different currencies. Amounts aren't converted. */
  currency: { from: string; to: string } | null
  families: (MovableFamily & { match: NameMatch | null })[]
  people: { id: string; name: string; familyId: string; match: NameMatch }[]
  occasions: { id: string; name: string; match: NameMatch | null; budgetDiffers: boolean; theirBudget: number | null; ourBudget: number | null }[]
  ideas: number
}

export interface MoveRequestDetail extends MoveRequestSummary {
  canDecide: boolean
  review: MoveReview | null
}

export interface ApproveMoveBody extends MoveSelection {
  keepBothFamilies?: string[]
  keepBothPeople?: string[]
  useTheirBudget?: string[]
}

export interface LeaveGroupBody {
  /** Owners leaving a group with others in it: who owns it next. */
  newOwnerId?: string
  /** An owner alone in the group confirms that leaving deletes it. */
  deleteGroup?: boolean
  /** Families to take a copy of, with their people and gift history. Into toGroupId, or another group of yours (a new one if none). */
  copy?: { familyIds: string[]; toGroupId?: string; toNewGroup?: boolean }
}

/** Before leaving: families you could take a copy of, and your other groups to put them in. */
export interface LeaveOptions {
  families: MovableFamily[]
  destinations: { groupId: string; groupName: string }[]
}

export interface LeaveResult {
  primaryGroupId: string
  copied: { families: number; gifts: number }
}
