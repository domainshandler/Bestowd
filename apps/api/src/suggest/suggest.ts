import { Prisma } from '@prisma/client'
import { db } from '../db.js'
import { SEED } from './seed.js'

export const SUGGEST_FIELDS = ['title', 'brand', 'store', 'category'] as const
export type SuggestField = (typeof SUGGEST_FIELDS)[number]
export type SuggestSource = 'yours' | 'popular' | 'common'
export interface Suggestion {
  value: string
  source: SuggestSource
}

export const MAX_SUGGESTIONS = 8
/** A value counts as popular once this many different groups logged it in the last POPULAR_DAYS. */
export const POPULAR_MIN_GROUPS = 5
export const POPULAR_DAYS = 90
/** How long the popular list is kept in memory before it's worked out again. */
export const POPULAR_TTL_MS = 60 * 60 * 1000

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
/** "gar" matches "Garmin" and "The Garden"; ignores case and accents. */
export function wordStarts(value: string, q: string): boolean {
  const f = fold(q)
  return (
    f.length > 0 &&
    fold(value)
      .split(/[\s'&.,/-]+/)
      .some((w) => w.startsWith(f))
  )
}

// Column names are fixed per field, so they can be put into SQL safely.
const COLUMN: Record<SuggestField, Prisma.Sql> = {
  title: Prisma.raw('"title"'),
  brand: Prisma.raw('"brand"'),
  store: Prisma.raw('"store"'),
  category: Prisma.raw('"category"'),
}

/** The group's own values for a field, most used then most recent first. */
async function yours(groupId: string, field: SuggestField, q: string): Promise<string[]> {
  const col = COLUMN[field]
  const like = `${fold(q).replace(/[\\%_]/g, '\\$&')}%`
  const rows = await db.$queryRaw<{ value: string }[]>`
    SELECT MIN(v) AS value FROM (
      SELECT ${col} AS v, "updatedAt" AS at FROM "GiftEntry" WHERE "groupId" = ${groupId} AND ${col} IS NOT NULL
      UNION ALL
      SELECT ${col} AS v, "updatedAt" AS at FROM "Idea" WHERE "groupId" = ${groupId} AND ${col} IS NOT NULL
    ) t
    WHERE lower(v) LIKE ${like} OR lower(v) LIKE ${'% ' + like}
    GROUP BY lower(v)
    ORDER BY COUNT(*) DESC, MAX(at) DESC
    LIMIT ${MAX_SUGGESTIONS * 2}`
  return rows.map((r) => r.value).filter((v) => wordStarts(v, q))
}

let popularCache: { at: number; byField: Record<SuggestField, string[]> } | null = null

/** For tests: forget the cached popular list. */
export function clearPopularCache(): void {
  popularCache = null
}

/**
 * What's popular across Bestowd: values logged by at least POPULAR_MIN_GROUPS groups recently, most
 * groups first. Only the value itself is kept, never who it was for or which groups. Cached for an hour.
 */
export async function popular(now = Date.now()): Promise<Record<SuggestField, string[]>> {
  if (popularCache && now - popularCache.at < POPULAR_TTL_MS) return popularCache.byField
  const since = new Date(now - POPULAR_DAYS * 86_400_000)
  const byField = {} as Record<SuggestField, string[]>
  for (const field of SUGGEST_FIELDS) {
    const col = COLUMN[field]
    const rows = await db.$queryRaw<{ value: string }[]>`
      SELECT MIN(v) AS value FROM (
        SELECT ${col} AS v, "groupId" AS g FROM "GiftEntry" WHERE ${col} IS NOT NULL AND "createdAt" >= ${since}
        UNION ALL
        SELECT ${col} AS v, "groupId" AS g FROM "Idea" WHERE ${col} IS NOT NULL AND "createdAt" >= ${since}
      ) t
      GROUP BY lower(v)
      HAVING COUNT(DISTINCT g) >= ${POPULAR_MIN_GROUPS}
      ORDER BY COUNT(DISTINCT g) DESC
      LIMIT 500`
    byField[field] = rows.map((r) => r.value)
  }
  popularCache = { at: now, byField }
  return byField
}

/** Suggestions for a field as the user types: theirs, then popular, then common; no repeats. */
export async function suggest(groupId: string, field: SuggestField, q: string): Promise<Suggestion[]> {
  if (!fold(q)) return []
  const out: Suggestion[] = []
  const seen = new Set<string>()
  const add = (values: string[], source: SuggestSource) => {
    for (const value of values) {
      if (out.length >= MAX_SUGGESTIONS) return
      const key = fold(value)
      if (seen.has(key) || !wordStarts(value, q)) continue
      seen.add(key)
      out.push({ value, source })
    }
  }
  add(await yours(groupId, field, q), 'yours')
  add((await popular())[field], 'popular')
  add(SEED[field], 'common')
  return out
}
