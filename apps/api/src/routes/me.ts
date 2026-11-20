import type { FastifyInstance } from 'fastify'
import { db } from '../db.js'
import { toUserDto } from '../dto.js'
import { userIdOf } from '../services/access.js'

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
}
