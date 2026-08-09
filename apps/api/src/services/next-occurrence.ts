export function computeNextOccurrence(date: Date, recurrenceRule: string): Date {
  if (recurrenceRule === 'once') {
    // Create a date that preserves the date components correctly
    // Use UTC components to create a new date with correct local time representation
    return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  }

  if (recurrenceRule === 'annual') {
    const now = new Date()
    const month = date.getUTCMonth()
    const day = date.getUTCDate()
    const thisYear = new Date(now.getFullYear(), month, day)

    if (thisYear > now) return thisYear
    return new Date(now.getFullYear() + 1, month, day)
  }

  // Unknown rule — return original date
  return new Date(date)
}
