import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { captureLink, capturePhoto, getAiSettings } from '@bestowd/api-client'
import type { ProductDraft } from '@bestowd/types'
import { Button, FormError } from '../ui.tsx'
import { useGroup } from '../../groups/GroupContext.tsx'

/** The form fields capture can fill. Each setter is called only when the draft has a value for it. */
export interface DraftTargets {
  title: (v: string) => void
  brand: (v: string) => void
  store: (v: string) => void
  price: (v: string) => void
  url?: (v: string) => void
  photo?: (v: string) => void
}

/** Fills what the draft found and leaves everything else as the user typed it. Returns a note for the user. */
export function applyDraft(d: ProductDraft, t: DraftTargets, has: { url: boolean; photo: boolean }): string {
  const filled: string[] = []
  if (d.title) { t.title(d.title); filled.push('name') }
  if (d.brand) { t.brand(d.brand); filled.push('brand') }
  if (d.store) { t.store(d.store); filled.push('store') }
  if (d.price !== null) { t.price(String(d.price)); filled.push('price') }
  if (d.url && !has.url && t.url) t.url(d.url)
  if (d.imageUrl && !has.photo && t.photo) { t.photo(d.imageUrl); filled.push('picture') }
  if (filled.length === 0) return "Couldn't find any details. Fill them in yourself."
  const price = d.price !== null && d.currency ? ` Price read as ${d.price} ${d.currency}.` : ''
  return `Filled in the ${filled.join(', ')}. Check before saving.${price}`
}

/** "Fill in from link" beside a product link field: reads the store page. */
export function FillFromLink({ groupId, url, onDraft }: { groupId: string; url: string; onDraft: (d: ProductDraft) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const ok = /^https?:\/\/\S+\.\S+/.test(url.trim())
  async function run() {
    setBusy(true); setError(null)
    try { onDraft(await captureLink(groupId, url.trim())) } catch (e) { setError(e) } finally { setBusy(false) }
  }
  return (
    <div className="flex flex-col gap-1">
      <Button type="button" variant="secondary" className="self-start" disabled={!ok || busy} onClick={() => void run()}>
        {busy ? 'Reading the page…' : 'Fill in from link'}
      </Button>
      <FormError error={error} />
    </div>
  )
}

/**
 * "Fill in from photo" once a photo is attached: the group's AI reads the item or price tag.
 * With auto (a form opened from a snapped photo), it reads the photo straight away, once.
 */
export function FillFromPhoto({ groupId, photoUrl, onDraft, auto = false }: { groupId: string; photoUrl: string | null; onDraft: (d: ProductDraft) => void; auto?: boolean }) {
  const { group } = useGroup()
  const ai = useQuery({ queryKey: ['ai', groupId], queryFn: () => getAiSettings(groupId) })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const autoRan = useRef(false)
  const readable = Boolean(photoUrl?.startsWith('/files/') && ai.data?.configured)
  useEffect(() => {
    if (!auto || autoRan.current || !readable) return
    autoRan.current = true
    void run()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, readable])
  if (!photoUrl?.startsWith('/files/') || !ai.data) return null
  if (!ai.data.configured) {
    return (
      <p className="text-xs text-muted">
        {group?.role === 'OWNER' ? 'To read details from photos, add an AI key under Settings.' : "To read details from photos, the group's owner can add an AI key in Settings."}
      </p>
    )
  }
  async function run() {
    setBusy(true); setError(null)
    try { onDraft(await capturePhoto(groupId, photoUrl!)) } catch (e) { setError(e) } finally { setBusy(false) }
  }
  return (
    <div className="flex flex-col gap-1">
      <Button type="button" variant="secondary" className="self-start" disabled={busy} onClick={() => void run()}>
        {busy ? 'Reading the photo…' : 'Fill in from photo'}
      </Button>
      <FormError error={error} />
    </div>
  )
}
