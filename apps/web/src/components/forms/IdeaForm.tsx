import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createIdea, listPeople } from '@bestowd/api-client'
import { Button, Field, FormError, Modal, TextArea, TextInput } from '../ui.tsx'
import { numberOrNull, useSave } from './useSave.ts'

export default function IdeaForm({ open, onClose, groupId, personId, occasionId }: {
  open: boolean; onClose: () => void; groupId: string; personId?: string | null; occasionId?: string | null
}) {
  const people = useQuery({ queryKey: ['people', groupId], queryFn: () => listPeople(groupId) })
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [price, setPrice] = useState('')
  const [url, setUrl] = useState('')
  const [ageMin, setAgeMin] = useState('')
  const [ageMax, setAgeMax] = useState('')
  const [notes, setNotes] = useState('')
  const [tagged, setTagged] = useState<string[]>(personId ? [personId] : [])

  const toggle = (id: string) => setTagged((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]))
  const save = useSave(() => createIdea(groupId, {
    title: title.trim(),
    category: category.trim() || null,
    price: numberOrNull(price),
    url: url.trim() || null,
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
        <Field label="Idea">{(id) => <TextInput id={id} required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Watercolour paint kit" />}</Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Category">{(id) => <TextInput id={id} maxLength={60} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Art" />}</Field>
          <Field label="Price">{(id) => <TextInput id={id} type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />}</Field>
        </div>
        <Field label="Link">{(id) => <TextInput id={id} type="url" pattern="https?://.*" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />}</Field>
        <fieldset>
          <legend className="text-sm font-medium mb-1">Good for ages</legend>
          <div className="grid grid-cols-2 gap-2">
            <TextInput aria-label="Minimum age" type="number" min={0} max={120} placeholder="From" value={ageMin} onChange={(e) => setAgeMin(e.target.value)} />
            <TextInput aria-label="Maximum age" type="number" min={0} max={120} placeholder="To" value={ageMax} onChange={(e) => setAgeMax(e.target.value)} />
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-sm font-medium mb-1">For</legend>
          <div className="flex flex-wrap gap-2">
            {people.data?.map((p) => (
              <label key={p.id} className={`min-h-[36px] px-3 rounded-full border text-sm flex items-center gap-2 cursor-pointer ${tagged.includes(p.id) ? 'bg-brand-light border-brand text-brand font-semibold' : 'bg-white border-line'}`}>
                <input type="checkbox" className="sr-only" checked={tagged.includes(p.id)} onChange={() => toggle(p.id)} />
                {p.name}
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Why it fits">{(id) => <TextArea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
        <FormError error={save.error} />
        <Button type="submit" disabled={!title.trim() || save.isPending}>{save.isPending ? 'Saving…' : 'Save idea'}</Button>
      </form>
    </Modal>
  )
}
