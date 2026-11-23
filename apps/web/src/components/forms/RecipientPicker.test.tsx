import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { createFamily, createPerson, getMe, listFamilies, listPeople } from '@bestowd/api-client'
import type { FamilyListItem, PersonListItem } from '@bestowd/types'
import RecipientPicker, { findRecipients, type Recipient } from './RecipientPicker.tsx'
import { me, membership, renderApp } from '../../test-utils.tsx'

vi.mock('@bestowd/api-client', async () => {
  class ApiError extends Error { constructor(public status: number, message: string) { super(message) } }
  return { ApiError, getMe: vi.fn(), listPeople: vi.fn(), listFamilies: vi.fn(), createFamily: vi.fn(), createPerson: vi.fn() }
})

const p = (id: string, name: string, familyName: string) => ({ id, name, familyName }) as PersonListItem
const f = (id: string, name: string, isOwnHousehold = false) => ({ id, name, isOwnHousehold }) as FamilyListItem
const people = [p('1', 'Mia', 'Smiths'), p('2', 'Amelia', 'Chen family'), p('3', 'Leo', 'Smiths'), p('4', 'Zoë', 'Park'), p('5', 'Liam', 'Park')]
const families = [f('h', 'Our household', true), f('s', 'Smiths'), f('k', 'Park')]

describe('findRecipients', () => {
  it('matches the start of a word, ignoring case and accents, with families when asked', () => {
    expect(findRecipients(people, families, 'mi', [], 'people').map((x) => x.name)).toEqual(['Mia'])
    expect(findRecipients(people, families, 'zoe', [], 'people').map((x) => x.name)).toEqual(['Zoë'])
    expect(findRecipients(people, families, 'smith', [], 'both').map((x) => `${x.kind}:${x.name}`)).toEqual(['family:Smiths', 'person:Leo', 'person:Mia'])
    expect(findRecipients(people, families, 'park', [{ kind: 'person', id: '4' }], 'people').map((x) => x.name)).toEqual(['Liam'])
    expect(findRecipients(people, families, '  ', [], 'both')).toEqual([])
  })
})

function Harness({ single = false, include = 'people' as 'people' | 'both' }) {
  const [value, setValue] = useState<Recipient[]>([])
  return (
    <>
      <RecipientPicker groupId="g1" label="For" value={value} onChange={setValue} single={single} include={include} />
      <output data-testid="value">{value.map((v) => `${v.kind}:${v.id}`).join(',')}</output>
    </>
  )
}

function setup() {
  vi.mocked(getMe).mockResolvedValue(me([membership('g1', 'Ours')]))
  vi.mocked(listPeople).mockResolvedValue(people)
  vi.mocked(listFamilies).mockResolvedValue(families)
}

describe('RecipientPicker', () => {
  it('narrows as you type and adds chosen people as chips', async () => {
    setup()
    renderApp(<Harness />)
    fireEvent.change(await screen.findByLabelText('For'), { target: { value: 'li' } })
    fireEvent.click(await screen.findByRole('button', { name: /^Liam/ }))
    expect(screen.getByTestId('value')).toHaveTextContent('person:5')
    expect(screen.getByRole('button', { name: 'Remove Liam' })).toBeInTheDocument()
  })

  it('with single, a family can be chosen and replaces the input', async () => {
    setup()
    renderApp(<Harness single include="both" />)
    fireEvent.change(await screen.findByLabelText('For'), { target: { value: 'park' } })
    fireEvent.click(await screen.findByRole('button', { name: /^Park · Whole family/ }))
    expect(screen.getByTestId('value')).toHaveTextContent('family:k')
    expect(screen.queryByLabelText('For')).not.toBeInTheDocument()
  })

  it('adds someone new in a new family', async () => {
    setup()
    vi.mocked(createFamily).mockResolvedValue({ id: 'nf' } as never)
    vi.mocked(createPerson).mockResolvedValue({ id: 'np' } as never)
    renderApp(<Harness />)
    fireEvent.change(await screen.findByLabelText('For'), { target: { value: 'Nora' } })
    fireEvent.click(await screen.findByRole('button', { name: /Add “Nora”/ }))
    fireEvent.change(screen.getByLabelText('New family name'), { target: { value: 'Nora’s family' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(screen.getByTestId('value')).toHaveTextContent('person:np'))
    expect(createFamily).toHaveBeenCalledWith('g1', { name: 'Nora’s family', type: 'FAMILY' })
    expect(createPerson).toHaveBeenCalledWith('nf', { name: 'Nora' })
  })
})
