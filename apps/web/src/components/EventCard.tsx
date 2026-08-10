import type { BestowdEvent } from '@bestowd/types'

interface Props {
  event: BestowdEvent
}

function daysUntil(dateStr: string | null | undefined): number {
  if (!dateStr) return Infinity
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

export default function EventCard({ event }: Props) {
  const displayDate = event.nextOccurrence || event.date
  const days = daysUntil(displayDate)
  const urgency =
    days <= 7 ? 'text-red-600 bg-red-50' : days <= 30 ? 'text-amber-600 bg-amber-50' : 'text-green-600 bg-green-50'

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
      <div>
        <p className="font-medium text-gray-900">{event.name}</p>
        <p className="text-xs text-gray-400 mt-0.5 capitalize">{event.type}</p>
      </div>
      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${urgency}`}>
        {days === 0 ? 'Today!' : days === Infinity ? 'No date' : `${days}d`}
      </span>
    </div>
  )
}
