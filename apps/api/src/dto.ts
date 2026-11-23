import type { Prisma } from '@prisma/client'

/** Decimal money columns go out as plain numbers. */
export function money(value: Prisma.Decimal | null): number | null {
  return value === null ? null : Number(value)
}

export function iso(value: Date): string
export function iso(value: Date | null): string | null
export function iso(value: Date | null): string | null {
  return value === null ? null : value.toISOString()
}

export function toUserDto(user: {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  identitySource: string
  emailVerified: boolean
  createdAt: Date
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    identitySource: user.identitySource,
    emailVerified: user.emailVerified,
    createdAt: iso(user.createdAt),
  }
}

export function toGroupDto(group: {
  id: string
  name: string
  currency: string
  defaultBudgets: Prisma.JsonValue
  defaultReminderDays: number[]
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: group.id,
    name: group.name,
    currency: group.currency,
    defaultBudgets: (group.defaultBudgets ?? {}) as Record<string, number>,
    defaultReminderDays: group.defaultReminderDays,
    createdAt: iso(group.createdAt),
    updatedAt: iso(group.updatedAt),
  }
}

export function toFamilyDto(family: {
  id: string
  groupId: string
  householdOfGroupId: string | null
  name: string
  type: string
  status: string
  photoUrl: string | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: family.id,
    groupId: family.groupId,
    name: family.name,
    type: family.type,
    status: family.status,
    isOwnHousehold: family.householdOfGroupId !== null,
    photoUrl: family.photoUrl,
    notes: family.notes,
    createdAt: iso(family.createdAt),
    updatedAt: iso(family.updatedAt),
  }
}

export function toPersonDto(person: {
  id: string
  groupId: string
  familyId: string
  userId?: string | null
  name: string
  relationship: string | null
  birthMonth: number | null
  birthDay: number | null
  birthYear: number | null
  likes: string[]
  avoid: string[]
  sizes: Prisma.JsonValue
  foodNotes: string | null
  photoUrl: string | null
  notes: string | null
  archivedAt: Date | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: person.id,
    groupId: person.groupId,
    familyId: person.familyId,
    name: person.name,
    /** This person signs in to the group. */
    isAccountHolder: (person.userId ?? null) !== null,
    relationship: person.relationship,
    birthMonth: person.birthMonth,
    birthDay: person.birthDay,
    birthYear: person.birthYear,
    likes: person.likes,
    avoid: person.avoid,
    sizes: (person.sizes ?? {}) as Record<string, string>,
    foodNotes: person.foodNotes,
    photoUrl: person.photoUrl,
    notes: person.notes,
    archivedAt: iso(person.archivedAt),
    createdAt: iso(person.createdAt),
    updatedAt: iso(person.updatedAt),
  }
}
