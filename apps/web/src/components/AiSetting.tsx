import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAiSettings, removeAiSettings, saveAiSettings } from '@bestowd/api-client'
import type { AiProvider } from '@bestowd/types'
import { Button, Card, Field, FormError, Select, TextInput } from './ui.tsx'
import { useSave } from './forms/useSave.ts'

export const PROVIDERS: { value: AiProvider; label: string; keyHelp: string }[] = [
  { value: 'anthropic', label: 'Anthropic (Claude)', keyHelp: 'Create a key at console.anthropic.com → API keys.' },
  { value: 'openai', label: 'OpenAI', keyHelp: 'Create a key at platform.openai.com → API keys.' },
  { value: 'google', label: 'Google (Gemini)', keyHelp: 'Create a key at aistudio.google.com → Get API key.' },
]

/**
 * Settings: the AI that reads photos of items and price tags, with the owner's own API key. Every
 * "Fill in from photo" is a request billed to that key; a store link needs no AI.
 */
export default function AiSetting({ groupId, isOwner }: { groupId: string; isOwner: boolean }) {
  const ai = useQuery({ queryKey: ['ai', groupId], queryFn: () => getAiSettings(groupId) })
  const [provider, setProvider] = useState<AiProvider | null>(null)
  const [model, setModel] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [saved, setSaved] = useState(false)
  const current = provider ?? ai.data?.provider ?? 'anthropic'
  const sameProvider = current === ai.data?.provider
  const modelValue = model ?? (sameProvider ? (ai.data?.model ?? '') : '')
  const save = useSave(
    () => saveAiSettings(groupId, { provider: current, model: modelValue.trim() || null, apiKey: apiKey.trim() || null }),
    () => {
      setApiKey('')
      setSaved(true)
    },
  )
  const remove = useSave(
    () => removeAiSettings(groupId),
    () => {
      setProvider(null)
      setModel(null)
      setApiKey('')
    },
  )
  const info = PROVIDERS.find((p) => p.value === current)!

  if (!ai.data) return null
  if (!isOwner) {
    return (
      <Card className="p-4 text-sm text-chip-ink">
        {ai.data.configured
          ? `Reading photos of items uses ${PROVIDERS.find((p) => p.value === ai.data.provider)?.label}, set up by the group's owner.`
          : "Reading details from photos isn't set up. The group's owner can add an AI key here."}
      </Card>
    )
  }
  return (
    <Card className="p-4">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          setSaved(false)
          save.mutate(undefined)
        }}
      >
        <div>
          <p className="font-semibold">AI for reading photos</p>
          <p className="text-sm text-muted">
            Lets “Fill in from photo” read an item's name, brand and price from a photo or price tag. It uses your own API key, and each
            photo read is billed to it (usually around a cent). Store links work without it.
          </p>
        </div>
        <Field label="Provider">
          {(id) => (
            <Select
              id={id}
              value={current}
              onChange={(e) => {
                setProvider(e.target.value as AiProvider)
                setModel(null)
                setSaved(false)
              }}
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field
          label="Model"
          hint={
            current === 'anthropic'
              ? `Leave blank for ${ai.data.defaultModel ?? 'claude-opus-5-5'}. claude-haiku-5-5 costs less.`
              : "Required: the model name from your provider's console."
          }
        >
          {(id) => (
            <TextInput
              id={id}
              value={modelValue}
              onChange={(e) => setModel(e.target.value)}
              placeholder={current === 'anthropic' ? 'claude-opus-5-5' : ''}
              autoComplete="off"
            />
          )}
        </Field>
        <Field
          label="API key"
          hint={
            sameProvider && ai.data.keyHint
              ? `A key ending in ${ai.data.keyHint} is saved. Leave blank to keep it. ${info.keyHelp}`
              : info.keyHelp
          }
        >
          {(id) => <TextInput id={id} type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" />}
        </Field>
        <FormError error={save.error ?? remove.error} />
        <div className="flex gap-2 items-center">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save AI settings'}
          </Button>
          {ai.data.configured && (
            <Button type="button" variant="ghost" disabled={remove.isPending} onClick={() => remove.mutate(undefined)}>
              Remove key
            </Button>
          )}
          {saved && <span className="text-sm text-brand">Saved</span>}
        </div>
      </form>
    </Card>
  )
}
