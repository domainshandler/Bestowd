/**
 * Reading a product from a photo with the AI the group's owner set up in Settings: Anthropic (Claude),
 * OpenAI or Google (Gemini), with the owner's own API key. Photos are sent only when someone taps
 * "Fill in from photo".
 */
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { ProductDraftSchema, type ProductReading } from './draft.js'

export const AI_PROVIDERS = ['anthropic', 'openai', 'google'] as const
export type AiProvider = (typeof AI_PROVIDERS)[number]

/** Model used when the owner leaves the model blank. OpenAI and Google need one named in Settings. */
export const DEFAULT_MODEL: Partial<Record<AiProvider, string>> = { anthropic: 'claude-opus-5-5' }

export interface AiSettings { provider: AiProvider; model: string | null; apiKey: string }
export interface Photo { base64: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' }

/** The provider turned the request down: the key, the model name, or a limit. Shown to the user. */
export class AiError extends Error {}

const PROMPT = `This photo shows a gift idea: an item, its packaging, or its price tag or shelf label in a store.
Read only what is visible. Give the product's name as a shopper would write it (no marketing text), the brand,
the price as a number, the currency as an ISO 4217 code if it can be told from the symbol or label, and the store
if its name is visible. Use null for anything you can't read with confidence; don't guess.`

const JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'brand', 'price', 'currency', 'store'],
  properties: {
    title: { type: ['string', 'null'] }, brand: { type: ['string', 'null'] }, price: { type: ['number', 'null'] },
    currency: { type: ['string', 'null'] }, store: { type: ['string', 'null'] },
  },
} as const

export function modelFor(s: Pick<AiSettings, 'provider' | 'model'>): string {
  const model = s.model?.trim() || DEFAULT_MODEL[s.provider]
  if (!model) throw new AiError('Choose a model for this AI provider in Settings')
  return model
}

async function readWithClaude(photo: Photo, s: AiSettings): Promise<ProductReading> {
  const client = new Anthropic({ apiKey: s.apiKey, timeout: 60_000, maxRetries: 1 })
  try {
    const response = await client.beta.messages.parse({
      model: modelFor(s),
      max_tokens: 16000,
      // A simple reading task: low effort keeps it fast and cheap.
      output_config: { effort: 'low', format: betaZodOutputFormat(ProductDraftSchema) },
      // If the model declines, the API retries on a suitable fallback model in the same call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: photo.mediaType, data: photo.base64 } },
          { type: 'text', text: PROMPT },
        ],
      }],
    })
    if (response.stop_reason === 'refusal' || !response.parsed_output) throw new AiError("The AI couldn't read this photo")
    return response.parsed_output
  } catch (err) {
    if (err instanceof AiError) throw err
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) throw new AiError('The Anthropic API key was rejected. Check it in Settings.')
    if (err instanceof Anthropic.NotFoundError || err instanceof Anthropic.BadRequestError) throw new AiError(`Anthropic didn't accept the request: ${err.message}`)
    if (err instanceof Anthropic.RateLimitError) throw new AiError('The Anthropic account is over its limit. Try again later.')
    if (err instanceof Anthropic.APIError) throw new AiError(`Anthropic had a problem (${err.status ?? 'network'}). Try again.`)
    throw err
  }
}

async function postJson(url: string, headers: Record<string, string>, body: unknown, provider: string): Promise<any> {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(60_000) })
  if (res.status === 401 || res.status === 403) throw new AiError(`The ${provider} API key was rejected. Check it in Settings.`)
  if (res.status === 429) throw new AiError(`The ${provider} account is over its limit. Try again later.`)
  if (!res.ok) throw new AiError(`${provider} didn't accept the request (${res.status}). Check the model name in Settings.`)
  return res.json()
}

const parseReading = (text: unknown): ProductReading => {
  try {
    return ProductDraftSchema.parse(JSON.parse(String(text)))
  } catch {
    throw new AiError("The AI couldn't read this photo")
  }
}

async function readWithOpenAi(photo: Photo, s: AiSettings): Promise<ProductReading> {
  const body = await postJson('https://api.openai.com/v1/chat/completions', { authorization: `Bearer ${s.apiKey}` }, {
    model: modelFor(s),
    response_format: { type: 'json_schema', json_schema: { name: 'product', strict: true, schema: JSON_SCHEMA } },
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: PROMPT },
        { type: 'image_url', image_url: { url: `data:${photo.mediaType};base64,${photo.base64}` } },
      ],
    }],
  }, 'OpenAI')
  return parseReading(body?.choices?.[0]?.message?.content)
}

async function readWithGemini(photo: Photo, s: AiSettings): Promise<ProductReading> {
  const model = encodeURIComponent(modelFor(s))
  const body = await postJson(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { 'x-goog-api-key': s.apiKey }, {
    contents: [{ parts: [{ inline_data: { mime_type: photo.mediaType, data: photo.base64 } }, { text: PROMPT }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: Object.fromEntries(Object.entries(JSON_SCHEMA.properties).map(([k, v]) => [k, { type: v.type[0] === 'number' ? 'NUMBER' : 'STRING', nullable: true }])),
      },
    },
  }, 'Google')
  return parseReading(body?.candidates?.[0]?.content?.parts?.[0]?.text)
}

/** Reads name, brand, price, currency and store from a photo. Throws AiError with a message for the user. */
export async function readProductPhoto(photo: Photo, settings: AiSettings): Promise<ProductReading> {
  switch (settings.provider) {
    case 'anthropic': return readWithClaude(photo, settings)
    case 'openai': return readWithOpenAi(photo, settings)
    case 'google': return readWithGemini(photo, settings)
  }
}
