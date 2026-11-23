import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { createGroupOccasion, listFamilies, listHolidays } from '@bestowd/api-client'
import { Button, Checkbox, Field, FormError, Modal, Select, TextInput } from '../ui.tsx'
import { FAMILY_TYPE_LABEL, formatDate } from '../../lib/format.ts'
import { numberOrNull, useSave } from './useSave.ts'
import FamilyTypeBudgets, { type TypeBudgetText, typeBudgetsFrom } from './FamilyTypeBudgets.tsx'

const CUSTOM = ''

/** Adds a group-wide occasion: a built-in holiday or your own, covering the families you tick. */
export default function GroupOccasionForm({ open, onClose, groupId }: { open: boolean; onClose: () => void; groupId: string }) {
  const navigate = useNavigate()
  const holidays = useQuery({ queryKey: ['holidays', groupId], queryFn: () => listHolidays(groupId) })
  const families = useQuery({ queryKey: ['families', groupId, 'ACTIVE'], queryFn: () => listFamilies(groupId) })

  const [holidayKey, setHolidayKey] = useState<string>(CUSTOM)
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [recurs, setRecurs] = useState(true)
  const [budget, setBudget] = useState('')
  const [typeBudgets, setTypeBudgets] = useState<TypeBudgetText>({})
  const [picked, setPicked] = useState<Set<string> | null>(null)
  const [includeNew, setIncludeNew] = useState(true)

  // Every family is ticked until the user changes the selection.
  useEffect(() => {
    if (families.data && picked === null) setPicked(new Set(families.data.map((f) => f.id)))
  }, [families.data, picked])

  const available = holidays.data?.holidays.filter((h) => h.occasionId === null && h.nextDate !== null) ?? []
  // Start on the first holiday the group hasn't added yet (else your own occasion).
  const [touched, setTouched] = useState(false)
  const firstAvailable = available[0]?.key
  useEffect(() => {
    if (!touched && firstAvailable) setHolidayKey(firstAvailable)
  }, [touched, firstAvailable])
  const chosen = holidays.data?.holidays.find((h) => h.key === holidayKey)
  const custom = holidayKey === CUSTOM

  const save = useSave(
    () => {
      const shared = {
        budget: numberOrNull(budget),
        familyTypeBudgets: typeBudgetsFrom(typeBudgets),
        includeNewFamilies: includeNew,
        familyIds: [...(picked ?? [])],
      }
      return custom
        ? createGroupOccasion(groupId, { groupWide: true, type: 'HOLIDAY', name: name.trim(), date, recursAnnually: recurs, ...shared })
        : createGroupOccasion(groupId, { groupWide: true, holidayKey, ...shared })
    },
    (created) => {
      onClose()
      navigate(`/occasions/${created.id}`)
    },
  )
  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate(undefined)
  }

  const toggle = (id: string, on: boolean) =>
    setPicked((s) => {
      const next = new Set(s)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  return (
    <Modal open={open} onClose={onClose} title="Add a group occasion">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Occasion" hint={chosen?.note ?? undefined}>
          {(id) => (
            <Select
              id={id}
              value={holidayKey}
              onChange={(e) => {
                setTouched(true)
                setHolidayKey(e.target.value)
              }}
            >
              {available.map((h) => (
                <option key={h.key} value={h.key}>
                  {h.name} · {formatDate(h.nextDate)}
                </option>
              ))}
              <option value={CUSTOM}>Your own occasion…</option>
            </Select>
          )}
        </Field>
        {custom && (
          <>
            <Field label="Name">
              {(id) => (
                <TextInput
                  id={id}
                  required
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Teacher appreciation"
                />
              )}
            </Field>
            <Field label="Date">
              {(id) => <TextInput id={id} type="date" required value={date} onChange={(e) => setDate(e.target.value)} />}
            </Field>
            <Checkbox label="Every year" checked={recurs} onChange={setRecurs} />
          </>
        )}

        <Field label="Budget per family" hint="Leave empty to use your group's Holiday default">
          {(id) => <TextInput id={id} type="number" min={0} step="0.01" value={budget} onChange={(e) => setBudget(e.target.value)} />}
        </Field>
        <FamilyTypeBudgets value={typeBudgets} onChange={setTypeBudgets} />

        <fieldset className="bg-white border border-line rounded-2xl px-4 py-2">
          <legend className="text-sm font-medium px-1">Families</legend>
          {families.data?.map((f) => (
            <Checkbox
              key={f.id}
              label={f.name}
              hint={f.isOwnHousehold ? 'Your household' : FAMILY_TYPE_LABEL[f.type]}
              checked={picked?.has(f.id) ?? true}
              onChange={(on) => toggle(f.id, on)}
            />
          ))}
          <Checkbox label="Include families added later" checked={includeNew} onChange={setIncludeNew} />
        </fieldset>

        <FormError error={save.error} />
        <Button type="submit" disabled={(custom && (!name.trim() || !date)) || save.isPending}>
          {save.isPending ? 'Adding…' : 'Add'}
        </Button>
      </form>
    </Modal>
  )
}
