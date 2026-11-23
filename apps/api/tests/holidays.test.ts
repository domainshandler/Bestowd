import { describe, it, expect } from 'vitest'
import { HOLIDAYS, easterSunday, findHoliday, holidayDateIn, nextHolidayDate } from '../src/holidays/catalog.js'

const d = (s: string) => new Date(`${s}T00:00:00Z`)

describe('holiday rules', () => {
  it('fixed dates', () => {
    expect(holidayDateIn(findHoliday('christmas')!.rule, 2026)).toEqual(d('2026-12-25'))
  })

  it("Mother's Day is the second Sunday of May, Father's Day the third Sunday of June", () => {
    expect(holidayDateIn(findHoliday('mothers-day')!.rule, 2026)).toEqual(d('2026-05-10'))
    expect(holidayDateIn(findHoliday('mothers-day')!.rule, 2027)).toEqual(d('2027-05-09'))
    expect(holidayDateIn(findHoliday('fathers-day')!.rule, 2026)).toEqual(d('2026-06-21'))
  })

  it('last weekday of a month', () => {
    // Last Monday of May 2026 (Memorial Day in the US) is May 25.
    expect(holidayDateIn({ kind: 'nthWeekday', month: 5, weekday: 1, n: -1 }, 2026)).toEqual(d('2026-05-25'))
  })

  it('Easter Sunday', () => {
    expect(easterSunday(2026)).toEqual(d('2026-04-05'))
    expect(easterSunday(2027)).toEqual(d('2027-03-28'))
    expect(easterSunday(2028)).toEqual(d('2028-04-16'))
  })

  it('date lists give that year’s date, or null for a year not listed', () => {
    const diwali = findHoliday('diwali')!.rule
    expect(holidayDateIn(diwali, 2027)).toEqual(d('2027-10-29'))
    expect(holidayDateIn(diwali, 2040)).toBeNull()
  })

  it('next date counts today and rolls into next year', () => {
    const christmas = findHoliday('christmas')!.rule
    expect(nextHolidayDate(christmas, new Date('2026-12-25T18:00:00Z'))).toEqual(d('2026-12-25'))
    expect(nextHolidayDate(christmas, d('2026-12-26'))).toEqual(d('2027-12-25'))
    expect(nextHolidayDate(findHoliday('diwali')!.rule, d('2040-01-01'))).toBeNull()
  })
})

describe('holiday catalog', () => {
  it('has unique keys', () => {
    expect(new Set(HOLIDAYS.map((h) => h.key)).size).toBe(HOLIDAYS.length)
  })

  it('date lists are sorted and valid', () => {
    for (const h of HOLIDAYS) {
      if (h.rule.kind !== 'dates') continue
      const sorted = [...h.rule.dates].sort()
      expect(h.rule.dates, h.key).toEqual(sorted)
      for (const date of h.rule.dates) expect(Number.isNaN(d(date).getTime()), `${h.key} ${date}`).toBe(false)
    }
  })

  // Fails about a year before a lunar holiday's list runs out: extend the dates in catalog.ts.
  it('every date list covers at least the next year', () => {
    const yearAhead = new Date(Date.now() + 365 * 86_400_000)
    for (const h of HOLIDAYS) {
      if (h.rule.kind !== 'dates') continue
      expect(nextHolidayDate(h.rule, yearAhead), `${h.key} needs more dates in src/holidays/catalog.ts`).not.toBeNull()
    }
  })
})
