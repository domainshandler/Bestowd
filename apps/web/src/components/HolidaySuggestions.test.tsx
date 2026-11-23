import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { chooseHolidays, createGroupOccasion, dismissHoliday, getMe, listHolidays } from '@bestowd/api-client'
import type { Holiday } from '@bestowd/types'
import HolidaySuggestions, { suggestedHolidays } from './HolidaySuggestions.tsx'
import { me, membership, occasion, renderApp } from '../test-utils.tsx'

vi.mock('@bestowd/api-client', () => ({
  getMe: vi.fn(), listHolidays: vi.fn(), chooseHolidays: vi.fn(), dismissHoliday: vi.fn(), createGroupOccasion: vi.fn(),
}))

const now = new Date('2026-11-23T12:00:00Z')
const h = (key: string, name: string, nextDate: string | null, over: Partial<Holiday> = {}): Holiday =>
  ({ key, name, note: null, nextDate, occasionId: null, dismissed: false, ...over })

describe('suggestedHolidays', () => {
  it('suggests upcoming holidays the group has neither added nor dismissed', () => {
    const list = [
      h('christmas', 'Christmas', '2026-12-25T00:00:00.000Z'),
      h('hanukkah', 'Hanukkah', '2026-12-05T00:00:00.000Z', { dismissed: true }),
      h('valentines', 'Valentine’s Day', '2027-02-14T00:00:00.000Z'),
      h('easter', 'Easter', '2026-12-01T00:00:00.000Z', { occasionId: 'o1' }),
    ]
    expect(suggestedHolidays(list, now).map((x) => x.key)).toEqual(['christmas'])
  })
})

describe('HolidaySuggestions', () => {
  it('asks which holidays the group celebrates until it has answered', async () => {
    vi.mocked(getMe).mockResolvedValue(me([membership('g1', 'Mine')]))
    vi.mocked(listHolidays).mockResolvedValue({ chosen: false, holidays: [
      h('christmas', 'Christmas', '2026-12-25T00:00:00.000Z'),
      h('diwali', 'Diwali', '2027-10-29T00:00:00.000Z', { note: 'Lakshmi Puja day' }),
    ] })
    vi.mocked(chooseHolidays).mockResolvedValue({ chosen: true, holidays: [] })
    renderApp(<HolidaySuggestions groupId="g1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Choose' }))
    fireEvent.click(await screen.findByLabelText(/Christmas/))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(chooseHolidays).toHaveBeenCalledWith('g1', ['christmas']))
  })

  it('offers to track or dismiss an upcoming holiday', async () => {
    vi.mocked(getMe).mockResolvedValue(me([membership('g1', 'Mine')]))
    const soon = new Date(Date.now() + 20 * 86_400_000).toISOString()
    vi.mocked(listHolidays).mockResolvedValue({ chosen: true, holidays: [h('christmas', 'Christmas', soon), h('easter', 'Easter', soon)] })
    vi.mocked(createGroupOccasion).mockResolvedValue(occasion({ id: 'xmas', scope: 'GROUP' }))
    vi.mocked(dismissHoliday).mockResolvedValue({ chosen: true, holidays: [] })
    renderApp(<HolidaySuggestions groupId="g1" />)

    const tracks = await screen.findAllByRole('button', { name: 'Track it' })
    fireEvent.click(tracks[0]!)
    await waitFor(() => expect(createGroupOccasion).toHaveBeenCalledWith('g1', { groupWide: true, holidayKey: 'christmas' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Not for us' })[1]!)
    await waitFor(() => expect(dismissHoliday).toHaveBeenCalledWith('g1', 'easter'))
  })
})
