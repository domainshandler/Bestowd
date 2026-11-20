export interface BirthFields {
  birthYear: number | null
  birthMonth: number | null
  birthDay: number | null
}

/** Age in whole years on the given date, or null when the birth year isn't known. */
export function ageOn(person: BirthFields, on: Date): number | null {
  if (person.birthYear == null) return null
  let age = on.getUTCFullYear() - person.birthYear
  if (person.birthMonth != null) {
    const month = on.getUTCMonth() + 1
    const day = on.getUTCDate()
    if (month < person.birthMonth || (month === person.birthMonth && day < (person.birthDay ?? 1))) age -= 1
  }
  return Math.max(age, 0)
}
