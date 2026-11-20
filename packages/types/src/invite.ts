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
}

export type AcceptInviteResult = { connectionId: string } | { groupId: string; alreadyMember: boolean }
