import { apiFetch } from './client.js'
import { toQuery } from './query.js'
import type { SuggestField, Suggestion } from '@bestowd/types'

/** Autofill for a form field as the user types. */
export async function suggest(groupId: string, field: SuggestField, q: string): Promise<Suggestion[]> {
  return (await apiFetch<{ suggestions: Suggestion[] }>(`/groups/${groupId}/suggest${toQuery({ field, q })}`)).suggestions
}
