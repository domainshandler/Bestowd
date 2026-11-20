import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from './AuthContext.tsx'
import { useAuth } from './useAuth.ts'

vi.mock('@bestowd/api-client', () => ({
  googleLogin: vi.fn().mockResolvedValue({
    token: 'test-jwt',
    user: { id: '1', email: 'alice@example.com', name: 'Alice', identitySource: 'google', emailVerified: true, createdAt: new Date().toISOString() },
  }),
  getAuthMe: vi.fn(),
}))

function TestConsumer() {
  const { user, login, logout } = useAuth()
  return (
    <div>
      <p data-testid="user">{user?.email ?? 'none'}</p>
      <button onClick={() => login('fake-token')}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts with no user', () => {
    render(<AuthProvider><MemoryRouter><TestConsumer /></MemoryRouter></AuthProvider>)
    expect(screen.getByTestId('user').textContent).toBe('none')
  })

  it('sets user and token after login', async () => {
    render(<AuthProvider><MemoryRouter><TestConsumer /></MemoryRouter></AuthProvider>)
    await act(async () => {
      screen.getByText('Login').click()
    })
    expect(screen.getByTestId('user').textContent).toBe('alice@example.com')
    expect(localStorage.getItem('bestowd_token')).toBe('test-jwt')
  })

  it('clears user and token after logout', async () => {
    render(<AuthProvider><MemoryRouter><TestConsumer /></MemoryRouter></AuthProvider>)
    await act(async () => { screen.getByText('Login').click() })
    await act(async () => { screen.getByText('Logout').click() })
    expect(screen.getByTestId('user').textContent).toBe('none')
    expect(localStorage.getItem('bestowd_token')).toBeNull()
  })
})
