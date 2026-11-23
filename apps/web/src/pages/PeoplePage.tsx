import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listFamilies, listPeople } from '@bestowd/api-client'
import { useGroup } from '../groups/GroupContext.tsx'
import FamilyForm from '../components/forms/FamilyForm.tsx'
import { Avatar, Badge, EmptyState, Icon, LoadError, Loading, Segmented } from '../components/ui.tsx'
import { FAMILY_TYPE_LABEL, birthdayLabel, formatDate } from '../lib/format.ts'

type View = 'families' | 'everyone'

export default function PeoplePage() {
  const { groupId } = useGroup()
  const [view, setView] = useState<View>('families')
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const families = useQuery({ queryKey: ['families', groupId], queryFn: () => listFamilies(groupId!), enabled: Boolean(groupId) })
  const people = useQuery({ queryKey: ['people', groupId], queryFn: () => listPeople(groupId!), enabled: Boolean(groupId) })

  const q = search.trim().toLowerCase()
  const matchingFamilies = useMemo(() => {
    const list = families.data ?? []
    if (!q) return list
    const familiesWithMatchingPeople = new Set((people.data ?? []).filter((p) => p.name.toLowerCase().includes(q)).map((p) => p.familyId))
    return list.filter((f) => f.name.toLowerCase().includes(q) || familiesWithMatchingPeople.has(f.id))
  }, [families.data, people.data, q])
  const matchingPeople = (people.data ?? []).filter((p) => !q || p.name.toLowerCase().includes(q) || p.familyName.toLowerCase().includes(q))
  const peopleByFamily = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const p of people.data ?? []) map.set(p.familyId, [...(map.get(p.familyId) ?? []), p.name])
    return map
  }, [people.data])

  const current = view === 'families' ? families : people

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">People</h1>
        <button
          type="button"
          onClick={() => setAdding(true)}
          disabled={!groupId}
          className="h-11 px-4 rounded-full bg-brand text-white text-sm font-semibold flex items-center gap-2 shadow-[0_6px_16px_rgba(15,110,104,0.3)]"
        >
          <Icon name="plus" size={18} /> Add family
        </button>
      </div>

      <label className="flex items-center gap-2.5 h-[46px] px-3.5 bg-white border border-line rounded-[14px] text-muted">
        <Icon name="search" size={18} />
        <span className="sr-only">Search people</span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search people or families"
          className="flex-1 border-none outline-none bg-transparent text-[15px] text-ink"
        />
      </label>

      <Segmented
        label="View"
        value={view}
        onChange={setView}
        options={[
          { value: 'families', label: 'Families' },
          { value: 'everyone', label: 'Everyone' },
        ]}
      />

      {(current.isLoading || !groupId) && <Loading />}
      {current.isError && <LoadError what="people" />}

      {view === 'families' && families.data && (
        <ul className="flex flex-col gap-2.5">
          {matchingFamilies.length === 0 && (
            <li>
              <EmptyState>{q ? 'No matches.' : 'Add the families you give gifts to, starting with friends and relatives.'}</EmptyState>
            </li>
          )}
          {matchingFamilies.map((f) => {
            const names = peopleByFamily.get(f.id) ?? []
            return (
              <li key={f.id}>
                <Link
                  to={`/families/${f.id}`}
                  className="bg-white border border-line rounded-2xl p-4 flex flex-col gap-3 hover:border-brand/40"
                >
                  <div className="flex justify-between items-center gap-3">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-base font-semibold flex items-center gap-2">
                        {f.name}
                        {f.onBestowd && <Badge tone="brand">On Bestowd</Badge>}
                        {f.status === 'PAUSED' && <Badge>Paused</Badge>}
                      </span>
                      <span className="text-[13px] text-muted">
                        {f.isOwnHousehold ? 'Your household' : FAMILY_TYPE_LABEL[f.type]} · {f.memberCount}{' '}
                        {f.memberCount === 1 ? 'person' : 'people'}
                      </span>
                    </div>
                    {names.length > 0 && (
                      <div className="flex">
                        {names.slice(0, 2).map((n, i) => (
                          <span key={n + i} className={i > 0 ? '-ml-2' : ''}>
                            <Avatar name={n} index={i} size={32} />
                          </span>
                        ))}
                        {names.length > 2 && (
                          <span
                            className="-ml-2 w-8 h-8 rounded-full bg-chip text-chip-ink text-xs font-semibold flex items-center justify-center border-2 border-white"
                            aria-hidden="true"
                          >
                            +{names.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {f.nextOccasion && (
                    <div className="flex items-center gap-2 text-[13px] text-chip-ink bg-ground rounded-[10px] px-2.5 py-2">
                      <span className="w-2 h-2 rounded-full bg-amber" aria-hidden="true" />
                      Next: {f.nextOccasion.name} · {formatDate(f.nextOccasion.nextOccurrence)}
                    </div>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {view === 'everyone' && people.data && (
        <ul className="bg-white border border-line rounded-2xl divide-y divide-divider">
          {matchingPeople.length === 0 && (
            <li className="p-4 text-sm text-muted">{q ? 'No matches.' : 'No people yet. Add a family, then its people.'}</li>
          )}
          {matchingPeople.map((p, i) => (
            <li key={p.id}>
              <Link to={`/people/${p.id}`} className="flex items-center gap-3 px-3.5 py-3 hover:bg-ground">
                <Avatar name={p.name} index={i} photoUrl={p.photoUrl} />
                <span className="flex-1 flex flex-col min-w-0">
                  <span className="text-[15px] font-semibold truncate">{p.name}</span>
                  <span className="text-[13px] text-muted truncate">
                    {[p.familyName, p.age !== null ? `${p.age}` : null, birthdayLabel(p.birthMonth, p.birthDay)]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <Icon name="chevron" size={18} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {adding && groupId && <FamilyForm open onClose={() => setAdding(false)} groupId={groupId} />}
    </div>
  )
}
