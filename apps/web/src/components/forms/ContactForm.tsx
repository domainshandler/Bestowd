import { useState } from 'react'
import type { CreateContactBody, ContactAttribute } from '@bestowd/types'

interface Props {
  initial?: Partial<CreateContactBody>
  onSubmit: (data: CreateContactBody) => void
  onCancel: () => void
  loading?: boolean
}

export default function ContactForm({ initial = {}, onSubmit, onCancel, loading }: Props) {
  const [name, setName] = useState(initial.name ?? '')
  const [email, setEmail] = useState(initial.email ?? '')
  const [notes, setNotes] = useState(initial.notes ?? '')
  const [attributes, setAttributes] = useState<ContactAttribute[]>(initial.attributes ?? [])
  const [attrLabel, setAttrLabel] = useState('')
  const [attrValue, setAttrValue] = useState('')

  function addAttribute() {
    if (!attrLabel || !attrValue) return
    setAttributes(prev => [...prev, { label: attrLabel, value: attrValue, visible: true }])
    setAttrLabel('')
    setAttrValue('')
  }

  function removeAttribute(index: number) {
    setAttributes(prev => prev.filter((_, i) => i !== index))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit({ name, email: email || undefined, notes: notes || undefined, attributes })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
        <input
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          value={name} onChange={e => setName(e.target.value)} required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          value={email} onChange={e => setEmail(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          rows={2} value={notes} onChange={e => setNotes(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Interests & Attributes</label>
        <div className="flex gap-2 mb-2">
          <input
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Label (e.g. Loves)" value={attrLabel} onChange={e => setAttrLabel(e.target.value)}
          />
          <input
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Value (e.g. hiking)" value={attrValue} onChange={e => setAttrValue(e.target.value)}
          />
          <button type="button" onClick={addAttribute} className="px-3 py-2 bg-brand text-white rounded-lg text-sm">+</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {attributes.map((attr, i) => (
            <span key={i} className="bg-brand-light text-brand text-xs px-2 py-1 rounded-full flex items-center gap-1">
              {attr.label}: {attr.value}
              <button type="button" onClick={() => removeAttribute(i)} className="ml-1 text-brand-dark hover:text-red-500">×</button>
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}
