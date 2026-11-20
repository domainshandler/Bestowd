import type { FastifyInstance } from 'fastify'
import { db } from '../db.js'
import { toUserDto } from '../dto.js'
import type { OccasionType } from '@prisma/client'
import { userIdOf } from '../services/access.js'
import { round2 } from '../services/gift-totals.js'
import { activeSubjectWhere, occasionInclude, serialiseOccasions } from '../services/occasions.js'
import { listQuerySchema, windowWhere } from './occasions.js'

export async function meRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  app.get('/me', async (request) => {
    const userId = userIdOf(request)
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } })
    const memberships = await db.groupMembership.findMany({
      where: { userId },
      include: { group: { include: { _count: { select: { memberships: true } } } } },
      orderBy: { createdAt: 'asc' },
    })
    memberships.sort((x, y) => Number(y.groupId === user.primaryGroupId) - Number(x.groupId === user.primaryGroupId))

    return {
      user: toUserDto(user),
      primaryGroupId: user.primaryGroupId,
      memberships: memberships.map((m) => ({
        groupId: m.groupId,
        groupName: m.group.name,
        role: m.role,
        memberCount: m.group._count.memberships,
      })),
    }
  })

  // Home: upcoming occasions across every group the user belongs to.
  app.get<{ Querystring: { from?: string; to?: string; type?: OccasionType } }>('/me/occasions', {
    schema: { querystring: listQuerySchema },
  }, async (request) => {
    const userId = userIdOf(request)
    const { type } = request.query
    const [membershipCount, rows] = await Promise.all([
      db.groupMembership.count({ where: { userId } }),
      db.occasion.findMany({
        where: {
          group: { memberships: { some: { userId } } },
          nextOccurrence: windowWhere(request.query),
          ...activeSubjectWhere,
          ...(type ? { type } : {}),
        },
        include: occasionInclude,
        orderBy: { nextOccurrence: 'asc' },
      }),
    ])
    const occasions = await serialiseOccasions(rows)

    const byCurrency = new Map<string, number>()
    for (const [i, o] of occasions.entries()) {
      const currency = rows[i]!.group.currency
      byCurrency.set(currency, (byCurrency.get(currency) ?? 0) + (o.effectiveBudget ?? 0))
    }

    return {
      occasions,
      plannedSpend: [...byCurrency].map(([currency, amount]) => ({ currency, amount: round2(amount) })),
      multipleGroups: membershipCount > 1,
    }
  })
}
