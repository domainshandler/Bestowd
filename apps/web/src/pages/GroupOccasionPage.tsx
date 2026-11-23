import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { deleteOccasion, getOccasion, listFamilies, setOccasionFamilies, updateOccasion } from '@bestowd/api-client'
import type { FamilyType, Occasion } from '@bestowd/types'
import GiftForm from '../components/forms/GiftForm.tsx'
import FamilyTypeBudgets, { type TypeBudgetText, typeBudgetText, typeBudgetsFrom } from '../components/forms/FamilyTypeBudgets.tsx'
import { numberOrNull, useSave } from '../components/forms/useSave.ts'
import { Badge, Button, Card, Checkbox, Field, FormError, LoadError, Loading, SectionHeader, Stat, TextInput } from '../components/ui.tsx'
import { FAMILY_TYPE_LABEL, formatDate, formatMoney, inDaysLabel } from '../lib/format.ts'

/** A group-wide occasion (a holiday or your own): progress and budget per family, and its settings. */
export default function GroupOccasionPage() {
  const { id = '' } = useParams()
  const occasion = useQuery({ queryKey: ['occasion', id], queryFn: () => getOccasion(id) })
  if (occasion.isLoading) return <Loading />
  if (occasion.isError || !occasion.data) return <LoadError what="this occasion" />
  if (occasion.data.scope !== 'GROUP') return <LoadError what="this occasion" />
  return <GroupOccasion o={occasion.data} />
}

function GroupOccasion({ o }: { o: Occasion }) {
  const navigate = useNavigate()
  const [logFor, setLogFor] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const coverage = o.coverage!
  const money = (n: number | null) => formatMoney(n, o.currency)

  const remove = useSave(
    () => deleteOccasion(o.id),
    () => navigate('/account'),
  )

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <header className="flex flex-col gap-1">
        <Link to="/account" className="text-sm text-brand">
          Group occasions
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">{o.name}</h1>
        <p className="text-sm text-muted">
          {o.nextOccurrence
            ? `${formatDate(o.nextOccurrence, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} · ${inDaysLabel(o.nextOccurrence)}`
            : 'No upcoming date'}
          {o.recursAnnually ? ' · every year' : ''}
        </p>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <Stat value={`${coverage.coveredCount} of ${coverage.familyCount}`} label="families have a gift" />
        <Stat value={money(o.spent)} label="spent" />
        <Stat value={o.effectiveBudget === null ? '–' : money(o.effectiveBudget)} label="budgeted" />
      </div>

      <section className="flex flex-col gap-2.5">
        <SectionHeader
          title="Families"
          action={
            <Button variant="ghost" onClick={() => setEditing(true)}>
              Edit families & budgets
            </Button>
          }
        />
        <Card className="divide-y divide-divider">
          {coverage.families.length === 0 && (
            <p className="p-4 text-sm text-muted">No families yet. Choose some with “Edit families & budgets”.</p>
          )}
          {coverage.families.map((f) => (
            <div key={f.familyId} className="flex items-center gap-3 p-3.5">
              <Link to={`/families/${f.familyId}`} className="flex-1 min-w-0 flex flex-col">
                <span className="text-[15px] font-semibold truncate">{f.name}</span>
                <span className="text-[13px] text-muted">
                  {FAMILY_TYPE_LABEL[f.type]}
                  {f.budget !== null && (
                    <>
                      {' '}
                      · {f.spent > 0 ? `${money(f.spent)} of ` : 'Budget '}
                      {money(f.budget)}
                      {f.budgetOverride !== null ? ' (just for them)' : ''}
                    </>
                  )}
                </span>
              </Link>
              {f.given ? (
                <Badge tone="brand">Given</Badge>
              ) : f.covered ? (
                <Badge tone="brand">Bought</Badge>
              ) : (
                <Button variant="secondary" onClick={() => setLogFor(f.familyId)}>
                  Log gift
                </Button>
              )}
            </div>
          ))}
        </Card>
      </section>

      <Button
        variant="danger"
        className="self-start"
        disabled={remove.isPending}
        onClick={() => {
          if (confirm(`Remove ${o.name}? Gifts already logged stay in the history.`)) remove.mutate(undefined)
        }}
      >
        Remove {o.name}
      </Button>
      <FormError error={remove.error} />

      {editing && <EditCoverage o={o} onClose={() => setEditing(false)} />}
      {logFor && <GiftForm open onClose={() => setLogFor(null)} groupId={o.groupId} defaults={{ familyId: logFor, occasionId: o.id }} />}
    </div>
  )
}

/** Which families are covered, each one's own budget, and the occasion's default and per-type budgets. */
function EditCoverage({ o, onClose }: { o: Occasion; onClose: () => void }) {
  const families = useQuery({ queryKey: ['families', o.groupId, 'ACTIVE'], queryFn: () => listFamilies(o.groupId) })
  const [budget, setBudget] = useState(o.budget?.toString() ?? '')
  const [typeBudgets, setTypeBudgets] = useState<TypeBudgetText>(typeBudgetText(o.familyTypeBudgets))
  const [includeNew, setIncludeNew] = useState(o.includeNewFamilies)
  // familyId → own budget text ('' = defaults); absent = not covered.
  const [rows, setRows] = useState<Map<string, string> | null>(null)
  useEffect(() => {
    setRows(new Map(o.coverage!.families.map((f) => [f.familyId, f.budgetOverride?.toString() ?? ''])))
  }, [o])

  const save = useSave(async () => {
    await updateOccasion(o.id, {
      budget: numberOrNull(budget),
      familyTypeBudgets: typeBudgetsFrom(typeBudgets),
      includeNewFamilies: includeNew,
    })
    return setOccasionFamilies(
      o.id,
      [...(rows ?? [])].map(([familyId, b]) => ({ familyId, budget: numberOrNull(b) })),
    )
  }, onClose)

  const set = (familyId: string, value: string | null) =>
    setRows((r) => {
      const next = new Map(r)
      if (value === null) next.delete(familyId)
      else next.set(familyId, value)
      return next
    })

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label="Edit families and budgets"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate(undefined)
        }}
        className="bg-ground w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 shadow-xl flex flex-col gap-4"
      >
        <h2 className="text-lg font-bold">Families & budgets</h2>
        <Field label="Budget per family" hint="Leave empty to use your group's default for this type of occasion">
          {(id) => <TextInput id={id} type="number" min={0} step="0.01" value={budget} onChange={(e) => setBudget(e.target.value)} />}
        </Field>
        <FamilyTypeBudgets value={typeBudgets} onChange={setTypeBudgets} />
        <fieldset className="bg-white border border-line rounded-2xl px-4 py-2 flex flex-col">
          <legend className="text-sm font-medium px-1">Families</legend>
          {families.data?.map((f) => {
            const own = rows?.get(f.id)
            const covered = own !== undefined
            return (
              <div key={f.id} className="flex items-center gap-3 min-h-[52px]">
                <input
                  type="checkbox"
                  aria-label={`Include ${f.name}`}
                  checked={covered}
                  className="w-5 h-5 accent-brand"
                  onChange={(e) => set(f.id, e.target.checked ? '' : null)}
                />
                <span className="flex-1 flex flex-col">
                  <span className="text-[15px] font-medium">{f.name}</span>
                  <span className="text-xs text-muted">{f.isOwnHousehold ? 'Your household' : FAMILY_TYPE_LABEL[f.type]}</span>
                </span>
                {covered && (
                  <TextInput
                    type="number"
                    min={0}
                    step="0.01"
                    className="w-28"
                    placeholder="Default"
                    aria-label={`Budget for ${f.name}`}
                    value={own}
                    onChange={(e) => set(f.id, e.target.value)}
                  />
                )}
              </div>
            )
          })}
          <Checkbox label="Include families added later" checked={includeNew} onChange={setIncludeNew} />
        </fieldset>
        <FormError error={save.error} />
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </div>
  )
}
