import { useState } from 'react'
import type { Contact, BestowdEvent, Gift, CreateAssignmentBody, AssignmentStatus } from '@bestowd/types'

interface Props {
  gifts: Gift[]
  contacts: Contact[]
  events: BestowdEvent[]
  onSubmit: (data: CreateAssignmentBody) => void
  onCancel: () => void
  loading?: boolean
}

const STATUS_OPTIONS: AssignmentStatus[] = ['idea', 'purchased', 'given']

export default function AssignmentForm({ gifts, contacts, events, onSubmit, onCancel, loading }: Props) {
  const [giftId, setGiftId] = useState('')
  const [contactId, setContactId] = useState('')
  const [eventId, setEventId] = useState('')
  const [status, setStatus] = useState<AssignmentStatus>('idea')
  const [notes, setNotes] = useState('')

  const contactEvents = events.filter(e => e.contactId === contactId)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit({ giftId, contactId, eventId: eventId || undefined, status, notes: notes || undefined })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Gift *</label>
        <select
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          value={giftId} onChange={e => setGiftId(e.target.value)} required
        >
          <option value="">Select a gift…</option>
          {gifts.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Recipient *</label>
        <select
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          value={contactId} onChange={e => { setContactId(e.target.value); setEventId('') }} required
        >
          <option value="">Select a contact…</option>
          {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {contactId && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Event (optional)</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            value={eventId} onChange={e => setEventId(e.target.value)}
          >
            <option value="">Ad-hoc gift (no event)</option>
            {contactEvents.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
        <select
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          value={status} onChange={e => setStatus(e.target.value as AssignmentStatus)}
        >
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          rows={2} value={notes} onChange={e => setNotes(e.target.value)}
        />
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
        <button type="submit" disabled={loading} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium disabled:opacity-50">
          {loading ? 'Saving…' : 'Assign Gift'}
        </button>
      </div>
    </form>
  )
}
