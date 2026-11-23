import { db } from '../db.js'

class AlreadyProvisioned extends Error {}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'My'
}

/**
 * Returns the user's primary group id, creating a personal group (user as OWNER) and an
 * own-household family first if the user has none. Safe to call on every sign-in.
 */
export async function provisionPersonalGroup(user: { id: string; name: string; primaryGroupId: string | null }): Promise<string> {
  if (user.primaryGroupId) return user.primaryGroupId
  const first = firstName(user.name)
  try {
    return await db.$transaction(async (tx) => {
      const group = await tx.group.create({
        data: { name: `${first}'s group`, memberships: { create: { userId: user.id, role: 'OWNER' } } },
      })
      const household = await tx.family.create({
        data: { groupId: group.id, householdOfGroupId: group.id, name: `${first}'s household`, type: 'FAMILY' },
      })
      await tx.person.create({ data: { groupId: group.id, familyId: household.id, userId: user.id, name: user.name } })
      // Concurrent first sign-ins: only one transaction can claim the null primaryGroupId; the other rolls back.
      const claimed = await tx.user.updateMany({
        where: { id: user.id, primaryGroupId: null },
        data: { primaryGroupId: group.id },
      })
      if (claimed.count === 0) throw new AlreadyProvisioned()
      return group.id
    })
  } catch (err) {
    if (!(err instanceof AlreadyProvisioned)) throw err
    const fresh = await db.user.findUniqueOrThrow({ where: { id: user.id } })
    return fresh.primaryGroupId!
  }
}

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0]

/** Puts the user in the group's household as a person, so the people who sign in show up as its members. */
export async function addAccountHolder(tx: Tx, groupId: string, user: { id: string; name: string }): Promise<void> {
  const household = await tx.family.findUnique({ where: { householdOfGroupId: groupId } })
  if (!household) return
  await tx.person.upsert({
    where: { groupId_userId: { groupId, userId: user.id } },
    create: { groupId, familyId: household.id, userId: user.id, name: user.name },
    update: {},
  })
}

/** How much the user would bring by moving their personal group into another. */
export interface MovableData {
  groupId: string
  groupName: string
  families: number
  people: number
  gifts: number
  ideas: number
  occasions: number
}

/**
 * The user's own group that can be moved into `targetGroupId` when they join it: their primary group,
 * if they own it, nobody else is in it, and it holds something besides themselves. Otherwise null.
 */
export async function movableData(userId: string, targetGroupId: string): Promise<MovableData | null> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { primaryGroupId: true } })
  const groupId = user?.primaryGroupId
  if (!groupId || groupId === targetGroupId) return null
  const group = await db.group.findUnique({ where: { id: groupId }, include: { memberships: true } })
  if (!group || group.memberships.length !== 1 || group.memberships[0]!.userId !== userId || group.memberships[0]!.role !== 'OWNER') return null
  const [families, people, gifts, ideas, occasions] = await Promise.all([
    db.family.count({ where: { groupId, householdOfGroupId: null } }),
    db.person.count({ where: { groupId, userId: null } }),
    db.giftEntry.count({ where: { groupId } }),
    db.idea.count({ where: { groupId } }),
    db.occasion.count({ where: { groupId } }),
  ])
  if (families + people + gifts + ideas + occasions === 0) return null
  return { groupId, groupName: group.name, families, people, gifts, ideas, occasions }
}

/** Points everything that refers to person `from` at person `into`, then deletes `from`. */
async function mergePerson(tx: Tx, from: string, into: string): Promise<void> {
  await tx.giftEntry.updateMany({ where: { personId: from }, data: { personId: into } })
  await tx.occasion.updateMany({ where: { personId: from }, data: { personId: into } })
  await tx.$executeRaw`UPDATE "GiftCredit" c SET "personId" = ${into} WHERE c."personId" = ${from}
    AND NOT EXISTS (SELECT 1 FROM "GiftCredit" t WHERE t."giftEntryId" = c."giftEntryId" AND t."personId" = ${into})`
  await tx.$executeRaw`UPDATE "IdeaPerson" c SET "personId" = ${into} WHERE c."personId" = ${from}
    AND NOT EXISTS (SELECT 1 FROM "IdeaPerson" t WHERE t."ideaId" = c."ideaId" AND t."personId" = ${into})`
  const [a, b] = await Promise.all([tx.person.findUniqueOrThrow({ where: { id: from } }), tx.person.findUniqueOrThrow({ where: { id: into } })])
  await tx.person.update({
    where: { id: into },
    data: {
      birthMonth: b.birthMonth ?? a.birthMonth, birthDay: b.birthDay ?? a.birthDay, birthYear: b.birthYear ?? a.birthYear,
      likes: [...new Set([...b.likes, ...a.likes])], avoid: [...new Set([...b.avoid, ...a.avoid])],
      foodNotes: b.foodNotes ?? a.foodNotes, photoUrl: b.photoUrl ?? a.photoUrl, notes: b.notes ?? a.notes,
    },
  })
  await tx.person.delete({ where: { id: from } })
}

/**
 * Moves everything in group `sourceId` into group `targetId`, then deletes the emptied source group.
 * The source household's people join the target household; the same account holder in both becomes one
 * person. Built-in holidays both groups track become one occasion. Run inside a transaction.
 */
export async function moveGroupInto(tx: Tx, sourceId: string, targetId: string): Promise<void> {
  const [srcHousehold, tgtHousehold] = await Promise.all([
    tx.family.findUniqueOrThrow({ where: { householdOfGroupId: sourceId } }),
    tx.family.findUniqueOrThrow({ where: { householdOfGroupId: targetId } }),
  ])
  const into = { groupId: targetId }

  // People in the source household: account holders already in the target merge; the rest move.
  for (const p of await tx.person.findMany({ where: { familyId: srcHousehold.id } })) {
    const twin = p.userId ? await tx.person.findUnique({ where: { groupId_userId: { groupId: targetId, userId: p.userId } } }) : null
    if (twin) await mergePerson(tx, p.id, twin.id)
    else await tx.person.update({ where: { id: p.id }, data: { groupId: targetId, familyId: tgtHousehold.id } })
  }

  // Built-in holidays the target tracks too: one occasion, covering both groups' families.
  const tgtHolidays = await tx.occasion.findMany({ where: { groupId: targetId, holidayKey: { not: null } } })
  for (const o of await tx.occasion.findMany({ where: { groupId: sourceId, holidayKey: { not: null } }, include: { coverage: true } })) {
    const twin = tgtHolidays.find((t) => t.holidayKey === o.holidayKey)
    if (!twin) continue
    await tx.giftEntry.updateMany({ where: { occasionId: o.id }, data: { occasionId: twin.id } })
    await tx.idea.updateMany({ where: { occasionId: o.id }, data: { occasionId: twin.id } })
    for (const c of o.coverage) {
      if (c.familyId === srcHousehold.id) continue
      await tx.occasionFamily.upsert({
        where: { occasionId_familyId: { occasionId: twin.id, familyId: c.familyId } },
        create: { occasionId: twin.id, familyId: c.familyId, budget: c.budget },
        update: {},
      })
    }
    await tx.occasion.delete({ where: { id: o.id } })
  }

  // The source household's coverage, gifts and occasions become the target household's.
  await tx.$executeRaw`UPDATE "OccasionFamily" c SET "familyId" = ${tgtHousehold.id} WHERE c."familyId" = ${srcHousehold.id}
    AND NOT EXISTS (SELECT 1 FROM "OccasionFamily" t WHERE t."occasionId" = c."occasionId" AND t."familyId" = ${tgtHousehold.id})`
  await tx.occasionFamily.deleteMany({ where: { familyId: srcHousehold.id } })
  await tx.giftEntry.updateMany({ where: { familyId: srcHousehold.id }, data: { familyId: tgtHousehold.id } })
  await tx.occasion.updateMany({ where: { familyId: srcHousehold.id }, data: { familyId: tgtHousehold.id } })
  await tx.familyConnection.updateMany({ where: { sourceFamilyId: srcHousehold.id }, data: { sourceFamilyId: tgtHousehold.id } })

  // Group-wide occasions coming over that cover new families also cover the families already in the target.
  const incoming = await tx.occasion.findMany({ where: { groupId: sourceId, personId: null, familyId: null, includeNewFamilies: true }, select: { id: true } })
  const existing = await tx.family.findMany({ where: { groupId: targetId, status: { not: 'ARCHIVED' } }, select: { id: true } })
  if (incoming.length > 0 && existing.length > 0) {
    await tx.occasionFamily.createMany({
      data: incoming.flatMap((o) => existing.map((f) => ({ occasionId: o.id, familyId: f.id }))),
      skipDuplicates: true,
    })
  }

  // Everything else moves as is.
  const moved = await tx.family.findMany({ where: { groupId: sourceId, householdOfGroupId: null }, select: { id: true } })
  await tx.family.updateMany({ where: { groupId: sourceId, householdOfGroupId: null }, data: into })
  await tx.person.updateMany({ where: { groupId: sourceId }, data: into })
  await tx.occasion.updateMany({ where: { groupId: sourceId }, data: into })
  await tx.giftEntry.updateMany({ where: { groupId: sourceId }, data: into })
  await tx.idea.updateMany({ where: { groupId: sourceId }, data: into })

  // Families in one group can't be connected to each other.
  await tx.familyConnection.deleteMany({ where: { family: { groupId: targetId }, sourceFamily: { groupId: targetId } } })

  // The target's group-wide occasions that cover new families now cover the moved ones.
  const covering = await tx.occasion.findMany({ where: { groupId: targetId, personId: null, familyId: null, includeNewFamilies: true }, select: { id: true } })
  if (moved.length > 0 && covering.length > 0) {
    await tx.occasionFamily.createMany({
      data: covering.flatMap((o) => moved.map((f) => ({ occasionId: o.id, familyId: f.id }))),
      skipDuplicates: true,
    })
  }

  await tx.user.updateMany({ where: { primaryGroupId: sourceId }, data: { primaryGroupId: targetId } })
  await tx.group.delete({ where: { id: sourceId } })
}
