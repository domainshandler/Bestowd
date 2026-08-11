import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getGift, deleteGift, listAssignments, updateAssignment, listListings } from '@bestowd/api-client'
import AssignmentStatusBadge from '../components/AssignmentStatusBadge.tsx'
import type { AssignmentStatus } from '@bestowd/types'

export default function GiftDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: gift, isLoading } = useQuery({ queryKey: ['gifts', id], queryFn: () => getGift(id!) })
  const { data: assignments = [] } = useQuery({
    queryKey: ['assignments-by-gift', id],
    queryFn: () => listAssignments(),
    select: data => data.filter(a => a.giftId === id),
    enabled: !!id,
  })
  const { data: listings = [] } = useQuery({
    queryKey: ['listings', id],
    queryFn: () => listListings(id!),
    enabled: !!id,
  })

  const remove = useMutation({
    mutationFn: () => deleteGift(id!),
    onSuccess: () => navigate('/gifts'),
  })

  const updateStatus = useMutation({
    mutationFn: ({ assignmentId, status }: { assignmentId: string; status: AssignmentStatus }) =>
      updateAssignment(assignmentId, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assignments-by-gift', id] }),
  })

  if (isLoading) return <p className="text-sm text-gray-400">Loading…</p>
  if (!gift) return <p className="text-sm text-red-500">Gift not found.</p>

  return (
    <div className="max-w-2xl">
      <button onClick={() => navigate(-1)} className="text-sm text-brand mb-4 hover:underline">← Back</button>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-gray-900">{gift.title}</h1>
              {gift.type === 'basket' && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Basket</span>
              )}
            </div>
            {gift.description && <p className="text-sm text-gray-600 mb-3">{gift.description}</p>}
            {gift.upc && <p className="text-xs text-gray-400">UPC: {gift.upc}</p>}
          </div>
          <button onClick={() => remove.mutate()} className="text-sm text-red-500 hover:underline shrink-0">Delete</button>
        </div>

        {gift.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {gift.tags.map(tag => (
              <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{tag}</span>
            ))}
          </div>
        )}

        {gift.type === 'basket' && gift.basketItems.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Basket Contents</p>
            <div className="flex flex-col gap-1">
              {gift.basketItems.map(item => (
                <div key={item.id} className="text-sm text-gray-700 pl-3 border-l-2 border-brand-light">{item.title}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {listings.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Where to Buy</h2>
          <div className="flex flex-col gap-2">
            {listings.map(listing => (
              <div key={listing.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800 capitalize">{listing.vendor}</p>
                  {listing.listedPrice && (
                    <p className="text-xs text-gray-500">${parseFloat(listing.listedPrice).toFixed(2)} {listing.currency}</p>
                  )}
                </div>
                <a href={listing.vendorUrl} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-brand hover:underline font-medium">
                  View →
                </a>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Assignments</h2>
        {assignments.length === 0 ? (
          <p className="text-sm text-gray-400">This gift hasn't been assigned yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {assignments.map(a => (
              <div key={a.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">Contact: {a.contactId}</p>
                  {a.givenAt && <p className="text-xs text-gray-400">Given: {new Date(a.givenAt).toLocaleDateString()}</p>}
                  {a.purchasePrice && <p className="text-xs text-gray-400">Paid: ${parseFloat(a.purchasePrice).toFixed(2)}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <AssignmentStatusBadge status={a.status} />
                  {a.status !== 'given' && (
                    <button
                      onClick={() => updateStatus.mutate({ assignmentId: a.id, status: a.status === 'idea' ? 'purchased' : 'given' })}
                      className="text-xs text-brand hover:underline"
                    >
                      → {a.status === 'idea' ? 'Mark Purchased' : 'Mark Given'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
