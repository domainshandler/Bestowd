import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getContact, updateContact, deleteContact, listAssignments, sendInvite } from '@bestowd/api-client'
import ContactForm from '../components/forms/ContactForm.tsx'
import type { UpdateContactBody } from '@bestowd/types'

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)

  const { data: contact, isLoading } = useQuery({
    queryKey: ['contacts', id],
    queryFn: () => getContact(id!),
  })

  const { data: assignments = [] } = useQuery({
    queryKey: ['assignments', id],
    queryFn: () => listAssignments({ contactId: id }),
    enabled: !!id,
  })

  const update = useMutation({
    mutationFn: (body: UpdateContactBody) => updateContact(id!, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contacts'] }); setEditing(false) },
  })

  const remove = useMutation({
    mutationFn: () => deleteContact(id!),
    onSuccess: () => navigate('/contacts'),
  })

  const invite = useMutation({
    mutationFn: () => sendInvite(id!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts', id] }),
  })

  if (isLoading) return <p className="text-sm text-gray-400">Loading…</p>
  if (!contact) return <p className="text-sm text-red-500">Contact not found.</p>

  return (
    <div className="max-w-2xl">
      <button onClick={() => navigate(-1)} className="text-sm text-brand mb-4 hover:underline">← Back</button>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-brand-light flex items-center justify-center text-xl text-brand font-bold">
              {contact.name[0]?.toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{contact.name}</h1>
              {contact.email && <p className="text-sm text-gray-500">{contact.email}</p>}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditing(true)} className="text-sm text-brand hover:underline">Edit</button>
            <button onClick={() => remove.mutate()} className="text-sm text-red-500 hover:underline">Delete</button>
          </div>
        </div>

        {contact.notes && <p className="text-sm text-gray-600 mb-4">{contact.notes}</p>}

        {contact.attributes.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Interests</p>
            <div className="flex flex-wrap gap-2">
              {contact.attributes.map((a, i) => (
                <span key={i} className="bg-brand-light text-brand text-xs px-3 py-1 rounded-full">
                  {a.label}: {a.value}
                </span>
              ))}
            </div>
          </div>
        )}

        {contact.isManaged && contact.email && (
          <div className="pt-4 border-t border-gray-100 flex items-center gap-3">
            <button
              onClick={() => invite.mutate()}
              disabled={invite.isPending}
              className="text-sm px-3 py-1.5 bg-brand text-white rounded-lg font-medium disabled:opacity-50"
            >
              {invite.isPending ? 'Sending…' : contact.invitedAt ? 'Resend Invite' : 'Send Invite'}
            </button>
            {contact.invitedAt && (
              <span className="text-xs text-gray-400">
                Invited on {new Date(contact.invitedAt).toLocaleDateString()}
              </span>
            )}
            {invite.isError && (
              <span className="text-xs text-red-500">Failed to send invite.</span>
            )}
          </div>
        )}
      </div>

      {editing && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
          <ContactForm
            initial={{ name: contact.name, email: contact.email ?? '', notes: contact.notes ?? '', attributes: contact.attributes }}
            onSubmit={(data) => update.mutate(data)}
            onCancel={() => setEditing(false)}
            loading={update.isPending}
          />
        </div>
      )}

      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Gift History</h2>
        {assignments.length === 0 ? (
          <p className="text-sm text-gray-400">No gifts recorded yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {assignments.map(a => (
              <div key={a.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">{a.giftId}</p>
                  {a.givenAt && <p className="text-xs text-gray-400">Given {new Date(a.givenAt).toLocaleDateString()}</p>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  a.status === 'given' ? 'bg-green-100 text-green-700'
                  : a.status === 'purchased' ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600'
                }`}>{a.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
