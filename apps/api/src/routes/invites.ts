import type { FastifyInstance } from 'fastify'
import { Prisma, type InviteKind } from '@prisma/client'
import { db } from '../db.js'
import { env } from '../config.js'
import { iso } from '../dto.js'
import { badRequest, conflict, gone, notFound } from '../http-error.js'
import { requireMember, userIdOf } from '../services/access.js'
import { DEFAULT_SHARED_FIELDS, INVITE_TTL_MS, SHAREABLE_FIELDS, newToken } from '../services/tokens.js'
import { nullableId } from './schemas.js'

async function usableInvite(token: string) {
  const invite = await db.inviteLink.findUnique({
    where: { token },
    include: { createdBy: { select: { name: true } }, group: { select: { name: true } }, family: { select: { name: true } } },
  })
  if (!invite) throw notFound()
  if (invite.acceptedAt) throw gone('This invite has already been used')
  if (invite.expiresAt <= new Date()) throw gone('This invite has expired')
  return invite
}

export async function inviteRoutes(app: FastifyInstance) {
  app.post<{ Params: { groupId: string }; Body: { kind: InviteKind; familyId?: string | null } }>('/groups/:groupId/invites', {
    preHandler: app.authenticate,
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['kind'],
        properties: { kind: { type: 'string', enum: ['FAMILY', 'GROUP'] }, familyId: nullableId },
      },
    },
  }, async (request, reply) => {
    const { groupId } = request.params
    const userId = userIdOf(request)
    await requireMember(userId, groupId)
    const { kind, familyId } = request.body

    if (kind === 'GROUP' && familyId) throw badRequest('A group invite has no family')
    if (kind === 'FAMILY') {
      if (!familyId) throw badRequest('A family invite needs familyId')
      const family = await db.family.findUnique({ where: { id: familyId }, include: { connection: true } })
      if (!family || family.groupId !== groupId) throw badRequest('Family not in this group')
      if (family.householdOfGroupId !== null) throw badRequest("You can't invite your own household")
      if (family.connection) throw conflict('This family is already connected')
    }

    const invite = await db.inviteLink.create({
      data: { token: newToken(), kind, groupId, familyId: familyId ?? null, createdById: userId, expiresAt: new Date(Date.now() + INVITE_TTL_MS) },
    })
    return reply.code(201).send({ token: invite.token, url: `${env.WEB_APP_URL}/join/${invite.token}`, expiresAt: iso(invite.expiresAt) })
  })

  // Public preview, so the join page can show who is inviting before sign-in.
  app.get<{ Params: { token: string } }>('/invites/:token', async (request) => {
    const invite = await usableInvite(request.params.token)
    return {
      kind: invite.kind,
      inviterName: invite.createdBy.name,
      groupName: invite.group.name,
      familyName: invite.family?.name ?? null,
      expiresAt: iso(invite.expiresAt),
    }
  })

  app.post<{ Params: { token: string }; Body: { sourceFamilyId?: string; sharedFields?: string[] } }>('/invites/:token/accept', {
    preHandler: app.authenticate,
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          sourceFamilyId: { type: 'string', minLength: 1, maxLength: 64 },
          sharedFields: { type: 'array', maxItems: SHAREABLE_FIELDS.length, items: { type: 'string', enum: [...SHAREABLE_FIELDS] } },
        },
      },
    },
  }, async (request) => {
    const userId = userIdOf(request)
    const invite = await usableInvite(request.params.token)
    const claim = (tx: Prisma.TransactionClient) =>
      tx.inviteLink.updateMany({
        where: { id: invite.id, acceptedAt: null, expiresAt: { gt: new Date() } },
        data: { acceptedAt: new Date(), acceptedById: userId },
      })

    if (invite.kind === 'GROUP') {
      const existing = await db.groupMembership.findUnique({ where: { groupId_userId: { groupId: invite.groupId, userId } } })
      if (existing) return { groupId: invite.groupId, alreadyMember: true }
      await db.$transaction(async (tx) => {
        if ((await claim(tx)).count === 0) throw gone('This invite has already been used')
        await tx.groupMembership.create({ data: { groupId: invite.groupId, userId, role: 'MEMBER' } })
      })
      return { groupId: invite.groupId, alreadyMember: false }
    }

    const { sourceFamilyId, sharedFields = DEFAULT_SHARED_FIELDS } = request.body
    if (!sourceFamilyId) throw badRequest('Choose which of your families to connect')
    const source = await db.family.findUnique({ where: { id: sourceFamilyId } })
    if (!source) throw badRequest('Family not found')
    const membership = await db.groupMembership.findUnique({ where: { groupId_userId: { groupId: source.groupId, userId } } })
    if (!membership) throw badRequest('That family is not in one of your groups')
    if (source.groupId === invite.groupId) throw badRequest("A family can't connect to a family in the same group")

    try {
      const connection = await db.$transaction(async (tx) => {
        if ((await claim(tx)).count === 0) throw gone('This invite has already been used')
        return tx.familyConnection.create({ data: { familyId: invite.familyId!, sourceFamilyId, sharedFields: [...new Set(sharedFields)] } })
      })
      return { connectionId: connection.id }
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw conflict('This family is already connected')
      throw err
    }
  })

  app.delete<{ Params: { id: string } }>('/family-connections/:id', { preHandler: app.authenticate }, async (request, reply) => {
    const userId = userIdOf(request)
    const connection = await db.familyConnection.findUnique({
      where: { id: request.params.id },
      include: { family: { select: { groupId: true } }, sourceFamily: { select: { groupId: true } } },
    })
    if (!connection) throw notFound()
    const allowed = await db.groupMembership.count({
      where: { userId, groupId: { in: [connection.family.groupId, connection.sourceFamily.groupId] } },
    })
    if (allowed === 0) throw notFound()
    await db.familyConnection.delete({ where: { id: connection.id } })
    return reply.code(204).send()
  })
}
