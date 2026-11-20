import type { OccasionType, Prisma } from '@prisma/client'

/** The occasion's own budget, else the group's default for its type, else null. */
export function effectiveBudget(budget: Prisma.Decimal | null, type: OccasionType, defaults: Prisma.JsonValue): number | null {
  if (budget !== null) return Number(budget)
  const value = (defaults as Record<string, unknown> | null)?.[type]
  return typeof value === 'number' ? value : null
}
