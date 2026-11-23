import type { FastifyInstance } from 'fastify'
import type { Prisma } from '@prisma/client'
import { db } from '../db.js'
import { toGroupDto } from '../dto.js'
import { requireMember, requireOwner, userIdOf } from '../services/access.js'
import { badRequest, conflict } from '../http-error.js'
import { firstName, provisionPersonalGroup, type Tx } from '../services/groups.js'
import { copyFamilies } from '../services/copy.js'
import { idList } from './schemas.js'

interface GroupParams { groupId: string }
interface LeaveBody { newOwnerId?: string; deleteGroup?: boolean; copy?: { familyIds: string[]; toGroupId?: string; toNewGroup?: boolean } }

/** A new group owned by the user, with their household and them in it, opened next. */
async function createOwnGroup(tx: Tx, user: { id: string; name: string }, name?: string): Promise<string> {
  const first = firstName(user.name)
  const group = await tx.group.create({ data: { name: name?.trim() || `${first}'s group`, memberships: { create: { userId: user.id, role: 'OWNER' } } } })
  const household = await tx.family.create({ data: { groupId: group.id, householdOfGroupId: group.id, name: `${first}'s household` } })
  await tx.person.create({ data: { groupId: group.id, familyId: household.id, userId: user.id, name: user.name } })
  await tx.user.update({ where: { id: user.id }, data: { primaryGroupId: group.id } })
  return group.id
}

/** Another group the user is in: their primary one first, then the first they own, then any. */
async function otherGroup(tx: Tx, user: { id: string; primaryGroupId: string | null }, leaving: string): Promise<string | null> {
  if (user.primaryGroupId && user.primaryGroupId !== leaving) return user.primaryGroupId
  const rows = await tx.groupMembership.findMany({ where: { userId: user.id, groupId: { not: leaving } }, orderBy: { createdAt: 'asc' } })
  return (rows.find((m) => m.role === 'OWNER') ?? rows[0])?.groupId ?? null
}
interface UpdateGroupBody {
  name?: string
  currency?: string
  defaultBudgets?: Record<string, number>
  defaultReminderDays?: number[]
}

export async function groupRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // Start a new group from scratch, with your own household. It becomes the one the app opens to.
  app.post<{ Body: { name?: string } }>('/groups', {
    schema: { body: { type: 'object', additionalProperties: false, properties: { name: { type: 'string', minLength: 1, maxLength: 100 } } } },
  }, async (request, reply) => {
    const user = await db.user.findUniqueOrThrow({ where: { id: userIdOf(request) } })
    const groupId = await db.$transaction((tx) => createOwnGroup(tx, user, request.body.name))
    return reply.code(201).send(await groupWithMembers(groupId))
  })

  // Before leaving: the families you could take a copy of, and the other groups you could put them in.
  app.get<{ Params: GroupParams }>('/groups/:groupId/leave-options', async (request) => {
    const { groupId } = request.params
    const userId = userIdOf(request)
    await requireMember(userId, groupId)
    const families = await db.family.findMany({ where: { groupId }, orderBy: { name: 'asc' } })
    const rows = []
    for (const f of families) {
      const [people, gifts] = await Promise.all([
        db.person.count({ where: { familyId: f.id, OR: [{ userId: null }, { userId: { not: userId } }] } }),
        db.giftEntry.count({ where: { OR: [{ familyId: f.id }, { person: { familyId: f.id } }] } }),
      ])
      const isOwnHousehold = f.householdOfGroupId !== null
      if (isOwnHousehold && people === 0 && gifts === 0) continue
      rows.push({ id: f.id, name: f.name, isOwnHousehold, people, gifts })
    }
    rows.sort((a, b) => Number(b.isOwnHousehold) - Number(a.isOwnHousehold) || a.name.localeCompare(b.name))
    const memberships = await db.groupMembership.findMany({ where: { userId, groupId: { not: groupId } }, include: { group: true }, orderBy: { createdAt: 'asc' } })
    return { families: rows, destinations: memberships.map((m) => ({ groupId: m.groupId, groupName: m.group.name })) }
  })

  /**
   * Leave a group. What you added stays with the group, and you stay in its household as a plain
   * person so gift history keeps its names. You can take a copy of families, with their people and
   * gift history, into another group of yours (a new one if you have no other). An owner hands the
   * group to another member first; an owner on their own deletes the group instead. Leaving your
   * last group starts you a fresh one.
   */
  app.post<{ Params: GroupParams; Body: LeaveBody }>('/groups/:groupId/leave', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          newOwnerId: { type: 'string', minLength: 1, maxLength: 64 },
          deleteGroup: { type: 'boolean' },
          copy: {
            type: 'object',
            additionalProperties: false,
            required: ['familyIds'],
            properties: { familyIds: idList, toGroupId: { type: 'string', minLength: 1, maxLength: 64 }, toNewGroup: { type: 'boolean' } },
          },
        },
      },
    },
  }, async (request) => {
    const { groupId } = request.params
    const userId = userIdOf(request)
    const role = await requireMember(userId, groupId)
    const others = await db.groupMembership.findMany({ where: { groupId, userId: { not: userId } } })
    const { newOwnerId, deleteGroup, copy } = request.body ?? {}

    if (role === 'OWNER' && others.length === 0 && !deleteGroup) {
      throw conflict("You're the only one in this group. Leaving deletes it and everything in it.")
    }
    if (role === 'OWNER' && others.length > 0 && !others.some((m) => m.userId === newOwnerId)) {
      throw conflict('Choose who looks after the group when you leave')
    }
    if (copy?.toGroupId) {
      if (copy.toGroupId === groupId) throw badRequest("Choose a group other than the one you're leaving")
      await requireMember(userId, copy.toGroupId)
    }
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } })

    const result = await db.$transaction(async (tx) => {
      let copied = { families: 0, gifts: 0 }
      let destination: string | null = null
      if (copy && copy.familyIds.length > 0) {
        destination = copy.toGroupId ?? (copy.toNewGroup ? null : await otherGroup(tx, user, groupId)) ?? await createOwnGroup(tx, user)
        copied = await copyFamilies(tx, groupId, destination, copy.familyIds, user)
      }
      await tx.moveRequest.updateMany({
        where: { status: 'PENDING', OR: [{ groupId, requestedById: userId }, { fromGroupId: groupId }] },
        data: { status: 'CANCELLED', decidedAt: new Date() },
      })
      if (role === 'OWNER' && others.length === 0) {
        await tx.group.delete({ where: { id: groupId } })
      } else {
        if (role === 'OWNER') {
          await tx.groupMembership.update({ where: { groupId_userId: { groupId, userId: newOwnerId! } }, data: { role: 'OWNER' } })
        }
        await tx.person.updateMany({ where: { groupId, userId }, data: { userId: null } })
        await tx.groupMembership.delete({ where: { groupId_userId: { groupId, userId } } })
      }
      // The app opens to where the copies went.
      if (destination) await tx.user.update({ where: { id: userId }, data: { primaryGroupId: destination } })
      return { copied }
    }, { timeout: 60_000 })

    const after = await db.user.findUniqueOrThrow({ where: { id: userId } })
    if (after.primaryGroupId === null || after.primaryGroupId === groupId) {
      const next = await db.groupMembership.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } })
      await db.user.update({ where: { id: userId }, data: { primaryGroupId: next?.groupId ?? null } })
    }
    const primaryGroupId = await provisionPersonalGroup(await db.user.findUniqueOrThrow({ where: { id: userId } }))
    return { primaryGroupId, copied: result.copied }
  })

  app.get<{ Params: GroupParams }>('/groups/:groupId', async (request) => {
    const { groupId } = request.params
    await requireMember(userIdOf(request), groupId)
    return groupWithMembers(groupId)
  })

  app.patch<{ Params: GroupParams; Body: UpdateGroupBody }>('/groups/:groupId', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          currency: { type: 'string', pattern: '^[A-Z]{3}$' },
          defaultBudgets: {
            type: 'object',
            additionalProperties: false,
            properties: {
              BIRTHDAY: { type: 'number', minimum: 0 },
              HOLIDAY: { type: 'number', minimum: 0 },
              ONE_OFF: { type: 'number', minimum: 0 },
            },
          },
          defaultReminderDays: {
            type: 'array',
            maxItems: 5,
            items: { type: 'integer', minimum: 0, maximum: 365 },
          },
        },
      },
    },
  }, async (request) => {
    const { groupId } = request.params
    await requireOwner(userIdOf(request), groupId)
    const { defaultBudgets, ...rest } = request.body
    await db.group.update({
      where: { id: groupId },
      data: { ...rest, ...(defaultBudgets ? { defaultBudgets: defaultBudgets as Prisma.InputJsonObject } : {}) },
    })
    return groupWithMembers(groupId)
  })
}

async function groupWithMembers(groupId: string) {
  const group = await db.group.findUniqueOrThrow({
    where: { id: groupId },
    include: { memberships: { include: { user: true }, orderBy: { createdAt: 'asc' } } },
  })
  return {
    ...toGroupDto(group),
    members: group.memberships.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      avatarUrl: m.user.avatarUrl,
      role: m.role,
    })),
  }
}
