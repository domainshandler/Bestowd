import { useState, type FormEvent } from 'react'
import { createPerson, updatePerson } from '@bestowd/api-client'
import type { Person } from '@bestowd/types'
import { Button, Field, FormError, Modal, Select, TextArea, TextInput } from '../ui.tsx'
import { numberOrNull, splitList, useSave } from './useSave.ts'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function PersonForm({ open, onClose, familyId, person }: {
  open: boolean; onClose: () => void; familyId: string; person?: Person
}) {
  const [name, setName] = useState(person?.name ?? '')
  const [relationship, setRelationship] = useState(person?.relationship ?? '')
  const [month, setMonth] = useState(person?.birthMonth?.toString() ?? '')
  const [day, setDay] = useState(person?.birthDay?.toString() ?? '')
  const [year, setYear] = useState(person?.birthYear?.toString() ?? '')
  const [likes, setLikes] = useState(person?.likes.join(', ') ?? '')
  const [avoid, setAvoid] = useState(person?.avoid.join(', ') ?? '')
  const [clothing, setClothing] = useState(person?.sizes['Clothing'] ?? '')
  const [shoes, setShoes] = useState(person?.sizes['Shoes'] ?? '')
  const [foodNotes, setFoodNotes] = useState(person?.foodNotes ?? '')
  const [notes, setNotes] = useState(person?.notes ?? '')

  const save = useSave(() => {
    const sizes: Record<string, string> = { ...(person?.sizes ?? {}) }
    for (const [k, v] of [['Clothing', clothing], ['Shoes', shoes]] as const) {
      if (v.trim()) sizes[k] = v.trim()
      else delete sizes[k]
    }
    const body = {
      name: name.trim(),
      relationship: relationship.trim() || null,
      birthMonth: numberOrNull(month),
      birthDay: month ? numberOrNull(day) : null,
      birthYear: numberOrNull(year),
      likes: splitList(likes),
      avoid: splitList(avoid),
      sizes,
      foodNotes: foodNotes.trim() || null,
      notes: notes.trim() || null,
    }
    return person ? updatePerson(person.id, body) : createPerson(familyId, body)
  }, onClose)
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate(undefined) }

  return (
    <Modal open={open} onClose={onClose} title={person ? `Edit ${person.name}` : 'Add person'}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Name">{(id) => <TextInput id={id} required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label="Relationship" hint="e.g. Daughter, Teacher, Grandma">{(id) => <TextInput id={id} value={relationship} onChange={(e) => setRelationship(e.target.value)} />}</Field>
        <fieldset className="flex flex-col gap-1">
          <legend className="text-sm font-medium mb-1">Birthday</legend>
          <div className="grid grid-cols-[2fr_1fr_1.2fr] gap-2">
            <Select aria-label="Birth month" value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="">Month</option>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </Select>
            <TextInput aria-label="Birth day" type="number" min={1} max={31} placeholder="Day" value={day} disabled={!month} onChange={(e) => setDay(e.target.value)} />
            <TextInput aria-label="Birth year" type="number" min={1900} max={new Date().getFullYear()} placeholder="Year" value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
          <p className="text-xs text-muted">The year is optional; with it, Bestowd shows their age.</p>
        </fieldset>
        <Field label="Loves" hint="Separate with commas">{(id) => <TextInput id={id} value={likes} onChange={(e) => setLikes(e.target.value)} placeholder="Painting, Dinosaurs" />}</Field>
        <Field label="Avoid" hint="Separate with commas">{(id) => <TextInput id={id} value={avoid} onChange={(e) => setAvoid(e.target.value)} placeholder="Glitter, Loud toys" />}</Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Clothing size">{(id) => <TextInput id={id} value={clothing} onChange={(e) => setClothing(e.target.value)} />}</Field>
          <Field label="Shoe size">{(id) => <TextInput id={id} value={shoes} onChange={(e) => setShoes(e.target.value)} />}</Field>
        </div>
        <Field label="Food note">{(id) => <TextInput id={id} value={foodNotes} onChange={(e) => setFoodNotes(e.target.value)} placeholder="Nut-free treats" />}</Field>
        <Field label="Notes">{(id) => <TextArea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
        <FormError error={save.error} />
        <Button type="submit" disabled={!name.trim() || save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</Button>
      </form>
    </Modal>
  )
}
