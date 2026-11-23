import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { approveMove, cancelMove, declineMove, getGroup, getMoveRequest } from '@bestowd/api-client'
import type { MoveReview } from '@bestowd/types'
import { Badge, Button, Card, Checkbox, FormError, LoadError, Loading, Segmented } from '../components/ui.tsx'
import { useSave } from '../components/forms/useSave.ts'
import { countsSummary, listOf } from '../components/MoveRequests.tsx'
import { formatMoney } from '../lib/format.ts'

type Merge = 'MERGE' | 'KEEP_BOTH'
type Budget = 'OURS' | 'THEIRS'
const MERGE_OPTIONS = [{ value: 'MERGE' as const, label: 'Same: combine' }, { value: 'KEEP_BOTH' as const, label: 'Different: keep both' }]

const toggle = (list: string[], id: string, on: boolean) => (on ? [...new Set([...list, id])] : list.filter((x) => x !== id))

/** The owner's decisions, starting from: bring everything, combine look-alikes, keep our budgets. */
export function initialChoices(review: MoveReview) {
  return {
    familyIds: review.families.map((f) => f.id),
    occasionIds: review.occasions.map((o) => o.id),
    ideas: review.ideas > 0,
    families: {} as Record<string, Merge>,
    people: {} as Record<string, Merge>,
    budgets: {} as Record<string, Budget>,
  }
}
export type ReviewChoices = ReturnType<typeof initialChoices>

export function approveBody(c: ReviewChoices) {
  const pick = <T,>(m: Record<string, T>, v: T) => Object.entries(m).filter(([, x]) => x === v).map(([k]) => k)
  return {
    familyIds: c.familyIds, occasionIds: c.occasionIds, ideas: c.ideas,
    keepBothFamilies: pick(c.families, 'KEEP_BOTH'), keepBothPeople: pick(c.people, 'KEEP_BOTH'), useTheirBudget: pick(c.budgets, 'THEIRS'),
  }
}

/** A request to bring things into the group: the owner reviews and decides; the requester can withdraw it. */
export default function MoveRequestPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const request = useQuery({ queryKey: ['move-request', id], queryFn: () => getMoveRequest(id) })
  const group = useQuery({ queryKey: ['group', request.data?.groupId], queryFn: () => getGroup(request.data!.groupId), enabled: Boolean(request.data) })
  const money = (n: number | null) => (n === null ? 'none' : formatMoney(n, group.data?.currency))
  const [choices, setChoices] = useState<ReviewChoices | null>(null)
  const done = () => navigate('/')
  const approve = useSave((body: ReturnType<typeof approveBody>) => approveMove(id, body), done)
  const decline = useSave(() => declineMove(id), done)
  const cancel = useSave(() => cancelMove(id), done)

  if (request.isLoading) return <Loading />
  if (request.isError || !request.data) return <LoadError what="this request" />
  const r = request.data
  const header = (
    <>
      <Link to="/" className="text-sm text-muted">← Home</Link>
      <h1 className="text-3xl font-bold tracking-tight">{r.requestedBy.name} wants to bring things in</h1>
      <p className="text-sm text-muted">{countsSummary(r.counts)} from {r.fromGroupName}.</p>
    </>
  )

  if (r.status !== 'PENDING') {
    return <div className="flex flex-col gap-4 max-w-lg">{header}<Badge>{r.status === 'APPROVED' ? 'Approved' : r.status === 'DECLINED' ? 'Declined' : 'Withdrawn'}</Badge></div>
  }
  if (!r.canDecide || !r.review) {
    return (
      <div className="flex flex-col gap-4 max-w-lg">
        {header}
        <Card className="p-4 text-sm text-chip-ink">Waiting for the group's owner to review it. Nothing moves until they approve.</Card>
        <FormError error={cancel.error} />
        <Button variant="danger" className="self-start" disabled={cancel.isPending} onClick={() => cancel.mutate(undefined)}>Withdraw request</Button>
      </div>
    )
  }

  const review = r.review
  const c = choices ?? initialChoices(review)
  const set = (patch: Partial<ReviewChoices>) => setChoices({ ...c, ...patch })
  const nothing = c.familyIds.length === 0 && c.occasionIds.length === 0 && !c.ideas
  const conflicts = review.families.filter((f) => f.match).length + review.people.length + review.occasions.filter((o) => o.match).length

  return (
    <form className="flex flex-col gap-5 max-w-lg" onSubmit={(e) => { e.preventDefault(); approve.mutate(approveBody(c)) }}>
      {header}
      <p className="text-sm text-muted">
        Untick anything you don't want. {conflicts > 0 ? `${conflicts === 1 ? 'One item looks' : `${conflicts} items look`} like something you already have: choose whether they're the same.` : 'Nothing looks like something you already have.'}
        {' '}Your group's settings don't change.
      </p>
      {review.currency && (
        <Card className="p-4 text-sm bg-amber-soft">
          {r.fromGroupName} uses {review.currency.from} and this group uses {review.currency.to}. Amounts aren't converted: they'll show in {review.currency.to}.
        </Card>
      )}

      {review.families.length > 0 && (
        <fieldset className="bg-white border border-line rounded-2xl px-4 py-2 flex flex-col">
          <legend className="text-sm font-medium px-1">Families</legend>
          {review.families.map((f) => {
            const on = c.familyIds.includes(f.id)
            const people = review.people.filter((p) => p.familyId === f.id)
            return (
              <div key={f.id} className="flex flex-col gap-2 py-1">
                <Checkbox label={f.isOwnHousehold ? `${f.name}: their household` : f.name}
                  hint={f.isOwnHousehold ? `${listOf([f.people ? `${f.people} ${f.people === 1 ? 'person joins' : 'people join'} your household` : null, f.gifts ? `${f.gifts} ${f.gifts === 1 ? 'gift' : 'gifts'}` : null])}` : listOf([f.people ? `${f.people} ${f.people === 1 ? 'person' : 'people'}` : null, f.gifts ? `${f.gifts} ${f.gifts === 1 ? 'gift' : 'gifts'}` : null])}
                  checked={on} onChange={(v) => set({ familyIds: toggle(c.familyIds, f.id, v) })} />
                {on && f.match && (
                  <div className="pl-1 pb-1 flex flex-col gap-1.5">
                    <span className="text-[13px] text-muted">Looks like your <strong>{f.match.name}</strong></span>
                    <Segmented label={`${f.name} and ${f.match.name}`} value={c.families[f.id] ?? 'MERGE'} options={MERGE_OPTIONS}
                      onChange={(v) => set({ families: { ...c.families, [f.id]: v } })} />
                  </div>
                )}
                {on && (f.isOwnHousehold || (c.families[f.id] ?? 'MERGE') === 'MERGE') && people.map((p) => (
                  <div key={p.id} className="pl-1 pb-1 flex flex-col gap-1.5">
                    <span className="text-[13px] text-muted"><strong>{p.name}</strong> looks like your <strong>{p.match.name}</strong></span>
                    <Segmented label={`${p.name} and ${p.match.name}`} value={c.people[p.id] ?? 'MERGE'} options={MERGE_OPTIONS}
                      onChange={(v) => set({ people: { ...c.people, [p.id]: v } })} />
                  </div>
                ))}
              </div>
            )
          })}
        </fieldset>
      )}

      {review.occasions.length > 0 && (
        <fieldset className="bg-white border border-line rounded-2xl px-4 py-2 flex flex-col">
          <legend className="text-sm font-medium px-1">Holidays</legend>
          {review.occasions.map((o) => {
            const on = c.occasionIds.includes(o.id)
            return (
              <div key={o.id} className="flex flex-col gap-2 py-1">
                <Checkbox label={o.name} hint={o.match ? `You track ${o.match.name} too: they become one` : 'New to this group'}
                  checked={on} onChange={(v) => set({ occasionIds: toggle(c.occasionIds, o.id, v) })} />
                {on && o.budgetDiffers && (
                  <div className="pl-1 pb-1 flex flex-col gap-1.5">
                    <span className="text-[13px] text-muted">The budgets differ. Which one should {o.name} use?</span>
                    <Segmented label={`${o.name} budget`} value={c.budgets[o.id] ?? 'OURS'}
                      options={[
                        { value: 'OURS' as const, label: `Yours (${money(o.ourBudget)})` },
                        { value: 'THEIRS' as const, label: `Theirs (${money(o.theirBudget)})` },
                      ]}
                      onChange={(v) => set({ budgets: { ...c.budgets, [o.id]: v } })} />
                  </div>
                )}
              </div>
            )
          })}
        </fieldset>
      )}

      {review.ideas > 0 && (
        <Card className="px-4 py-1">
          <Checkbox label="Gift ideas" hint={`${review.ideas} ${review.ideas === 1 ? 'idea' : 'ideas'}`} checked={c.ideas} onChange={(v) => set({ ideas: v })} />
        </Card>
      )}

      <FormError error={approve.error ?? decline.error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={approve.isPending || nothing}>{approve.isPending ? 'Bringing them in…' : 'Approve'}</Button>
        <Button type="button" variant="danger" disabled={decline.isPending} onClick={() => decline.mutate(undefined)}>Decline</Button>
      </div>
      <p className="text-xs text-muted">Declining leaves everything in {r.fromGroupName}. {r.requestedBy.name} can ask again later.</p>
    </form>
  )
}
