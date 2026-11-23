/**
 * Bringing things from your own group into a group you've joined.
 *
 * The joiner picks which families, holidays and ideas to bring. That makes a MoveRequest, and the
 * receiving group's owner reviews it. Look-alike families and people (same name) are flagged: by
 * default they merge, or the owner keeps both. Holidays both groups track become one occasion, with
 * the owner choosing whose budget to keep. The receiving group's settings never change.
 */
import type { Prisma } from '@prisma/client'
import { db } from '../db.js'
import type { Tx } from './groups.js'
import { GROUP_WIDE } from './occasions.js'

type Client = Tx | typeof db

/** "The Chen family", "The Chens", "chen  Family" and "Chén" all become "chen". */
export function normalName(name: string): string {
  return name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim()
    .replace(/^the /, '').replace(/ (family|household)$/, '').trim()
    .replace(/(\w{3,})s$/, '$1')
}

/** What can be brought along: everything chosen at once. */
export interface Selection {
  familyIds: string[]
  occasionIds: string[]
  ideas: boolean
}

/** The owner's decisions on a request. */
export interface Choices extends Selection {
  /** Incoming families or people to keep separate from their look-alike instead of merging. */
  keepBothFamilies: string[]
  keepBothPeople: string[]
  /** Incoming holidays whose budgets replace those of the matching holiday. */
  useTheirBudget: string[]
}

/** Something in the receiving group that an incoming item matches. */
interface Match { id: string; name: string }

export interface MovableFamily { id: string; name: string; isOwnHousehold: boolean; people: number; gifts: number }
export interface MovableItems {
  groupId: string
  groupName: string
  families: MovableFamily[]
  occasions: { id: string; name: string }[]
  ideas: number
}

/** True when the group holds anything besides its account holders. */
export async function hasContent(c: Client, groupId: string): Promise<boolean> {
  const counts = await Promise.all([
    c.family.count({ where: { groupId, householdOfGroupId: null } }),
    c.person.count({ where: { groupId, userId: null } }),
    c.giftEntry.count({ where: { groupId } }),
    c.idea.count({ where: { groupId } }),
    c.occasion.count({ where: { groupId } }),
  ])
  return counts.some((n) => n > 0)
}

/**
 * The user's own group they can bring things from into `targetGroupId`: one they own, that nobody else
 * is in, and that holds something. Their primary group first. Null when there's none.
 */
export async function sourceGroupFor(userId: string, targetGroupId: string): Promise<{ id: string; name: string } | null> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { primaryGroupId: true } })
  const owned = await db.groupMembership.findMany({
    where: { userId, role: 'OWNER', groupId: { not: targetGroupId } },
    include: { group: { include: { _count: { select: { memberships: true } } } } },
    orderBy: { createdAt: 'asc' },
  })
  owned.sort((a, b) => Number(b.groupId === user.primaryGroupId) - Number(a.groupId === user.primaryGroupId))
  for (const m of owned) {
    if (m.group._count.memberships === 1 && (await hasContent(db, m.groupId))) return { id: m.groupId, name: m.group.name }
  }
  return null
}

const giftsOfFamily = (familyId: string): Prisma.GiftEntryWhereInput => ({ OR: [{ familyId }, { person: { familyId } }] })

/** Everything in the group that could be brought, for the joiner's checklist. Empty households are left out. */
export async function movableItems(group: { id: string; name: string }): Promise<MovableItems> {
  const families = await db.family.findMany({ where: { groupId: group.id }, orderBy: [{ householdOfGroupId: 'asc' }, { name: 'asc' }] })
  const rows: MovableFamily[] = []
  for (const f of families) {
    const [people, gifts] = await Promise.all([
      db.person.count({ where: { familyId: f.id, userId: null } }),
      db.giftEntry.count({ where: giftsOfFamily(f.id) }),
    ])
    const isOwnHousehold = f.householdOfGroupId !== null
    if (isOwnHousehold && people === 0 && gifts === 0) continue
    rows.push({ id: f.id, name: f.name, isOwnHousehold, people, gifts })
  }
  rows.sort((a, b) => Number(b.isOwnHousehold) - Number(a.isOwnHousehold) || a.name.localeCompare(b.name))
  const occasions = await db.occasion.findMany({ where: { groupId: group.id, ...GROUP_WIDE }, select: { id: true, name: true }, orderBy: { name: 'asc' } })
  return { groupId: group.id, groupName: group.name, families: rows, occasions, ideas: await db.idea.count({ where: { groupId: group.id } }) }
}

/** The ids of a selection that still exist in the source group. */
export async function liveSelection(c: Client, sourceId: string, s: Selection): Promise<Selection> {
  const [families, occasions] = await Promise.all([
    c.family.findMany({ where: { groupId: sourceId, id: { in: s.familyIds } }, select: { id: true } }),
    c.occasion.findMany({ where: { groupId: sourceId, id: { in: s.occasionIds }, ...GROUP_WIDE }, select: { id: true } }),
  ])
  return { familyIds: families.map((f) => f.id), occasionIds: occasions.map((o) => o.id), ideas: s.ideas }
}

export function isEmptySelection(s: Selection): boolean {
  return s.familyIds.length === 0 && s.occasionIds.length === 0 && !s.ideas
}

/** For each incoming family: the receiving family it would merge into. The household always goes to the household. */
async function familyMatches(c: Client, sourceId: string, targetId: string, familyIds: string[]) {
  const [incoming, existing] = await Promise.all([
    c.family.findMany({ where: { groupId: sourceId, id: { in: familyIds } } }),
    c.family.findMany({ where: { groupId: targetId } }),
  ])
  const household = existing.find((f) => f.householdOfGroupId !== null)!
  return incoming.map((f) => {
    if (f.householdOfGroupId !== null) return { family: f, match: { id: household.id, name: household.name } as Match, isHousehold: true }
    const twin = existing.find((e) => e.householdOfGroupId === null && normalName(e.name) === normalName(f.name))
    return { family: f, match: twin ? ({ id: twin.id, name: twin.name } as Match) : null, isHousehold: false }
  })
}

/** For incoming people (not account holders) in a merging family: the receiving person with the same name. */
async function personMatches(c: Client, pairs: { from: string; into: string }[]) {
  const out: { person: { id: string; name: string; familyId: string }; match: Match }[] = []
  for (const { from, into } of pairs) {
    const [incoming, existing] = await Promise.all([
      c.person.findMany({ where: { familyId: from, userId: null } }),
      c.person.findMany({ where: { familyId: into } }),
    ])
    for (const p of incoming) {
      const twin = existing.find((e) => normalName(e.name) === normalName(p.name))
      if (twin) out.push({ person: { id: p.id, name: p.name, familyId: p.familyId }, match: { id: twin.id, name: twin.name } })
    }
  }
  return out
}

/** The receiving group's group-wide occasion an incoming one matches: same built-in holiday, or same name. */
function occasionTwin<T extends { holidayKey: string | null; name: string }>(o: { holidayKey: string | null; name: string }, existing: T[]): T | undefined {
  return existing.find((e) => (o.holidayKey !== null ? e.holidayKey === o.holidayKey : e.holidayKey === null && normalName(e.name) === normalName(o.name)))
}

const sameBudget = (a: { budget: Prisma.Decimal | null; familyTypeBudgets: Prisma.JsonValue }, b: typeof a) =>
  String(a.budget ?? '') === String(b.budget ?? '') && JSON.stringify(a.familyTypeBudgets ?? {}) === JSON.stringify(b.familyTypeBudgets ?? {})

/** What the owner sees when reviewing a request: the items, their look-alikes, and differences to decide on. */
export async function reviewMove(sourceId: string, targetId: string, selection: Selection) {
  const live = await liveSelection(db, sourceId, selection)
  const [source, target] = await Promise.all([db.group.findUniqueOrThrow({ where: { id: sourceId } }), db.group.findUniqueOrThrow({ where: { id: targetId } })])
  const fams = await familyMatches(db, sourceId, targetId, live.familyIds)
  const families = []
  for (const { family, match, isHousehold } of fams) {
    const [people, gifts] = await Promise.all([
      db.person.count({ where: { familyId: family.id, userId: null } }),
      db.giftEntry.count({ where: giftsOfFamily(family.id) }),
    ])
    families.push({ id: family.id, name: family.name, isOwnHousehold: isHousehold, people, gifts, match: isHousehold ? null : match })
  }
  const people = await personMatches(db, fams.filter((f) => f.match).map((f) => ({ from: f.family.id, into: f.match!.id })))

  const existing = await db.occasion.findMany({ where: { groupId: targetId, ...GROUP_WIDE } })
  const incoming = await db.occasion.findMany({ where: { id: { in: live.occasionIds } }, orderBy: { name: 'asc' } })
  const occasions = incoming.map((o) => {
    const twin = occasionTwin(o, existing)
    return {
      id: o.id, name: o.name,
      match: twin ? { id: twin.id, name: twin.name } : null,
      budgetDiffers: twin ? !sameBudget(o, twin) : false,
      theirBudget: o.budget === null ? null : Number(o.budget),
      ourBudget: twin?.budget == null ? null : Number(twin.budget),
    }
  })
  return {
    currency: source.currency === target.currency ? null : { from: source.currency, to: target.currency },
    families: families.sort((a, b) => Number(b.isOwnHousehold) - Number(a.isOwnHousehold) || a.name.localeCompare(b.name)),
    people: people.map(({ person, match }) => ({ ...person, match })),
    occasions,
    ideas: live.ideas ? await db.idea.count({ where: { groupId: sourceId } }) : 0,
  }
}

/** Points everything that refers to person `from` at person `into`, fills in what `into` lacks, then deletes `from`. */
export async function mergePerson(tx: Tx, from: string, into: string): Promise<void> {
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
      relationship: b.relationship ?? a.relationship,
      birthMonth: b.birthMonth ?? a.birthMonth, birthDay: b.birthDay ?? a.birthDay, birthYear: b.birthYear ?? a.birthYear,
      likes: [...new Set([...b.likes, ...a.likes])], avoid: [...new Set([...b.avoid, ...a.avoid])],
      foodNotes: b.foodNotes ?? a.foodNotes, photoUrl: b.photoUrl ?? a.photoUrl, notes: b.notes ?? a.notes,
    },
  })
  await tx.person.delete({ where: { id: from } })
}

/** Moves family `from`'s people (merging same-named ones unless kept apart), gifts and occasions into `into`, then deletes it. */
async function mergeFamily(tx: Tx, from: string, into: string, targetId: string, keepBothPeople: Set<string>): Promise<void> {
  const existing = await tx.person.findMany({ where: { familyId: into } })
  for (const p of await tx.person.findMany({ where: { familyId: from } })) {
    const twin = p.userId
      ? await tx.person.findUnique({ where: { groupId_userId: { groupId: targetId, userId: p.userId } } })
      : keepBothPeople.has(p.id) ? undefined : existing.find((e) => normalName(e.name) === normalName(p.name))
    if (twin) await mergePerson(tx, p.id, twin.id)
    else await tx.person.update({ where: { id: p.id }, data: { familyId: into, groupId: targetId } })
  }
  await tx.giftEntry.updateMany({ where: { familyId: from }, data: { familyId: into } })
  await tx.occasion.updateMany({ where: { familyId: from }, data: { familyId: into } })
  await tx.$executeRaw`UPDATE "OccasionFamily" c SET "familyId" = ${into} WHERE c."familyId" = ${from}
    AND NOT EXISTS (SELECT 1 FROM "OccasionFamily" t WHERE t."occasionId" = c."occasionId" AND t."familyId" = ${into})`
  await tx.familyConnection.updateMany({ where: { sourceFamilyId: from }, data: { sourceFamilyId: into } })
  if (!(await tx.familyConnection.findUnique({ where: { familyId: into } }))) {
    await tx.familyConnection.updateMany({ where: { familyId: from }, data: { familyId: into } })
  }
  const [a, b] = await Promise.all([tx.family.findUniqueOrThrow({ where: { id: from } }), tx.family.findUniqueOrThrow({ where: { id: into } })])
  await tx.family.update({ where: { id: into }, data: { notes: b.notes ?? a.notes, photoUrl: b.photoUrl ?? a.photoUrl } })
  await tx.family.delete({ where: { id: from } })
}

/**
 * Brings the chosen things from `sourceId` into `targetId`. Families go with their people, the gifts
 * for them, and their own occasions such as birthdays. Links to things left behind are dropped: a
 * moved gift for a holiday that stays loses the holiday unless the receiving group tracks it too.
 * Removes the source group when nothing is left in it. Run inside a transaction.
 */
export async function applyMove(tx: Tx, sourceId: string, targetId: string, choices: Choices): Promise<{ sourceRemoved: boolean }> {
  const sel = await liveSelection(tx, sourceId, choices)
  const keepBothFamilies = new Set(choices.keepBothFamilies)
  const keepBothPeople = new Set(choices.keepBothPeople)
  const useTheirBudget = new Set(choices.useTheirBudget)
  const [srcHousehold, tgtHousehold] = await Promise.all([
    tx.family.findUniqueOrThrow({ where: { householdOfGroupId: sourceId } }),
    tx.family.findUniqueOrThrow({ where: { householdOfGroupId: targetId } }),
  ])
  const famIds = sel.familyIds
  const personIds = (await tx.person.findMany({ where: { familyId: { in: famIds } }, select: { id: true } })).map((p) => p.id)
  const giftIds = (await tx.giftEntry.findMany({
    where: { groupId: sourceId, OR: [{ familyId: { in: famIds } }, { personId: { in: personIds } }] }, select: { id: true },
  })).map((g) => g.id)
  const subjectOccIds = (await tx.occasion.findMany({
    where: { groupId: sourceId, OR: [{ familyId: { in: famIds } }, { personId: { in: personIds } }] }, select: { id: true },
  })).map((o) => o.id)
  const movingOccIds = [...subjectOccIds, ...sel.occasionIds]
  const ideaIds = sel.ideas ? (await tx.idea.findMany({ where: { groupId: sourceId }, select: { id: true } })).map((i) => i.id) : []
  const staysInSource = { groupId: sourceId }

  // Cut links between what moves and what stays.
  await tx.giftEntry.updateMany({ where: { ...staysInSource, id: { notIn: giftIds }, occasionId: { in: movingOccIds } }, data: { occasionId: null } })
  await tx.giftEntry.updateMany({ where: { ...staysInSource, id: { notIn: giftIds }, ideaId: { in: ideaIds } }, data: { ideaId: null } })
  await tx.giftEntry.updateMany({ where: { id: { in: giftIds }, ideaId: { notIn: ideaIds } }, data: { ideaId: null } })
  await tx.idea.updateMany({ where: { ...staysInSource, id: { notIn: ideaIds }, occasionId: { in: movingOccIds } }, data: { occasionId: null } })
  await tx.idea.updateMany({ where: { id: { in: ideaIds }, occasionId: { notIn: movingOccIds } }, data: { occasionId: null } })
  await tx.giftCredit.deleteMany({ where: { giftEntryId: { in: giftIds }, personId: { notIn: personIds } } })
  await tx.giftCredit.deleteMany({ where: { giftEntry: { ...staysInSource }, giftEntryId: { notIn: giftIds }, personId: { in: personIds } } })
  await tx.ideaPerson.deleteMany({ where: { ideaId: { in: ideaIds }, personId: { notIn: personIds } } })
  await tx.ideaPerson.deleteMany({ where: { idea: { ...staysInSource }, ideaId: { notIn: ideaIds }, personId: { in: personIds } } })
  // Holidays that stay no longer cover families that leave; holidays that leave only cover families that come along.
  await tx.occasionFamily.deleteMany({ where: { occasion: { ...staysInSource }, occasionId: { notIn: movingOccIds }, familyId: { in: famIds.filter((f) => f !== srcHousehold.id) } } })
  await tx.occasionFamily.deleteMany({ where: { occasionId: { in: sel.occasionIds }, familyId: { notIn: [...famIds, srcHousehold.id] } } })
  await tx.inviteLink.deleteMany({ where: { familyId: { in: famIds } } })

  // Moved gifts for a holiday that stays: use the receiving group's same holiday, if it has one.
  const existingWide = await tx.occasion.findMany({ where: { groupId: targetId, ...GROUP_WIDE } })
  const leftBehind = await tx.occasion.findMany({ where: { ...staysInSource, ...GROUP_WIDE, id: { notIn: movingOccIds }, gifts: { some: { id: { in: giftIds } } } } })
  for (const o of leftBehind) {
    const twin = occasionTwin(o, existingWide)
    await tx.giftEntry.updateMany({ where: { id: { in: giftIds }, occasionId: o.id }, data: { occasionId: twin?.id ?? null } })
  }
  await tx.giftEntry.updateMany({ where: { id: { in: giftIds }, occasionId: { notIn: movingOccIds }, occasion: { groupId: sourceId } }, data: { occasionId: null } })

  // Holidays coming over: one occasion per holiday; otherwise they cover the receiving group's families too.
  const existingFamilies = await tx.family.findMany({ where: { groupId: targetId, status: { not: 'ARCHIVED' } }, select: { id: true } })
  for (const o of await tx.occasion.findMany({ where: { id: { in: sel.occasionIds } }, include: { coverage: true } })) {
    const twin = occasionTwin(o, existingWide)
    const mapFamily = (id: string) => (id === srcHousehold.id ? tgtHousehold.id : id)
    if (twin) {
      if (useTheirBudget.has(o.id)) {
        await tx.occasion.update({ where: { id: twin.id }, data: { budget: o.budget, familyTypeBudgets: o.familyTypeBudgets as Prisma.InputJsonValue } })
      }
      for (const c of o.coverage) {
        await tx.occasionFamily.upsert({
          where: { occasionId_familyId: { occasionId: twin.id, familyId: mapFamily(c.familyId) } },
          create: { occasionId: twin.id, familyId: mapFamily(c.familyId), budget: c.budget },
          update: {},
        })
      }
      await tx.giftEntry.updateMany({ where: { occasionId: o.id }, data: { occasionId: twin.id } })
      await tx.idea.updateMany({ where: { occasionId: o.id }, data: { occasionId: twin.id } })
      await tx.occasion.delete({ where: { id: o.id } })
      continue
    }
    await tx.$executeRaw`UPDATE "OccasionFamily" c SET "familyId" = ${tgtHousehold.id} WHERE c."occasionId" = ${o.id} AND c."familyId" = ${srcHousehold.id}`
    if (o.includeNewFamilies && existingFamilies.length > 0) {
      await tx.occasionFamily.createMany({ data: existingFamilies.map((f) => ({ occasionId: o.id, familyId: f.id })), skipDuplicates: true })
    }
  }

  // Families: the household's people join the receiving household; look-alikes merge unless kept apart.
  const moved: string[] = []
  for (const { family, match, isHousehold } of await familyMatches(tx, sourceId, targetId, famIds)) {
    if (isHousehold) {
      const existing = await tx.person.findMany({ where: { familyId: tgtHousehold.id } })
      for (const p of await tx.person.findMany({ where: { familyId: family.id } })) {
        const twin = p.userId
          ? existing.find((e) => e.userId === p.userId)
          : keepBothPeople.has(p.id) ? undefined : existing.find((e) => normalName(e.name) === normalName(p.name))
        if (twin) await mergePerson(tx, p.id, twin.id)
        else await tx.person.update({ where: { id: p.id }, data: { familyId: tgtHousehold.id, groupId: targetId } })
      }
      await tx.giftEntry.updateMany({ where: { id: { in: giftIds }, familyId: family.id }, data: { familyId: tgtHousehold.id } })
      await tx.occasion.updateMany({ where: { id: { in: subjectOccIds }, familyId: family.id }, data: { familyId: tgtHousehold.id } })
    } else if (match && !keepBothFamilies.has(family.id)) {
      await mergeFamily(tx, family.id, match.id, targetId, keepBothPeople)
    } else {
      await tx.family.update({ where: { id: family.id }, data: { groupId: targetId } })
      moved.push(family.id)
    }
  }

  await tx.person.updateMany({ where: { id: { in: personIds } }, data: { groupId: targetId } })
  await tx.occasion.updateMany({ where: { id: { in: movingOccIds } }, data: { groupId: targetId } })
  await tx.giftEntry.updateMany({ where: { id: { in: giftIds } }, data: { groupId: targetId } })
  await tx.idea.updateMany({ where: { id: { in: ideaIds } }, data: { groupId: targetId } })

  // Families that arrived are covered by the receiving group's holidays that take new families.
  const covering = await tx.occasion.findMany({ where: { groupId: targetId, ...GROUP_WIDE, includeNewFamilies: true }, select: { id: true } })
  if (moved.length > 0 && covering.length > 0) {
    await tx.occasionFamily.createMany({ data: covering.flatMap((o) => moved.map((f) => ({ occasionId: o.id, familyId: f }))), skipDuplicates: true })
  }
  // Families in one group can't be connected to each other.
  await tx.familyConnection.deleteMany({ where: { family: { groupId: targetId }, sourceFamily: { groupId: targetId } } })

  if (await hasContent(tx, sourceId)) return { sourceRemoved: false }
  await tx.user.updateMany({ where: { primaryGroupId: sourceId }, data: { primaryGroupId: targetId } })
  await tx.group.delete({ where: { id: sourceId } })
  return { sourceRemoved: true }
}
