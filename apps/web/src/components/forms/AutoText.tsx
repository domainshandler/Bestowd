import { useEffect, useId, useState, type InputHTMLAttributes } from 'react'
import { suggest } from '@bestowd/api-client'
import type { SuggestField, Suggestion } from '@bestowd/types'
import { TextInput } from '../ui.tsx'

export const DEBOUNCE_MS = 150

/** A text box that offers suggestions as you type: your group's past entries, popular ones, then common ones. */
export default function AutoText({ groupId, field, value, onChange, ...rest }: {
  groupId: string; field: SuggestField; value: string; onChange: (v: string) => void
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'list'>) {
  const listId = useId()
  const [options, setOptions] = useState<Suggestion[]>([])
  useEffect(() => {
    const q = value.trim()
    if (!q) { setOptions([]); return }
    let live = true
    const t = setTimeout(() => {
      // Suggestions are a convenience: if they fail, the field still works.
      Promise.resolve().then(() => suggest(groupId, field, q)).then((s) => { if (live) setOptions(s.filter((o) => o.value !== value)) }).catch(() => {})
    }, DEBOUNCE_MS)
    return () => { live = false; clearTimeout(t) }
  }, [groupId, field, value])
  return (
    <>
      <TextInput {...rest} value={value} onChange={(e) => onChange(e.target.value)} list={listId} autoComplete="off" />
      <datalist id={listId} data-testid={`suggestions-${field}`}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.source === 'yours' ? 'Used before' : o.source === 'popular' ? 'Popular' : ''}</option>)}
      </datalist>
    </>
  )
}
