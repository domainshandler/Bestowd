import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { acceptInvite, getInvite, getMe, getMovable, listFamilies } from '@bestowd/api-client'
import JoinPage, { movableSummary } from './JoinPage.tsx'
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
    await waitFor(() => expect(acceptInvite).toHaveBeenCalledWith('grp', { bringData: false }))
    expect(screen.queryByText(/Bring my things/)).not.toBeInTheDocument()
  })

  it('offers to bring your own things along, ticked by default', async () => {
    vi.mocked(getMe).mockResolvedValue(me([membership('g1', 'Mine')]))
    vi.mocked(getInvite).mockResolvedValue({ ...preview, kind: 'GROUP', familyName: null })
    vi.mocked(getMovable).mockResolvedValue({ groupId: 'g1', groupName: 'Mine', families: 1, people: 2, gifts: 1, ideas: 0, occasions: 0 })
    vi.mocked(acceptInvite).mockResolvedValue({ groupId: 'g9', alreadyMember: false })
    renderApp(<JoinPage />, { route: '/join/grp', path: '/join/:token' })
    expect(await screen.findByText(/1 family, 2 people and 1 gift from Mine/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Join group' }))
    await waitFor(() => expect(acceptInvite).toHaveBeenCalledWith('grp', { bringData: true }))
  })

  it('summarises what would move', () => {
    expect(movableSummary({ groupId: 'g', groupName: 'G', families: 2, people: 0, gifts: 1, ideas: 3, occasions: 1 })).toBe('2 families, 1 gift, 3 ideas and 1 occasion')
    expect(movableSummary({ groupId: 'g', groupName: 'G', families: 0, people: 1, gifts: 0, ideas: 0, occasions: 0 })).toBe('1 person')
  })

  it('asks a signed-out visitor to sign in', async () => {
    vi.mocked(getInvite).mockResolvedValue({ ...preview, kind: 'GROUP', familyName: null })
    renderApp(<JoinPage />, { route: '/join/grp', path: '/join/:token', token: null })
    expect(await screen.findByRole('link', { name: 'Sign in to accept' })).toBeInTheDocument()
  })
})
