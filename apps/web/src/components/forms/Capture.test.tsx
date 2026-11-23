import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { capturePhoto, getAiSettings, getMe, saveAiSettings } from '@bestowd/api-client'
import { FillFromPhoto, applyDraft } from './Capture.tsx'
import AiSetting from '../AiSetting.tsx'
import { me, membership, renderApp } from '../../test-utils.tsx'

vi.mock('@bestowd/api-client', async () => {
  class ApiError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message)
    }
  }
  return {
    ApiError,
    getMe: vi.fn(),
    getAiSettings: vi.fn(),
    saveAiSettings: vi.fn(),
    removeAiSettings: vi.fn(),
    captureLink: vi.fn(),
    capturePhoto: vi.fn(),
  }
})

const draft = {
  title: 'Forerunner 165',
  brand: 'Garmin',
  price: 329.99,
  currency: 'CAD',
  store: null,
  url: 'https://shop/w',
  imageUrl: 'https://shop/w.jpg',
}

describe('capture', () => {
  it('fills only what was found and keeps a link or photo the user already has', () => {
    const set = { title: vi.fn(), brand: vi.fn(), store: vi.fn(), price: vi.fn(), url: vi.fn(), photo: vi.fn() }
    const note = applyDraft(draft, set, { url: true, photo: false })
    expect(set.title).toHaveBeenCalledWith('Forerunner 165')
    expect(set.price).toHaveBeenCalledWith('329.99')
    expect(set.store).not.toHaveBeenCalled()
    expect(set.url).not.toHaveBeenCalled()
    expect(set.photo).toHaveBeenCalledWith('https://shop/w.jpg')
    expect(note).toBe('Filled in the name, brand, price, picture. Check before saving. Price read as 329.99 CAD.')
    expect(applyDraft({ ...draft, title: null, brand: null, price: null, imageUrl: null }, set, { url: false, photo: true })).toMatch(
      /Couldn't find/,
    )
  })

  it('offers to read an uploaded photo when the group has an AI key', async () => {
    vi.mocked(getMe).mockResolvedValue(me([membership('g1', 'Ours', 'MEMBER')]))
    vi.mocked(getAiSettings).mockResolvedValue({
      provider: 'anthropic',
      model: null,
      defaultModel: 'claude-opus-5-5',
      keyHint: '1234',
      configured: true,
    })
    vi.mocked(capturePhoto).mockResolvedValue(draft)
    const onDraft = vi.fn()
    renderApp(<FillFromPhoto groupId="g1" photoUrl="/files/g1/a.jpg?sig=x" onDraft={onDraft} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Fill in from photo' }))
    await waitFor(() => expect(onDraft).toHaveBeenCalledWith(draft))
  })

  it("tells members who can set it up when there's no key", async () => {
    vi.mocked(getMe).mockResolvedValue(me([membership('g1', 'Ours', 'MEMBER')]))
    vi.mocked(getAiSettings).mockResolvedValue({ provider: null, model: null, defaultModel: null, keyHint: null, configured: false })
    renderApp(<FillFromPhoto groupId="g1" photoUrl="/files/g1/a.jpg?sig=x" onDraft={vi.fn()} />)
    expect(await screen.findByText(/the group's owner can add an AI key/)).toBeInTheDocument()
  })

  it('lets the owner choose a provider and save a key, keeping the saved key when left blank', async () => {
    vi.mocked(getMe).mockResolvedValue(me([membership('g1', 'Ours')]))
    vi.mocked(getAiSettings).mockResolvedValue({
      provider: 'anthropic',
      model: null,
      defaultModel: 'claude-opus-5-5',
      keyHint: '1234',
      configured: true,
    })
    vi.mocked(saveAiSettings).mockResolvedValue({
      provider: 'openai',
      model: 'gpt-x',
      defaultModel: null,
      keyHint: 'abcd',
      configured: true,
    })
    renderApp(<AiSetting groupId="g1" isOwner />)
    expect(await screen.findByText(/A key ending in 1234 is saved/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'openai' } })
    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'gpt-x' } })
    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'sk-abcd' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save AI settings' }))
    await waitFor(() => expect(saveAiSettings).toHaveBeenCalledWith('g1', { provider: 'openai', model: 'gpt-x', apiKey: 'sk-abcd' }))
  })
})
