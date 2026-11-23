import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { suggest } from '@bestowd/api-client'
import AutoText from './AutoText.tsx'

vi.mock('@bestowd/api-client', () => ({ suggest: vi.fn() }))

describe('AutoText', () => {
  it('offers suggestions for what is typed, after a short pause', async () => {
    vi.mocked(suggest).mockResolvedValue([{ value: 'Garmin', source: 'yours' }, { value: 'Gap', source: 'common' }])
    function Harness() {
      const [v, setV] = useState('')
      return <AutoText aria-label="Brand" groupId="g1" field="brand" value={v} onChange={setV} />
    }
    render(<Harness />)
    fireEvent.change(screen.getByLabelText('Brand'), { target: { value: 'ga' } })
    await waitFor(() => expect(suggest).toHaveBeenCalledWith('g1', 'brand', 'ga'))
    await waitFor(() => expect(screen.getByTestId('suggestions-brand').querySelectorAll('option')).toHaveLength(2))
    expect(screen.getByTestId('suggestions-brand').querySelector('option')).toHaveAttribute('value', 'Garmin')
  })
})
