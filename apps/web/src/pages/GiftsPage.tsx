import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listGifts, createGift, listContacts, listEvents, createAssignment } from '@bestowd/api-client'
import GiftCard from '../components/GiftCard.tsx'
import GiftForm from '../components/forms/GiftForm.tsx'
import AssignmentForm from '../components/forms/AssignmentForm.tsx'

export default function GiftsPage() {
  const qc = useQueryClient()
  const [showGiftForm, setShowGiftForm] = useState(false)
  const [showAssignForm, setShowAssignForm] = useState(false)

  const { data: gifts = [], isLoading } = useQuery({ queryKey: ['gifts'], queryFn: listGifts })
  const { data: contacts = [] } = useQuery({ queryKey: ['contacts'], queryFn: listContacts })
  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: listEvents })

  const createGiftMutation = useMutation({
    mutationFn: createGift,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gifts'] }); setShowGiftForm(false) },
  })

  const createAssignmentMutation = useMutation({
    mutationFn: createAssignment,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assignments'] }); setShowAssignForm(false) },
  })

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Gifts</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowAssignForm(true)} className="px-4 py-2 border border-brand text-brand rounded-lg text-sm font-medium hover:bg-brand-light">
            Assign Gift
          </button>
          <button onClick={() => setShowGiftForm(true)} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium">
            + Add Gift
          </button>
        </div>
      </div>

      {showGiftForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
          <h2 className="text-base font-semibold mb-4">New Gift</h2>
          <GiftForm
            onSubmit={data => createGiftMutation.mutate(data)}
            onCancel={() => setShowGiftForm(false)}
            loading={createGiftMutation.isPending}
          />
        </div>
      )}

      {showAssignForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
          <h2 className="text-base font-semibold mb-4">Assign Gift to Contact</h2>
          <AssignmentForm
            gifts={gifts}
            contacts={contacts}
            events={events}
            onSubmit={data => createAssignmentMutation.mutate(data)}
            onCancel={() => setShowAssignForm(false)}
            loading={createAssignmentMutation.isPending}
          />
        </div>
      )}

      {isLoading && <p className="text-sm text-gray-400">Loading…</p>}
      <div className="flex flex-col gap-2">
        {gifts.map(gift => <GiftCard key={gift.id} gift={gift} />)}
      </div>
      {!isLoading && gifts.length === 0 && (
        <p className="text-sm text-gray-400">No gifts yet. Add your first gift idea above.</p>
      )}
    </div>
  )
}
