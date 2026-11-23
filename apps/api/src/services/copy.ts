/**
 * Taking a copy of families when you leave a group. The group keeps its originals. The copies go
 * into another group of yours, with the families' people, their own occasions (birthdays), the
 * holidays their gifts were for, and the whole gift history for them, given and received, whoever
 * logged it. Look-alikes already in the destination (same name) are combined instead of duplicated.
 */
import type { Prisma } from '@prisma/client'
import type { Tx } from './groups.js'
import { addAccountHolder } from './groups.js'
import { normalName } from './move.js'
import { GROUP_WIDE } from './occasions.js'

const json = (v: Prisma.JsonValue) => (v ?? {}) as Prisma.InputJsonValue

/** Copies families `familyIds` of group `sourceId` into group `destId`, for `user` (who is a member of both). */
export async function copyFamilies(
  tx: Tx, sourceId: string, destId: string, familyIds: string[], user: { id: string; name: string }, withIdeas = false,
): Promise<{ families: number; gifts: number; ideas: number }> {
  const families = await tx.family.findMany({ where: { groupId: sourceId, id: { in: familyIds } } })
  if (families.length === 0) return { families: 0, gifts: 0, ideas: 0 }
  await addAccountHolder(tx, destId, user)
  const destHousehold = await tx.family.findUniqueOrThrow({ where: { householdOfGroupId: destId } })
  const destFamilies = await tx.family.findMany({ where: { groupId: destId, householdOfGroupId: null } })
  const me = await tx.person.findUniqueOrThrow({ where: { groupId_userId: { groupId: destId, userId: user.id } } })
  const familyMap = new Map<string, string>()
  const personMap = new Map<string, string>()
  const created: string[] = []

  for (const f of families) {
    let target: string
    if (f.householdOfGroupId !== null) target = destHousehold.id
    else {
      const twin = destFamilies.find((d) => normalName(d.name) === normalName(f.name))
      if (twin) target = twin.id
      else {
        const copy = await tx.family.create({ data: { groupId: destId, name: f.name, type: f.type, status: f.status, photoUrl: f.photoUrl, notes: f.notes } })
        target = copy.id
        created.push(copy.id)
      }
    }
    familyMap.set(f.id, target)

    const existing = await tx.person.findMany({ where: { familyId: target } })
    for (const p of await tx.person.findMany({ where: { familyId: f.id } })) {
      if (p.userId === user.id) { personMap.set(p.id, me.id); continue }
      const twin = existing.find((e) => normalName(e.name) === normalName(p.name))
      if (twin) { personMap.set(p.id, twin.id); continue }
      const copy = await tx.person.create({
        data: {
          groupId: destId, familyId: target, name: p.name, relationship: p.relationship,
          birthMonth: p.birthMonth, birthDay: p.birthDay, birthYear: p.birthYear, likes: p.likes, avoid: p.avoid,
          sizes: json(p.sizes), foodNotes: p.foodNotes, photoUrl: p.photoUrl, notes: p.notes, archivedAt: p.archivedAt,
        },
      })
      personMap.set(p.id, copy.id)
    }
  }

  const occasionFields = (o: Prisma.OccasionGetPayload<object>) => ({
    type: o.type, name: o.name, date: o.date, recursAnnually: o.recursAnnually, recurrenceEndsAt: o.recurrenceEndsAt,
    nextOccurrence: o.nextOccurrence, budget: o.budget, status: o.status, needsCard: o.needsCard, cardDone: o.cardDone,
    reminderDays: o.reminderDays, partyAt: o.partyAt, location: o.location, rsvp: o.rsvp, hostGiftRequest: o.hostGiftRequest,
  })
  const occasionMap = new Map<string, string>()

  // Their own occasions, such as birthdays, unless the destination already has the same one.
  const own = await tx.occasion.findMany({ where: { groupId: sourceId, OR: [{ personId: { in: [...personMap.keys()] } }, { familyId: { in: [...familyMap.keys()] } }] } })
  for (const o of own) {
    const personId = o.personId ? personMap.get(o.personId)! : null
    const familyId = o.familyId ? familyMap.get(o.familyId)! : null
    const twin = await tx.occasion.findFirst({ where: { groupId: destId, personId, familyId, type: o.type } })
    if (twin && normalName(twin.name) === normalName(o.name)) { occasionMap.set(o.id, twin.id); continue }
    occasionMap.set(o.id, (await tx.occasion.create({ data: { groupId: destId, personId, familyId, ...occasionFields(o) } })).id)
  }

  // Gifts for them, given and received.
  const personIds = [...personMap.keys()]
  const gifts = await tx.giftEntry.findMany({
    where: { groupId: sourceId, OR: [{ familyId: { in: [...familyMap.keys()] } }, { personId: { in: personIds } }] },
    include: { credits: true, occasion: true },
  })

  // Holidays: the ones those gifts were for and the ones covering the families. Use the destination's if it has them.
  const wide = await tx.occasion.findMany({
    where: { groupId: sourceId, ...GROUP_WIDE, OR: [{ id: { in: gifts.map((g) => g.occasionId).filter((x): x is string => x !== null) } }, { coverage: { some: { familyId: { in: [...familyMap.keys()] } } } }] },
    include: { coverage: true },
  })
  const destWide = await tx.occasion.findMany({ where: { groupId: destId, ...GROUP_WIDE } })
  const destAll = await tx.family.findMany({ where: { groupId: destId, status: { not: 'ARCHIVED' } }, select: { id: true } })
  for (const o of wide) {
    const twin = destWide.find((d) => (o.holidayKey !== null ? d.holidayKey === o.holidayKey : d.holidayKey === null && normalName(d.name) === normalName(o.name)))
    const id = twin?.id ?? (await tx.occasion.create({
      data: { groupId: destId, ...occasionFields(o), holidayKey: o.holidayKey, familyTypeBudgets: json(o.familyTypeBudgets), includeNewFamilies: o.includeNewFamilies },
    })).id
    occasionMap.set(o.id, id)
    const cover = o.coverage.filter((c) => familyMap.has(c.familyId)).map((c) => ({ occasionId: id, familyId: familyMap.get(c.familyId)!, budget: c.budget }))
    if (!twin && o.includeNewFamilies) cover.push(...destAll.map((f) => ({ occasionId: id, familyId: f.id, budget: null })))
    if (cover.length) await tx.occasionFamily.createMany({ data: cover, skipDuplicates: true })
  }

  // Families copied as new are covered by the destination's holidays that take new families.
  const covering = destWide.filter((o) => o.includeNewFamilies)
  if (created.length && covering.length) {
    await tx.occasionFamily.createMany({ data: covering.flatMap((o) => created.map((f) => ({ occasionId: o.id, familyId: f }))), skipDuplicates: true })
  }

  // Gift ideas for the copied people, tagged with their copies.
  const ideaMap = new Map<string, string>()
  if (withIdeas) {
    const ideas = await tx.idea.findMany({ where: { groupId: sourceId, tags: { some: { personId: { in: personIds } } } }, include: { tags: true } })
    for (const i of ideas) {
      const tags = [...new Set(i.tags.map((t) => personMap.get(t.personId)).filter((x): x is string => x !== undefined))]
      const copy = await tx.idea.create({
        data: {
          groupId: destId, title: i.title, category: i.category, url: i.url, imageUrl: i.imageUrl, price: i.price, notes: i.notes,
          ageMin: i.ageMin, ageMax: i.ageMax, status: i.status, occasionId: i.occasionId ? occasionMap.get(i.occasionId) ?? null : null,
          createdById: i.createdById, tags: { create: tags.map((personId) => ({ personId })) },
        },
      })
      ideaMap.set(i.id, copy.id)
    }
  }

  for (const g of gifts) {
    const copy = await tx.giftEntry.create({
      data: {
        groupId: destId, direction: g.direction, title: g.title, category: g.category,
        occasionId: g.occasionId ? occasionMap.get(g.occasionId) ?? null : null, occasionDate: g.occasionDate, date: g.date,
        personId: g.personId ? personMap.get(g.personId)! : null, familyId: g.familyId ? familyMap.get(g.familyId)! : null,
        amount: g.amount, status: g.status, valueHidden: g.valueHidden, hasGiftReceipt: g.hasGiftReceipt, returnBy: g.returnBy,
        thankYouSent: g.thankYouSent, thankYouDueAt: g.thankYouDueAt, reaction: g.reaction, photoUrl: g.photoUrl, notes: g.notes,
        ideaId: g.ideaId ? ideaMap.get(g.ideaId) ?? null : null,
        createdById: g.createdById,
      },
    })
    const credits = g.credits.map((c) => personMap.get(c.personId)).filter((x): x is string => x !== undefined)
    if (credits.length) await tx.giftCredit.createMany({ data: [...new Set(credits)].map((personId) => ({ giftEntryId: copy.id, personId })), skipDuplicates: true })
  }
  return { families: families.length, gifts: gifts.length, ideas: ideaMap.size }
}
