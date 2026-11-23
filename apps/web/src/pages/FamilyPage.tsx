import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { deleteFamily, getFamily, getGroup, listGifts, revokeConnection, updateFamily } from '@bestowd/api-client'
import type { FamilyProfile, Occasion } from '@bestowd/types'
import FamilyForm from '../components/forms/FamilyForm.tsx'
import PersonForm from '../components/forms/PersonForm.tsx'
import OccasionForm from '../components/forms/OccasionForm.tsx'
import InviteLinkModal from '../components/forms/InviteLinkModal.tsx'
import GiftForm from '../components/forms/GiftForm.tsx'
import { useSave } from '../components/forms/useSave.ts'
import GiftRow from '../components/GiftRow.tsx'
import OccasionRow from '../components/OccasionRow.tsx'
import PersonNotes from '../components/PersonNotes.tsx'
import { Avatar, Badge, Button, Card, EmptyState, Icon, LoadError, Loading, SectionHeader, Stat } from '../components/ui.tsx'
import { FAMILY_TYPE_LABEL, birthdayLabel, daysUntil, formatDate, formatMoney, inDaysLabel } from '../lib/format.ts'

type Person = FamilyProfile['people'][number]

/** "Turns 5 · Nov 22", or the relationship and birthday when the age isn't known. */
function personLine(p: Person): string {
  const bday = birthdayLabel(p.birthMonth, p.birthDay)
  if (p.nextBirthday && p.birthYear) return `Turns ${new Date(p.nextBirthday).getUTCFullYear() - p.birthYear} · ${bday}`
  return [p.relationship, bday].filter(Boolean).join(' · ') || 'No birthday yet'
}

export default function FamilyPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const family = useQuery({ queryKey: ['family', id], queryFn: () => getFamily(id) })
  const groupId = family.data?.groupId
  const group = useQuery({ queryKey: ['group', groupId], queryFn: () => getGroup(groupId!), enabled: Boolean(groupId) })
  const history = useQuery({
    queryKey: ['gifts', groupId, { familyId: id }],
    queryFn: () => listGifts(groupId!, { familyId: id }),
    enabled: Boolean(groupId),
  })

  const [modal, setModal] = useState<null | 'edit' | 'person' | 'occasion' | 'invite' | 'gift'>(null)
  const close = () => setModal(null)

  const setStatus = useSave((status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED') => updateFamily(id, { status }))
  const remove = useSave(
    () => deleteFamily(id),
    () => navigate('/people'),
  )
  const disconnect = useSave((connectionId: string) => revokeConnection(connectionId))

  if (family.isLoading) return <Loading />
  if (family.isError || !family.data) return <LoadError what="this family" />
  const f = family.data
  const currency = group.data?.currency ?? 'CAD'
  const coGivers = group.data?.members.map((m) => m.name.split(' ')[0]).join(' & ')
  const featured: Occasion | undefined = f.occasions.find((o) => o.needsGift && o.personId && daysUntil(o.nextOccurrence!) <= 30)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <Link to="/people" className="h-11 flex items-center gap-1 text-[15px] font-medium no-underline text-brand">
          <Icon name="back" /> People
        </Link>
        <button
          type="button"
          aria-label="Edit family"
          onClick={() => setModal('edit')}
          className="w-11 h-11 rounded-full border border-line bg-white flex items-center justify-center"
        >
          <Icon name="edit" size={18} />
        </button>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge tone={f.status === 'ACTIVE' ? 'brand' : 'neutral'}>
            {f.status === 'ACTIVE' ? 'Active' : f.status === 'PAUSED' ? 'Paused' : 'Archived'}
          </Badge>
          <Badge>{f.isOwnHousehold ? 'Your household' : FAMILY_TYPE_LABEL[f.type]}</Badge>
          {f.connection && <Badge tone="brand">On Bestowd</Badge>}
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{f.name}</h1>
        {coGivers && (
          <p className="flex items-center gap-2 text-[13px] text-muted">
            <Icon name="people" size={16} /> Co-givers: {coGivers}
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat value={f.totals.givenCount} label="Gifts given" />
        <Stat value={f.totals.receivedCount} label="Received" />
        <Stat value={formatMoney(f.totals.spent, currency) || '0'} label="Spent" />
      </div>

      <section className="flex flex-col gap-2.5">
        <SectionHeader
          title="Members"
          action={
            <Button variant="ghost" className="min-h-0 h-9 px-2" onClick={() => setModal('person')}>
              + Add person
            </Button>
          }
        />
        {f.people.length === 0 ? (
          <EmptyState>No one here yet. Add the people in this family.</EmptyState>
        ) : (
          <Card as="section" className="divide-y divide-divider">
            {f.people.map((p, i) => (
              <Link
                key={p.id}
                to={`/people/${p.id}`}
                className="flex items-center gap-3 px-3.5 py-3 hover:bg-ground first:rounded-t-2xl last:rounded-b-2xl"
              >
                <Avatar name={p.name} index={i} photoUrl={p.photoUrl} />
                <span className="flex-1 flex flex-col min-w-0">
                  <span className="text-[15px] font-semibold">{p.name}</span>
                  <span className="text-[13px] text-muted">{personLine(p)}</span>
                </span>
                {p.nextBirthday && daysUntil(p.nextBirthday) <= 30 && <Badge tone="amber">{inDaysLabel(p.nextBirthday)}</Badge>}
              </Link>
            ))}
          </Card>
        )}
      </section>

      <section className="flex flex-col gap-2.5">
        <SectionHeader
          title="Upcoming"
          action={
            <Button variant="ghost" className="min-h-0 h-9 px-2" onClick={() => setModal('occasion')}>
              + Add occasion
            </Button>
          }
        />
        {featured && (
          <div className="bg-brand text-white rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex justify-between items-center gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-base font-semibold">{featured.name}</span>
                <span className="text-[13px] text-brand-faint">
                  {formatDate(featured.nextOccurrence, { weekday: 'short', month: 'short', day: 'numeric' })}
                  {featured.location ? ` · ${featured.location}` : ''}
                </span>
              </div>
              <span className="bg-amber text-ink text-xs font-semibold px-2.5 py-1 rounded-full">Needs gift</span>
            </div>
            <Link
              to={`/ideas?personId=${featured.personId}&occasionId=${featured.id}`}
              className="h-11 rounded-xl bg-white text-brand text-sm font-semibold flex items-center justify-center gap-1.5"
            >
              <Icon name="sparkle" size={16} /> See gift ideas for {featured.subjectName}
            </Link>
          </div>
        )}
        {f.occasions
          .filter((o) => o !== featured)
          .map((o) => (
            <OccasionRow key={o.id} occasion={o} />
          ))}
        {f.occasions.length === 0 && <EmptyState>No occasions in the next year.</EmptyState>}
      </section>

      {f.people.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold">Gifting notes</h2>
            <span className="flex items-center gap-1 text-xs text-muted">
              <Icon name="lock" size={14} /> Only your group
            </span>
          </div>
          <PersonNotes people={f.people} />
        </section>
      )}

      {f.connection ? (
        <section className="flex flex-col gap-2.5">
          <SectionHeader title={`Shared by ${f.connection.sourceFamilyName}`} />
          <Card className="divide-y divide-divider">
            {f.connection.people.map((p) => (
              <div key={p.id} className="px-3.5 py-3 flex flex-col gap-1">
                <span className="text-[15px] font-semibold">{p.name}</span>
                <span className="text-[13px] text-muted">
                  {[
                    p.birthMonth
                      ? `Birthday ${birthdayLabel(p.birthMonth, p.birthDay ?? null)}${p.birthYear ? ` ${p.birthYear}` : ''}`
                      : null,
                    p.likes?.length ? `Loves ${p.likes.join(', ')}` : null,
                    p.avoid?.length ? `Avoid ${p.avoid.join(', ')}` : null,
                    p.foodNotes ? `Food: ${p.foodNotes}` : null,
                    p.sizes && Object.keys(p.sizes).length
                      ? Object.entries(p.sizes)
                          .map(([k, v]) => `${k} ${v}`)
                          .join(', ')
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Nothing shared yet'}
                </span>
              </div>
            ))}
            {f.connection.people.length === 0 && <p className="px-3.5 py-3 text-sm text-muted">They haven't added anyone yet.</p>}
          </Card>
          <p className="text-xs text-muted">Read-only. This updates when they change their profile.</p>
        </section>
      ) : (
        !f.isOwnHousehold && (
          <Card className="p-4 flex items-center gap-3">
            <span className="flex-1 text-sm text-chip-ink">
              Is {f.name} on Bestowd? Connect to see the birthdays and likes they choose to share.
            </span>
            <Button variant="secondary" onClick={() => setModal('invite')}>
              <Icon name="link" size={16} /> Invite
            </Button>
          </Card>
        )
      )}

      <section className="flex flex-col gap-2.5">
        <SectionHeader
          title="Gift history"
          action={
            <Link to={`/gifts?familyId=${f.id}`} className="text-sm font-medium">
              See all {history.data ? history.data.gifts.length : ''}
            </Link>
          }
        />
        {history.data && history.data.gifts.length === 0 && <EmptyState>No gifts logged with {f.name} yet.</EmptyState>}
        {history.data && history.data.gifts.length > 0 && (
          <Card className="divide-y divide-divider">
            {history.data.gifts.slice(0, 5).map((g) => (
              <GiftRow key={g.id} gift={g} currency={currency} />
            ))}
          </Card>
        )}
        <Button variant="dashed" onClick={() => setModal('gift')}>
          <Icon name="plus" size={18} /> Log a gift
        </Button>
      </section>

      <section className="flex flex-col gap-2.5">
        <h2 className="text-lg font-bold">Family settings</h2>
        <Card className="divide-y divide-divider">
          {f.status !== 'ARCHIVED' && (
            <button
              type="button"
              className="w-full flex flex-col items-start gap-0.5 p-3.5 text-left"
              onClick={() => setStatus.mutate(f.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED')}
            >
              <span className="text-[15px] font-semibold">{f.status === 'PAUSED' ? 'Resume this family' : 'Pause this family'}</span>
              <span className="text-[13px] text-muted">
                {f.status === 'PAUSED' ? 'Turns reminders back on.' : 'Stops reminders. History is kept.'}
              </span>
            </button>
          )}
          {!f.isOwnHousehold && (
            <button
              type="button"
              className="w-full flex flex-col items-start gap-0.5 p-3.5 text-left"
              onClick={() => setStatus.mutate(f.status === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED')}
            >
              <span className="text-[15px] font-semibold text-danger">{f.status === 'ARCHIVED' ? 'Restore family' : 'Archive family'}</span>
              <span className="text-[13px] text-muted">
                {f.status === 'ARCHIVED' ? 'Brings it back to your People list.' : 'Hides it from People. Nobody is notified.'}
              </span>
            </button>
          )}
          {f.connection && (
            <button
              type="button"
              className="w-full flex flex-col items-start gap-0.5 p-3.5 text-left"
              onClick={() => disconnect.mutate(f.connection!.id)}
            >
              <span className="text-[15px] font-semibold">Disconnect {f.connection.sourceFamilyName}</span>
              <span className="text-[13px] text-muted">You stop seeing what they share.</span>
            </button>
          )}
          {!f.isOwnHousehold && (
            <button
              type="button"
              className="w-full flex flex-col items-start gap-0.5 p-3.5 text-left"
              onClick={() => {
                if (window.confirm(`Delete ${f.name} and all its people, occasions and gifts?`)) remove.mutate(undefined)
              }}
            >
              <span className="text-[15px] font-semibold text-danger">Delete family</span>
              <span className="text-[13px] text-muted">Removes its people, occasions and gift history. Can't be undone.</span>
            </button>
          )}
        </Card>
      </section>

      {modal === 'edit' && <FamilyForm open onClose={close} groupId={f.groupId} family={f} />}
      {modal === 'person' && <PersonForm open onClose={close} familyId={f.id} />}
      {modal === 'occasion' && <OccasionForm open onClose={close} groupId={f.groupId} />}
      {modal === 'invite' && <InviteLinkModal open onClose={close} groupId={f.groupId} kind="FAMILY" familyId={f.id} familyName={f.name} />}
      {modal === 'gift' && <GiftForm open onClose={close} groupId={f.groupId} defaults={{ familyId: f.id }} />}
    </div>
  )
}
