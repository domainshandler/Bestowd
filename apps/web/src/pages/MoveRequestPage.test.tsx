import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { approveMove, cancelMove, getGroup, getMe, getMoveRequest } from '@bestowd/api-client'
import MoveRequestPage, { approveBody, initialChoices } from './MoveRequestPage.tsx'
import { me, membership, renderApp } from '../test-utils.tsx'
import type { MoveRequestDetail } from '@bestowd/types'

vi.mock('@bestowd/api-client', async () => {
  class ApiError extends Error { constructor(public status: number, message: string) { super(message) } }
  return { ApiError, getMe: vi.fn(), getGroup: vi.fn(), getMoveRequest: vi.fn(), approveMove: vi.fn(), declineMove: vi.fn(), cancelMove: vi.fn() }
})

const request = (over: Partial<MoveRequestDetail> = {}): MoveRequestDetail => ({
  id: 'm1', groupId: 'g1', fromGroupName: "Sheldon's group", requestedBy: { userId: 'u2', name: 'Sheldon' }, status: 'PENDING',
  createdAt: '2026-11-23T00:00:00.000Z', counts: { families: 2, people: 3, gifts: 2, occasions: 1, ideas: 0 }, canDecide: true,
  review: {
    currency: { from: 'USD', to: 'CAD' },
    families: [
      { id: 'hh', name: "Sheldon's household", isOwnHousehold: true, people: 1, gifts: 1, match: null },
      { id: 'f1', name: 'The Mirandas', isOwnHousehold: false, people: 2, gifts: 1, match: { id: 'x1', name: 'Miranda family' } },
    ],
    people: [{ id: 'p1', name: 'grandma', familyId: 'f1', match: { id: 'x2', name: 'Grandma' } }],
    occasions: [{ id: 'o1', name: 'Christmas', match: { id: 'x3', name: 'Christmas' }, budgetDiffers: true, theirBudget: 80, ourBudget: 50 }],
    ideas: 0,
  },
  ...over,
})

describe('MoveRequestPage', () => {
  it('builds the approval from the choices', () => {
    const c = initialChoices(request().review!)
    expect(approveBody({ ...c, families: { f1: 'KEEP_BOTH' }, budgets: { o1: 'THEIRS' } })).toEqual({
      familyIds: ['hh', 'f1'], occasionIds: ['o1'], ideas: false, keepBothFamilies: ['f1'], keepBothPeople: [], useTheirBudget: ['o1'],
    })
  })

  it('lets the owner resolve look-alikes and approve', async () => {
    vi.mocked(getMe).mockResolvedValue(me([membership('g1', 'Ours')]))
    vi.mocked(getGroup).mockResolvedValue({ id: 'g1', currency: 'CAD' } as never)
    vi.mocked(getMoveRequest).mockResolvedValue(request())
    vi.mocked(approveMove).mockResolvedValue({ status: 'APPROVED', sourceRemoved: false })
    renderApp(<MoveRequestPage />, { route: '/move-requests/m1', path: '/move-requests/:id' })

    expect(await screen.findByText(/uses USD and this group uses CAD/)).toBeInTheDocument()
    expect(screen.getByText(/3 items look like something you already have/)).toBeInTheDocument()
    fireEvent.click(within('grandma and Grandma', 'Different: keep both'))
    fireEvent.click(within('Christmas budget', /Theirs/))
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(approveMove).toHaveBeenCalledWith('m1', {
      familyIds: ['hh', 'f1'], occasionIds: ['o1'], ideas: false, keepBothFamilies: [], keepBothPeople: ['p1'], useTheirBudget: ['o1'],
    }))
  })

  it('shows the person who asked that it is waiting, and lets them withdraw it', async () => {
    vi.mocked(getMe).mockResolvedValue(me([membership('g1', 'Ours', 'MEMBER')]))
    vi.mocked(getGroup).mockResolvedValue({ id: 'g1', currency: 'CAD' } as never)
    vi.mocked(getMoveRequest).mockResolvedValue(request({ canDecide: false, review: null }))
    vi.mocked(cancelMove).mockResolvedValue({ status: 'CANCELLED' })
    renderApp(<MoveRequestPage />, { route: '/move-requests/m1', path: '/move-requests/:id' })
    expect(await screen.findByText(/Waiting for the group's owner/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw request' }))
    await waitFor(() => expect(cancelMove).toHaveBeenCalledWith('m1'))
  })
})

function within(group: string, name: string | RegExp) {
  const el = screen.getByRole('group', { name: group })
  return [...el.querySelectorAll('button')].find((b) => (typeof name === 'string' ? b.textContent === name : name.test(b.textContent ?? '')))!
}
