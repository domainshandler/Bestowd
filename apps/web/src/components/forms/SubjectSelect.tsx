import { useQuery } from '@tanstack/react-query'
import { listFamilies, listPeople } from '@bestowd/api-client'
import { Select } from '../ui.tsx'

export interface Subject {
  personId: string | null
  familyId: string | null
}

/** A subject as a picker choice, and back. */
export const subjectToRecipients = (s: Subject): { kind: 'person' | 'family'; id: string }[] =>
  s.personId ? [{ kind: 'person', id: s.personId }] : s.familyId ? [{ kind: 'family', id: s.familyId }] : []
export const recipientsToSubject = (r: { kind: 'person' | 'family'; id: string }[]): Subject =>
  r[0]
    ? { personId: r[0].kind === 'person' ? r[0].id : null, familyId: r[0].kind === 'family' ? r[0].id : null }
    : { personId: null, familyId: null }

export const encodeSubject = (s: Subject) => (s.personId ? `person:${s.personId}` : s.familyId ? `family:${s.familyId}` : '')
export function decodeSubject(v: string): Subject {
  const [kind, id] = v.split(':')
  return { personId: kind === 'person' ? id : null, familyId: kind === 'family' ? id : null }
}

/** One select over the group's people and families. */
export default function SubjectSelect({
  id,
  groupId,
  value,
  onChange,
  placeholder = 'Choose…',
}: {
  id?: string
  groupId: string
  value: Subject
  onChange: (s: Subject) => void
  placeholder?: string
}) {
  const people = useQuery({ queryKey: ['people', groupId], queryFn: () => listPeople(groupId) })
  const families = useQuery({ queryKey: ['families', groupId, 'ACTIVE'], queryFn: () => listFamilies(groupId) })
  return (
    <Select id={id} required value={encodeSubject(value)} onChange={(e) => onChange(decodeSubject(e.target.value))}>
      <option value="">{placeholder}</option>
      <optgroup label="People">
        {people.data?.map((p) => (
          <option key={p.id} value={`person:${p.id}`}>
            {p.name} ({p.familyName})
          </option>
        ))}
      </optgroup>
      <optgroup label="Whole family">
        {families.data?.map((f) => (
          <option key={f.id} value={`family:${f.id}`}>
            {f.name}
          </option>
        ))}
      </optgroup>
    </Select>
  )
}
