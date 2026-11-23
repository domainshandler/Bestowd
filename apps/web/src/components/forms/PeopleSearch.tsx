import { useId, useState } from 'react'
import type { PersonListItem } from '@bestowd/types'
import { Icon, TextInput } from '../ui.tsx'

export const MAX_MATCHES = 8

const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
const wordStarts = (text: string, q: string) => fold(text).split(/[\s'-]+/).some((w) => w.startsWith(q))

/** People with a word in their name or family starting with the search (ignoring case and accents), not already chosen. */
export function findPeople(people: PersonListItem[], search: string, exclude: string[]): PersonListItem[] {
  const q = fold(search.trim())
  if (!q) return []
  return people
    .filter((p) => !exclude.includes(p.id) && (wordStarts(p.name, q) || wordStarts(p.familyName, q)))
    .sort((a, b) => Number(!fold(a.name).startsWith(q)) - Number(!fold(b.name).startsWith(q)) || a.name.localeCompare(b.name))
    .slice(0, MAX_MATCHES)
}

/** Choose several people by searching instead of toggling everyone: chosen people show as removable chips. */
export default function PeopleSearch({ label, people, value, onChange }: {
  label: string; people: PersonListItem[]; value: string[]; onChange: (ids: string[]) => void
}) {
  const id = useId()
  const [search, setSearch] = useState('')
  const chosen = value.map((v) => people.find((p) => p.id === v)).filter((p): p is PersonListItem => Boolean(p))
  const matches = findPeople(people, search, value)
  const add = (p: PersonListItem) => { onChange([...value, p.id]); setSearch('') }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      {chosen.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={`${label}: chosen`}>
          {chosen.map((p) => (
            <li key={p.id} className="min-h-[36px] pl-3 pr-1 rounded-full border bg-brand-light border-brand text-brand text-sm font-semibold flex items-center gap-1">
              {p.name}
              <button type="button" aria-label={`Remove ${p.name}`} onClick={() => onChange(value.filter((v) => v !== p.id))}
                className="w-8 h-8 rounded-full hover:bg-white flex items-center justify-center">
                <Icon name="close" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <TextInput id={id} type="search" autoComplete="off" placeholder="Search people to add" value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && matches[0]) { e.preventDefault(); add(matches[0]) } }} />
      {matches.length > 0 && (
        <ul className="bg-white border border-line rounded-xl divide-y divide-divider" aria-label="Matching people">
          {matches.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => add(p)} className="w-full min-h-[44px] px-3 text-left text-[15px] hover:bg-ground">
                {p.name} <span className="text-muted text-sm">· {p.familyName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {search.trim() && matches.length === 0 && <p className="text-xs text-muted">No one matches. Add people under People first.</p>}
    </div>
  )
}
