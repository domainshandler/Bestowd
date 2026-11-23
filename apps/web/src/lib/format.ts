const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** The API stores calendar dates as UTC midnight, so format in UTC. */
export function formatDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, { ...opts, timeZone: 'UTC' })
}

export function monthShort(iso: string): string {
  return MONTHS[new Date(iso).getUTCMonth()]!.toUpperCase()
}

export function dayOfMonth(iso: string): number {
  return new Date(iso).getUTCDate()
}

export function formatMoney(amount: number | null | undefined, currency = 'CAD'): string {
  if (amount === null || amount === undefined) return ''
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount)
}

/** Whole days from today (UTC) until the date; negative when past. */
export function daysUntil(iso: string, now = new Date()): number {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.round((new Date(iso).getTime() - today) / 86_400_000)
}

export function inDaysLabel(iso: string, now = new Date()): string {
  const d = daysUntil(iso, now)
  if (d === 0) return 'Today'
  if (d === 1) return 'Tomorrow'
  return d > 0 ? `In ${d} days` : `${-d} days ago`
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1]![0] : '')).toUpperCase() || '?'
}

/** Birthday as "Mar 9", from month/day parts. */
export function birthdayLabel(month: number | null, day: number | null): string {
  if (!month) return ''
  return `${MONTHS[month - 1]}${day ? ` ${day}` : ''}`
}

/** "YYYY-MM-DD" for today in UTC, for date inputs. */
export function todayInput(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

export const OCCASION_TYPE_LABEL = { BIRTHDAY: 'Birthday', HOLIDAY: 'Holiday', ONE_OFF: 'Event' } as const
export const FAMILY_TYPE_LABEL = { FAMILY: 'Family', FRIENDS: 'Friends', SCHOOL: 'School', NEIGHBOURS: 'Neighbours', OTHER: 'Other' } as const
export const REACTION_LABEL = { LOVED_IT: 'Loved it', LIKED_IT: 'Liked it', ALREADY_HAD_IT: 'Already had it', NOT_A_HIT: 'Not a hit' } as const
