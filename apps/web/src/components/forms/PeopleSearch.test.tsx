import { describe, it, expect } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import type { PersonListItem } from '@bestowd/types'
import PeopleSearch, { findPeople } from './PeopleSearch.tsx'

const p = (id: string, name: string, familyName: string) => ({ id, name, familyName }) as PersonListItem
const people = [p('1', 'Mia', 'Smiths'), p('2', 'Amelia', 'Chen family'), p('3', 'Leo', 'Smiths'), p('4', 'Zoë', 'Park'), p('5', 'Liam', 'Park')]

describe('findPeople', () => {
  it('matches the start of a word in the name or family, ignoring case and accents', () => {
    expect(findPeople(people, 'mi', []).map((x) => x.name)).toEqual(['Mia'])
    expect(findPeople(people, 'zoe', []).map((x) => x.name)).toEqual(['Zoë'])
    expect(findPeople(people, 'SMITH', []).map((x) => x.name)).toEqual(['Leo', 'Mia'])
    expect(findPeople(people, 'park', ['4']).map((x) => x.name)).toEqual(['Liam'])
    expect(findPeople(people, '  ', [])).toEqual([])
  })
})

function Harness({ initial = [] as string[] }) {
  const [value, setValue] = useState(initial)
  return <><PeopleSearch label="For" people={people} value={value} onChange={setValue} /><output>{value.join(',')}</output></>
}

describe('PeopleSearch', () => {
  it('adds people from search results and removes chips', () => {
    render(<Harness initial={['3']} />)
    expect(screen.getByText('Leo')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('For'), { target: { value: 'pa' } })
    fireEvent.click(screen.getByRole('button', { name: /Zoë/ }))
    expect(screen.getByRole('status')).toHaveTextContent('3,4')
    expect(screen.getByLabelText('For')).toHaveValue('')

    fireEvent.change(screen.getByLabelText('For'), { target: { value: 'li' } })
    fireEvent.keyDown(screen.getByLabelText('For'), { key: 'Enter' })
    expect(screen.getByRole('status')).toHaveTextContent('3,4,5')

    fireEvent.click(screen.getByRole('button', { name: 'Remove Leo' }))
    expect(screen.getByRole('status')).toHaveTextContent('4,5')
  })

  it('says when nobody matches', () => {
    render(<Harness />)
    fireEvent.change(screen.getByLabelText('For'), { target: { value: 'xyz' } })
    expect(screen.getByText(/No one matches/)).toBeInTheDocument()
  })
})
