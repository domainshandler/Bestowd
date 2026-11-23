import { useId, useState } from 'react'
import { photoSrc, uploadPhoto } from '@bestowd/api-client'
import { Button, FormError, Icon, Modal } from './ui.tsx'
import { shrinkPhoto } from './forms/PhotoField.tsx'
import IdeaForm from './forms/IdeaForm.tsx'
import GiftForm from './forms/GiftForm.tsx'

type Kind = 'idea' | 'given' | 'received'

/**
 * "Snap a gift": take a photo first and decide later whether it's an idea or a gift.
 * The chosen form opens with the photo and reads it when the group has AI.
 */
export default function SnapCapture({ groupId, shrink = shrinkPhoto }: { groupId: string; shrink?: (f: Blob) => Promise<Blob> }) {
  const id = useId()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [kind, setKind] = useState<Kind | null>(null)

  async function pick(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      setPhotoUrl((await uploadPhoto(groupId, await shrink(file))).url)
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }
  const done = () => {
    setKind(null)
    setPhotoUrl(null)
  }

  return (
    <section aria-label="Capture" className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className={`min-h-[64px] px-4 rounded-2xl bg-white border border-line flex items-center gap-3 cursor-pointer hover:bg-ground ${busy ? 'opacity-60' : ''}`}
      >
        <span className="w-11 h-11 rounded-full bg-brand text-white flex items-center justify-center shrink-0">
          <Icon name="camera" size={22} />
        </span>
        <span className="flex flex-col">
          <span className="text-[15px] font-semibold">{busy ? 'Uploading…' : 'Snap a gift'}</span>
          <span className="text-[13px] text-muted">Photograph it or its price tag. Save it as an idea or a gift after.</span>
        </span>
      </label>
      <input
        id={id}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        disabled={busy}
        aria-label="Snap a gift"
        onChange={(e) => {
          void pick(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <FormError error={error} />

      {photoUrl && !kind && (
        <Modal open onClose={done} title="What is it?">
          <div className="flex flex-col gap-3">
            <img
              src={photoSrc(photoUrl)}
              alt="What you snapped"
              className="w-full max-h-64 object-contain rounded-xl border border-line bg-ground"
            />
            <Button onClick={() => setKind('idea')}>A gift idea</Button>
            <Button variant="secondary" onClick={() => setKind('given')}>
              A gift I gave or bought
            </Button>
            <Button variant="secondary" onClick={() => setKind('received')}>
              A gift we received
            </Button>
          </div>
        </Modal>
      )}
      {photoUrl && kind === 'idea' && <IdeaForm open onClose={done} groupId={groupId} photoUrl={photoUrl} fromPhoto />}
      {photoUrl && (kind === 'given' || kind === 'received') && (
        <GiftForm
          open
          onClose={done}
          groupId={groupId}
          defaults={{ direction: kind === 'given' ? 'GIVEN' : 'RECEIVED', photoUrl, fromPhoto: true }}
        />
      )}
    </section>
  )
}
