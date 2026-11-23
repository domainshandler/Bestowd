import { findHoliday, nextHolidayDate } from '../holidays/catalog.js'

export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000)
}

/**
 * The next occurrence on or after today (UTC), or null when there is none.
 * Feb 29 falls on Mar 1 in non-leap years (Date.UTC rollover).
 */
export function computeNextOccurrence(
  occasion: { date: Date; recursAnnually: boolean; recurrenceEndsAt: Date | null; holidayKey?: string | null },
  now: Date = new Date(),
): Date | null {
  const today = startOfUtcDay(now)
  const first = startOfUtcDay(occasion.date)
  const holiday = occasion.holidayKey ? findHoliday(occasion.holidayKey) : undefined
  let next: Date
  if (holiday) {
    // A built-in holiday follows its own rule (e.g. 2nd Sunday of May); null once a date list runs out.
    const found = nextHolidayDate(holiday.rule, today)
    if (!found) return null
    next = found
  } else if (!occasion.recursAnnually) {
    next = first
  } else {
    const month = first.getUTCMonth()
    const day = first.getUTCDate()
    next = new Date(Date.UTC(today.getUTCFullYear(), month, day))
    if (next < today) next = new Date(Date.UTC(today.getUTCFullYear() + 1, month, day))
    if (next < first) next = first
  }
  if (next < today) return null
  if (occasion.recurrenceEndsAt && next > occasion.recurrenceEndsAt) return null
  return next
}
