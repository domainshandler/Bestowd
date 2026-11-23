import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { getMe, listFamilies, listOccasions, listPeople } from '@bestowd/api-client'
import type { FamilyListItem, PersonListItem } from '@bestowd/types'
import GiftForm from './GiftForm.tsx'
import { me, membership, occasion, renderApp } from '../../test-utils.tsx'

vi.mock('@bestowd/api-client', () => ({
  getMe: vi.fn(),
  listFamilies: vi.fn(),
  listOccasions: vi.fn(),
  listPeople: vi.fn(),
  createGift: vi.fn(),
  updateGift: vi.fn(),
}))

const christmas = occasion({
  id: 'xmas',
  name: 'Christmas',
  scope: 'GROUP',
  personId: null,
  familyId: null,
  nextOccurrence: '2026-12-25T00:00:00.000Z',
})
const birthday = occasion({ id: 'bday', name: "Mia's birthday", personId: 'p1' })

function setup() {
  vi.mocked(getMe).mockResolvedValue(me([membership('g1', 'Mine')]))
  vi.mocked(listPeople).mockResolvedValue([{ id: 'p1', name: 'Mia', familyId: 'f1', familyName: 'Smiths' } as PersonListItem])
  vi.mocked(listFamilies).mockResolvedValue([{ id: 'f1', name: 'Smiths', type: 'FAMILY' } as FamilyListItem])
  vi.mocked(listOccasions).mockResolvedValue({ currency: 'CAD', occasions: [christmas, birthday], plannedSpend: 0 })
}

describe('GiftForm occasions', () => {
  it('lists the group’s occasions before anyone is chosen', async () => {
    setup()
    renderApp(<GiftForm open onClose={() => {}} groupId="g1" />)
    expect(await screen.findByRole('option', { name: /Christmas/ })).toBeInTheDocument()
    expect(screen.getByLabelText('Occasion')).not.toBeDisabled()
    expect(vi.mocked(listOccasions).mock.calls[0][1]).not.toHaveProperty('personId')
  })

  it('picking a person’s occasion fills in who it’s for', async () => {
    setup()
    renderApp(<GiftForm open onClose={() => {}} groupId="g1" />)
    await screen.findByRole('option', { name: /Mia's birthday/ })
    fireEvent.change(screen.getByLabelText('Occasion'), { target: { value: 'bday' } })
    await waitFor(() => expect(listOccasions).toHaveBeenLastCalledWith('g1', expect.objectContaining({ personId: 'p1' })))
    await waitFor(() => expect(screen.getByLabelText('Occasion')).toHaveValue('bday'))
  })

  it('keeps a prefilled family and occasion selected', async () => {
    setup()
    renderApp(<GiftForm open onClose={() => {}} groupId="g1" defaults={{ familyId: 'f1', occasionId: 'xmas' }} />)
    await screen.findByRole('option', { name: /Christmas/ })
    expect(screen.getByLabelText('Occasion')).toHaveValue('xmas')
    expect(listOccasions).toHaveBeenLastCalledWith('g1', expect.objectContaining({ familyId: 'f1' }))
  })
})
