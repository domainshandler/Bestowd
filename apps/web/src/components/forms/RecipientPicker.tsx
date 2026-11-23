import { useId, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFamily, createPerson, listFamilies, listPeople } from '@bestowd/api-client'
import type { FamilyListItem, FamilyType, PersonListItem } from '@bestowd/types'
import { Button, FormError, Icon, Select, TextInput } from '../ui.tsx'
import { FAMILY_TYPE_LABEL } from '../../lib/format.ts'

export const MAX_MATCHES = 8

/** A person or a whole family. */
export interface Recipient { kind: 'person' | 'family'; id: string }

const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
const wordStarts = (text: string, q: string) => fold(text).split(/[\s'-]+/).some((w) => w.startsWith(q))

export interface Match extends Recipient { name: string; detail: string }

/**
 * People and families with a word starting with the search (ignoring case and accents), not already
 * chosen. Names that start with it come first.
 */
export function findRecipients(people: PersonListItem[], families: FamilyListItem[], search: string, exclude: Recipient[], include: 'people' | 'both'): Match[] {
  const q = fold(search.trim())
  if (!q) return []
  const taken = (kind: Recipient['kind'], id: string) => exclude.some((e) => e.kind === kind && e.id === id)
  const rank = (name: string) => Number(!fold(name).startsWith(q))
  const ps: Match[] = people
    .filter((p) => !taken('person', p.id) && (wordStarts(p.name, q) || wordStarts(p.familyName, q)))
    .map((p) => ({ kind: 'person', id: p.id, name: p.name, detail: p.familyName }))
  const fs: Match[] = include === 'both'
    ? families.filter((f) => !taken('family', f.id) && wordStarts(f.name, q)).map((f) => ({ kind: 'family', id: f.id, name: f.name, detail: 'Whole family' }))
    : []
  return [...ps, ...fs].sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name)).slice(0, MAX_MATCHES)
}

const NEW_FAMILY = '__new__'

/**
 * Choose people (and, with include="both", whole families) by typing: matches narrow as you type, chosen
 * ones show as removable chips, and "+ Add" creates someone who isn't in Bestowd yet.
 * With single, choosing replaces the current choice.
 */
export default function RecipientPicker({ groupId, label, value, onChange, include = 'people', single = false, placeholder, required }: {
  groupId: string; label: string; value: Recipient[]; onChange: (v: Recipient[]) => void
  include?: 'people' | 'both'; single?: boolean; placeholder?: string; required?: boolean
}) {
  const id = useId()
  const qc = useQueryClient()
  const people = useQuery({ queryKey: ['people', groupId], queryFn: () => listPeople(groupId) })
  const families = useQuery({ queryKey: ['families', groupId, 'ACTIVE'], queryFn: () => listFamilies(groupId) })
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)

  const nameOf = (r: Recipient) => r.kind === 'person'
    ? people.data?.find((p) => p.id === r.id)?.name
    : families.data?.find((f) => f.id === r.id)?.name
  const chosen = value.map((r) => ({ ...r, name: nameOf(r) })).filter((r): r is Recipient & { name: string } => Boolean(r.name))
  const matches = findRecipients(people.data ?? [], families.data ?? [], search, value, include)
  const choose = (r: Recipient) => { onChange(single ? [r] : [...value, r]); setSearch(''); setAdding(false) }
  const showInput = !single || chosen.length === 0

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      {chosen.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={`${label}: chosen`}>
          {chosen.map((r) => (
            <li key={`${r.kind}:${r.id}`} className="min-h-[36px] pl-3 pr-1 rounded-full border bg-brand-light border-brand text-brand text-sm font-semibold flex items-center gap-1">
              {r.name}{r.kind === 'family' && <span className="font-normal"> · family</span>}
              <button type="button" aria-label={`Remove ${r.name}`} onClick={() => onChange(value.filter((v) => !(v.kind === r.kind && v.id === r.id)))}
                className="w-8 h-8 rounded-full hover:bg-white flex items-center justify-center">
                <Icon name="close" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {showInput && (
        <TextInput id={id} type="search" autoComplete="off" required={required && chosen.length === 0}
          placeholder={placeholder ?? (include === 'both' ? 'Search people or families' : 'Search people')} value={search}
          onChange={(e) => { setSearch(e.target.value); setAdding(false) }}
          onKeyDown={(e) => { if (e.key === 'Enter' && matches[0]) { e.preventDefault(); choose(matches[0]) } }} />
      )}
      {showInput && search.trim() && !adding && (
        <ul className="bg-white border border-line rounded-xl divide-y divide-divider" aria-label="Matches">
          {matches.map((m) => (
            <li key={`${m.kind}:${m.id}`}>
              <button type="button" onClick={() => choose(m)} className="w-full min-h-[44px] px-3 text-left text-[15px] hover:bg-ground">
                {m.name} <span className="text-muted text-sm">· {m.detail}</span>
              </button>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => setAdding(true)} className="w-full min-h-[44px] px-3 text-left text-[15px] text-brand font-semibold hover:bg-ground flex items-center gap-2">
              <Icon name="plus" size={16} /> Add “{search.trim()}”
            </button>
          </li>
        </ul>
      )}
      {adding && (
        <QuickAdd groupId={groupId} name={search.trim()} families={families.data ?? []} allowFamily={include === 'both'}
          onCancel={() => setAdding(false)}
          onAdded={async (r) => { await qc.invalidateQueries({ queryKey: ['people', groupId] }); await qc.invalidateQueries({ queryKey: ['families', groupId] }); choose(r) }} />
      )}
    </div>
  )
}

/** Someone new: a person in an existing or new family, or (when allowed) a whole new family. */
function QuickAdd({ groupId, name, families, allowFamily, onAdded, onCancel }: {
  groupId: string; name: string; families: FamilyListItem[]; allowFamily: boolean
  onAdded: (r: Recipient) => void; onCancel: () => void
}) {
  const [kind, setKind] = useState<'person' | 'family'>('person')
  const [personName, setPersonName] = useState(name)
  const household = families.find((f) => f.isOwnHousehold)
  const [familyId, setFamilyId] = useState(NEW_FAMILY)
  const [familyName, setFamilyName] = useState(kind === 'family' ? name : '')
  const [type, setType] = useState<FamilyType>('FAMILY')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  async function save() {
    setBusy(true); setError(null)
    try {
      if (kind === 'family') {
        const f = await createFamily(groupId, { name: personName.trim(), type })
        onAdded({ kind: 'family', id: f.id })
        return
      }
      const fid = familyId === NEW_FAMILY
        ? (await createFamily(groupId, { name: familyName.trim() || `${personName.trim()}'s family`, type })).id
        : familyId
      const p = await createPerson(fid, { name: personName.trim() })
      onAdded({ kind: 'person', id: p.id })
    } catch (e) { setError(e) } finally { setBusy(false) }
  }

  return (
    <div className="bg-ground border border-line rounded-xl p-3 flex flex-col gap-3" role="group" aria-label="Add someone new">
      {allowFamily && (
        <div className="flex gap-2">
          {(['person', 'family'] as const).map((k) => (
            <Button key={k} type="button" variant={kind === k ? 'primary' : 'secondary'} onClick={() => setKind(k)}>{k === 'person' ? 'A person' : 'A whole family'}</Button>
          ))}
        </div>
      )}
      <TextInput aria-label={kind === 'person' ? 'Name' : 'Family name'} value={personName} onChange={(e) => setPersonName(e.target.value)} maxLength={100} />
      {kind === 'person' && (
        <Select aria-label="In family" value={familyId} onChange={(e) => setFamilyId(e.target.value)}>
          <option value={NEW_FAMILY}>In a new family…</option>
          {household && <option value={household.id}>{household.name} (your household)</option>}
          {families.filter((f) => !f.isOwnHousehold).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </Select>
      )}
      {kind === 'person' && familyId === NEW_FAMILY && (
        <TextInput aria-label="New family name" placeholder={`${personName.trim() || 'Their'}'s family`} value={familyName} onChange={(e) => setFamilyName(e.target.value)} maxLength={100} />
      )}
      {(kind === 'family' || familyId === NEW_FAMILY) && (
        <Select aria-label="Family type" value={type} onChange={(e) => setType(e.target.value as FamilyType)}>
          {Object.entries(FAMILY_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
      )}
      <FormError error={error} />
      <div className="flex gap-2">
        <Button type="button" disabled={busy || !personName.trim()} onClick={() => void save()}>{busy ? 'Adding…' : 'Add'}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
      <p className="text-xs text-muted">You can add their birthday and details later under People.</p>
    </div>
  )
}
