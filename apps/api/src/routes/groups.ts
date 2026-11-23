import type { FastifyInstance } from 'fastify'
import type { Prisma } from '@prisma/client'
import { db } from '../db.js'
import { toGroupDto } from '../dto.js'
import { requireMember, requireOwner, userIdOf } from '../services/access.js'
import { conflict } from '../http-error.js'
import { firstName, provisionPersonalGroup } from '../services/groups.js'

interface GroupParams { groupId: string }
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
    const userId = userIdOf(request)
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } })
    const first = firstName(user.name)
    const groupId = await db.$transaction(async (tx) => {
      const group = await tx.group.create({
        data: { name: request.body.name?.trim() || `${first}'s group`, memberships: { create: { userId, role: 'OWNER' } } },
      })
      const household = await tx.family.create({ data: { groupId: group.id, householdOfGroupId: group.id, name: `${first}'s household` } })
      await tx.person.create({ data: { groupId: group.id, familyId: household.id, userId, name: user.name } })
      await tx.user.update({ where: { id: userId }, data: { primaryGroupId: group.id } })
      return group.id
    })
    return reply.code(201).send(await groupWithMembers(groupId))
  })

  /**
   * Leave a group. What you added stays with the group, and you stay in its household as a plain
   * person so gift history keeps its names. An owner hands the group to another member first; an owner
   * on their own deletes the group instead. Leaving your last group starts you a fresh one.
   */
  app.post<{ Params: GroupParams; Body: { newOwnerId?: string; deleteGroup?: boolean } }>('/groups/:groupId/leave', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        properties: { newOwnerId: { type: 'string', minLength: 1, maxLength: 64 }, deleteGroup: { type: 'boolean' } },
      },
    },
  }, async (request) => {
    const { groupId } = request.params
    const userId = userIdOf(request)
    const role = await requireMember(userId, groupId)
    const others = await db.groupMembership.findMany({ where: { groupId, userId: { not: userId } } })
    const { newOwnerId, deleteGroup } = request.body ?? {}

    if (role === 'OWNER' && others.length === 0 && !deleteGroup) {
      throw conflict("You're the only one in this group. Leaving deletes it and everything in it.")
    }
    if (role === 'OWNER' && others.length > 0 && !others.some((m) => m.userId === newOwnerId)) {
      throw conflict('Choose who looks after the group when you leave')
    }

    await db.$transaction(async (tx) => {
      await tx.moveRequest.updateMany({
        where: { status: 'PENDING', OR: [{ groupId, requestedById: userId }, { fromGroupId: groupId }] },
        data: { status: 'CANCELLED', decidedAt: new Date() },
      })
      if (role === 'OWNER' && others.length === 0) {
        await tx.group.delete({ where: { id: groupId } })
        return
      }
      if (role === 'OWNER') {
        await tx.groupMembership.update({ where: { groupId_userId: { groupId, userId: newOwnerId! } }, data: { role: 'OWNER' } })
      }
      await tx.person.updateMany({ where: { groupId, userId }, data: { userId: null } })
      await tx.groupMembership.delete({ where: { groupId_userId: { groupId, userId } } })
    })

    const user = await db.user.findUniqueOrThrow({ where: { id: userId } })
    if (user.primaryGroupId === null || user.primaryGroupId === groupId) {
      const next = await db.groupMembership.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } })
      await db.user.update({ where: { id: userId }, data: { primaryGroupId: next?.groupId ?? null } })
    }
    const fresh = await db.user.findUniqueOrThrow({ where: { id: userId } })
    const primaryGroupId = await provisionPersonalGroup(fresh)
    return { primaryGroupId }
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
