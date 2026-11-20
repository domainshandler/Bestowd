import { badRequest } from '../http-error.js'

/** Shared JSON-schema fragments for route bodies. */
const DATE_PATTERN = '^\\d{4}-\\d{2}-\\d{2}(T[0-9:.]+(Z|[+-]\\d{2}:\\d{2})?)?$'
export const nullableString = (maxLength: number) => ({ type: ['string', 'null'], maxLength })
/** "2026-03-09" or a full ISO timestamp. Parse with parseDate. */
export const isoDate = { type: 'string', pattern: DATE_PATTERN } as const
export const nullableIsoDate = { type: ['string', 'null'], pattern: DATE_PATTERN } as const
export const money = { type: ['number', 'null'], minimum: 0, maximum: 99_999_999 } as const
export const id = { type: 'string', minLength: 1, maxLength: 64 } as const
export const nullableId = { type: ['string', 'null'], minLength: 1, maxLength: 64 } as const
export const stringList = { type: 'array', maxItems: 50, items: { type: 'string', minLength: 1, maxLength: 100 } } as const
export const idList = { type: 'array', maxItems: 50, items: id } as const

export function parseDate(value: string): Date
export function parseDate(value: string | null | undefined): Date | null | undefined
export function parseDate(value: string | null | undefined): Date | null | undefined {
  if (value === null || value === undefined) return value
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) throw badRequest(`Invalid date: ${value}`)
  return d
}
