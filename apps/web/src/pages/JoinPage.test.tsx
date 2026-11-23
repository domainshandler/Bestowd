import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { acceptInvite, getInvite, getMe, getMovable, listFamilies } from '@bestowd/api-client'
import JoinPage from './JoinPage.tsx'
import { me, membership, renderApp } from '../test-utils.tsx'

vi.mock('@bestowd/api-client', async () => {
  class ApiError extends Error { constructor(public status: number, message: string) { super(message) } }
  return { ApiError, getMe: vi.fn(), getInvite: vi.fn(), acceptInvite: vi.fn(), listFamilies: vi.fn(), getMovable: vi.fn() }
})

const preview = { inviterName: 'Alice', groupName: "Alice's group", expiresAt: '2026-12-01T00:00:00.000Z' }

describe('JoinPage', () => {
  it('connects a family with the chosen family and fields', async () => {
    vi.mocked(getMe).mockResolvedValue(me([membership('g1', 'Mine')]))
    vi.mocked(getInvite).mockResolvedValue({ ...preview, kind: 'FAMILY', familyName: 'Chen family' })
    vi.mocked(listFamilies).mockResolvedValue([
      { id: 'other', name: 'Neighbours', isOwnHousehold: false } as never,
      { id: 'home', name: "Wei's household", isOwnHousehold: true } as never,
    ])
    vi.mocked(acceptInvite).mockResolvedValue({ connectionId: 'c1' })

    renderApp(<JoinPage />, { route: '/join/tok123', path: '/join/:token' })
    expect(await screen.findByText('Connect as Chen family on Bestowd')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Which of your families is this?')).toHaveValue('home'))
    fireEvent.click(screen.getByLabelText('Sizes'))
    fireEvent.click(screen.getByLabelText('What to avoid'))
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }))
    await waitFor(() => expect(acceptInvite).toHaveBeenCalledWith('tok123', { sourceFamilyId: 'home', sharedFields: ['birthday', 'likes', 'sizes'] }))
    expect(await screen.findByText('Connected.')).toBeInTheDocument()
  })

  it('accepts a group invite directly', async () => {
    vi.mocked(getMe).mockResolvedValue(me([membership('g1', 'Mine')]))
    vi.mocked(getInvite).mockResolvedValue({ ...preview, kind: 'GROUP', familyName: null })
    vi.mocked(getMovable).mockResolvedValue(null)
    vi.mocked(acceptInvite).mockResolvedValue({ groupId: 'g9', alreadyMember: false })
    renderApp(<JoinPage />, { route: '/join/grp', path: '/join/:token' })
    fireEvent.click(await screen.findByRole('button', { name: 'Join group' }))
    await waitFor(() => expect(acceptInvite).toHaveBeenCalledWith('grp', {}))
    expect(screen.queryByText('Bring your things along?')).not.toBeInTheDocument()
  })

  it('lets you choose what to bring, all ticked to start', async () => {
    vi.mocked(getMe).mockResolvedValue(me([membership('g1', 'Mine')]))
    vi.mocked(getInvite).mockResolvedValue({ ...preview, kind: 'GROUP', familyName: null })
    vi.mocked(getMovable).mockResolvedValue({
      groupId: 'g1', groupName: 'Mine', ideas: 2,
      families: [{ id: 'hh', name: 'My household', isOwnHousehold: true, people: 1, gifts: 2 }, { id: 'f1', name: 'Book club', isOwnHousehold: false, people: 0, gifts: 1 }],
      occasions: [{ id: 'o1', name: 'Christmas' }],
    })
    vi.mocked(acceptInvite).mockResolvedValue({ groupId: 'g9', alreadyMember: false, moveRequestId: 'm1' })
    renderApp(<JoinPage />, { route: '/join/grp', path: '/join/:token' })
    expect(await screen.findByText('Bring your things along?')).toBeInTheDocument()
    expect(screen.getByText('1 person and 2 gifts')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: /Book club/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Gift ideas/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Join group' }))
    await waitFor(() => expect(acceptInvite).toHaveBeenCalledWith('grp', { bring: { familyIds: ['hh'], occasionIds: ['o1'], ideas: false } }))
  })

  it('asks a signed-out visitor to sign in', async () => {
    vi.mocked(getInvite).mockResolvedValue({ ...preview, kind: 'GROUP', familyName: null })
    renderApp(<JoinPage />, { route: '/join/grp', path: '/join/:token', token: null })
    expect(await screen.findByRole('link', { name: 'Sign in to accept' })).toBeInTheDocument()
  })
})
