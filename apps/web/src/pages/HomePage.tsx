import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listHomeOccasions } from '@bestowd/api-client'
import type { OccasionType } from '@bestowd/types'
import { useAuth } from '../auth/useAuth.ts'
import { useGroup } from '../groups/GroupContext.tsx'
import OccasionRow from '../components/OccasionRow.tsx'
import HolidaySuggestions from '../components/HolidaySuggestions.tsx'
import { GroupNotices, PendingMoves } from '../components/MoveRequests.tsx'
import GiftForm from '../components/forms/GiftForm.tsx'
import SnapCapture from '../components/SnapCapture.tsx'
import { Button, Chips, EmptyState, Icon, LoadError, Loading } from '../components/ui.tsx'
import { formatMoney } from '../lib/format.ts'

type Filter = 'ALL' | OccasionType

function greeting(now = new Date()) {
  const h = now.getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function HomePage() {
  const { user } = useAuth()
  const { groupId } = useGroup()
  const [filter, setFilter] = useState<Filter>('ALL')
  const [logging, setLogging] = useState(false)
  const { data, isLoading, isError } = useQuery({
    queryKey: ['home-occasions', filter],
    queryFn: () => listHomeOccasions(filter === 'ALL' ? {} : { type: filter }),
  })
  const occasions = data?.occasions ?? []
  const needGifts = occasions.filter((o) => o.status === 'NOT_STARTED').length

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm text-muted">
          {greeting()}, {user?.name.split(' ')[0]}
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Coming up</h1>
      </div>

      <section aria-label="Summary" className="bg-brand text-white rounded-[20px] p-5 flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <p className="text-[13px] font-medium text-brand-faint">Next 30 days</p>
          {needGifts > 0 && (
            <span className="bg-amber text-ink text-xs font-semibold px-2.5 py-1 rounded-full">
              {needGifts} need {needGifts === 1 ? 'a gift' : 'gifts'}
            </span>
          )}
        </div>
        <p className="font-display text-[22px] font-bold leading-tight">
          {isLoading ? '…' : `${occasions.length} ${occasions.length === 1 ? 'occasion' : 'occasions'} in the next 30 days`}
        </p>
        {data && data.plannedSpend.some((p) => p.amount > 0) && (
          <p className="text-[13px] text-brand-faint">
            {data.plannedSpend
              .filter((p) => p.amount > 0)
              .map((p) => formatMoney(p.amount, p.currency))
              .join(' + ')}{' '}
            planned
          </p>
        )}
      </section>

      {groupId && <SnapCapture groupId={groupId} />}
      {groupId && <GroupNotices groupId={groupId} />}
      {groupId && <PendingMoves groupId={groupId} />}
      {groupId && <HolidaySuggestions groupId={groupId} />}

      <Chips
        label="Occasion type"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'ALL', label: 'All' },
          { value: 'BIRTHDAY', label: 'Birthdays' },
          { value: 'HOLIDAY', label: 'Holidays' },
          { value: 'ONE_OFF', label: 'Events' },
        ]}
      />

      <section className="flex flex-col gap-2.5" aria-label="Upcoming occasions">
        {isLoading && <Loading />}
        {isError && <LoadError what="your occasions" />}
        {!isLoading && !isError && occasions.length === 0 && (
          <EmptyState>Nothing in the next 30 days. Add people and their birthdays under People.</EmptyState>
        )}
        {occasions.map((o) => (
          <OccasionRow key={o.id} occasion={o} showGroup={data?.multipleGroups ?? false} />
        ))}
      </section>

      {groupId && (
        <>
          <Button variant="dashed" className="h-[52px] text-[15px]" onClick={() => setLogging(true)}>
            <Icon name="plus" size={18} /> Log a gift
          </Button>
          {logging && <GiftForm open onClose={() => setLogging(false)} groupId={groupId} />}
        </>
      )}
    </div>
  )
}
