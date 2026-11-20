import { describe, it, expect } from 'vitest'
import { computeNextOccurrence } from '../src/services/next-occurrence.js'
import { effectiveBudget } from '../src/services/budgets.js'
import { Prisma } from '@prisma/client'

const now = new Date('2026-11-18T15:30:00Z')
const d = (s: string) => new Date(`${s}T00:00:00Z`)
const annual = (date: string, recurrenceEndsAt: Date | null = null) => ({ date: d(date), recursAnnually: true, recurrenceEndsAt })
const once = (date: string) => ({ date: d(date), recursAnnually: false, recurrenceEndsAt: null })

describe('computeNextOccurrence', () => {
  it('moves an annual date to its next anniversary', () => {
    expect(computeNextOccurrence(annual('2019-03-09'), now)).toEqual(d('2027-03-09'))
  })
  it('counts today as the next occurrence', () => {
    expect(computeNextOccurrence(annual('2019-11-18'), now)).toEqual(d('2026-11-18'))
  })
  it('returns null for a past one-off and the date for a future one', () => {
    expect(computeNextOccurrence(once('2026-01-05'), now)).toBeNull()
    expect(computeNextOccurrence(once('2027-01-05'), now)).toEqual(d('2027-01-05'))
  })
  it('stops after recurrenceEndsAt', () => {
    expect(computeNextOccurrence(annual('2019-03-09', d('2026-12-31')), now)).toBeNull()
  })
  it('waits for a first date that is more than a year away', () => {
    expect(computeNextOccurrence(annual('2028-05-01'), now)).toEqual(d('2028-05-01'))
  })
})

describe('effectiveBudget', () => {
  const defaults = { BIRTHDAY: 40, HOLIDAY: 30 }
  it('prefers the occasion budget, then the group default, then null', () => {
    expect(effectiveBudget(new Prisma.Decimal(55), 'BIRTHDAY', defaults)).toBe(55)
    expect(effectiveBudget(null, 'BIRTHDAY', defaults)).toBe(40)
    expect(effectiveBudget(null, 'ONE_OFF', defaults)).toBeNull()
  })
})
