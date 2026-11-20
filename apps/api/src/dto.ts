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
  id: string; email: string; name: string; avatarUrl: string | null
  identitySource: string; emailVerified: boolean; createdAt: Date
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
  id: string; name: string; currency: string; defaultBudgets: Prisma.JsonValue
  defaultReminderDays: number[]; createdAt: Date; updatedAt: Date
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
