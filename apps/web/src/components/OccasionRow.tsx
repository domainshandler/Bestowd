import { Link } from 'react-router-dom'
import type { Occasion, OccasionStatus } from '@bestowd/types'
import { Badge, DateTile, type Tone } from './ui.tsx'
import { formatMoney } from '../lib/format.ts'

export const STATUS_LABEL: Record<OccasionStatus, string> = {
  NOT_STARTED: 'Needs gift',
  IDEA_SAVED: 'Idea saved',
  BOUGHT: 'Bought',
  GIVEN: 'Given',
}
export const STATUS_TONE: Record<OccasionStatus, Tone> = {
  NOT_STARTED: 'amber',
  IDEA_SAVED: 'neutral',
  BOUGHT: 'brand',
  GIVEN: 'brand',
}

/** Where tapping an occasion goes: a group-wide occasion's own page, else the person, else the family. */
export function occasionHref(o: Occasion): string {
  if (o.scope === 'GROUP') return `/occasions/${o.id}`
  if (o.personId) return `/people/${o.personId}`
  return `/families/${o.familyId ?? o.subjectFamilyId}`
}

export default function OccasionRow({ occasion, showGroup = false }: { occasion: Occasion; showGroup?: boolean }) {
  const o = occasion
  // A group-wide occasion shown for the whole group says how many families are covered.
  const progress = o.coverage && !o.subjectFamilyId ? `${o.coverage.coveredCount} of ${o.subjectName} have a gift` : null
  const details = [progress, o.personId ? o.subjectFamilyName : null, showGroup ? o.groupName : null].filter(Boolean)
  return (
    <Link to={occasionHref(o)} className="bg-white border border-line rounded-2xl p-3.5 flex gap-3.5 items-center hover:border-brand/40">
      {o.nextOccurrence && <DateTile iso={o.nextOccurrence} />}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <p className="text-[15px] font-semibold truncate">{o.name}</p>
        <p className="text-[13px] text-muted truncate">
          {details.join(' · ') || o.subjectName}
          {o.effectiveBudget !== null && (
            <span className={o.overBudget ? 'text-danger' : ''}>
              {' · '}
              {o.spent > 0 ? `${formatMoney(o.spent, o.currency)} of ` : 'Budget '}
              {formatMoney(o.effectiveBudget, o.currency)}
            </span>
          )}
        </p>
      </div>
      <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
    </Link>
  )
}
