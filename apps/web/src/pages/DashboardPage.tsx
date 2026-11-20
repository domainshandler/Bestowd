import { useQuery } from '@tanstack/react-query'
import { listHomeOccasions } from '@bestowd/api-client'
import type { Occasion, OccasionStatus } from '@bestowd/types'
import { useAuth } from '../auth/useAuth.ts'

const STATUS_LABEL: Record<OccasionStatus, string> = {
  NOT_STARTED: 'Needs gift',
  IDEA_SAVED: 'Idea saved',
  BOUGHT: 'Bought',
  GIVEN: 'Given',
}

const STATUS_STYLE: Record<OccasionStatus, string> = {
  NOT_STARTED: 'bg-amber-50 text-amber-700',
  IDEA_SAVED: 'bg-blue-50 text-blue-700',
  BOUGHT: 'bg-purple-50 text-purple-700',
  GIVEN: 'bg-green-50 text-green-700',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

function OccasionRow({ occasion, showGroup }: { occasion: Occasion; showGroup: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="font-medium text-gray-900 truncate">{occasion.name}</p>
        <p className="text-sm text-gray-500">
          {occasion.nextOccurrence ? formatDate(occasion.nextOccurrence) : '—'}
          {occasion.subjectFamilyName && ` · ${occasion.subjectFamilyName}`}
          {showGroup && ` · ${occasion.groupName}`}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {occasion.effectiveBudget !== null && (
          <span className={`text-sm ${occasion.overBudget ? 'text-red-600' : 'text-gray-500'}`}>
            {occasion.spent > 0 ? `${formatMoney(occasion.spent, occasion.currency)} of ` : ''}
            {formatMoney(occasion.effectiveBudget, occasion.currency)}
          </span>
        )}
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_STYLE[occasion.status]}`}>
          {STATUS_LABEL[occasion.status]}
        </span>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { data, isLoading, isError } = useQuery({ queryKey: ['home-occasions'], queryFn: () => listHomeOccasions() })
  const occasions = data?.occasions ?? []

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome back, {user?.name?.split(' ')[0]}</h1>
      <p className="text-gray-500 mb-6">
        {occasions.length} occasion{occasions.length === 1 ? '' : 's'} in the next 30 days
        {data?.plannedSpend.map((p) => ` · ${formatMoney(p.amount, p.currency)} planned`).join('')}
      </p>

      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Upcoming</h2>
        {isLoading && <p className="text-sm text-gray-400">Loading…</p>}
        {isError && <p className="text-sm text-red-600">Couldn't load your occasions.</p>}
        {!isLoading && !isError && occasions.length === 0 && (
          <p className="text-sm text-gray-400">Nothing coming up in the next 30 days.</p>
        )}
        <div className="flex flex-col gap-2">
          {occasions.map((o) => <OccasionRow key={o.id} occasion={o} showGroup={data?.multipleGroups ?? false} />)}
        </div>
      </section>
    </div>
  )
}
