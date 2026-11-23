import { useEffect, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createGift, listOccasions, updateGift } from '@bestowd/api-client'
import type { CreateGiftBody, Gift, GiftDirection, GiftStatus, Reaction } from '@bestowd/types'
import { Button, Checkbox, Field, FormError, Modal, Segmented, Select, TextArea, TextInput } from '../ui.tsx'
import { REACTION_LABEL, formatDate, todayInput } from '../../lib/format.ts'
import { recipientsToSubject, subjectToRecipients, type Subject } from './SubjectSelect.tsx'
import RecipientPicker from './RecipientPicker.tsx'
import PhotoField from './PhotoField.tsx'
import AutoText from './AutoText.tsx'
import { FillFromLink, FillFromPhoto, applyDraft } from './Capture.tsx'
import type { ProductDraft } from '@bestowd/types'
import { numberOrNull, useSave } from './useSave.ts'

export interface GiftDefaults {
  direction?: GiftDirection
  personId?: string | null
  familyId?: string | null
  occasionId?: string | null
  /** Details to start from: an idea being bought, or a snapped photo. */
  title?: string
  brand?: string | null
  store?: string | null
  category?: string | null
  amount?: number | null
  url?: string | null
  photoUrl?: string | null
  notes?: string | null
  status?: GiftStatus
  /** Logging a given gift from this idea marks the idea bought. */
  ideaId?: string | null
  /** Started from a snapped photo: show it first and read it straight away when the group has AI. */
  fromPhoto?: boolean
}

/** Log a given or received gift, or edit one. */
export default function GiftForm({ open, onClose, groupId, defaults = {}, gift }: {
  open: boolean; onClose: () => void; groupId: string; defaults?: GiftDefaults; gift?: Gift
}) {
  const [direction, setDirection] = useState<GiftDirection>(gift?.direction ?? defaults.direction ?? 'GIVEN')
  const [title, setTitle] = useState(gift?.title ?? defaults.title ?? '')
  const [who, setWho] = useState<Subject>({ personId: gift?.personId ?? defaults.personId ?? null, familyId: gift?.familyId ?? defaults.familyId ?? null })
  const [date, setDate] = useState(gift?.date.slice(0, 10) ?? todayInput())
  const [occasionId, setOccasionId] = useState(gift?.occasionId ?? defaults.occasionId ?? '')
  const [amount, setAmount] = useState(gift?.amount?.toString() ?? defaults.amount?.toString() ?? '')
  const [category, setCategory] = useState(gift?.category ?? defaults.category ?? '')
  const [brand, setBrand] = useState(gift?.brand ?? defaults.brand ?? '')
  const [store, setStore] = useState(gift?.store ?? defaults.store ?? '')
  const [url, setUrl] = useState(gift?.url ?? defaults.url ?? '')
  const [status, setStatus] = useState<GiftStatus>(gift?.status ?? defaults.status ?? 'GIVEN')
  const [valueHidden, setValueHidden] = useState(gift?.valueHidden ?? true)
  const [hasGiftReceipt, setHasGiftReceipt] = useState(gift?.hasGiftReceipt ?? false)
  const [returnBy, setReturnBy] = useState(gift?.returnBy?.slice(0, 10) ?? '')
  const [thankYouSent, setThankYouSent] = useState(gift?.thankYouSent ?? false)
  const [reaction, setReaction] = useState<Reaction | ''>(gift?.reaction ?? '')
  const [notes, setNotes] = useState(gift?.notes ?? defaults.notes ?? '')
  const [photoUrl, setPhotoUrl] = useState<string | null>(gift?.photoUrl ?? defaults.photoUrl ?? null)
  const [captureNote, setCaptureNote] = useState<string | null>(null)
  const onDraft = (d: ProductDraft) => setCaptureNote(applyDraft(d,
    { title: setTitle, brand: setBrand, store: setStore, price: setAmount, url: setUrl, photo: setPhotoUrl },
    { url: Boolean(url.trim()), photo: Boolean(photoUrl) }))

  // Occasions for the chosen person or family (group-wide ones included), or every occasion in the group when nobody
  // is chosen yet; from a year back to a year ahead.
  const yearAgo = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10)
  const yearAhead = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10)
  const occasions = useQuery({
    queryKey: ['occasions', groupId, who, 'picker'],
    queryFn: () => listOccasions(groupId, {
      from: yearAgo, to: yearAhead,
      ...(who.personId ? { personId: who.personId } : who.familyId ? { familyId: who.familyId } : {}),
    }),
  })
  // Keep the picked occasion when the list changes, unless it no longer applies to who it's for.
  useEffect(() => {
    if (occasionId && occasions.data && !occasions.data.occasions.some((o) => o.id === occasionId)) setOccasionId('')
  }, [occasions.data, occasionId])
  // Picking an occasion first fills in who it's for, when it belongs to one person or family.
  const chooseOccasion = (id: string) => {
    setOccasionId(id)
    const o = occasions.data?.occasions.find((x) => x.id === id)
    if (o && o.scope !== 'GROUP' && !who.personId && !who.familyId) setWho({ personId: o.personId, familyId: o.personId ? null : o.familyId })
  }

  const received = direction === 'RECEIVED'
  const save = useSave(() => {
    const common = {
      title: title.trim(), date, ...who,
      occasionId: occasionId || null,
      amount: numberOrNull(amount),
      category: category.trim() || null,
      brand: brand.trim() || null,
      store: store.trim() || null,
      url: url.trim() || null,
      photoUrl,
      reaction: reaction || null,
      notes: notes.trim() || null,
    }
    const receivedFields = { valueHidden, hasGiftReceipt, returnBy: returnBy || null, thankYouSent }
    if (gift) return updateGift(gift.id, received ? { ...common, ...receivedFields } : { ...common, status })
    const body: CreateGiftBody = received
      ? { direction: 'RECEIVED', ...common, ...receivedFields }
      : { direction: 'GIVEN', ...common, status }
    return createGift(groupId, { ...body, ...(defaults.ideaId ? { ideaId: defaults.ideaId } : {}) })
  }, onClose)
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate(undefined) }

  const photoFirst = Boolean(defaults.fromPhoto && !gift)
  const photo = (
    <>
      <PhotoField groupId={groupId} value={photoUrl} onChange={setPhotoUrl} />
      <FillFromPhoto groupId={groupId} photoUrl={photoUrl} onDraft={onDraft} auto={photoFirst} />
      {captureNote && <p role="status" className="text-sm text-brand">{captureNote}</p>}
    </>
  )

  return (
    <Modal open={open} onClose={onClose} title={gift ? 'Edit gift' : 'Log a gift'}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {photoFirst && photo}
        {!gift && (
          <Segmented label="Direction" value={direction} onChange={setDirection}
            options={[{ value: 'GIVEN', label: 'I gave' }, { value: 'RECEIVED', label: 'We received' }]} />
        )}
        <Field label="Gift">{(id) => <AutoText id={id} groupId={groupId} field="title" required maxLength={200} value={title} onChange={setTitle} placeholder="Wooden art easel" />}</Field>
        <RecipientPicker groupId={groupId} label={received ? 'From' : 'To'} include="both" single
          value={subjectToRecipients(who)} onChange={(r) => setWho(recipientsToSubject(r))} />
        <Field label="Occasion">
          {(id) => (
            <Select id={id} value={occasionId} onChange={(e) => chooseOccasion(e.target.value)}>
              <option value="">None</option>
              {occasions.data?.occasions.map((o) => (
                <option key={o.id} value={o.id}>{o.name}{o.nextOccurrence ? ` · ${formatDate(o.nextOccurrence)}` : ''}</option>
              ))}
            </Select>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Date">{(id) => <TextInput id={id} type="date" required value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
          <Field label={received ? 'Estimated value' : 'Price'}>{(id) => <TextInput id={id} type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />}</Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Brand">{(id) => <AutoText id={id} groupId={groupId} field="brand" maxLength={80} value={brand} onChange={setBrand} placeholder="Garmin" />}</Field>
          <Field label="Category" hint="Warns about repeats">{(id) => <AutoText id={id} groupId={groupId} field="category" maxLength={60} value={category} onChange={setCategory} placeholder="Smartwatch" />}</Field>
        </div>
        {!received && <Field label="Store">{(id) => <AutoText id={id} groupId={groupId} field="store" maxLength={80} value={store} onChange={setStore} placeholder="Best Buy" />}</Field>}
        <Field label="Link to product">{(id) => <TextInput id={id} type="url" pattern="https?://.*" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />}</Field>
        {received ? (
          <>
            <Checkbox label="Keep value hidden" hint="Shown only when you choose" checked={valueHidden} onChange={setValueHidden} />
            <Checkbox label="Has a gift receipt" checked={hasGiftReceipt} onChange={setHasGiftReceipt} />
            {hasGiftReceipt && <Field label="Return by">{(id) => <TextInput id={id} type="date" value={returnBy} onChange={(e) => setReturnBy(e.target.value)} />}</Field>}
            <Checkbox label="Thank-you sent" checked={thankYouSent} onChange={setThankYouSent} />
          </>
        ) : (
          <Field label="Status">
            {(id) => (
              <Select id={id} value={status} onChange={(e) => setStatus(e.target.value as GiftStatus)}>
                <option value="GIVEN">Given</option>
                <option value="BOUGHT">Bought, not given yet</option>
              </Select>
            )}
          </Field>
        )}
        <Field label="Reaction">
          {(id) => (
            <Select id={id} value={reaction} onChange={(e) => setReaction(e.target.value as Reaction | '')}>
              <option value="">Not yet</option>
              {Object.entries(REACTION_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          )}
        </Field>
        <FillFromLink groupId={groupId} url={url} onDraft={onDraft} />
        {!photoFirst && photo}
        <Field label="Notes">{(id) => <TextArea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
        <FormError error={save.error} />
        <Button type="submit" disabled={!title.trim() || (!who.personId && !who.familyId) || save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</Button>
      </form>
    </Modal>
  )
}
