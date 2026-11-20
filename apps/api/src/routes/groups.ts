import type { FastifyInstance } from 'fastify'
import type { Prisma } from '@prisma/client'
import { db } from '../db.js'
import { toGroupDto } from '../dto.js'
import { requireMember, requireOwner, userIdOf } from '../services/access.js'

interface GroupParams { groupId: string }
interface UpdateGroupBody {
  name?: string
  currency?: string
  defaultBudgets?: Record<string, number>
  defaultReminderDays?: number[]
}

export async function groupRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

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
