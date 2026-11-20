import { useState } from 'react'
import type { Person } from '@bestowd/types'
import { Button, Card } from './ui.tsx'
import PersonForm from './forms/PersonForm.tsx'

function Tags({ items, tone }: { items: string[]; tone: 'brand' | 'danger' }) {
  const cls = tone === 'brand' ? 'text-brand-dark bg-brand-light' : 'text-danger bg-danger-soft'
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => <span key={t} className={`text-[13px] font-medium px-2.5 py-1.5 rounded-full ${cls}`}>{t}</span>)}
    </div>
  )
}

export function NotesCard({ person, onEdit }: { person: Person; onEdit?: () => void }) {
  const p = person
  const facts = [...Object.entries(p.sizes).map(([k, v]) => [`${k} size`, v] as const), ...(p.foodNotes ? [['Food note', p.foodNotes] as const] : [])]
  const empty = !p.likes.length && !p.avoid.length && !facts.length && !p.notes
  return (
    <Card className="p-4 flex flex-col gap-3.5">
      {empty && <p className="text-sm text-muted">No notes for {p.name} yet.</p>}
      {p.likes.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted tracking-wide uppercase">Loves</span>
          <Tags items={p.likes} tone="brand" />
        </div>
      )}
      {p.avoid.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted tracking-wide uppercase">Avoid</span>
          <Tags items={p.avoid} tone="danger" />
        </div>
      )}
      {facts.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {facts.map(([k, v]) => (
            <div key={k} className="bg-ground rounded-[10px] p-2.5 flex flex-col gap-0.5">
              <span className="text-xs text-muted">{k}</span>
              <span className="text-sm font-semibold">{v}</span>
            </div>
          ))}
        </div>
      )}
      {p.notes && <p className="text-sm text-chip-ink whitespace-pre-line">{p.notes}</p>}
      {onEdit && <Button variant="secondary" onClick={onEdit}>{empty ? 'Add notes' : 'Edit notes'}</Button>}
    </Card>
  )
}

/** Per-person notes with a tab for each person. */
export default function PersonNotes({ people }: { people: Person[] }) {
  const [selected, setSelected] = useState(people[0]?.id)
  const [editing, setEditing] = useState(false)
  const person = people.find((p) => p.id === selected) ?? people[0]
  if (!person) return null
  return (
    <>
      <div role="tablist" aria-label="Notes for" className="flex gap-2 overflow-x-auto pb-1">
        {people.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={p.id === person.id}
            onClick={() => setSelected(p.id)}
            className={`h-9 px-3.5 rounded-full text-sm whitespace-nowrap ${p.id === person.id ? 'bg-ink text-white font-semibold' : 'bg-white border border-line font-medium'}`}
          >
            {p.name}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        <NotesCard person={person} onEdit={() => setEditing(true)} />
      </div>
      {editing && <PersonForm open onClose={() => setEditing(false)} familyId={person.familyId} person={person} />}
    </>
  )
}
