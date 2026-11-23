import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { getGroup, getMe, leaveGroup, listMoveRequests } from '@bestowd/api-client'
import { LeaveGroup, PendingMoves, countsSummary } from './MoveRequests.tsx'
import { me, membership, renderApp, user } from '../test-utils.tsx'

vi.mock('@bestowd/api-client', async () => {
  class ApiError extends Error { constructor(public status: number, message: string) { super(message) } }
  return { ApiError, getMe: vi.fn(), getGroup: vi.fn(), leaveGroup: vi.fn(), listMoveRequests: vi.fn(), createGroup: vi.fn(), getGroupMovable: vi.fn(), requestMove: vi.fn() }
})

const member = (userId: string, name: string, role: 'OWNER' | 'MEMBER') => ({ userId, name, avatarUrl: null, role })

describe('move requests and leaving', () => {
  it('summarises counts', () => {
    expect(countsSummary({ families: 1, people: 0, gifts: 3, occasions: 2, ideas: 0 })).toBe('1 family, 3 gifts and 2 holidays')
  })

  it('shows the owner who wants to bring things in', async () => {
    vi.mocked(getMe).mockResolvedValue(me([membership('g1', 'Ours')]))
    vi.mocked(listMoveRequests).mockResolvedValue([{
      id: 'm1', groupId: 'g1', fromGroupName: 'Theirs', requestedBy: { userId: 'u2', name: 'Sheldon' }, status: 'PENDING',
      createdAt: '2026-11-23T00:00:00.000Z', counts: { families: 2, people: 0, gifts: 1, occasions: 0, ideas: 0 },
    }])
    renderApp(<PendingMoves groupId="g1" />)
    expect(await screen.findByText('Sheldon wants to bring things in')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Review' })).toHaveAttribute('href', '/move-requests/m1')
  })

  it('has an owner hand the group over before leaving', async () => {
    vi.mocked(getMe).mockResolvedValue(me([membership('g1', 'Ours')]))
    vi.mocked(getGroup).mockResolvedValue({ id: 'g1', members: [member(user.id, 'Me', 'OWNER'), member('u2', 'Sheldon', 'MEMBER')] } as never)
    vi.mocked(leaveGroup).mockResolvedValue({ primaryGroupId: 'g2' })
    renderApp(<LeaveGroup groupId="g1" groupName="Ours" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Leave or delete group' }))
    expect(await screen.findByLabelText('Who looks after the group now?')).toHaveValue('u2')
    fireEvent.click(screen.getByRole('button', { name: 'Leave group' }))
    await waitFor(() => expect(leaveGroup).toHaveBeenCalledWith('g1', { newOwnerId: 'u2' }))
  })

  it('asks a lone owner to confirm deleting the group', async () => {
    vi.mocked(getMe).mockResolvedValue(me([membership('g1', 'Ours')]))
    vi.mocked(getGroup).mockResolvedValue({ id: 'g1', members: [member(user.id, 'Me', 'OWNER')] } as never)
    vi.mocked(leaveGroup).mockResolvedValue({ primaryGroupId: 'g2' })
    renderApp(<LeaveGroup groupId="g1" groupName="Ours" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Leave or delete group' }))
    const button = await screen.findByRole('button', { name: 'Delete group' })
    expect(button).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Type "delete" to confirm'), { target: { value: 'Delete' } })
    fireEvent.click(button)
    await waitFor(() => expect(leaveGroup).toHaveBeenCalledWith('g1', { deleteGroup: true }))
  })
})
