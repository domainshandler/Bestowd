import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listContacts, createContact } from '@bestowd/api-client'
import ContactCard from '../components/ContactCard.tsx'
import ContactForm from '../components/forms/ContactForm.tsx'
import type { CreateContactBody } from '@bestowd/types'

export default function ContactsPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const { data: contacts = [], isLoading } = useQuery({ queryKey: ['contacts'], queryFn: listContacts })

  const create = useMutation({
    mutationFn: createContact,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contacts'] }); setShowForm(false) },
  })

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
        <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium">
          + Add Contact
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
          <h2 className="text-base font-semibold mb-4">New Contact</h2>
          <ContactForm
            onSubmit={(data: CreateContactBody) => create.mutate(data)}
            onCancel={() => setShowForm(false)}
            loading={create.isPending}
          />
        </div>
      )}

      {isLoading && <p className="text-sm text-gray-400">Loading…</p>}
      <div className="flex flex-col gap-2">
        {contacts.map(contact => <ContactCard key={contact.id} contact={contact} />)}
      </div>
      {!isLoading && contacts.length === 0 && (
        <p className="text-sm text-gray-400">No contacts yet. Add your first one above.</p>
      )}
    </div>
  )
}
