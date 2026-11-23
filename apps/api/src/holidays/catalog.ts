/**
 * Built-in holidays a group can celebrate as a group-wide occasion.
 *
 * To add one, append an entry: a stable `key` (stored on occasions, never rename it), a display `name`
 * and a date `rule`:
 * - `fixed`: the same day every year.
 * - `nthWeekday`: e.g. the 2nd Sunday of May. `n: -1` is the last one in the month.
 * - `easter`: Western (Gregorian) Easter Sunday, optionally offset by days.
 * - `dates`: explicit dates for holidays set by a lunar or lunisolar calendar. Extend the list before
 *   it runs out; the catalog test fails when a list has less than a year of dates left.
 *
 * Lunar dates (2026–2031) were checked on 2026-11-23 against timeanddate.com (Canada pages for Eid,
 * Hanukkah and Lunar New Year) and drikpanchang.com (Diwali, Lakshmi Puja in New Delhi). Eid dates from
 * 2027 are tentative and can differ by a day with moon sighting.
 */
export type HolidayRule =
  | { kind: 'fixed'; month: number; day: number }
  | { kind: 'nthWeekday'; month: number; weekday: number; n: number }
  | { kind: 'easter'; offsetDays?: number }
  | { kind: 'dates'; dates: string[] }

export interface Holiday {
  key: string
  name: string
  rule: HolidayRule
  /** Shown under the name when picking, e.g. how the date is chosen. */
  note?: string
}

/** Weekdays for nthWeekday rules (0 = Sunday, as in Date.getUTCDay). */
const SUNDAY = 0

export const HOLIDAYS: readonly Holiday[] = [
  { key: 'christmas', name: 'Christmas', rule: { kind: 'fixed', month: 12, day: 25 } },
  { key: 'valentines', name: "Valentine's Day", rule: { kind: 'fixed', month: 2, day: 14 } },
  {
    key: 'mothers-day',
    name: "Mother's Day",
    rule: { kind: 'nthWeekday', month: 5, weekday: SUNDAY, n: 2 },
    note: 'Second Sunday of May (Canada, US)',
  },
  { key: 'fathers-day', name: "Father's Day", rule: { kind: 'nthWeekday', month: 6, weekday: SUNDAY, n: 3 }, note: 'Third Sunday of June' },
  { key: 'easter', name: 'Easter', rule: { kind: 'easter' } },
  {
    key: 'diwali',
    name: 'Diwali',
    note: 'Lakshmi Puja day',
    rule: { kind: 'dates', dates: ['2026-11-08', '2027-10-29', '2028-10-17', '2029-11-05', '2030-10-26', '2031-11-14'] },
  },
  {
    key: 'eid-al-fitr',
    name: 'Eid al-Fitr',
    note: 'May differ by a day with moon sighting',
    rule: { kind: 'dates', dates: ['2026-03-20', '2027-03-10', '2028-02-27', '2029-02-15', '2030-02-05', '2031-01-25'] },
  },
  {
    key: 'eid-al-adha',
    name: 'Eid al-Adha',
    note: 'May differ by a day with moon sighting',
    rule: { kind: 'dates', dates: ['2026-05-27', '2027-05-17', '2028-05-05', '2029-04-24', '2030-04-14', '2031-04-03'] },
  },
  {
    key: 'hanukkah',
    name: 'Hanukkah',
    note: 'First day (the first candle is lit the evening before)',
    rule: { kind: 'dates', dates: ['2026-12-05', '2027-12-25', '2028-12-13', '2029-12-02', '2030-12-21', '2031-12-10'] },
  },
  {
    key: 'lunar-new-year',
    name: 'Lunar New Year',
    rule: { kind: 'dates', dates: ['2026-02-17', '2027-02-06', '2028-01-26', '2029-02-13', '2030-02-03', '2031-01-23'] },
  },
]

export function findHoliday(key: string): Holiday | undefined {
  return HOLIDAYS.find((h) => h.key === key)
}

/** Western Easter Sunday (anonymous Gregorian algorithm), as UTC midnight. */
export function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(year, month - 1, day))
}

/** The holiday's date in a year (UTC midnight), or null when the rule has none that year. */
export function holidayDateIn(rule: HolidayRule, year: number): Date | null {
  switch (rule.kind) {
    case 'fixed':
      return new Date(Date.UTC(year, rule.month - 1, rule.day))
    case 'nthWeekday': {
      if (rule.n === -1) {
        const last = new Date(Date.UTC(year, rule.month, 0))
        return new Date(Date.UTC(year, rule.month - 1, last.getUTCDate() - ((last.getUTCDay() - rule.weekday + 7) % 7)))
      }
      const first = new Date(Date.UTC(year, rule.month - 1, 1))
      const day = 1 + ((rule.weekday - first.getUTCDay() + 7) % 7) + (rule.n - 1) * 7
      return new Date(Date.UTC(year, rule.month - 1, day))
    }
    case 'easter':
      return new Date(easterSunday(year).getTime() + (rule.offsetDays ?? 0) * 86_400_000)
    case 'dates': {
      const found = rule.dates.find((d) => d.startsWith(`${year}-`))
      return found ? new Date(`${found}T00:00:00.000Z`) : null
    }
  }
}

/** The holiday's next date on or after `from` (UTC day), or null when the rule has run out of dates. */
export function nextHolidayDate(rule: HolidayRule, from: Date): Date | null {
  const today = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  for (let year = from.getUTCFullYear(); year <= from.getUTCFullYear() + 1; year++) {
    const date = holidayDateIn(rule, year)
    if (date && date.getTime() >= today) return date
  }
  return null
}
