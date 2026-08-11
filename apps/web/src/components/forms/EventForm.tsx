import { useState } from 'react'
import type { Contact, EventType } from '@bestowd/types'
import type { CreateEventBody } from '@bestowd/types'

interface Props {
  contacts: Contact[]
  onSubmit: (data: CreateEventBody) => void
  onCancel: () => void
  loading?: boolean
}

const EVENT_TYPES = ['birthday', 'anniversary', 'christmas', 'custom'] as const

export default function EventForm({ contacts, onSubmit, onCancel, loading }: Props) {
  const [contactId, setContactId] = useState('')
  const [type, setType] = useState<EventType>('birthday')
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [recurrenceRule, setRecurrenceRule] = useState<string>('yearly')
  const [reminderDays, setReminderDays] = useState('30')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit({
      contactId,
      type,
      name,
      date,
      recurrenceRule,
      reminderDays: [parseInt(reminderDays, 10)],
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Contact *</label>
        <select
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          value={contactId} onChange={e => setContactId(e.target.value)} required
        >
          <option value="">Select a contact…</option>
          {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            value={type} onChange={e => setType(e.target.value as EventType)}
          >
            {EVENT_TYPES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Recurrence</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            value={recurrenceRule} onChange={e => setRecurrenceRule(e.target.value)}
          >
            <option value="yearly">Yearly</option>
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
            <option value="none">None</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Event Name *</label>
        <input
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          value={name} onChange={e => setName(e.target.value)} required
          placeholder={type === 'birthday' ? "Alice's Birthday" : 'Event name'}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
        <input
          type="date"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          value={date} onChange={e => setDate(e.target.value)} required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Remind me (days before)</label>
        <input
          type="number"
          min="0"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          value={reminderDays} onChange={e => setReminderDays(e.target.value)}
        />
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
        <button type="submit" disabled={loading} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium disabled:opacity-50">
          {loading ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}
