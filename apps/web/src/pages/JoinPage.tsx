import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, acceptInvite, getInvite, getMovable, listFamilies } from '@bestowd/api-client'
import type { MoveSelection, ShareableField } from '@bestowd/types'
import { BringChecklist, isEmpty, selectAll } from '../components/MoveRequests.tsx'
import { useAuth } from '../auth/useAuth.ts'
import { useGroup } from '../groups/GroupContext.tsx'
import { Button, Card, Checkbox, Field, FormError, Loading, Select } from '../components/ui.tsx'

const FIELDS: { field: ShareableField; label: string }[] = [
  { field: 'birthday', label: 'Birthdays' },
  { field: 'likes', label: 'What they love' },
  { field: 'avoid', label: 'What to avoid' },
  { field: 'sizes', label: 'Sizes' },
  { field: 'foodNotes', label: 'Food notes' },
  { field: 'photo', label: 'Photos' },
]
const DEFAULT_FIELDS: ShareableField[] = ['birthday', 'likes', 'avoid']

/** On a phone, offer to open the invite in the Bestowd app (it handles bestowd://join/<token>). */
const ON_PHONE = typeof navigator !== 'undefined' && /Android|iPhone|iPad/i.test(navigator.userAgent)

export default function JoinPage() {
  const { token: inviteToken = '' } = useParams()
  const { token } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { memberships, setGroupId } = useGroup()
  const preview = useQuery({ queryKey: ['invite', inviteToken], queryFn: () => getInvite(inviteToken), retry: false })

  const [sourceGroupId, setSourceGroupId] = useState('')
  const [sourceFamilyId, setSourceFamilyId] = useState('')
  const [fields, setFields] = useState<ShareableField[]>(DEFAULT_FIELDS)
  const [bringChoice, setBringChoice] = useState<MoveSelection | null>(null)
  const movable = useQuery({
    queryKey: ['invite-movable', inviteToken],
    queryFn: () => getMovable(inviteToken),
    enabled: Boolean(token && preview.data?.kind === 'GROUP'),
    retry: false,
  })
  useEffect(() => {
    if (!sourceGroupId && memberships[0]) setSourceGroupId(memberships[0].groupId)
  }, [memberships, sourceGroupId])
  const families = useQuery({
    queryKey: ['families', sourceGroupId],
    queryFn: () => listFamilies(sourceGroupId),
    enabled: Boolean(token && sourceGroupId && preview.data?.kind === 'FAMILY'),
  })
  useEffect(() => {
    const own = families.data?.find((f) => f.isOwnHousehold) ?? families.data?.[0]
    if (own) setSourceFamilyId(own.id)
  }, [families.data])

  const accept = useMutation({
    mutationFn: () =>
      acceptInvite(
        inviteToken,
        preview.data?.kind === 'FAMILY' ? { sourceFamilyId, sharedFields: fields } : bring && !isEmpty(bring) ? { bring } : {},
      ),
    onSuccess: async (result) => {
      await qc.invalidateQueries()
      if ('groupId' in result) {
        setGroupId(result.groupId)
        navigate('/')
      }
    },
  })

  const bring = movable.data ? (bringChoice ?? selectAll(movable.data)) : null

  if (preview.isLoading)
    return (
      <Centered>
        <Loading />
      </Centered>
    )
  if (preview.isError) {
    const gone = preview.error instanceof ApiError && preview.error.status === 410
    return (
      <Centered>
        <h1 className="text-2xl font-bold">{gone ? 'This link has been used or has expired' : 'Invite not found'}</h1>
        <p className="text-muted text-sm">Ask whoever sent it for a new link.</p>
        <Link to="/">Go to Bestowd</Link>
      </Centered>
    )
  }
  const p = preview.data!
  const isFamily = p.kind === 'FAMILY'

  return (
    <Centered>
      <p className="text-sm text-muted">{p.inviterName} invited you</p>
      <h1 className="text-2xl font-bold">{isFamily ? `Connect as ${p.familyName} on Bestowd` : `Join ${p.groupName}`}</h1>
      <p className="text-sm text-muted">
        {isFamily
          ? `${p.inviterName} will see the details you choose below, read-only. Nothing else in your account is shared.`
          : `You'll see and add to everything in ${p.groupName}: families, gifts and ideas, and you'll be in its household.`}
      </p>

      {ON_PHONE && (
        <a
          href={`bestowd://join/${inviteToken}`}
          className="min-h-[44px] px-4 rounded-xl bg-brand text-white text-sm font-semibold flex items-center justify-center"
        >
          Open in the Bestowd app
        </a>
      )}

      {!token ? (
        <Link
          to="/login"
          state={{ from: `/join/${inviteToken}` }}
          className="min-h-[44px] px-4 rounded-xl bg-brand text-white text-sm font-semibold flex items-center justify-center"
        >
          Sign in to accept
        </Link>
      ) : accept.isSuccess && isFamily ? (
        <Card className="p-4 flex flex-col gap-2">
          <p className="font-semibold">Connected.</p>
          <p className="text-sm text-muted">{p.inviterName} can now see what you shared. You can disconnect from the family's settings.</p>
          <Link to="/">Go to Home</Link>
        </Card>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            accept.mutate()
          }}
        >
          {isFamily && (
            <>
              {memberships.length > 1 && (
                <Field label="From group">
                  {(id) => (
                    <Select
                      id={id}
                      value={sourceGroupId}
                      onChange={(e) => {
                        setSourceGroupId(e.target.value)
                        setSourceFamilyId('')
                      }}
                    >
                      {memberships.map((m) => (
                        <option key={m.groupId} value={m.groupId}>
                          {m.groupName}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              )}
              <Field label="Which of your families is this?">
                {(id) => (
                  <Select id={id} required value={sourceFamilyId} onChange={(e) => setSourceFamilyId(e.target.value)}>
                    {families.data?.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                        {f.isOwnHousehold ? ' (your household)' : ''}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <fieldset className="bg-white border border-line rounded-2xl px-4 py-2">
                <legend className="text-sm font-medium px-1">Share</legend>
                {FIELDS.map(({ field, label }) => (
                  <Checkbox
                    key={field}
                    label={label}
                    checked={fields.includes(field)}
                    onChange={(on) => setFields((f) => (on ? [...f, field] : f.filter((x) => x !== field)))}
                  />
                ))}
                <p className="text-xs text-muted pb-2">Names are always shared.</p>
              </fieldset>
            </>
          )}
          {!isFamily && movable.data && bring && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold">Bring your things along?</p>
              <BringChecklist movable={movable.data} value={bring} onChange={setBringChoice} />
              <p className="text-xs text-muted">
                {p.groupName}'s owner reviews what you bring before it's added. Anything that looks like what they already have, they can
                combine. Once everything has moved, {movable.data.groupName} is removed.
              </p>
            </div>
          )}
          <FormError error={accept.error} />
          <Button type="submit" disabled={accept.isPending || (isFamily && !sourceFamilyId)}>
            {accept.isPending ? 'Accepting…' : isFamily ? 'Connect' : 'Join group'}
          </Button>
        </form>
      )}
    </Centered>
  )
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-start sm:items-center justify-center px-5 py-10">
      <div className="w-full max-w-md flex flex-col gap-4">
        <span className="font-display text-xl font-bold text-brand">Bestowd</span>
        {children}
      </div>
    </div>
  )
}
