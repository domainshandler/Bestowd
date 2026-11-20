import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { buyIdea, getMe, listIdeas, listOccasions, listPeople } from '@bestowd/api-client'
import IdeasPage from './IdeasPage.tsx'
import { idea, me, membership, occasion, renderApp } from '../test-utils.tsx'

vi.mock('@bestowd/api-client', () => ({ getMe: vi.fn(), listIdeas: vi.fn(), listOccasions: vi.fn(), listPeople: vi.fn(), buyIdea: vi.fn(), updateIdea: vi.fn(), createIdea: vi.fn() }))

describe('IdeasPage', () => {
  it('shows the repeat notice and marks the top pick as bought for the occasion', async () => {
    vi.mocked(getMe).mockResolvedValue(me([membership('g1', 'Mine')]))
    vi.mocked(listPeople).mockResolvedValue([{ id: 'p1', name: 'Maya', familyName: 'Chen family', age: 4 } as never])
    vi.mocked(listOccasions).mockResolvedValue({ currency: 'CAD', plannedSpend: 40, occasions: [occasion()] })
    vi.mocked(listIdeas).mockResolvedValue({
      person: { id: 'p1', name: 'Maya', age: 5 },
      ideas: [
        idea({ id: 'puzzle', title: 'Floor puzzle', category: 'Puzzle', repeat: { giftEntryId: 'x', title: '48 pc puzzle', date: '2025-12-25T00:00:00.000Z' } }),
        idea(),
      ],
    })
    vi.mocked(buyIdea).mockResolvedValue({} as never)

    renderApp(<IdeasPage />, { route: '/ideas?personId=p1' })
    expect(await screen.findByText(/Puzzle: you gave one in Dec 2025/)).toBeInTheDocument()
    expect(screen.getByText('Top pick')).toBeInTheDocument()
    expect(screen.getByText(/Turning 5/)).toBeInTheDocument()
    await waitFor(() => expect(listIdeas).toHaveBeenCalledWith('g1', { personId: 'p1', occasionId: 'o1' }))

    fireEvent.click(screen.getAllByRole('button', { name: 'Mark as bought' })[1]!)
    await waitFor(() => expect(buyIdea).toHaveBeenCalledWith('i1', { occasionId: 'o1', personId: 'p1' }))
  })
})
