import type { FamilyType } from '@bestowd/types'
import { TextInput } from '../ui.tsx'
import { FAMILY_TYPE_LABEL } from '../../lib/format.ts'

export type TypeBudgetText = Partial<Record<FamilyType, string>>

const TYPES = Object.keys(FAMILY_TYPE_LABEL) as FamilyType[]

/** Text fields from saved budgets per family type. */
export function typeBudgetText(saved: Partial<Record<FamilyType, number>>): TypeBudgetText {
  return Object.fromEntries(Object.entries(saved).map(([t, v]) => [t, String(v)]))
}

/** The budgets per family type to save: empty fields are left out (they use the occasion's budget). */
export function typeBudgetsFrom(text: TypeBudgetText): Partial<Record<FamilyType, number>> {
  return Object.fromEntries(
    Object.entries(text)
      .filter(([, v]) => v !== undefined && v.trim() !== '')
      .map(([t, v]) => [t, Number(v)]),
  )
}

/** Optional budgets by type of family (e.g. less for teachers than for close family). */
export default function FamilyTypeBudgets({ value, onChange }: { value: TypeBudgetText; onChange: (v: TypeBudgetText) => void }) {
  return (
    <details className="bg-white border border-line rounded-xl p-3" open={Object.values(value).some((v) => v)}>
      <summary className="text-sm font-medium cursor-pointer min-h-[28px]">Different budget by kind of family</summary>
      <div className="grid grid-cols-2 gap-3 mt-3">
        {TYPES.map((t) => (
          <label key={t} className="flex flex-col gap-1 text-sm">
            <span className="text-muted">{FAMILY_TYPE_LABEL[t]}</span>
            <TextInput
              type="number"
              min={0}
              step="0.01"
              aria-label={`${FAMILY_TYPE_LABEL[t]} budget`}
              value={value[t] ?? ''}
              onChange={(e) => onChange({ ...value, [t]: e.target.value })}
            />
          </label>
        ))}
      </div>
    </details>
  )
}
