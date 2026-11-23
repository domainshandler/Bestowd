import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { capturePhoto, getAiSettings, getMe, uploadPhoto } from '@bestowd/api-client'
import SnapCapture from './SnapCapture.tsx'
import { me, membership, renderApp } from '../test-utils.tsx'

vi.mock('@bestowd/api-client', () => ({
  getMe: vi.fn(),
  uploadPhoto: vi.fn(),
  photoSrc: (u: string) => `http://api${u}`,
  getAiSettings: vi.fn(),
  capturePhoto: vi.fn(),
  captureLink: vi.fn(),
  listPeople: vi.fn().mockResolvedValue([]),
  listFamilies: vi.fn().mockResolvedValue([]),
  listOccasions: vi.fn().mockResolvedValue({ occasions: [] }),
  suggest: vi.fn().mockResolvedValue([]),
  createIdea: vi.fn(),
  updateIdea: vi.fn(),
  createGift: vi.fn(),
  updateGift: vi.fn(),
}))

const snap = async () => {
  fireEvent.change(screen.getByLabelText('Snap a gift'), { target: { files: [new File(['big'], 'tag.jpg', { type: 'image/jpeg' })] } })
  return screen.findByRole('heading', { name: 'What is it?' })
}

describe('SnapCapture', () => {
  it('uploads the photo first, then opens the chosen form and reads the photo straight away', async () => {
    vi.mocked(getMe).mockResolvedValue(me([membership('g1', 'Ours')]))
    vi.mocked(uploadPhoto).mockResolvedValue({ url: '/files/g1/tag.jpg?sig=x' })
    vi.mocked(getAiSettings).mockResolvedValue({
      provider: 'anthropic',
      model: null,
      defaultModel: 'claude-opus-5-5',
      keyHint: '1234',
      configured: true,
    })
    vi.mocked(capturePhoto).mockResolvedValue({
      title: 'Forerunner 165',
      brand: 'Garmin',
      price: 329.99,
      currency: 'CAD',
      store: null,
      url: null,
      imageUrl: null,
    })
    const shrink = vi.fn(async (f: Blob) => f)
    renderApp(<SnapCapture groupId="g1" shrink={shrink} />)

    await snap()
    expect(uploadPhoto).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'A gift idea' }))
    expect(await screen.findByRole('heading', { name: 'Add an idea' })).toBeInTheDocument()
    await waitFor(() => expect(capturePhoto).toHaveBeenCalledWith('g1', '/files/g1/tag.jpg?sig=x'))
    await waitFor(() => expect(screen.getByLabelText('Idea')).toHaveValue('Forerunner 165'))
    expect(capturePhoto).toHaveBeenCalledTimes(1)
  })

  it('can log the photo as a received gift instead, and says how to turn on reading when there is no AI', async () => {
    vi.mocked(getMe).mockResolvedValue(me([membership('g1', 'Ours', 'MEMBER')]))
    vi.mocked(uploadPhoto).mockResolvedValue({ url: '/files/g1/scarf.jpg?sig=y' })
    vi.mocked(getAiSettings).mockResolvedValue({
      provider: null,
      model: null,
      defaultModel: null,
      keyHint: null,
      configured: false,
    })
    vi.mocked(capturePhoto).mockClear()
    renderApp(<SnapCapture groupId="g1" shrink={async (f) => f} />)

    await snap()
    fireEvent.click(screen.getByRole('button', { name: 'A gift we received' }))
    expect(await screen.findByRole('heading', { name: 'Log a gift' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'We received' })).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByText(/group's owner can add an AI key/)).toBeInTheDocument()
    expect(capturePhoto).not.toHaveBeenCalled()
  })
})
