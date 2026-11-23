import type { FastifyInstance } from 'fastify'
import { Prisma, type MoveRequest } from '@prisma/client'
import { db } from '../db.js'
import { iso } from '../dto.js'
import { badRequest, conflict, forbidden, notFound } from '../http-error.js'
import { requireMember, userIdOf } from '../services/access.js'
import {
  applyMove,
  isEmptySelection,
  liveSelection,
  movableItems,
  reviewMove,
  sourceGroupFor,
  type Choices,
  type Selection,
} from '../services/move.js'
import { idList } from './schemas.js'

export const selectionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['familyIds', 'occasionIds', 'ideas'],
  properties: { familyIds: idList, occasionIds: idList, ideas: { type: 'boolean' } },
} as const

const choicesSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['familyIds', 'occasionIds', 'ideas'],
  properties: {
    ...selectionSchema.properties,
    keepBothFamilies: idList,
    keepBothPeople: idList,
    useTheirBudget: idList,
  },
} as const

/**
 * Asks to bring `selection` from the user's own group into `groupId`. Null when there's nothing to
 * bring; with `strict`, that and an existing pending request are errors instead.
 */
export async function createMoveRequest(
  userId: string,
  groupId: string,
  selection: Selection,
  strict = false,
): Promise<MoveRequest | null> {
  const source = await sourceGroupFor(userId, groupId)
  if (!source) {
    if (strict) throw badRequest('You have nothing of your own to bring')
    return null
  }
  const live = await liveSelection(db, source.id, selection)
  if (isEmptySelection(live)) {
    if (strict) throw badRequest('Choose something to bring')
    return null
  }
  const pending = await db.moveRequest.findFirst({ where: { fromGroupId: source.id, status: 'PENDING' } })
  if (pending) {
    if (strict) throw conflict('You already asked to bring things from this group')
    return null
  }
  try {
    return await db.moveRequest.create({
      data: { groupId, fromGroupId: source.id, fromGroupName: source.name, requestedById: userId, ...live },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      if (strict) throw conflict('You already asked to bring things from this group')
      return null
    }
    throw err
  }
}

type RequestRow = MoveRequest & { requestedBy: { name: string } }

/** A request as listed: who asked, and how much it brings as things stand now. */
async function summarise(r: RequestRow) {
  const live = r.fromGroupId ? await liveSelection(db, r.fromGroupId, r) : { familyIds: [], occasionIds: [], ideas: false }
  const [families, people, gifts, ideas] = r.fromGroupId
    ? await Promise.all([
        db.family.count({ where: { id: { in: live.familyIds }, householdOfGroupId: null } }),
        db.person.count({ where: { familyId: { in: live.familyIds }, userId: null } }),
        db.giftEntry.count({
          where: { groupId: r.fromGroupId, OR: [{ familyId: { in: live.familyIds } }, { person: { familyId: { in: live.familyIds } } }] },
        }),
        live.ideas ? db.idea.count({ where: { groupId: r.fromGroupId } }) : 0,
      ])
    : [0, 0, 0, 0]
  return {
    id: r.id,
    groupId: r.groupId,
    fromGroupName: r.fromGroupName,
    requestedBy: { userId: r.requestedById, name: r.requestedBy.name },
    status: r.status,
    createdAt: iso(r.createdAt),
    counts: { families, people, gifts, occasions: live.occasionIds.length, ideas },
  }
}

async function loadRequest(userId: string, id: string) {
  const r = await db.moveRequest.findUnique({ where: { id }, include: { requestedBy: { select: { name: true } } } })
  if (!r) throw notFound()
  const role = await requireMember(userId, r.groupId)
  return { r, isOwner: role === 'OWNER' }
}

async function requirePending(r: MoveRequest) {
  if (r.status !== 'PENDING') throw conflict('This request has already been decided')
  if (!r.fromGroupId) throw conflict('There is nothing left to bring')
}

/** Owners may narrow a request, never widen it. */
function within(requested: string[], chosen: string[]): string[] {
  const allowed = new Set(requested)
  return [...new Set(chosen)].filter((x) => allowed.has(x))
}

export async function moveRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // What the user could still bring into this group from their own group (Settings: "Bring my things").
  app.get<{ Params: { groupId: string } }>('/groups/:groupId/movable', async (request) => {
    const userId = userIdOf(request)
    await requireMember(userId, request.params.groupId)
    const source = await sourceGroupFor(userId, request.params.groupId)
    if (!source) return { movable: null, pending: false }
    const pending = (await db.moveRequest.count({ where: { fromGroupId: source.id, status: 'PENDING' } })) > 0
    return { movable: await movableItems(source), pending }
  })

  app.post<{ Params: { groupId: string }; Body: Selection }>(
    '/groups/:groupId/move-requests',
    {
      schema: { body: selectionSchema },
    },
    async (request, reply) => {
      const userId = userIdOf(request)
      await requireMember(userId, request.params.groupId)
      const created = (await createMoveRequest(userId, request.params.groupId, request.body, true))!
      return reply
        .code(201)
        .send(
          await summarise({ ...created, requestedBy: await db.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } }) }),
        )
    },
  )

  // Pending requests into this group: the owner reviews them; the person who asked sees theirs.
  app.get<{ Params: { groupId: string } }>('/groups/:groupId/move-requests', async (request) => {
    const userId = userIdOf(request)
    const role = await requireMember(userId, request.params.groupId)
    const rows = await db.moveRequest.findMany({
      where: { groupId: request.params.groupId, status: 'PENDING', ...(role === 'OWNER' ? {} : { requestedById: userId }) },
      include: { requestedBy: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    })
    return Promise.all(rows.map(summarise))
  })

  app.get<{ Params: { id: string } }>('/move-requests/:id', async (request) => {
    const userId = userIdOf(request)
    const { r, isOwner } = await loadRequest(userId, request.params.id)
    if (!isOwner && r.requestedById !== userId) throw notFound()
    const review = r.status === 'PENDING' && r.fromGroupId ? await reviewMove(r.fromGroupId, r.groupId, r) : null
    return { ...(await summarise(r)), canDecide: isOwner && r.status === 'PENDING', review }
  })

  app.post<{ Params: { id: string }; Body: Choices }>(
    '/move-requests/:id/approve',
    {
      schema: { body: choicesSchema },
    },
    async (request) => {
      const userId = userIdOf(request)
      const { r, isOwner } = await loadRequest(userId, request.params.id)
      if (!isOwner) throw forbidden()
      await requirePending(r)
      const b = request.body
      const choices: Choices = {
        familyIds: within(r.familyIds, b.familyIds),
        occasionIds: within(r.occasionIds, b.occasionIds),
        ideas: r.ideas && b.ideas,
        keepBothFamilies: b.keepBothFamilies ?? [],
        keepBothPeople: b.keepBothPeople ?? [],
        useTheirBudget: b.useTheirBudget ?? [],
      }
      const result = await db.$transaction(
        async (tx) => {
          const claimed = await tx.moveRequest.updateMany({
            where: { id: r.id, status: 'PENDING' },
            data: { status: 'APPROVED', decidedById: userId, decidedAt: new Date() },
          })
          if (claimed.count === 0) throw conflict('This request has already been decided')
          return applyMove(tx, r.fromGroupId!, r.groupId, choices)
        },
        { timeout: 60_000 },
      )
      return { status: 'APPROVED', sourceRemoved: result.sourceRemoved }
    },
  )

  app.post<{ Params: { id: string } }>('/move-requests/:id/decline', async (request) => {
    const userId = userIdOf(request)
    const { r, isOwner } = await loadRequest(userId, request.params.id)
    if (!isOwner) throw forbidden()
    if (r.status !== 'PENDING') throw conflict('This request has already been decided')
    await db.moveRequest.update({ where: { id: r.id }, data: { status: 'DECLINED', decidedById: userId, decidedAt: new Date() } })
    return { status: 'DECLINED' }
  })

  // The person who asked takes it back.
  app.post<{ Params: { id: string } }>('/move-requests/:id/cancel', async (request) => {
    const userId = userIdOf(request)
    const { r } = await loadRequest(userId, request.params.id)
    if (r.requestedById !== userId) throw forbidden()
    if (r.status !== 'PENDING') throw conflict('This request has already been decided')
    await db.moveRequest.update({ where: { id: r.id }, data: { status: 'CANCELLED', decidedAt: new Date() } })
    return { status: 'CANCELLED' }
  })
}
