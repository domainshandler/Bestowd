import { useId, useState } from 'react'
import { photoSrc, uploadPhoto } from '@bestowd/api-client'
import { Button, FormError, Icon } from '../ui.tsx'

/** Longest side of an uploaded photo, in pixels. */
export const MAX_SIDE = 1600

/** The size a photo is shrunk to so its longest side is at most `max`, keeping its shape. */
export function fitWithin(width: number, height: number, max = MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

/** Re-encodes a photo as a JPEG no larger than MAX_SIDE. Re-encoding also drops its metadata, including location. */
export async function shrinkPhoto(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = fitWithin(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't read that photo"))), 'image/jpeg', 0.85))
}

/** A photo on an idea or gift: take one with the camera (on a phone) or pick a file. */
export default function PhotoField({ groupId, value, onChange, label = 'Photo', shrink = shrinkPhoto }: {
  groupId: string; value: string | null; onChange: (url: string | null) => void; label?: string; shrink?: (f: Blob) => Promise<Blob>
}) {
  const id = useId()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  async function pick(file: File | undefined) {
    if (!file) return
    setBusy(true); setError(null)
    try {
      const { url } = await uploadPhoto(groupId, await shrink(file))
      onChange(url)
    } catch (e) { setError(e) } finally { setBusy(false) }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      {value && (
        <div className="flex items-center gap-3">
          <img src={photoSrc(value)} alt="" className="w-20 h-20 rounded-xl object-cover border border-line" />
          <Button type="button" variant="ghost" onClick={() => onChange(null)}>Remove photo</Button>
        </div>
      )}
      <label htmlFor={id} className={`min-h-[44px] px-4 rounded-xl border border-dashed border-line text-sm font-semibold text-brand flex items-center justify-center gap-2 cursor-pointer ${busy ? 'opacity-50' : ''}`}>
        <Icon name="plus" size={16} /> {busy ? 'Uploading…' : value ? 'Replace photo' : 'Take or choose a photo'}
      </label>
      <input id={id} type="file" accept="image/*" className="sr-only" disabled={busy} aria-label={value ? 'Replace photo' : 'Take or choose a photo'}
        onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = '' }} />
      <FormError error={error} />
    </div>
  )
}
