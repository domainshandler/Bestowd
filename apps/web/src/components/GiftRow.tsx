import { useState } from 'react'
import { updateGift } from '@bestowd/api-client'
import type { Gift } from '@bestowd/types'
import { Badge, Icon } from './ui.tsx'
import { useSave } from './forms/useSave.ts'
import GiftForm from './forms/GiftForm.tsx'
import { REACTION_LABEL, formatDate, formatMoney } from '../lib/format.ts'

/** One gift in a history list. Received values stay hidden until revealed (which also counts them in totals). */
export default function GiftRow({ gift, currency, showYear = true }: { gift: Gift; currency: string; showYear?: boolean }) {
  const g = gift
  const [editing, setEditing] = useState(false)
  const reveal = useSave(() => updateGift(g.id, { valueHidden: false }))
  const thank = useSave(() => updateGift(g.id, { thankYouSent: true }))
  const received = g.direction === 'RECEIVED'
  const when = g.occasionName
    ? `${g.occasionName}${showYear && g.occasionDate ? ` ${new Date(g.occasionDate).getUTCFullYear()}` : ''}`
    : formatDate(g.date, showYear ? { month: 'short', year: 'numeric' } : { month: 'short', day: 'numeric' })
  const line = [`${received ? 'From' : 'To'} ${g.counterpartyName}`, when, g.reaction ? REACTION_LABEL[g.reaction] : null].filter(Boolean).join(' · ')

  return (
    <div className="flex items-center gap-3 p-3.5">
      <span className={`w-10 h-10 rounded-xl flex items-center justify-center flex-none ${received ? 'bg-amber-soft text-amber-ink' : 'bg-brand-light text-brand'}`}>
        <Icon name={received ? 'received' : 'given'} label={received ? 'Received' : 'Given'} />
      </span>
      <button type="button" onClick={() => setEditing(true)} className="flex-1 min-w-0 flex flex-col gap-0.5 text-left">
        <span className="text-[15px] font-semibold truncate">{g.title}</span>
        <span className="text-[13px] text-muted truncate">{line}</span>
      </button>
      <div className="flex flex-col items-end gap-1 flex-none">
        {!received && g.status === 'BOUGHT' && <Badge>Bought</Badge>}
        {!received && g.amount !== null && <span className="text-[15px] font-semibold">{formatMoney(g.amount, currency)}</span>}
        {received && g.amount !== null && (g.valueHidden
          ? <button type="button" onClick={() => reveal.mutate(undefined)} className="text-xs font-medium text-brand flex items-center gap-1 min-h-[28px]"><Icon name="eye" size={14} /> Show value</button>
          : <span className="text-[15px] font-semibold">{formatMoney(g.amount, currency)}</span>)}
        {received && (g.thankYouSent
          ? <Badge tone="brand">Thanked</Badge>
          : <button type="button" onClick={() => thank.mutate(undefined)} className="rounded-full" title="Mark thank-you sent"><Badge tone="amber">Thank-you due</Badge></button>)}
      </div>
      {editing && <GiftForm open onClose={() => setEditing(false)} groupId={g.groupId} gift={g} />}
    </div>
  )
}
