import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  createGroup,
  dismissNotice,
  getGroup,
  getGroupMovable,
  getLeaveOptions,
  leaveGroup,
  listMoveRequests,
  listNotices,
  requestMove,
} from '@bestowd/api-client'
import type { MovableItems, MoveRequestSummary, MoveSelection } from '@bestowd/types'
import { Button, Card, Checkbox, Field, FormError, Modal, Select, TextInput } from './ui.tsx'
import { useSave } from './forms/useSave.ts'
import { useGroup } from '../groups/GroupContext.tsx'

const count = (n: number, one: string, many: string) => (n > 0 ? `${n} ${n === 1 ? one : many}` : null)

/** "2 families, 3 gifts and 1 idea". */
export function listOf(parts: (string | null)[]): string {
  const p = parts.filter((x): x is string => x !== null)
  return p.length <= 1 ? (p[0] ?? 'nothing') : `${p.slice(0, -1).join(', ')} and ${p.at(-1)}`
}

export function countsSummary(c: MoveRequestSummary['counts']): string {
  return listOf([
    count(c.families, 'family', 'families'),
    count(c.people, 'person', 'people'),
    count(c.gifts, 'gift', 'gifts'),
    count(c.occasions, 'holiday', 'holidays'),
    count(c.ideas, 'idea', 'ideas'),
  ])
}

/** Everything ticked. */
export function selectAll(m: MovableItems): MoveSelection {
  return { familyIds: m.families.map((f) => f.id), occasionIds: m.occasions.map((o) => o.id), ideas: m.ideas > 0 }
}

export function isEmpty(s: MoveSelection): boolean {
  return s.familyIds.length === 0 && s.occasionIds.length === 0 && !s.ideas
}

const toggle = (list: string[], id: string, on: boolean) => (on ? [...new Set([...list, id])] : list.filter((x) => x !== id))

/** The joiner's checklist: which families, holidays and ideas to bring. */
export function BringChecklist({
  movable,
  value,
  onChange,
}: {
  movable: MovableItems
  value: MoveSelection
  onChange: (s: MoveSelection) => void
}) {
  return (
    <fieldset className="bg-white border border-line rounded-2xl px-4 py-2">
      <legend className="text-sm font-medium px-1">From {movable.groupName}</legend>
      {movable.families.map((f) => (
        <Checkbox
          key={f.id}
          label={f.isOwnHousehold ? `${f.name} (your household)` : f.name}
          hint={listOf([count(f.people, 'person', 'people'), count(f.gifts, 'gift', 'gifts')])}
          checked={value.familyIds.includes(f.id)}
          onChange={(on) => onChange({ ...value, familyIds: toggle(value.familyIds, f.id, on) })}
        />
      ))}
      {movable.occasions.map((o) => (
        <Checkbox
          key={o.id}
          label={o.name}
          hint="Holiday"
          checked={value.occasionIds.includes(o.id)}
          onChange={(on) => onChange({ ...value, occasionIds: toggle(value.occasionIds, o.id, on) })}
        />
      ))}
      {movable.ideas > 0 && (
        <Checkbox
          label="Gift ideas"
          hint={count(movable.ideas, 'idea', 'ideas')!}
          checked={value.ideas}
          onChange={(on) => onChange({ ...value, ideas: on })}
        />
      )}
      <p className="text-xs text-muted pb-2">
        Gifts go with the family or person they're for. What you leave unticked stays in {movable.groupName}.
      </p>
    </fieldset>
  )
}

/** Pending requests into this group: the owner reviews them; the person who asked sees theirs. */
export function PendingMoves({ groupId }: { groupId: string }) {
  const { group } = useGroup()
  const requests = useQuery({ queryKey: ['move-requests', groupId], queryFn: () => listMoveRequests(groupId) })
  if (!requests.data?.length) return null
  const isOwner = group?.role === 'OWNER'
  return (
    <section aria-label="Waiting for approval" className="flex flex-col gap-2.5">
      {requests.data.map((r) => (
        <Card key={r.id} className="p-4 flex items-center gap-3">
          <span className="flex-1 min-w-0 flex flex-col">
            <span className="text-[15px] font-semibold">
              {isOwner ? `${r.requestedBy.name} wants to bring things in` : 'Waiting for approval'}
            </span>
            <span className="text-[13px] text-muted">
              {countsSummary(r.counts)} from {r.fromGroupName}
              {isOwner ? '' : '. The group owner reviews it first.'}
            </span>
          </span>
          <Link
            to={`/move-requests/${r.id}`}
            className="min-h-[44px] px-4 rounded-xl bg-chip text-chip-ink text-sm font-semibold flex items-center"
          >
            {isOwner ? 'Review' : 'View'}
          </Link>
        </Card>
      ))}
    </section>
  )
}

/** Settings: bring things from your own group into this one, when there's anything to bring. */
export function BringMyThings({ groupId, groupName }: { groupId: string; groupName: string }) {
  const movable = useQuery({ queryKey: ['group-movable', groupId], queryFn: () => getGroupMovable(groupId) })
  const [open, setOpen] = useState(false)
  const [selection, setSelection] = useState<MoveSelection | null>(null)
  const send = useSave(
    (s: MoveSelection) => requestMove(groupId, s),
    () => setOpen(false),
  )
  const m = movable.data?.movable
  if (!m || movable.data?.pending) return null
  const value = selection ?? selectAll(m)
  return (
    <Card className="p-4 flex items-center gap-3">
      <span className="flex-1 text-sm text-chip-ink">
        Bring families, gifts and ideas from {m.groupName} into {groupName}.
      </span>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Bring my things
      </Button>
      {open && (
        <Modal open onClose={() => setOpen(false)} title={`Bring my things into ${groupName}`}>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              send.mutate(value)
            }}
          >
            <BringChecklist movable={m} value={value} onChange={setSelection} />
            <p className="text-sm text-muted">The group's owner reviews it before anything moves.</p>
            <FormError error={send.error} />
            <Button type="submit" disabled={send.isPending || isEmpty(value)}>
              {send.isPending ? 'Sending…' : 'Ask to bring them'}
            </Button>
          </form>
        </Modal>
      )}
    </Card>
  )
}

const NEW_GROUP = '__new__'

/**
 * Settings: leave the group. You choose which families to take a copy of, with their people and
 * gift history, and which of your groups they go into. The group keeps its originals. An owner hands
 * it to someone first; an owner on their own deletes it.
 */
export function LeaveGroup({ groupId, groupName }: { groupId: string; groupName: string }) {
  const { group: membership, me, memberships, setGroupId } = useGroup()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const details = useQuery({ queryKey: ['group', groupId], queryFn: () => getGroup(groupId), enabled: open })
  const options = useQuery({ queryKey: ['leave-options', groupId], queryFn: () => getLeaveOptions(groupId), enabled: open })
  const others = (details.data?.members ?? []).filter((m) => m.userId !== me?.user.id)
  const [newOwnerId, setNewOwnerId] = useState('')
  const [confirm, setConfirm] = useState('')
  const [picked, setPicked] = useState<string[] | null>(null)
  const [destination, setDestination] = useState<string | null>(null)
  const [withIdeas, setWithIdeas] = useState(true)
  const [forgetMe, setForgetMe] = useState(false)
  const isOwner = membership?.role === 'OWNER'
  const alone = isOwner && details.data !== undefined && others.length === 0
  const families = options.data?.families ?? []
  const familyIds = picked ?? families.map((f) => f.id)
  const destinations = options.data?.destinations ?? []
  // Default: a group you own, else any other group, else a new one.
  const defaultDestination =
    (destinations.find((d) => memberships.find((m) => m.groupId === d.groupId)?.role === 'OWNER') ?? destinations[0])?.groupId ?? NEW_GROUP
  const to = destination ?? defaultDestination
  const ideas = (options.data?.ideas ?? 0) > 0 && withIdeas
  const copy =
    familyIds.length === 0 ? undefined : to === NEW_GROUP ? { familyIds, ideas, toNewGroup: true } : { familyIds, ideas, toGroupId: to }
  const leave = useSave(
    () =>
      leaveGroup(groupId, {
        ...(isOwner ? (alone ? { deleteGroup: true } : { newOwnerId: newOwnerId || others[0]?.userId }) : {}),
        ...(copy ? { copy } : {}),
        ...(!alone && forgetMe ? { forgetMe: true } : {}),
      }),
    (r) => {
      setGroupId(r.primaryGroupId)
      navigate('/')
    },
  )
  const ready = details.data !== undefined && options.data !== undefined && (!alone || confirm.trim().toLowerCase() === 'delete')

  return (
    <>
      <Button variant="ghost" className="self-start text-danger" onClick={() => setOpen(true)}>
        {isOwner ? 'Leave or delete group' : 'Leave group'}
      </Button>
      {open && (
        <Modal open onClose={() => setOpen(false)} title={alone ? `Delete ${groupName}?` : `Leave ${groupName}?`}>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              leave.mutate(undefined)
            }}
          >
            <p className="text-sm text-muted">
              {alone
                ? `You're the only one in ${groupName}, so leaving deletes it with every family, gift and idea in it. This can't be undone.`
                : `What you've added stays in ${groupName}, and you stay listed in its household so gift history keeps your name. You can be invited back.`}
            </p>

            {families.length > 0 && (
              <fieldset className="bg-white border border-line rounded-2xl px-4 py-2">
                <legend className="text-sm font-medium px-1">Take a copy of</legend>
                {families.map((f) => (
                  <Checkbox
                    key={f.id}
                    label={f.isOwnHousehold ? `${f.name} (the household's people)` : f.name}
                    hint={listOf([count(f.people, 'person', 'people'), count(f.gifts, 'gift', 'gifts')])}
                    checked={familyIds.includes(f.id)}
                    onChange={(on) => setPicked(toggle(familyIds, f.id, on))}
                  />
                ))}
                <p className="text-xs text-muted pb-2">
                  Copies include their people, birthdays and every gift for them, given and received, including ones the others logged.{' '}
                  {groupName} keeps its own. Anything that matches a family you already have is combined with it.
                </p>
              </fieldset>
            )}
            {copy && (options.data?.ideas ?? 0) > 0 && (
              <Card className="px-4 py-1">
                <Checkbox
                  label="Gift ideas for them too"
                  hint="Ideas tagged with anyone you're copying"
                  checked={withIdeas}
                  onChange={setWithIdeas}
                />
              </Card>
            )}
            {copy && (
              <Field label="Put the copies in">
                {(id) => (
                  <Select id={id} value={to} onChange={(e) => setDestination(e.target.value)}>
                    {destinations.map((d) => (
                      <option key={d.groupId} value={d.groupId}>
                        {d.groupName}
                      </option>
                    ))}
                    <option value={NEW_GROUP}>A new group of my own</option>
                  </Select>
                )}
              </Field>
            )}

            {!alone && (
              <Card className="px-4 py-1">
                <Checkbox
                  label="Remove my details"
                  checked={forgetMe}
                  onChange={setForgetMe}
                  hint={`Clears your birthday, likes, sizes and notes from ${groupName}. Your name stays on past gifts.`}
                />
              </Card>
            )}
            {isOwner && others.length > 0 && (
              <Field label="Who looks after the group now?">
                {(id) => (
                  <Select id={id} value={newOwnerId || others[0].userId} onChange={(e) => setNewOwnerId(e.target.value)}>
                    {others.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
            {alone && (
              <Field label='Type "delete" to confirm'>
                {(id) => <TextInput id={id} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />}
              </Field>
            )}
            {!copy && destinations.length === 0 && (
              <p className="text-xs text-muted">This is your only group, so you'll start a fresh one.</p>
            )}
            <FormError error={leave.error} />
            <Button type="submit" variant="danger" disabled={!ready || leave.isPending}>
              {leave.isPending ? 'Leaving…' : alone ? 'Delete group' : 'Leave group'}
            </Button>
          </form>
        </Modal>
      )}
    </>
  )
}

/** Settings: start a new, empty group of your own. */
export function StartGroup() {
  const { setGroupId } = useGroup()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const create = useSave(
    () => createGroup(name.trim() || undefined),
    (g) => {
      setGroupId(g.id)
      navigate('/')
    },
  )
  return (
    <>
      <Button variant="ghost" className="self-start" onClick={() => setOpen(true)}>
        Start a new group
      </Button>
      {open && (
        <Modal open onClose={() => setOpen(false)} title="Start a new group">
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              create.mutate(undefined)
            }}
          >
            <p className="text-sm text-muted">
              A fresh group with just your household. Your other groups stay as they are; switch between them in Settings.
            </p>
            <Field label="Name">
              {(id) => (
                <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Our family" maxLength={100} />
              )}
            </Field>
            <FormError error={create.error} />
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create group'}
            </Button>
          </form>
        </Modal>
      )}
    </>
  )
}

/** Home: things the group should know, such as someone leaving. */
export function GroupNotices({ groupId }: { groupId: string }) {
  const notices = useQuery({ queryKey: ['notices', groupId], queryFn: () => listNotices(groupId) })
  const dismiss = useSave((id: string) => dismissNotice(id))
  if (!notices.data?.length) return null
  return (
    <section aria-label="Group news" className="flex flex-col gap-2.5">
      {notices.data.map((n) => (
        <Card key={n.id} className="p-4 flex items-center gap-3">
          <span className="flex-1 text-sm text-chip-ink">{n.text}</span>
          <Button variant="ghost" aria-label="Dismiss" disabled={dismiss.isPending} onClick={() => dismiss.mutate(n.id)}>
            OK
          </Button>
        </Card>
      ))}
    </section>
  )
}
