import { useState, type FormEvent } from 'react'
import { createFamily, updateFamily } from '@bestowd/api-client'
import type { Family, FamilyType } from '@bestowd/types'
import { Button, Field, FormError, Modal, Select, TextArea, TextInput } from '../ui.tsx'
import { FAMILY_TYPE_LABEL } from '../../lib/format.ts'
import { useSave } from './useSave.ts'

export default function FamilyForm({
  open,
  onClose,
  groupId,
  family,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  groupId: string
  family?: Family
  onSaved?: (f: Family) => void
}) {
  const [name, setName] = useState(family?.name ?? '')
  const [type, setType] = useState<FamilyType>(family?.type ?? 'FAMILY')
  const [notes, setNotes] = useState(family?.notes ?? '')
  const save = useSave(
    () => {
      const body = { name: name.trim(), type, notes: notes.trim() || null }
      return family ? updateFamily(family.id, body) : createFamily(groupId, body)
    },
    (f) => {
      onSaved?.(f)
      onClose()
    },
  )
  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate(undefined)
  }

  return (
    <Modal open={open} onClose={onClose} title={family ? 'Edit family' : 'Add family'}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Name">
          {(id) => (
            <TextInput id={id} required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="Chen family" />
          )}
        </Field>
        <Field label="Type">
          {(id) => (
            <Select id={id} value={type} onChange={(e) => setType(e.target.value as FamilyType)}>
              {Object.entries(FAMILY_TYPE_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Notes">{(id) => <TextArea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
        <FormError error={save.error} />
        <Button type="submit" disabled={!name.trim() || save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </form>
    </Modal>
  )
}
