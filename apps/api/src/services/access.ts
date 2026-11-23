import type { FastifyRequest } from 'fastify'
import type { MembershipRole } from '@prisma/client'
import { db } from '../db.js'
import { notFound, forbidden, badRequest } from '../http-error.js'

export function userIdOf(request: FastifyRequest): string {
  return (request.user as { userId: string }).userId
}

/** The caller's role in the group. Non-members get 404 so they can't tell whether the group exists. */
export async function requireMember(userId: string, groupId: string): Promise<MembershipRole> {
  const membership = await db.groupMembership.findUnique({ where: { groupId_userId: { groupId, userId } } })
  if (!membership) throw notFound()
  return membership.role
}

/** 404 for non-members, 403 for members who aren't OWNER. */
export async function requireOwner(userId: string, groupId: string): Promise<void> {
  if ((await requireMember(userId, groupId)) !== 'OWNER') throw forbidden()
}

/** A group-owned row, or 404 if it's missing or the caller isn't a member of its group. */
export async function loadOr404<T extends { groupId: string }>(userId: string, row: T | null): Promise<T> {
  if (!row) throw notFound()
  await requireMember(userId, row.groupId)
  return row
}

/** Exactly one of personId / familyId, and it must belong to groupId. */
export async function assertSubject(groupId: string, subject: { personId?: string | null; familyId?: string | null }): Promise<void> {
  const { personId, familyId } = subject
  if (!personId === !familyId) throw badRequest('Provide exactly one of personId or familyId')
  const row = personId ? await db.person.findUnique({ where: { id: personId } }) : await db.family.findUnique({ where: { id: familyId! } })
  if (!row || row.groupId !== groupId) throw badRequest('Person or family not in this group')
}

type GroupModel = 'person' | 'family' | 'occasion' | 'idea'

/** Every id must exist in groupId; 400 otherwise. */
export async function assertInGroup(model: GroupModel, groupId: string, ids: string[]): Promise<void> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return
  const where = { id: { in: unique }, groupId }
  const counts: Record<GroupModel, () => Promise<number>> = {
    person: () => db.person.count({ where }),
    family: () => db.family.count({ where }),
    occasion: () => db.occasion.count({ where }),
    idea: () => db.idea.count({ where }),
  }
  if ((await counts[model]()) !== unique.length) throw badRequest(`${model} not in this group`)
}
