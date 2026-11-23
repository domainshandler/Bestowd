import type { OccasionType, Prisma } from '@prisma/client'

/** The occasion's own budget, else the group's default for its type, else null. */
export function effectiveBudget(budget: Prisma.Decimal | null, type: OccasionType, defaults: Prisma.JsonValue): number | null {
  if (budget !== null) return Number(budget)
  const value = (defaults as Record<string, unknown> | null)?.[type]
  return typeof value === 'number' ? value : null
}

/**
 * A covered family's budget for a group-wide occasion: its own override, else the occasion's budget for
 * that type of family, else the occasion's budget, else the group default for the occasion type.
 */
export function familyBudget(
  occasion: { budget: Prisma.Decimal | null; type: OccasionType; familyTypeBudgets: Prisma.JsonValue },
  familyType: string,
  override: Prisma.Decimal | null,
  groupDefaults: Prisma.JsonValue,
): number | null {
  if (override !== null) return Number(override)
  const byType = (occasion.familyTypeBudgets as Record<string, unknown> | null)?.[familyType]
  if (typeof byType === 'number') return byType
  return effectiveBudget(occasion.budget, occasion.type, groupDefaults)
}
