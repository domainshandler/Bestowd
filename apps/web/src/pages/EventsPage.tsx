import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listEvents, createEvent, deleteEvent, listContacts } from '@bestowd/api-client'
import EventCard from '../components/EventCard.tsx'
import EventForm from '../components/forms/EventForm.tsx'
import type { CreateEventBody } from '@bestowd/types'

export default function EventsPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const { data: events = [], isLoading } = useQuery({ queryKey: ['events'], queryFn: listEvents })
  const { data: contacts = [] } = useQuery({ queryKey: ['contacts'], queryFn: listContacts })

  const create = useMutation({
    mutationFn: createEvent,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); setShowForm(false) },
  })

  const remove = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  })

  const sorted = [...events].sort(
    (a, b) => new Date(a.nextOccurrence).getTime() - new Date(b.nextOccurrence).getTime()
  )

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Events</h1>
        <button onClick={() => setShowForm(v => !v)} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium">
          + Add Event
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
          <h2 className="text-base font-semibold mb-4">New Event</h2>
          <EventForm
            contacts={contacts}
            onSubmit={(data: CreateEventBody) => create.mutate(data)}
            onCancel={() => setShowForm(false)}
            loading={create.isPending}
          />
        </div>
      )}

      {isLoading && <p className="text-sm text-gray-400">Loading…</p>}
      <div className="flex flex-col gap-2">
        {sorted.map(event => (
          <div key={event.id} className="relative group">
            <EventCard event={event} />
            <button
              onClick={() => { if (window.confirm('Delete this event?')) remove.mutate(event.id) }}
              disabled={remove.isPending}
              className="absolute top-3 right-3 text-xs text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      {!isLoading && events.length === 0 && (
        <p className="text-sm text-gray-400">No events yet. Add contacts first, then create events for them.</p>
      )}
    </div>
  )
}
