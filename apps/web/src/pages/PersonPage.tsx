import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { deletePerson, getGroup, getPerson, listGifts, listIdeas, listOccasions, updatePerson } from '@bestowd/api-client'
import type { Gift, GiftDirection } from '@bestowd/types'
import GiftForm from '../components/forms/GiftForm.tsx'
import OccasionForm from '../components/forms/OccasionForm.tsx'
import PersonForm from '../components/forms/PersonForm.tsx'
import { useSave } from '../components/forms/useSave.ts'
import GiftRow from '../components/GiftRow.tsx'
import OccasionRow from '../components/OccasionRow.tsx'
import { NotesCard } from '../components/PersonNotes.tsx'
import { Avatar, Badge, Button, Card, EmptyState, Icon, LoadError, Loading, SectionHeader, Segmented } from '../components/ui.tsx'
import { birthdayLabel, formatMoney } from '../lib/format.ts'

function byYear(gifts: Gift[]): [number, Gift[]][] {
  const map = new Map<number, Gift[]>()
  for (const g of gifts) {
    const y = new Date(g.date).getUTCFullYear()
    map.set(y, [...(map.get(y) ?? []), g])
  }
  return [...map.entries()].sort((a, b) => b[0] - a[0])
}

export default function PersonPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const person = useQuery({ queryKey: ['person', id], queryFn: () => getPerson(id) })
  const groupId = person.data?.groupId
  const enabled = Boolean(groupId)
  const group = useQuery({ queryKey: ['group', groupId], queryFn: () => getGroup(groupId!), enabled })
  const gifts = useQuery({ queryKey: ['gifts', groupId, { personId: id }], queryFn: () => listGifts(groupId!, { personId: id }), enabled })
  const ideas = useQuery({ queryKey: ['ideas', groupId, { personId: id }], queryFn: () => listIdeas(groupId!, { personId: id }), enabled })
  const yearAhead = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10)
  const occasions = useQuery({
    queryKey: ['occasions', groupId, { personId: id }],
    queryFn: () => listOccasions(groupId!, { personId: id, to: yearAhead }),
    enabled,
  })

  const [direction, setDirection] = useState<GiftDirection>('GIVEN')
  const [modal, setModal] = useState<null | 'edit' | 'gift' | 'occasion'>(null)
  const close = () => setModal(null)
  const archive = useSave((archived: boolean) => updatePerson(id, { archived }))
  const remove = useSave(
    () => deletePerson(id),
    () => navigate(person.data ? `/families/${person.data.familyId}` : '/people'),
  )

  const history = useMemo(() => byYear((gifts.data?.gifts ?? []).filter((g) => g.direction === direction)), [gifts.data, direction])

  if (person.isLoading) return <Loading />
  if (person.isError || !person.data) return <LoadError what="this person" />
  const p = person.data
  const currency = group.data?.currency ?? 'CAD'
  const repeats = (ideas.data?.ideas ?? []).filter((i) => i.repeat)
  const bday = birthdayLabel(p.birthMonth, p.birthDay)

  return (
    <div className="flex flex-col gap-6">
      <Link to={`/families/${p.familyId}`} className="h-11 flex items-center gap-1 text-[15px] font-medium text-brand self-start">
        <Icon name="back" /> {p.familyName}
      </Link>

      <div className="flex items-center gap-4">
        <Avatar name={p.name} photoUrl={p.photoUrl} size={64} />
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">{p.name}</h1>
          <p className="text-sm text-muted">
            {[p.age !== null ? `${p.age} years old` : null, bday ? `Birthday ${bday}` : null, p.relationship].filter(Boolean).join(' · ')}
          </p>
          {p.archivedAt && <Badge className="self-start">Archived</Badge>}
        </div>
        <button
          type="button"
          aria-label={`Edit ${p.name}`}
          onClick={() => setModal('edit')}
          className="w-11 h-11 rounded-full border border-line bg-white flex items-center justify-center"
        >
          <Icon name="edit" size={18} />
        </button>
      </div>

      <NotesCard person={p} />

      <section className="flex flex-col gap-2.5">
        <SectionHeader
          title="Occasions"
          action={
            <Button variant="ghost" className="min-h-0 h-9 px-2" onClick={() => setModal('occasion')}>
              + Add
            </Button>
          }
        />
        {occasions.data?.occasions.map((o) => (
          <OccasionRow key={o.id} occasion={o} />
        ))}
        {occasions.data && occasions.data.occasions.length === 0 && (
          <EmptyState>No occasions yet.{!bday && ' Add a birthday to get reminders.'}</EmptyState>
        )}
      </section>

      <section className="flex flex-col gap-2.5">
        <SectionHeader title="Gift history" />
        <Segmented
          label="Direction"
          value={direction}
          onChange={setDirection}
          options={[
            { value: 'GIVEN', label: 'Given' },
            { value: 'RECEIVED', label: 'Received' },
          ]}
        />
        {gifts.isLoading && <Loading />}
        {history.length === 0 && gifts.data && (
          <EmptyState>{direction === 'GIVEN' ? `Nothing given to ${p.name} yet.` : `Nothing received from ${p.name} yet.`}</EmptyState>
        )}
        {history.map(([year, list]) => (
          <div key={year} className="flex flex-col gap-2">
            <h3 className="text-[13px] font-semibold text-muted tracking-wide uppercase mt-1">{year}</h3>
            <Card className="divide-y divide-divider">
              {list.map((g) => (
                <GiftRow key={g.id} gift={g} currency={currency} showYear={false} />
              ))}
            </Card>
          </div>
        ))}
        <Button variant="dashed" onClick={() => setModal('gift')}>
          <Icon name="plus" size={18} /> Log a gift
        </Button>
      </section>

      <section className="flex flex-col gap-2.5">
        <SectionHeader
          title="Ideas"
          action={
            <Link to={`/ideas?personId=${p.id}`} className="text-sm font-medium">
              See all
            </Link>
          }
        />
        {repeats.length > 0 && (
          <p className="flex items-center gap-2 text-[13px] text-chip-ink bg-amber-soft rounded-xl px-3 py-2.5">
            <Icon name="info" size={16} />
            {repeats.length === 1 ? `"${repeats[0].title}" repeats` : `${repeats.length} ideas repeat`} something you've given before.
          </p>
        )}
        {ideas.data?.ideas.slice(0, 3).map((i) => (
          <Card key={i.id} className="p-4 flex justify-between items-baseline gap-3">
            <span className="text-[15px] font-semibold">{i.title}</span>
            {i.price !== null && <span className="text-sm font-semibold">{formatMoney(i.price, currency)}</span>}
          </Card>
        ))}
        {ideas.data && ideas.data.ideas.length === 0 && <EmptyState>No saved ideas for {p.name}.</EmptyState>}
      </section>

      <div className="flex gap-2 flex-wrap">
        <Button variant="secondary" onClick={() => archive.mutate(!p.archivedAt)}>
          {p.archivedAt ? 'Restore' : 'Archive'} {p.name}
        </Button>
        {!p.isAccountHolder && (
          <Button
            variant="danger"
            onClick={() => {
              if (window.confirm(`Delete ${p.name} and their gift history?`)) remove.mutate(undefined)
            }}
          >
            Delete
          </Button>
        )}
      </div>

      {modal === 'edit' && <PersonForm open onClose={close} familyId={p.familyId} person={p} />}
      {modal === 'gift' && <GiftForm open onClose={close} groupId={p.groupId} defaults={{ personId: p.id }} />}
      {modal === 'occasion' && (
        <OccasionForm open onClose={close} groupId={p.groupId} subject={{ personId: p.id, familyId: null }} subjectName={p.name} />
      )}
    </div>
  )
}
