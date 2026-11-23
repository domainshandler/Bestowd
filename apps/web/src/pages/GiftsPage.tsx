import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listGifts } from '@bestowd/api-client'
import type { Gift, GiftQuery } from '@bestowd/types'
import { useGroup } from '../groups/GroupContext.tsx'
import GiftForm from '../components/forms/GiftForm.tsx'
import GiftRow from '../components/GiftRow.tsx'
import { Button, Card, Chips, EmptyState, Icon, LoadError, Loading, Select, Stat } from '../components/ui.tsx'
import { formatMoney } from '../lib/format.ts'

type Filter = 'ALL' | 'GIVEN' | 'RECEIVED' | 'PLANNED'

/** Groups gifts by occasion and year, e.g. "Christmas · 2025", keeping newest first. */
export function groupGifts(gifts: Gift[]): { title: string; gifts: Gift[] }[] {
  const groups = new Map<string, Gift[]>()
  for (const g of gifts) {
    const year = new Date(g.occasionDate ?? g.date).getUTCFullYear()
    const key = `${g.occasionName ?? 'Other gifts'} · ${year}`
    groups.set(key, [...(groups.get(key) ?? []), g])
  }
  return [...groups.entries()].map(([title, list]) => ({ title, gifts: list }))
}

function compact(amount: number, currency: string) {
  return amount >= 1000 ? `${formatMoney(Math.round(amount / 100) / 10, currency)}k` : formatMoney(amount, currency)
}

export default function GiftsPage() {
  const { groupId } = useGroup()
  const [params] = useSearchParams()
  const thisYear = new Date().getUTCFullYear()
  const [year, setYear] = useState<number | 'ALL'>(params.get('familyId') || params.get('personId') ? 'ALL' : thisYear)
  const [filter, setFilter] = useState<Filter>('ALL')
  const [logging, setLogging] = useState(false)

  const query: GiftQuery = {
    ...(year !== 'ALL' ? { year } : {}),
    ...(filter === 'GIVEN' || filter === 'RECEIVED' ? { direction: filter } : {}),
    ...(filter === 'PLANNED' ? { direction: 'GIVEN', status: 'BOUGHT' } : {}),
    ...(params.get('familyId') ? { familyId: params.get('familyId')! } : {}),
    ...(params.get('personId') ? { personId: params.get('personId')! } : {}),
  }
  const gifts = useQuery({ queryKey: ['gifts', groupId, query], queryFn: () => listGifts(groupId!, query), enabled: Boolean(groupId) })
  const sections = useMemo(() => groupGifts(gifts.data?.gifts ?? []), [gifts.data])
  const currency = gifts.data?.currency ?? 'CAD'
  const t = gifts.data?.totals

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Gifts</h1>
        <Select
          aria-label="Year"
          className="w-auto min-h-[40px] font-medium"
          value={year}
          onChange={(e) => setYear(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
        >
          {Array.from({ length: 6 }, (_, i) => thisYear - i).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
          <option value="ALL">All years</option>
        </Select>
      </div>

      {(params.get('familyId') || params.get('personId')) && (
        <p className="text-sm text-muted">
          Showing one {params.get('familyId') ? 'family' : 'person'}. <Link to="/gifts">Show everyone</Link>
        </p>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Stat value={t?.givenCount ?? '–'} label="Given" />
        <Stat value={t?.receivedCount ?? '–'} label="Received" />
        <Stat value={t ? compact(t.spent, currency) || '0' : '–'} label="Spent" />
      </div>
      {t && t.thankYouDueCount > 0 && (
        <p className="text-[13px] text-amber-ink bg-amber-soft rounded-xl px-3 py-2">
          {t.thankYouDueCount} thank-you{t.thankYouDueCount === 1 ? '' : 's'} due
        </p>
      )}

      <Chips
        label="Filter"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'ALL', label: 'All' },
          { value: 'GIVEN', label: 'Given' },
          { value: 'RECEIVED', label: 'Received' },
          { value: 'PLANNED', label: 'Planned' },
        ]}
      />

      {(gifts.isLoading || !groupId) && <Loading />}
      {gifts.isError && <LoadError what="gifts" />}
      {gifts.data && sections.length === 0 && (
        <EmptyState>{filter === 'PLANNED' ? 'Nothing bought and waiting to be given.' : 'No gifts logged for this period.'}</EmptyState>
      )}
      {sections.map((s) => (
        <section key={s.title} className="flex flex-col gap-2">
          <h2 className="font-sans text-[13px] font-semibold text-muted tracking-wide uppercase mt-1">{s.title}</h2>
          <Card className="divide-y divide-divider">
            {s.gifts.map((g) => (
              <GiftRow key={g.id} gift={g} currency={currency} showYear={false} />
            ))}
          </Card>
        </section>
      ))}

      {groupId && (
        <>
          <Button variant="dashed" className="h-[52px]" onClick={() => setLogging(true)}>
            <Icon name="plus" size={18} /> Log a gift
          </Button>
          {logging && (
            <GiftForm
              open
              onClose={() => setLogging(false)}
              groupId={groupId}
              defaults={{ personId: params.get('personId'), familyId: params.get('familyId') }}
            />
          )}
        </>
      )}
    </div>
  )
}
