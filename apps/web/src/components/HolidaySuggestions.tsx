import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { chooseHolidays, createGroupOccasion, dismissHoliday, listHolidays } from '@bestowd/api-client'
import type { Holiday } from '@bestowd/types'
import { Button, Card, Checkbox, FormError, Modal } from './ui.tsx'
import { useSave } from './forms/useSave.ts'
import { daysUntil, formatDate, inDaysLabel } from '../lib/format.ts'

/** Built-in holidays within this many days that the group hasn't added are suggested on Home. */
export const SUGGEST_WITHIN_DAYS = 45

/** Suggested holidays: upcoming, not added and not dismissed. */
export function suggestedHolidays(holidays: Holiday[], now = new Date()): Holiday[] {
  return holidays.filter((h) => h.occasionId === null && !h.dismissed && h.nextDate !== null && daysUntil(h.nextDate, now) <= SUGGEST_WITHIN_DAYS)
}

/**
 * On Home: until the group says which holidays it celebrates, a prompt to choose; afterwards, upcoming
 * built-in holidays it hasn't added, each with "Track it" (adds it for every family) and "Not for us".
 */
export default function HolidaySuggestions({ groupId }: { groupId: string }) {
  const navigate = useNavigate()
  const [choosing, setChoosing] = useState(false)
  const holidays = useQuery({ queryKey: ['holidays', groupId], queryFn: () => listHolidays(groupId) })
  const track = useSave((key: string) => createGroupOccasion(groupId, { groupWide: true, holidayKey: key }), (o) => navigate(`/occasions/${o.id}`))
  const dismiss = useSave((key: string) => dismissHoliday(groupId, key))

  if (!holidays.data) return null
  const { chosen, holidays: all } = holidays.data

  if (!chosen) {
    return (
      <Card className="p-4 flex items-center gap-3">
        <span className="flex-1 flex flex-col">
          <span className="text-[15px] font-semibold">Which holidays do you celebrate?</span>
          <span className="text-[13px] text-muted">Pick them once and Bestowd tracks a gift and budget for each family.</span>
        </span>
        <Button onClick={() => setChoosing(true)}>Choose</Button>
        {choosing && <ChooseHolidays groupId={groupId} holidays={all} onClose={() => setChoosing(false)} />}
      </Card>
    )
  }

  const suggested = suggestedHolidays(all)
  if (suggested.length === 0) return null
  return (
    <section aria-label="Suggested holidays" className="flex flex-col gap-2.5">
      {suggested.map((h) => (
        <Card key={h.key} className="p-3.5 flex items-center gap-3">
          <span className="flex-1 min-w-0 flex flex-col">
            <span className="text-[15px] font-semibold">{h.name}</span>
            <span className="text-[13px] text-muted">{formatDate(h.nextDate)} · {inDaysLabel(h.nextDate!)} · not tracked yet</span>
          </span>
          <Button variant="ghost" disabled={dismiss.isPending} onClick={() => dismiss.mutate(h.key)}>Not for us</Button>
          <Button variant="secondary" disabled={track.isPending} onClick={() => track.mutate(h.key)}>Track it</Button>
        </Card>
      ))}
      <FormError error={track.error ?? dismiss.error} />
    </section>
  )
}

/** The checklist: ticked holidays are added for every family; the rest stop being suggested. */
export function ChooseHolidays({ groupId, holidays, onClose }: { groupId: string; holidays: Holiday[]; onClose: () => void }) {
  const offered = holidays.filter((h) => h.nextDate !== null || h.occasionId !== null)
  const [picked, setPicked] = useState(() => new Set(offered.filter((h) => h.occasionId !== null).map((h) => h.key)))
  const save = useSave(() => chooseHolidays(groupId, [...picked]), onClose)
  const toggle = (key: string, on: boolean) => setPicked((s) => {
    const next = new Set(s)
    if (on) next.add(key); else next.delete(key)
    return next
  })
  return (
    <Modal open onClose={onClose} title="Which holidays do you celebrate?">
      <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined) }}>
        <p className="text-sm text-muted">Each one you pick covers all your families. You can change families and budgets later, or add your own occasions under Account.</p>
        <fieldset className="bg-white border border-line rounded-2xl px-4 py-2">
          <legend className="sr-only">Holidays</legend>
          {offered.map((h) => (
            <Checkbox key={h.key} label={h.name} hint={[h.nextDate ? `Next: ${formatDate(h.nextDate)}` : null, h.note].filter(Boolean).join(' · ')}
              checked={picked.has(h.key)} onChange={(on) => toggle(h.key, on)} />
          ))}
        </fieldset>
        <FormError error={save.error} />
        <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</Button>
      </form>
    </Modal>
  )
}
