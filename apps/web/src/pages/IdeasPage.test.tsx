import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { buyIdea, createGift, getMe, listIdeas, listOccasions, listPeople, updateIdea } from '@bestowd/api-client'
import IdeasPage from './IdeasPage.tsx'
import { idea, me, membership, occasion, renderApp } from '../test-utils.tsx'

vi.mock('@bestowd/api-client', () => ({
  getMe: vi.fn(),
  listIdeas: vi.fn(),
  listOccasions: vi.fn(),
  listPeople: vi.fn(),
  listFamilies: vi.fn().mockResolvedValue([]),
  buyIdea: vi.fn(),
  updateIdea: vi.fn(),
  createIdea: vi.fn(),
  createGift: vi.fn(),
  updateGift: vi.fn(),
  suggest: vi.fn().mockResolvedValue([]),
  getAiSettings: vi.fn().mockResolvedValue({ configured: false }),
  photoSrc: (u: string) => u,
}))

describe('IdeasPage', () => {
  it('shows the repeat notice and marks the top pick as bought for the occasion', async () => {
    vi.mocked(getMe).mockResolvedValue(me([membership('g1', 'Mine')]))
    vi.mocked(listPeople).mockResolvedValue([{ id: 'p1', name: 'Maya', familyName: 'Chen family', age: 4 } as never])
    vi.mocked(listOccasions).mockResolvedValue({ currency: 'CAD', plannedSpend: 40, occasions: [occasion()] })
    vi.mocked(listIdeas).mockResolvedValue({
      person: { id: 'p1', name: 'Maya', age: 5 },
      ideas: [
        idea({
          id: 'puzzle',
          title: 'Floor puzzle',
          category: 'Puzzle',
          repeat: { giftEntryId: 'x', title: '48 pc puzzle', date: '2025-12-25T00:00:00.000Z' },
        }),
        idea(),
      ],
    })
    vi.mocked(buyIdea).mockResolvedValue({} as never)

    renderApp(<IdeasPage />, { route: '/ideas?personId=p1' })
    expect(await screen.findByText(/Puzzle: you gave one in Dec 2025/)).toBeInTheDocument()
    expect(screen.getByText('Top pick')).toBeInTheDocument()
    expect(screen.getByText(/Turning 5/)).toBeInTheDocument()
    await waitFor(() => expect(listIdeas).toHaveBeenCalledWith('g1', { personId: 'p1', occasionId: 'o1' }))

    fireEvent.click(screen.getAllByRole('button', { name: 'Mark as bought' })[1])
    await waitFor(() => expect(buyIdea).toHaveBeenCalledWith('i1', { occasionId: 'o1', personId: 'p1' }))
  })

  it('edits an idea and logs one with nobody tagged as a gift, starting from the idea', async () => {
    vi.mocked(getMe).mockResolvedValue(me([membership('g1', 'Mine')]))
    vi.mocked(listPeople).mockResolvedValue([{ id: 'p1', name: 'Maya', familyName: 'Chen family', age: 4 } as never])
    vi.mocked(listOccasions).mockResolvedValue({ currency: 'CAD', plannedSpend: 0, occasions: [] })
    vi.mocked(listIdeas).mockResolvedValue({
      person: null,
      ideas: [idea({ id: 'lamp', title: 'Reading lamp', brand: 'IKEA', people: [], price: 40 })],
    })
    vi.mocked(updateIdea).mockResolvedValue({} as never)
    vi.mocked(createGift).mockResolvedValue({} as never)

    renderApp(<IdeasPage />, { route: '/ideas' })
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Reading lamp' }))
    const title = await screen.findByLabelText('Idea')
    expect(title).toHaveValue('Reading lamp')
    fireEvent.change(title, { target: { value: 'Desk lamp' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save idea' }))
    await waitFor(() =>
      expect(updateIdea).toHaveBeenCalledWith('lamp', expect.objectContaining({ title: 'Desk lamp', brand: 'IKEA', personIds: [] })),
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Mark as bought' }))
    expect(buyIdea).not.toHaveBeenCalledWith('lamp', expect.anything())
    expect(await screen.findByRole('heading', { name: 'Log a gift' })).toBeInTheDocument()
    expect(screen.getByLabelText('Gift')).toHaveValue('Reading lamp')
    expect(screen.getByLabelText('Status')).toHaveValue('BOUGHT')
    fireEvent.change(screen.getByLabelText('To'), { target: { value: 'may' } })
    fireEvent.click(await screen.findByRole('button', { name: /Maya/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(createGift).toHaveBeenCalledWith(
        'g1',
        expect.objectContaining({ title: 'Reading lamp', ideaId: 'lamp', personId: 'p1', amount: 40, status: 'BOUGHT' }),
      ),
    )
  })
})
