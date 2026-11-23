import { z } from 'zod/v4'

/** What capture fills into the idea or gift form. Every field is a suggestion the user can change. */
export const ProductDraftSchema = z.object({
  title: z.string().nullable(),
  brand: z.string().nullable(),
  price: z.number().nullable(),
  /** ISO 4217, e.g. "CAD". */
  currency: z.string().nullable(),
  store: z.string().nullable(),
})
export type ProductReading = z.infer<typeof ProductDraftSchema>

export interface ProductDraft extends ProductReading {
  url: string | null
  imageUrl: string | null
}

/** Tidies what a page or a model returned: trims text, drops empty values, keeps prices sensible. */
export function cleanDraft(d: Partial<ProductDraft>): ProductDraft {
  const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
  const price =
    typeof d.price === 'number' && Number.isFinite(d.price) && d.price >= 0 && d.price < 1e8 ? Math.round(d.price * 100) / 100 : null
  const currency = typeof d.currency === 'string' && /^[A-Za-z]{3}$/.test(d.currency.trim()) ? d.currency.trim().toUpperCase() : null
  return {
    title: text(d.title, 200),
    brand: text(d.brand, 80),
    price,
    currency,
    store: text(d.store, 80),
    url: text(d.url, 2000),
    imageUrl: text(d.imageUrl, 2000),
  }
}
