const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** The API stores calendar dates as UTC midnight, so format in UTC. */
export function formatDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, { ...opts, timeZone: 'UTC' })
}

export function monthShort(iso: string): string {
  return MONTHS[new Date(iso).getUTCMonth()].toUpperCase()
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
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?'
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
export const FAMILY_TYPE_LABEL = {
  FAMILY: 'Family',
  FRIENDS: 'Friends',
  SCHOOL: 'School',
  NEIGHBOURS: 'Neighbours',
  OTHER: 'Other',
} as const
export const REACTION_LABEL = {
  LOVED_IT: 'Loved it',
  LIKED_IT: 'Liked it',
  ALREADY_HAD_IT: 'Already had it',
  NOT_A_HIT: 'Not a hit',
} as const

/** Currencies offered in settings (ISO 4217). Keep in step with the mobile app's Currencies list. */
export const CURRENCIES: { code: string; name: string }[] = [
  { code: 'CAD', name: 'Canadian dollar' },
  { code: 'USD', name: 'US dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British pound' },
  { code: 'AUD', name: 'Australian dollar' },
  { code: 'NZD', name: 'New Zealand dollar' },
  { code: 'INR', name: 'Indian rupee' },
  { code: 'PKR', name: 'Pakistani rupee' },
  { code: 'PHP', name: 'Philippine peso' },
  { code: 'MXN', name: 'Mexican peso' },
  { code: 'BRL', name: 'Brazilian real' },
  { code: 'JPY', name: 'Japanese yen' },
  { code: 'CNY', name: 'Chinese yuan' },
  { code: 'HKD', name: 'Hong Kong dollar' },
  { code: 'SGD', name: 'Singapore dollar' },
  { code: 'KRW', name: 'South Korean won' },
  { code: 'AED', name: 'UAE dirham' },
  { code: 'SAR', name: 'Saudi riyal' },
  { code: 'ZAR', name: 'South African rand' },
  { code: 'NGN', name: 'Nigerian naira' },
  { code: 'KES', name: 'Kenyan shilling' },
  { code: 'CHF', name: 'Swiss franc' },
  { code: 'SEK', name: 'Swedish krona' },
  { code: 'NOK', name: 'Norwegian krone' },
  { code: 'DKK', name: 'Danish krone' },
  { code: 'PLN', name: 'Polish złoty' },
]

/** The currency options, plus the current one if it isn't listed (so it still shows). */
export function currencyOptions(current: string): { code: string; name: string }[] {
  return current && !CURRENCIES.some((c) => c.code === current) ? [...CURRENCIES, { code: current, name: current }] : CURRENCIES
}
