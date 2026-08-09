import { describe, it, expect } from 'vitest'
import { computeNextOccurrence } from '../src/services/next-occurrence.js'

describe('computeNextOccurrence', () => {
  it('returns null for once rule', () => {
    const date = new Date('2027-06-15')
    const result = computeNextOccurrence(date, 'once')
    expect(result).toBeNull()
  })

  it('returns null for none rule', () => {
    const date = new Date('2027-06-15')
    const result = computeNextOccurrence(date, 'none')
    expect(result).toBeNull()
  })

  it('returns null when recurrenceRule is null', () => {
    const date = new Date('2027-06-15')
    const result = computeNextOccurrence(date, null)
    expect(result).toBeNull()
  })

  it('returns null when recurrenceRule is undefined', () => {
    const date = new Date('2027-06-15')
    const result = computeNextOccurrence(date, undefined)
    expect(result).toBeNull()
  })

  it('returns current year occurrence when annual date has not passed yet', () => {
    const date = new Date('1990-12-31')
    const result = computeNextOccurrence(date, 'annual')
    const now = new Date()
    expect(result).not.toBeNull()
    expect(result!.getUTCMonth()).toBe(11)
    expect(result!.getUTCDate()).toBe(31)
    expect(result!.getUTCFullYear()).toBeGreaterThanOrEqual(now.getUTCFullYear())
  })

  it('returns next year when annual date already passed this year', () => {
    const pastDate = new Date(Date.UTC(new Date().getUTCFullYear() - 1, 0, 1)) // Jan 1 last year
    const result = computeNextOccurrence(pastDate, 'annual')
    expect(result).not.toBeNull()
    expect(result!.getUTCFullYear()).toBeGreaterThanOrEqual(new Date().getUTCFullYear())
  })

  it('supports yearly as an alias for annual', () => {
    const date = new Date('1990-12-31')
    const result = computeNextOccurrence(date, 'yearly')
    expect(result).not.toBeNull()
    expect(result!.getUTCMonth()).toBe(11)
    expect(result!.getUTCDate()).toBe(31)
  })

  it('returns next monthly occurrence after now', () => {
    // Use a date in the far past so we know it has already passed
    const date = new Date('2000-01-01')
    const result = computeNextOccurrence(date, 'monthly')
    expect(result).not.toBeNull()
    expect(result!.getTime()).toBeGreaterThan(Date.now())
  })

  it('returns next weekly occurrence after now', () => {
    const date = new Date('2000-01-01')
    const result = computeNextOccurrence(date, 'weekly')
    expect(result).not.toBeNull()
    expect(result!.getTime()).toBeGreaterThan(Date.now())
    // Should be within 7 days of now
    const sevenDays = 7 * 24 * 60 * 60 * 1000
    expect(result!.getTime() - Date.now()).toBeLessThanOrEqual(sevenDays)
  })

  it('returns null for unknown rule', () => {
    const date = new Date('2027-06-15')
    const result = computeNextOccurrence(date, 'unknown-rule')
    expect(result).toBeNull()
  })
})
