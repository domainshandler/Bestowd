import { useState, type FormEvent } from 'react'
import { createOccasion, updateOccasion } from '@bestowd/api-client'
import type { Occasion, OccasionType } from '@bestowd/types'
import { Button, Checkbox, Field, FormError, Modal, Select, TextInput } from '../ui.tsx'
import { OCCASION_TYPE_LABEL } from '../../lib/format.ts'
import SubjectSelect, { type Subject } from './SubjectSelect.tsx'
import { numberOrNull, useSave } from './useSave.ts'

export default function OccasionForm({ open, onClose, groupId, subject, occasion, subjectName }: {
  open: boolean; onClose: () => void; groupId: string; subject?: Subject; occasion?: Occasion; subjectName?: string
}) {
  const [type, setType] = useState<OccasionType>(occasion?.type ?? 'BIRTHDAY')
  const [name, setName] = useState(occasion?.name ?? (subjectName ? `${subjectName}'s birthday` : ''))
  const [date, setDate] = useState(occasion?.date.slice(0, 10) ?? '')
  const [who, setWho] = useState<Subject>(subject ?? { personId: occasion?.personId ?? null, familyId: occasion?.familyId ?? null })
  const [recurs, setRecurs] = useState(occasion?.recursAnnually ?? true)
  const [budget, setBudget] = useState(occasion?.budget?.toString() ?? '')
  const [needsCard, setNeedsCard] = useState(occasion?.needsCard ?? false)
  const [partyAt, setPartyAt] = useState(occasion?.partyAt?.slice(0, 16) ?? '')
  const [location, setLocation] = useState(occasion?.location ?? '')
  const [hostGiftRequest, setHostGiftRequest] = useState(occasion?.hostGiftRequest ?? '')

  const chooseType = (t: OccasionType) => { setType(t); setRecurs(t !== 'ONE_OFF') }

  const save = useSave(() => {
    const body = {
      type, name: name.trim(), date, recursAnnually: recurs, budget: numberOrNull(budget), needsCard,
      partyAt: partyAt ? new Date(partyAt).toISOString() : null,
      location: location.trim() || null,
      hostGiftRequest: hostGiftRequest.trim() || null,
      ...(subject ? {} : who),
    }
    return occasion ? updateOccasion(occasion.id, body) : createOccasion(groupId, { ...body, ...who })
  }, onClose)
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate(undefined) }

  return (
    <Modal open={open} onClose={onClose} title={occasion ? 'Edit occasion' : 'Add occasion'}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Type">
          {(id) => (
            <Select id={id} value={type} onChange={(e) => chooseType(e.target.value as OccasionType)}>
              {Object.entries(OCCASION_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          )}
        </Field>
        {!subject && <Field label="For">{(id) => <SubjectSelect id={id} groupId={groupId} value={who} onChange={setWho} />}</Field>}
        <Field label="Name">{(id) => <TextInput id={id} required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Maya's birthday" />}</Field>
        <Field label="Date">{(id) => <TextInput id={id} type="date" required value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
        <Checkbox label="Every year" checked={recurs} onChange={setRecurs} />
        <Field label="Budget" hint="Leave empty to use your group's default">{(id) => <TextInput id={id} type="number" min={0} step="0.01" value={budget} onChange={(e) => setBudget(e.target.value)} />}</Field>
        <Checkbox label="Needs a card" checked={needsCard} onChange={setNeedsCard} />
        <details className="bg-white border border-line rounded-xl p-3">
          <summary className="text-sm font-medium cursor-pointer min-h-[28px]">Party details</summary>
          <div className="flex flex-col gap-3 mt-3">
            <Field label="Party time">{(id) => <TextInput id={id} type="datetime-local" value={partyAt} onChange={(e) => setPartyAt(e.target.value)} />}</Field>
            <Field label="Location">{(id) => <TextInput id={id} value={location} onChange={(e) => setLocation(e.target.value)} />}</Field>
            <Field label="Host's gift request">{(id) => <TextInput id={id} value={hostGiftRequest} onChange={(e) => setHostGiftRequest(e.target.value)} placeholder="Books only, under $20" />}</Field>
          </div>
        </details>
        <FormError error={save.error} />
        <Button type="submit" disabled={!name.trim() || !date || (!subject && !who.personId && !who.familyId) || save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </form>
    </Modal>
  )
}
