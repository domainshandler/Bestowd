function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setUTCMonth(d.getUTCMonth() + months)
  return d
}

function addWeeks(date: Date, weeks: number): Date {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + weeks * 7)
  return d
}

export function computeNextOccurrence(date: Date, recurrenceRule: string | null | undefined): Date | null {
  if (!recurrenceRule || recurrenceRule === 'none' || recurrenceRule === 'once') {
    return null
  }

  const now = new Date()

  if (recurrenceRule === 'annual' || recurrenceRule === 'yearly') {
    const month = date.getUTCMonth()
    const day = date.getUTCDate()
    const thisYear = new Date(Date.UTC(now.getUTCFullYear(), month, day))
    if (thisYear > now) return thisYear
    return new Date(Date.UTC(now.getUTCFullYear() + 1, month, day))
  }

  if (recurrenceRule === 'monthly') {
    let candidate = addMonths(date, 0)
    // Find the next monthly occurrence after now
    while (candidate <= now) {
      candidate = addMonths(candidate, 1)
    }
    return candidate
  }

  if (recurrenceRule === 'weekly') {
    let candidate = addWeeks(date, 0)
    // Find the next weekly occurrence after now
    while (candidate <= now) {
      candidate = addWeeks(candidate, 1)
    }
    return candidate
  }

  // Unknown rule — return null
  return null
}
