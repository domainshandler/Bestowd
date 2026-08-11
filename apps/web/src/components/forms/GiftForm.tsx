import { useState } from 'react'
import type { CreateGiftBody } from '@bestowd/types'

interface Props {
  onSubmit: (data: CreateGiftBody) => void
  onCancel: () => void
  loading?: boolean
}

export default function GiftForm({ onSubmit, onCancel, loading }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [upc, setUpc] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [type, setType] = useState<'product' | 'basket'>('product')

  function addTag() {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t)) setTags(prev => [...prev, t])
    setTagInput('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit({ title, description: description || undefined, imageUrl: imageUrl || undefined, upc: upc || undefined, tags, type })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex gap-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="radio" value="product" checked={type === 'product'} onChange={() => setType('product')} />
          Product
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="radio" value="basket" checked={type === 'basket'} onChange={() => setType('basket')} />
          Basket
        </label>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
        <input
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          value={title} onChange={e => setTitle(e.target.value)} required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          rows={2} value={description} onChange={e => setDescription(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
        <input
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          value={imageUrl} onChange={e => setImageUrl(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">UPC / GTIN</label>
        <input
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          value={upc} onChange={e => setUpc(e.target.value)} placeholder="Optional product barcode"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
        <div className="flex gap-2 mb-2">
          <input
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="e.g. tech, books" value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
          />
          <button type="button" onClick={addTag} className="px-3 py-2 bg-brand text-white rounded-lg text-sm">+</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {tags.map(tag => (
            <span key={tag} className="bg-brand-light text-brand text-xs px-2 py-1 rounded-full flex items-center gap-1">
              {tag}
              <button type="button" onClick={() => setTags(prev => prev.filter(t => t !== tag))}>×</button>
            </span>
          ))}
        </div>
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
        <button type="submit" disabled={loading} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium disabled:opacity-50">
          {loading ? 'Saving…' : 'Save Gift'}
        </button>
      </div>
    </form>
  )
}
