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

export type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0]

/** Puts the user in the group's household as a person, so the people who sign in show up as its members. */
export async function addAccountHolder(tx: Tx, groupId: string, user: { id: string; name: string }): Promise<void> {
  const household = await tx.family.findUnique({ where: { householdOfGroupId: groupId } })
  if (!household) return
  if (await tx.person.findUnique({ where: { groupId_userId: { groupId, userId: user.id } } })) return
  // Someone who left and came back gets their old household entry back.
  const key = (n: string) => n.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase()
  const previous = (await tx.person.findMany({ where: { familyId: household.id, userId: null } })).find((p) => key(p.name) === key(user.name))
  if (previous) { await tx.person.update({ where: { id: previous.id }, data: { userId: user.id } }); return }
  await tx.person.upsert({
    where: { groupId_userId: { groupId, userId: user.id } },
    create: { groupId, familyId: household.id, userId: user.id, name: user.name },
    update: {},
  })
}

