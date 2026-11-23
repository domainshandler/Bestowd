import { useState, type FormEvent } from 'react'
import { createIdea } from '@bestowd/api-client'
import { Button, Field, FormError, Modal, TextArea, TextInput } from '../ui.tsx'
import RecipientPicker from './RecipientPicker.tsx'
import PhotoField from './PhotoField.tsx'
import AutoText from './AutoText.tsx'
import { numberOrNull, useSave } from './useSave.ts'

export default function IdeaForm({ open, onClose, groupId, personId, occasionId }: {
  open: boolean; onClose: () => void; groupId: string; personId?: string | null; occasionId?: string | null
}) {
  const [title, setTitle] = useState('')
  const [brand, setBrand] = useState('')
  const [store, setStore] = useState('')
  const [category, setCategory] = useState('')
  const [price, setPrice] = useState('')
  const [url, setUrl] = useState('')
  const [ageMin, setAgeMin] = useState('')
  const [ageMax, setAgeMax] = useState('')
  const [notes, setNotes] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [tagged, setTagged] = useState<string[]>(personId ? [personId] : [])

  const save = useSave(() => createIdea(groupId, {
    title: title.trim(),
    brand: brand.trim() || null,
    store: store.trim() || null,
    category: category.trim() || null,
    price: numberOrNull(price),
    url: url.trim() || null,
    imageUrl,
    ageMin: numberOrNull(ageMin),
    ageMax: numberOrNull(ageMax),
    notes: notes.trim() || null,
    personIds: tagged,
    occasionId: occasionId ?? null,
  }), onClose)
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate(undefined) }

  return (
    <Modal open={open} onClose={onClose} title="Add an idea">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Idea">{(id) => <AutoText id={id} groupId={groupId} field="title" required maxLength={200} value={title} onChange={setTitle} placeholder="Watercolour paint kit" />}</Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Brand">{(id) => <AutoText id={id} groupId={groupId} field="brand" maxLength={80} value={brand} onChange={setBrand} placeholder="Crayola" />}</Field>
          <Field label="Category">{(id) => <AutoText id={id} groupId={groupId} field="category" maxLength={60} value={category} onChange={setCategory} placeholder="Art" />}</Field>
        </div>
        <Field label="Store">{(id) => <AutoText id={id} groupId={groupId} field="store" maxLength={80} value={store} onChange={setStore} placeholder="Where to buy it" />}</Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Price">{(id) => <TextInput id={id} type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />}</Field>
          <Field label="Link">{(id) => <TextInput id={id} type="url" pattern="https?://.*" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />}</Field>
        </div>
        <PhotoField groupId={groupId} value={imageUrl} onChange={setImageUrl} />
        <fieldset>
          <legend className="text-sm font-medium mb-1">Good for ages</legend>
          <div className="grid grid-cols-2 gap-2">
            <TextInput aria-label="Minimum age" type="number" min={0} max={120} placeholder="From" value={ageMin} onChange={(e) => setAgeMin(e.target.value)} />
            <TextInput aria-label="Maximum age" type="number" min={0} max={120} placeholder="To" value={ageMax} onChange={(e) => setAgeMax(e.target.value)} />
          </div>
        </fieldset>
        <RecipientPicker groupId={groupId} label="For" value={tagged.map((id) => ({ kind: 'person' as const, id }))} onChange={(r) => setTagged(r.map((x) => x.id))} />
        <Field label="Why it fits">{(id) => <TextArea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
        <FormError error={save.error} />
        <Button type="submit" disabled={!title.trim() || save.isPending}>{save.isPending ? 'Saving…' : 'Save idea'}</Button>
      </form>
    </Modal>
  )
}
