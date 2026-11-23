import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { getMe, listGifts, updateGift } from '@bestowd/api-client'
import GiftsPage, { groupGifts } from './GiftsPage.tsx'
import { gift, me, membership, renderApp } from '../test-utils.tsx'

vi.mock('@bestowd/api-client', () => ({
  getMe: vi.fn(),
  listGifts: vi.fn(),
  updateGift: vi.fn(),
  listPeople: vi.fn(),
  listFamilies: vi.fn(),
  listOccasions: vi.fn(),
}))

const totals = { givenCount: 1, receivedCount: 1, spent: 45, receivedValue: 0, hiddenReceivedCount: 1, thankYouDueCount: 1 }

describe('GiftsPage', () => {
  beforeEach(() => {
    vi.mocked(getMe).mockResolvedValue(me([membership('g1', 'Mine')]))
    vi.mocked(listGifts).mockResolvedValue({
      currency: 'CAD',
      totals,
      gifts: [
        gift(),
        gift({
          id: 'r1',
          direction: 'RECEIVED',
          title: 'Cookie tin',
          counterpartyName: 'Chen family',
          amount: 30,
          valueHidden: true,
          status: null,
        }),
      ],
    })
  })

  it('keeps a received value hidden until "Show value" is pressed', async () => {
    vi.mocked(updateGift).mockResolvedValue(gift({ id: 'r1', direction: 'RECEIVED', valueHidden: false }))
    renderApp(<GiftsPage />)
    expect(await screen.findByText('Cookie tin')).toBeInTheDocument()
    expect(screen.queryByText('CA$30')).not.toBeInTheDocument()
    expect(screen.queryByText('$30')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Show value/ }))
    await waitFor(() => expect(updateGift).toHaveBeenCalledWith('r1', { valueHidden: false }))
  })

  it('asks for bought-but-not-given gifts under Planned', async () => {
    renderApp(<GiftsPage />)
    await screen.findByText('Art easel')
    fireEvent.click(screen.getByRole('button', { name: 'Planned' }))
    await waitFor(() => expect(listGifts).toHaveBeenLastCalledWith('g1', expect.objectContaining({ direction: 'GIVEN', status: 'BOUGHT' })))
  })

  it('groups gifts by occasion and year', () => {
    const groups = groupGifts([
      gift({ id: 'a', occasionName: 'Christmas', occasionDate: '2025-12-25T00:00:00.000Z' }),
      gift({ id: 'b', occasionName: 'Christmas', occasionDate: '2025-12-25T00:00:00.000Z' }),
      gift({ id: 'c', occasionName: null, date: '2026-02-01T00:00:00.000Z' }),
    ])
    expect(groups.map((g) => [g.title, g.gifts.length])).toEqual([
      ['Christmas · 2025', 2],
      ['Other gifts · 2026', 1],
    ])
  })
})
