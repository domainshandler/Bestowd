import { describe, it, expect } from 'vitest'
import { computeNextOccurrence } from '../src/services/next-occurrence.js'

describe('computeNextOccurrence', () => {
  it('returns the date unchanged for once rule', () => {
    const date = new Date('2027-06-15')
    const result = computeNextOccurrence(date, 'once')
    expect(result.getFullYear()).toBe(2027)
    expect(result.getMonth()).toBe(5)
    expect(result.getDate()).toBe(15)
  })

  it('returns current year occurrence when it has not passed yet', () => {
    const date = new Date('1990-12-31')
    const result = computeNextOccurrence(date, 'annual')
    const now = new Date()
    expect(result.getMonth()).toBe(11)
    expect(result.getDate()).toBe(31)
    expect(result.getFullYear()).toBeGreaterThanOrEqual(now.getFullYear())
  })

  it('returns next year when annual date already passed this year', () => {
    const pastDate = new Date(new Date().getFullYear() - 1, 0, 1) // Jan 1 last year
    const result = computeNextOccurrence(pastDate, 'annual')
    expect(result.getFullYear()).toBeGreaterThanOrEqual(new Date().getFullYear())
  })
})
