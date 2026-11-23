import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { createInvite } from '@bestowd/api-client'
import type { InviteKind } from '@bestowd/types'
import { Button, FormError, Modal, TextInput } from '../ui.tsx'
import { formatDate } from '../../lib/format.ts'

/** Creates an invite link when opened and offers copy / share. */
export default function InviteLinkModal({
  open,
  onClose,
  groupId,
  kind,
  familyId,
  familyName,
}: {
  open: boolean
  onClose: () => void
  groupId: string
  kind: InviteKind
  familyId?: string
  familyName?: string
}) {
  const [copied, setCopied] = useState(false)
  const invite = useMutation({ mutationFn: () => createInvite(groupId, { kind, familyId: familyId ?? null }) })
  const { mutate, reset } = invite
  useEffect(() => {
    if (open) mutate()
    else {
      reset()
      setCopied(false)
    }
  }, [open, mutate, reset])

  const url = invite.data?.url ?? ''
  const text =
    kind === 'FAMILY'
      ? `Connect ${familyName ?? 'your family'} on Bestowd so we can keep gifts in step: ${url}`
      : `Join my group on Bestowd so we can plan gifts together: ${url}`

  const share = async () => {
    if (navigator.share) {
      await navigator.share({ text }).catch(() => undefined)
    } else {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={kind === 'FAMILY' ? `Invite ${familyName ?? 'family'} to connect` : 'Invite to your group'}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          {kind === 'FAMILY'
            ? 'Send this link by WhatsApp or text. When they accept, they choose what to share, and you see it here.'
            : 'Anyone who accepts sees everything in this group: families, gifts and ideas.'}
        </p>
        {invite.isPending && <p className="text-sm text-muted">Creating link…</p>}
        <FormError error={invite.error} />
        {url && (
          <>
            <TextInput readOnly aria-label="Invite link" value={url} onFocus={(e) => e.currentTarget.select()} />
            <p className="text-xs text-muted">
              Works once, until {formatDate(invite.data!.expiresAt, { month: 'short', day: 'numeric', year: 'numeric' })}.
            </p>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={share}>
                Share link
              </Button>
              <Button
                variant="secondary"
                onClick={async () => {
                  await navigator.clipboard.writeText(url)
                  setCopied(true)
                }}
              >
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
