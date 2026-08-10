import { useQuery } from '@tanstack/react-query'
import { listEvents } from '@bestowd/api-client'
import { useAuth } from '../auth/useAuth.ts'
import EventCard from '../components/EventCard.tsx'

export default function DashboardPage() {
  const { user } = useAuth()
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: listEvents,
  })

  const upcoming = [...events]
    .sort((a, b) => {
      const dateA = new Date(a.nextOccurrence || a.date).getTime()
      const dateB = new Date(b.nextOccurrence || b.date).getTime()
      return dateA - dateB
    })
    .slice(0, 10)

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome back, {user?.name?.split(' ')[0]}</h1>
      <p className="text-gray-500 mb-8">Here's what's coming up.</p>

      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Upcoming Events</h2>
        {isLoading && <p className="text-sm text-gray-400">Loading…</p>}
        {!isLoading && upcoming.length === 0 && (
          <p className="text-sm text-gray-400">No upcoming events. Add contacts and events to get started.</p>
        )}
        <div className="flex flex-col gap-2">
          {upcoming.map(event => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </section>
    </div>
  )
}
