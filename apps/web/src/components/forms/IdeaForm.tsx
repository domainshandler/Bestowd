import { useState, type FormEvent } from 'react'
import { createIdea, updateIdea } from '@bestowd/api-client'
import { Button, Field, FormError, Modal, TextArea, TextInput } from '../ui.tsx'
import RecipientPicker from './RecipientPicker.tsx'
import PhotoField from './PhotoField.tsx'
import AutoText from './AutoText.tsx'
import { FillFromLink, FillFromPhoto, applyDraft } from './Capture.tsx'
import type { Idea, ProductDraft } from '@bestowd/types'
import { numberOrNull, useSave } from './useSave.ts'

/** Add an idea, or edit one (pass idea). photoUrl with fromPhoto starts from a snapped photo and reads it. */
export default function IdeaForm({
  open,
  onClose,
  groupId,
  personId,
  occasionId,
  idea,
  photoUrl,
  fromPhoto = false,
}: {
  open: boolean
  onClose: () => void
  groupId: string
  personId?: string | null
  occasionId?: string | null
  idea?: Pick<
    Idea,
    'id' | 'title' | 'brand' | 'store' | 'category' | 'price' | 'url' | 'imageUrl' | 'ageMin' | 'ageMax' | 'notes' | 'people'
  >
  photoUrl?: string | null
  fromPhoto?: boolean
}) {
  const [title, setTitle] = useState(idea?.title ?? '')
  const [brand, setBrand] = useState(idea?.brand ?? '')
  const [store, setStore] = useState(idea?.store ?? '')
  const [category, setCategory] = useState(idea?.category ?? '')
  const [price, setPrice] = useState(idea?.price?.toString() ?? '')
  const [url, setUrl] = useState(idea?.url ?? '')
  const [ageMin, setAgeMin] = useState(idea?.ageMin?.toString() ?? '')
  const [ageMax, setAgeMax] = useState(idea?.ageMax?.toString() ?? '')
  const [notes, setNotes] = useState(idea?.notes ?? '')
  const [imageUrl, setImageUrl] = useState<string | null>(idea?.imageUrl ?? photoUrl ?? null)
  const [captureNote, setCaptureNote] = useState<string | null>(null)
  const onDraft = (d: ProductDraft) =>
    setCaptureNote(
      applyDraft(
        d,
        { title: setTitle, brand: setBrand, store: setStore, price: setPrice, url: setUrl, photo: setImageUrl },
        { url: Boolean(url.trim()), photo: Boolean(imageUrl) },
      ),
    )
  const [tagged, setTagged] = useState<string[]>(idea ? idea.people.map((p) => p.id) : personId ? [personId] : [])

  const save = useSave(() => {
    const body = {
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
    }
    return idea ? updateIdea(idea.id, body) : createIdea(groupId, { ...body, occasionId: occasionId ?? null })
  }, onClose)
  const photoFirst = fromPhoto && !idea
  const photo = (
    <>
      <PhotoField groupId={groupId} value={imageUrl} onChange={setImageUrl} />
      <FillFromPhoto groupId={groupId} photoUrl={imageUrl} onDraft={onDraft} auto={photoFirst} />
      {captureNote && (
        <p role="status" className="text-sm text-brand">
          {captureNote}
        </p>
      )}
    </>
  )
  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate(undefined)
  }

  return (
    <Modal open={open} onClose={onClose} title={idea ? 'Edit idea' : 'Add an idea'}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {photoFirst && photo}
        <Field label="Idea">
          {(id) => (
            <AutoText
              id={id}
              groupId={groupId}
              field="title"
              required
              maxLength={200}
              value={title}
              onChange={setTitle}
              placeholder="Watercolour paint kit"
            />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Brand">
            {(id) => (
              <AutoText id={id} groupId={groupId} field="brand" maxLength={80} value={brand} onChange={setBrand} placeholder="Crayola" />
            )}
          </Field>
          <Field label="Category">
            {(id) => (
              <AutoText
                id={id}
                groupId={groupId}
                field="category"
                maxLength={60}
                value={category}
                onChange={setCategory}
                placeholder="Art"
              />
            )}
          </Field>
        </div>
        <Field label="Store">
          {(id) => (
            <AutoText
              id={id}
              groupId={groupId}
              field="store"
              maxLength={80}
              value={store}
              onChange={setStore}
              placeholder="Where to buy it"
            />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Price">
            {(id) => <TextInput id={id} type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />}
          </Field>
          <Field label="Link">
            {(id) => (
              <TextInput
                id={id}
                type="url"
                pattern="https?://.*"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://"
              />
            )}
          </Field>
        </div>
        <FillFromLink groupId={groupId} url={url} onDraft={onDraft} />
        {!photoFirst && photo}
        <fieldset>
          <legend className="text-sm font-medium mb-1">Good for ages</legend>
          <div className="grid grid-cols-2 gap-2">
            <TextInput
              aria-label="Minimum age"
              type="number"
              min={0}
              max={120}
              placeholder="From"
              value={ageMin}
              onChange={(e) => setAgeMin(e.target.value)}
            />
            <TextInput
              aria-label="Maximum age"
              type="number"
              min={0}
              max={120}
              placeholder="To"
              value={ageMax}
              onChange={(e) => setAgeMax(e.target.value)}
            />
          </div>
        </fieldset>
        <RecipientPicker
          groupId={groupId}
          label="For"
          value={tagged.map((id) => ({ kind: 'person' as const, id }))}
          onChange={(r) => setTagged(r.map((x) => x.id))}
        />
        <Field label="Why it fits">{(id) => <TextArea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
        <FormError error={save.error} />
        <Button type="submit" disabled={!title.trim() || save.isPending}>
          {save.isPending ? 'Saving…' : 'Save idea'}
        </Button>
      </form>
    </Modal>
  )
}
