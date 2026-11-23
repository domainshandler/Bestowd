/**
 * Filling in an idea or gift from a store link: fetch the page and read its product data (schema.org
 * Product JSON-LD, then Open Graph tags). No AI involved.
 */
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { cleanDraft, type ProductDraft } from './draft.js'

export const MAX_PAGE_BYTES = 2 * 1024 * 1024
export class LinkError extends Error {}

/** Addresses a server must never fetch for a user: loopback, private ranges, link-local (cloud metadata). */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase()
    if (v.startsWith('::ffff:')) return isPrivateAddress(v.slice(7))
    return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')
  }
  const [a = 0, b = 0] = ip.split('.').map(Number)
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
}

async function assertPublic(url: URL): Promise<void> {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new LinkError('Use a link starting with https://')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address)
  if (addresses.length === 0) throw new LinkError("Couldn't find that website")
  if (addresses.some(isPrivateAddress)) throw new LinkError("That link isn't a public website")
}

/** Fetches a public page (following up to 3 redirects, each checked), at most MAX_PAGE_BYTES of it. */
export async function fetchPage(link: string): Promise<{ url: string; html: string }> {
  let url = new URL(link)
  for (let hop = 0; hop < 4; hop++) {
    await assertPublic(url)
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; Bestowd/1.0; product preview)', accept: 'text/html,application/xhtml+xml' },
    })
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = new URL(res.headers.get('location')!, url)
      continue
    }
    if (!res.ok) throw new LinkError(`The store's page answered ${res.status}`)
    const reader = res.body?.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    while (reader) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      chunks.push(value)
      if (size >= MAX_PAGE_BYTES) { await reader.cancel(); break }
    }
    return { url: url.toString(), html: Buffer.concat(chunks).toString('utf8') }
  }
  throw new LinkError('That link redirects too many times')
}

const decode = (s: string) => s.replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

function meta(html: string, names: string[]): string | null {
  for (const name of names) {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name.replace(/[.:]/g, '\\$&')}["'][^>]*>`, 'i')
    const tag = html.match(re)?.[0]
    const content = tag?.match(/content=["']([^"']*)["']/i)?.[1]
    if (content) return decode(content)
  }
  return null
}

/** Every schema.org object in the page's JSON-LD, flattened out of @graph and arrays. */
function jsonLd(html: string): Record<string, any>[] {
  const out: Record<string, any>[] = []
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === 'object') {
      out.push(v as Record<string, any>)
      if ('@graph' in v) walk((v as any)['@graph'])
    }
  }
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { walk(JSON.parse(m[1]!)) } catch { /* a broken block: skip it */ }
  }
  return out
}

const isType = (o: Record<string, any>, t: string) => [].concat(o['@type'] ?? []).some((x: string) => String(x).toLowerCase() === t)
const first = <T,>(v: T | T[] | undefined): T | undefined => (Array.isArray(v) ? v[0] : v)
const num = (v: unknown) => (v === undefined || v === null || v === '' ? null : Number(String(v).replace(/[^0-9.]/g, '')) || null)

/** The product a store page describes. Missing details stay null. */
export function readProductPage(html: string, pageUrl: string): ProductDraft {
  const product = jsonLd(html).find((o) => isType(o, 'product'))
  const offer = first(product?.offers) as Record<string, any> | undefined
  const priceSpec = first(offer?.priceSpecification) as Record<string, any> | undefined
  const brand = first(product?.brand) as unknown
  const image = first(product?.image) as unknown
  const site = meta(html, ['og:site_name']) ?? new URL(pageUrl).hostname.replace(/^www\./, '')
  return cleanDraft({
    title: product?.name ?? meta(html, ['og:title', 'twitter:title']) ?? decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? ''),
    brand: typeof brand === 'string' ? brand : (brand as any)?.name ?? meta(html, ['product:brand', 'og:brand']),
    price: num(offer?.price ?? offer?.lowPrice ?? priceSpec?.price) ?? num(meta(html, ['product:price:amount', 'og:price:amount'])),
    currency: offer?.priceCurrency ?? priceSpec?.priceCurrency ?? meta(html, ['product:price:currency', 'og:price:currency']),
    store: site,
    url: meta(html, ['og:url']) ?? pageUrl,
    imageUrl: typeof image === 'string' ? image : (image as any)?.url ?? meta(html, ['og:image', 'twitter:image']),
  })
}
