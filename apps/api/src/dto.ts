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
