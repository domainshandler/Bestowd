import type { User } from './user.js'
import type { OccasionType } from './occasion.js'

export type MembershipRole = 'OWNER' | 'MEMBER'

export interface Membership {
  groupId: string
  groupName: string
  role: MembershipRole
  memberCount: number
}

/** GET /me */
export interface Me {
  user: User
  primaryGroupId: string | null
  /** Primary group first. */
  memberships: Membership[]
}

export type DefaultBudgets = Partial<Record<OccasionType, number>>

export interface GroupMember {
  userId: string
  name: string
  avatarUrl: string | null
  role: MembershipRole
}

export interface Group {
  id: string
  name: string
  currency: string
  defaultBudgets: DefaultBudgets
  defaultReminderDays: number[]
  createdAt: string
  updatedAt: string
  /** The co-givers. */
  members: GroupMember[]
}

export interface UpdateGroupBody {
  name?: string
  /** Three-letter uppercase code, e.g. "CAD". */
  currency?: string
  defaultBudgets?: DefaultBudgets
  defaultReminderDays?: number[]
}
