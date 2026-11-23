import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { buyIdea, listIdeas, listOccasions, listPeople, updateIdea, photoSrc } from '@bestowd/api-client'
import type { Idea } from '@bestowd/types'
import { useGroup } from '../groups/GroupContext.tsx'
import IdeaForm from '../components/forms/IdeaForm.tsx'
import GiftForm from '../components/forms/GiftForm.tsx'
import { useSave } from '../components/forms/useSave.ts'
import { Avatar, Badge, Button, Card, EmptyState, FormError, Icon, LoadError, Loading } from '../components/ui.tsx'
import RecipientPicker, { type Recipient } from '../components/forms/RecipientPicker.tsx'
import { formatDate, formatMoney } from '../lib/format.ts'

function IdeaCard({ idea, featured, currency, onBuy, onEdit, onDismiss, busy }: {
  idea: Idea; featured: boolean; currency: string; onBuy: () => void; onEdit: () => void; onDismiss: () => void; busy: boolean
}) {
  return (
    <Card className={`p-4 flex flex-col ${featured ? 'gap-2.5 rounded-[18px]' : 'gap-2'}`}>
      <div className="flex justify-between items-center gap-2">
        {featured
          ? <span className="flex items-center gap-1.5 text-xs font-semibold text-brand"><Icon name="sparkle" size={14} /> Top pick</span>
          : <span className="text-base font-semibold">{idea.title}</span>}
        <span className="flex items-center gap-2">
          {idea.repeat && <Badge tone="amber">Repeat</Badge>}
          {idea.price !== null && <span className="text-sm font-semibold">{formatMoney(idea.price, currency)}</span>}
        </span>
      </div>
      {featured && <p className="font-display text-lg font-bold">{idea.title}</p>}
      {idea.imageUrl && <img src={photoSrc(idea.imageUrl)} alt="" loading="lazy" className="w-full max-h-48 object-cover rounded-xl border border-line" />}
      {idea.brand && <p className="text-[13px] font-medium text-chip-ink">{idea.brand}</p>}
      {idea.notes && <p className="text-sm leading-snug text-muted">{idea.notes}</p>}
      {idea.repeat && (
        <p className="text-[13px] text-amber-ink">You gave “{idea.repeat.title}” in {formatDate(idea.repeat.date, { month: 'short', year: 'numeric' })}.</p>
      )}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
        {idea.people.length > 0 && <span>For {idea.people.map((p) => p.name).join(', ')}</span>}
        {(idea.ageMin !== null || idea.ageMax !== null) && <span>Ages {idea.ageMin ?? 0}–{idea.ageMax ?? '∞'}</span>}
        {idea.url && <a href={idea.url} target="_blank" rel="noreferrer noopener">View product</a>}
      </div>
      <div className="flex gap-2">
        <Button className="flex-1" onClick={onBuy} disabled={busy}>Mark as bought</Button>
        <Button variant="secondary" onClick={onEdit} disabled={busy} aria-label={`Edit ${idea.title}`}>Edit</Button>
        <Button variant="secondary" onClick={onDismiss} disabled={busy} aria-label={`Dismiss ${idea.title}`}>Dismiss</Button>
      </div>
    </Card>
  )
}

export default function IdeasPage() {
  const { groupId } = useGroup()
  const [params, setParams] = useSearchParams()
  const personId = params.get('personId') ?? ''
  const familyId = params.get('familyId') ?? ''
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Idea | null>(null)
  // Bought, but we don't know who for: log it as a gift, starting from the idea.
  const [logging, setLogging] = useState<Idea | null>(null)
  const enabled = Boolean(groupId)

  const people = useQuery({ queryKey: ['people', groupId], queryFn: () => listPeople(groupId!), enabled })
  const yearAhead = new Date(Date.now() + 366 * 86_400_000).toISOString().slice(0, 10)
  const occasions = useQuery({
    queryKey: ['occasions', groupId, { personId, to: 'year' }],
    queryFn: () => listOccasions(groupId!, { personId, to: yearAhead }),
    enabled: enabled && Boolean(personId),
  })
  // Age and budget are taken on the chosen occasion, else the person's next one.
  const occasion = occasions.data?.occasions.find((o) => o.id === params.get('occasionId')) ?? occasions.data?.occasions[0]
  const ideas = useQuery({
    queryKey: ['ideas', groupId, { personId, familyId, occasionId: occasion?.id }],
    queryFn: () => listIdeas(groupId!, personId ? { personId, ...(occasion ? { occasionId: occasion.id } : {}) } : familyId ? { familyId } : {}),
    enabled: enabled && (!personId || !occasions.isLoading),
  })

  // The recipient is the chosen person, else the idea's only tagged person, else its occasion's subject (server default).
  const buy = useSave((idea: Idea) => {
    const recipient = personId || (idea.people.length === 1 ? idea.people[0]!.id : '')
    return buyIdea(idea.id, {
      ...(personId && occasion ? { occasionId: occasion.id } : {}),
      ...(recipient ? { personId: recipient } : {}),
    })
  })
  const dismiss = useSave((idea: Idea) => updateIdea(idea.id, { status: 'DISMISSED' }))

  const pick = (r: Recipient[]) => setParams(r[0] ? { [r[0].kind === 'person' ? 'personId' : 'familyId']: r[0].id } : {})
  const person = people.data?.find((p) => p.id === personId)
  const list = ideas.data?.ideas ?? []
  const featuredId = list.find((i) => !i.repeat)?.id
  const repeats = list.filter((i) => i.repeat)
  const currency = occasions.data?.currency ?? 'CAD'
  const age = ideas.data?.person?.age

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Ideas</h1>
        <Button variant="secondary" onClick={() => setAdding(true)} disabled={!groupId}><Icon name="plus" size={18} /> Add idea</Button>
      </div>

      <div className="flex items-start gap-3 px-3.5 py-3 bg-white border border-line rounded-2xl">
        <Avatar name={person?.name ?? '?'} />
        <span className="flex-1 flex flex-col gap-0.5 min-w-0">
          {groupId && (
            <RecipientPicker groupId={groupId} label="Ideas for" include="both" single placeholder="Everyone: type a name to narrow"
              value={personId ? [{ kind: 'person', id: personId }] : familyId ? [{ kind: 'family', id: familyId }] : []} onChange={pick} />
          )}
          {person && (
            <span className="text-[13px] text-muted">
              {[
                occasion && age !== null && age !== undefined ? `${occasion.type === 'BIRTHDAY' ? 'Turning' : 'Age'} ${age}` : age !== null && age !== undefined ? `Age ${age}` : null,
                occasion?.nextOccurrence ? `${occasion.name} · ${formatDate(occasion.nextOccurrence)}` : null,
                occasion?.effectiveBudget != null ? `Budget ${formatMoney(occasion.effectiveBudget, occasion.currency)}` : null,
              ].filter(Boolean).join(' · ') || person.familyName}
            </span>
          )}
        </span>
      </div>

      {repeats.length > 0 && (
        <p className="flex items-center gap-2 text-[13px] text-chip-ink bg-amber-soft rounded-xl px-3 py-2.5">
          <Icon name="info" size={16} />
          {repeats.map((i) => `${i.category}: you gave one in ${formatDate(i.repeat!.date, { month: 'short', year: 'numeric' })}`).join(' · ')}
        </p>
      )}

      {(ideas.isLoading || !groupId) && <Loading />}
      {ideas.isError && <LoadError what="ideas" />}
      <FormError error={buy.error ?? dismiss.error} />
      {ideas.data && list.length === 0 && (
        <EmptyState>{person ? `No saved ideas fit ${person.name} yet. Add one, or tag an idea with an age range.` : 'No saved ideas yet.'}</EmptyState>
      )}
      <div className="flex flex-col gap-2.5">
        {list.map((i) => (
          <IdeaCard
            key={i.id}
            idea={i}
            featured={Boolean(personId) && i.id === featuredId}
            currency={currency}
            busy={buy.isPending || dismiss.isPending}
            onBuy={() => (personId || i.people.length === 1 || i.occasionId ? buy.mutate(i) : setLogging(i))}
            onEdit={() => setEditing(i)}
            onDismiss={() => dismiss.mutate(i)}
          />
        ))}
      </div>

      {editing && groupId && <IdeaForm open onClose={() => setEditing(null)} groupId={groupId} idea={editing} />}
      {logging && groupId && (
        <GiftForm open onClose={() => setLogging(null)} groupId={groupId} defaults={{
          direction: 'GIVEN', status: 'BOUGHT', title: logging.title, brand: logging.brand, store: logging.store, category: logging.category,
          amount: logging.price, url: logging.url, photoUrl: logging.imageUrl, notes: logging.notes, ideaId: logging.id,
          personId: logging.people[0]?.id ?? null,
        }} />
      )}
      {adding && groupId && (
        <IdeaForm open onClose={() => setAdding(false)} groupId={groupId} personId={personId || null} occasionId={personId ? occasion?.id ?? null : null} />
      )}
    </div>
  )
}
