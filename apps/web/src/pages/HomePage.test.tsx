import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { getMe, listHomeOccasions } from '@bestowd/api-client'
import HomePage from './HomePage.tsx'
import { me, membership, occasion, renderApp } from '../test-utils.tsx'

vi.mock('@bestowd/api-client', () => ({ getMe: vi.fn(), listHomeOccasions: vi.fn(), listPeople: vi.fn(), listFamilies: vi.fn(), listOccasions: vi.fn() }))

describe('HomePage', () => {
  it('shows the summary and occasions, without group labels for a single group', async () => {
    vi.mocked(getMe).mockResolvedValue(me([membership('g1', "Renny's group")]))
    vi.mocked(listHomeOccasions).mockResolvedValue({
      occasions: [occasion(), occasion({ id: 'o2', name: 'Christmas', personId: null, familyId: 'f1', type: 'HOLIDAY', status: 'IDEA_SAVED', subjectName: 'Chen family', effectiveBudget: null })],
      plannedSpend: [{ currency: 'CAD', amount: 40 }],
      multipleGroups: false,
    })
    renderApp(<HomePage />)
    expect(await screen.findByText('2 occasions in the next 30 days')).toBeInTheDocument()
    expect(screen.getByText('1 need a gift')).toBeInTheDocument()
    expect(screen.getByText(/planned/)).toHaveTextContent('40')
    expect(screen.getByText("Maya's birthday")).toBeInTheDocument()
    expect(screen.getByText('Needs gift')).toBeInTheDocument()
    expect(screen.getByText('Idea saved')).toBeInTheDocument()
    expect(screen.queryByText(/Renny's group/)).not.toBeInTheDocument()
  })

  it('labels occasions with their group when the user is in several groups', async () => {
    vi.mocked(getMe).mockResolvedValue(me([membership('g1', "Renny's group"), membership('g2', "Sam's group", 'MEMBER')]))
    vi.mocked(listHomeOccasions).mockResolvedValue({ occasions: [occasion({ groupName: "Sam's group" })], plannedSpend: [], multipleGroups: true })
    renderApp(<HomePage />)
    expect(await screen.findByText(/Sam's group/)).toBeInTheDocument()
  })

  it('filters by occasion type', async () => {
    vi.mocked(getMe).mockResolvedValue(me([membership('g1', 'Mine')]))
    vi.mocked(listHomeOccasions).mockResolvedValue({ occasions: [], plannedSpend: [], multipleGroups: false })
    renderApp(<HomePage />)
    await screen.findByText(/Nothing in the next 30 days/)
    fireEvent.click(screen.getByRole('button', { name: 'Holidays' }))
    await waitFor(() => expect(listHomeOccasions).toHaveBeenLastCalledWith({ type: 'HOLIDAY' }))
  })
})
