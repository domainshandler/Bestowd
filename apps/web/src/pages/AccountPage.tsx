import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getGroup, listHolidays, listOccasions, updateGroup } from '@bestowd/api-client'
import type { OccasionType } from '@bestowd/types'
import { useAuth } from '../auth/useAuth.ts'
import { GROUP_KEY, useGroup } from '../groups/GroupContext.tsx'
import InviteLinkModal from '../components/forms/InviteLinkModal.tsx'
import GroupOccasionForm from '../components/forms/GroupOccasionForm.tsx'
import OccasionRow from '../components/OccasionRow.tsx'
import { ChooseHolidays } from '../components/HolidaySuggestions.tsx'
import { useSave } from '../components/forms/useSave.ts'
import { Avatar, Badge, Button, Card, EmptyState, Field, FormError, Icon, SectionHeader, Select, TextInput } from '../components/ui.tsx'
import { OCCASION_TYPE_LABEL, currencyOptions } from '../lib/format.ts'

const TYPES = Object.keys(OCCASION_TYPE_LABEL) as OccasionType[]

/** "Holidays we celebrate": which built-in holidays the group tracks, with Change to reopen the checklist. */
function HolidaysSetting({ groupId }: { groupId: string }) {
  const [choosing, setChoosing] = useState(false)
  const holidays = useQuery({ queryKey: ['holidays', groupId], queryFn: () => listHolidays(groupId) })
  const names = holidays.data?.holidays.filter((h) => h.occasionId !== null).map((h) => h.name) ?? []
  const summary = names.length ? names.join(', ') : holidays.data?.chosen ? 'None' : 'Not chosen yet'
  return (
    <Card className="p-4 flex items-center gap-3">
      <span className="flex-1 flex flex-col">
        <span className="text-[15px] font-semibold">Holidays we celebrate</span>
        <span className="text-[13px] text-muted">{holidays.data ? summary : '…'}</span>
      </span>
      <Button variant="secondary" disabled={!holidays.data} onClick={() => setChoosing(true)}>Change</Button>
      {choosing && holidays.data && <ChooseHolidays groupId={groupId} holidays={holidays.data.holidays} onClose={() => setChoosing(false)} />}
    </Card>
  )
}

/** Holidays and other occasions for the whole group, e.g. Christmas covering every family. */
function GroupOccasions({ groupId }: { groupId: string }) {
  const [adding, setAdding] = useState(false)
  const yearAhead = new Date(Date.now() + 366 * 86_400_000).toISOString().slice(0, 10)
  const occasions = useQuery({ queryKey: ['occasions', groupId, 'group-wide'], queryFn: () => listOccasions(groupId, { to: yearAhead }) })
  const groupWide = occasions.data?.occasions.filter((o) => o.scope === 'GROUP') ?? []
  return (
    <section className="flex flex-col gap-2.5">
      <SectionHeader title="Group occasions" action={<Button variant="ghost" onClick={() => setAdding(true)}><Icon name="plus" size={16} /> Add</Button>} />
      {occasions.isSuccess && groupWide.length === 0 && (
        <EmptyState>Holidays you celebrate with several families, like Christmas or Diwali. Add one to track a gift and budget for each family.</EmptyState>
      )}
      {groupWide.map((o) => <OccasionRow key={o.id} occasion={o} />)}
      {adding && <GroupOccasionForm open onClose={() => setAdding(false)} groupId={groupId} />}
    </section>
  )
}

function GroupSettings({ groupId }: { groupId: string }) {
  const group = useQuery({ queryKey: ['group', groupId], queryFn: () => getGroup(groupId) })
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('')
  const [budgets, setBudgets] = useState<Record<string, string>>({})
  const [days, setDays] = useState('')
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    if (!group.data) return
    setName(group.data.name)
    setCurrency(group.data.currency)
    setBudgets(Object.fromEntries(TYPES.map((t) => [t, group.data.defaultBudgets[t]?.toString() ?? ''])))
    setDays(group.data.defaultReminderDays.join(', '))
  }, [group.data])

  const save = useSave(() => updateGroup(groupId, {
    name: name.trim(),
    currency: currency.trim().toUpperCase(),
    defaultBudgets: Object.fromEntries(TYPES.filter((t) => budgets[t]?.trim()).map((t) => [t, Number(budgets[t])])),
    defaultReminderDays: days.split(',').map((d) => d.trim()).filter(Boolean).map(Number),
  }), () => { setSaved(true); setTimeout(() => setSaved(false), 2000) })

  if (!group.data) return null
  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(undefined) }} className="flex flex-col gap-4">
      <Field label="Group name">{(id) => <TextInput id={id} required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
      <Field label="Currency">
        {(id) => (
          <Select id={id} required value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {currencyOptions(currency).map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
          </Select>
        )}
      </Field>
      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-medium mb-1">Default budget per occasion</legend>
        <div className="grid grid-cols-3 gap-2">
          {TYPES.map((t) => (
            <label key={t} className="flex flex-col gap-1 text-xs text-muted">
              {OCCASION_TYPE_LABEL[t]}
              <TextInput type="number" min={0} step="1" value={budgets[t] ?? ''} onChange={(e) => setBudgets((b) => ({ ...b, [t]: e.target.value }))} />
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Remind me" hint="Days before each occasion, separated by commas">{(id) => <TextInput id={id} value={days} onChange={(e) => setDays(e.target.value)} placeholder="14, 3" />}</Field>
      <FormError error={save.error} />
      <Button type="submit" disabled={save.isPending}>{saved ? 'Saved' : save.isPending ? 'Saving…' : 'Save settings'}</Button>
    </form>
  )
}

export default function AccountPage() {
  const { user, logout } = useAuth()
  const { memberships, groupId, group, setGroupId, multipleGroups } = useGroup()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [inviting, setInviting] = useState(false)

  function handleLogout() {
    logout()
    localStorage.removeItem(GROUP_KEY)
    qc.clear()
    navigate('/login')
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

      <Card className="p-5 flex items-center gap-4">
        <Avatar name={user?.name ?? '?'} photoUrl={user?.avatarUrl} size={56} />
        <div>
          <p className="font-semibold">{user?.name}</p>
          <p className="text-sm text-muted">{user?.email}</p>
        </div>
      </Card>

      {multipleGroups && (
        <section className="flex flex-col gap-2.5">
          <SectionHeader title="Your groups" />
          <Card className="divide-y divide-divider">
            {memberships.map((m) => (
              <button key={m.groupId} type="button" onClick={() => setGroupId(m.groupId)} className="w-full flex items-center gap-3 p-3.5 text-left">
                <span className="flex-1 flex flex-col">
                  <span className="text-[15px] font-semibold">{m.groupName}</span>
                  <span className="text-[13px] text-muted">{m.memberCount} {m.memberCount === 1 ? 'member' : 'members'} · {m.role === 'OWNER' ? 'Owner' : 'Member'}</span>
                </span>
                {m.groupId === groupId && <Badge tone="brand">Viewing</Badge>}
              </button>
            ))}
          </Card>
        </section>
      )}

      {groupId && (
        <section className="flex flex-col gap-2.5">
          <SectionHeader title={multipleGroups ? `${group?.groupName} settings` : 'Group settings'} />
          <HolidaysSetting groupId={groupId} />
          <Card className="p-4 flex flex-col gap-4">
            {group?.role === 'OWNER'
              ? <GroupSettings groupId={groupId} />
              : <p className="text-sm text-muted">Only the group's owner can change its settings.</p>}
          </Card>
          <Card className="p-4 flex items-center gap-3">
            <span className="flex-1 text-sm text-chip-ink">Plan gifts with a partner or co-parent. They'll see everything in {multipleGroups ? group?.groupName : 'your account'}.</span>
            <Button variant="secondary" onClick={() => setInviting(true)}><Icon name="link" size={16} /> Invite</Button>
          </Card>
        </section>
      )}

      {groupId && <GroupOccasions groupId={groupId} />}

      <Button variant="danger" className="self-start" onClick={handleLogout}>Sign out</Button>
      {inviting && groupId && <InviteLinkModal open onClose={() => setInviting(false)} groupId={groupId} kind="GROUP" />}
    </div>
  )
}
