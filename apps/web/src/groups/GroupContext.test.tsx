import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, act } from '@testing-library/react'
import { getMe } from '@bestowd/api-client'
import { GROUP_KEY, useGroup } from './GroupContext.tsx'
import { me, membership, renderApp } from '../test-utils.tsx'

vi.mock('@bestowd/api-client', () => ({ getMe: vi.fn() }))

function Probe() {
  const { groupId, multipleGroups, setGroupId } = useGroup()
  return (
    <div>
      <p data-testid="group">{groupId ?? 'none'}</p>
      <p data-testid="multi">{String(multipleGroups)}</p>
      <button onClick={() => setGroupId('g2')}>switch</button>
    </div>
  )
}

describe('GroupContext', () => {
  beforeEach(() => localStorage.clear())

  it('defaults to the primary group', async () => {
    vi.mocked(getMe).mockResolvedValue(me([membership('g2', 'Partner'), membership('g1', 'Mine')], 'g1'))
    renderApp(<Probe />)
    await waitFor(() => expect(screen.getByTestId('group').textContent).toBe('g1'))
    expect(screen.getByTestId('multi').textContent).toBe('true')
  })

  it('remembers a chosen group', async () => {
    vi.mocked(getMe).mockResolvedValue(me([membership('g1', 'Mine'), membership('g2', 'Partner')], 'g1'))
    renderApp(<Probe />)
    await waitFor(() => expect(screen.getByTestId('group').textContent).toBe('g1'))
    act(() => screen.getByText('switch').click())
    expect(screen.getByTestId('group').textContent).toBe('g2')
    expect(localStorage.getItem(GROUP_KEY)).toBe('g2')
  })

  it('falls back to the primary group when the stored group is gone', async () => {
    localStorage.setItem(GROUP_KEY, 'left-this-group')
    vi.mocked(getMe).mockResolvedValue(me([membership('g1', 'Mine')]))
    renderApp(<Probe />)
    await waitFor(() => expect(screen.getByTestId('group').textContent).toBe('g1'))
    expect(screen.getByTestId('multi').textContent).toBe('false')
  })
})
