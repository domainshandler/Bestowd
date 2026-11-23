import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { uploadPhoto } from '@bestowd/api-client'
import PhotoField, { fitWithin } from './PhotoField.tsx'

vi.mock('@bestowd/api-client', () => ({ uploadPhoto: vi.fn(), photoSrc: (u: string) => `http://api${u}` }))

describe('PhotoField', () => {
  it('shrinks to a 1600 px longest side, keeping the shape, never enlarging', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 })
    expect(fitWithin(900, 1800)).toEqual({ width: 800, height: 1600 })
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 })
  })

  it('uploads the shrunk photo and shows it', async () => {
    vi.mocked(uploadPhoto).mockResolvedValue({ url: '/files/g1/a.jpg?sig=x' })
    const small = new Blob(['jpeg'], { type: 'image/jpeg' })
    const shrink = vi.fn().mockResolvedValue(small)
    function Harness() {
      const [v, setV] = useState<string | null>(null)
      return <PhotoField groupId="g1" value={v} onChange={setV} shrink={shrink} />
    }
    render(<Harness />)
    const file = new File(['big'], 'watch.heic', { type: 'image/heic' })
    fireEvent.change(screen.getByLabelText('Take or choose a photo'), { target: { files: [file] } })
    await waitFor(() => expect(uploadPhoto).toHaveBeenCalledWith('g1', small))
    expect(shrink).toHaveBeenCalledWith(file)
    await waitFor(() => expect(document.querySelector('img')).toHaveAttribute('src', 'http://api/files/g1/a.jpg?sig=x'))
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo' }))
    expect(document.querySelector('img')).toBeNull()
  })
})
