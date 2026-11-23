import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { createGroupOccasion, getMe, getOccasion, listFamilies, listHolidays, setOccasionFamilies, updateOccasion } from '@bestowd/api-client'
import type { FamilyListItem } from '@bestowd/types'
import GroupOccasionPage from './GroupOccasionPage.tsx'
import GroupOccasionForm from '../components/forms/GroupOccasionForm.tsx'
import { me, membership, occasion, renderApp } from '../test-utils.tsx'

vi.mock('@bestowd/api-client', () => ({
  getMe: vi.fn(), getOccasion: vi.fn(), listFamilies: vi.fn(), listHolidays: vi.fn(), createGroupOccasion: vi.fn(),
  setOccasionFamilies: vi.fn(), updateOccasion: vi.fn(), deleteOccasion: vi.fn(), listPeople: vi.fn(), listOccasions: vi.fn(),
}))

const family = (id: string, name: string, type: FamilyListItem['type'] = 'FAMILY', isOwnHousehold = false) =>
  ({ id, name, type, isOwnHousehold, groupId: 'g1', status: 'ACTIVE', photoUrl: null, notes: null, memberCount: 1, onBestowd: false, nextOccasion: null }) as unknown as FamilyListItem

const christmas = occasion({
  id: 'xmas', scope: 'GROUP', holidayKey: 'christmas', personId: null, familyId: null, type: 'HOLIDAY', name: 'Christmas',
  nextOccurrence: '2026-12-25T00:00:00.000Z', budget: 50, familyTypeBudgets: { SCHOOL: 20 }, subjectName: '2 families', subjectFamilyId: null,
  effectiveBudget: 70, spent: 40,
  coverage: {
    familyCount: 2, coveredCount: 1,
    families: [
      { familyId: 'f1', name: 'Chen family', type: 'FAMILY', budgetOverride: null, budget: 50, spent: 40, covered: true, given: false },
      { familyId: 'f2', name: 'Ms Park', type: 'SCHOOL', budgetOverride: null, budget: 20, spent: 0, covered: false, given: false },
    ],
  },
})

describe('GroupOccasionPage', () => {
  it('shows progress and each family’s budget', async () => {
    vi.mocked(getMe).mockResolvedValue(me([membership('g1', 'Mine')]))
    vi.mocked(getOccasion).mockResolvedValue(christmas)
    renderApp(<GroupOccasionPage />, { route: '/occasions/xmas', path: '/occasions/:id' })
    expect(await screen.findByRole('heading', { name: 'Christmas' })).toBeInTheDocument()
    expect(screen.getByText('1 of 2')).toBeInTheDocument()
    expect(screen.getByText(/40(\.00)? of .*50/)).toBeInTheDocument()
    expect(screen.getByText('Bought')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log gift' })).toBeInTheDocument()
  })

  it('saves families, per-family budgets and type budgets', async () => {
    vi.mocked(getMe).mockResolvedValue(me([membership('g1', 'Mine')]))
    vi.mocked(getOccasion).mockResolvedValue(christmas)
    vi.mocked(listFamilies).mockResolvedValue([family('f1', 'Chen family'), family('f2', 'Ms Park', 'SCHOOL'), family('f3', 'Next door', 'NEIGHBOURS')])
    vi.mocked(updateOccasion).mockResolvedValue(christmas)
    vi.mocked(setOccasionFamilies).mockResolvedValue(christmas)
    renderApp(<GroupOccasionPage />, { route: '/occasions/xmas', path: '/occasions/:id' })
    fireEvent.click(await screen.findByRole('button', { name: 'Edit families & budgets' }))

    fireEvent.click(await screen.findByLabelText('Include Next door'))
    fireEvent.change(screen.getByLabelText('Budget for Chen family'), { target: { value: '120' } })
    fireEvent.change(screen.getByLabelText('Neighbours budget'), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(setOccasionFamilies).toHaveBeenCalledWith('xmas', [
      { familyId: 'f1', budget: 120 }, { familyId: 'f2', budget: null }, { familyId: 'f3', budget: null },
    ]))
    expect(updateOccasion).toHaveBeenCalledWith('xmas', { budget: 50, familyTypeBudgets: { SCHOOL: 20, NEIGHBOURS: 10 }, includeNewFamilies: true })
  })
})

describe('GroupOccasionForm', () => {
  it('adds a built-in holiday for the ticked families', async () => {
    vi.mocked(getMe).mockResolvedValue(me([membership('g1', 'Mine')]))
    vi.mocked(listHolidays).mockResolvedValue([
      { key: 'christmas', name: 'Christmas', note: null, nextDate: '2026-12-25T00:00:00.000Z', occasionId: 'already' },
      { key: 'diwali', name: 'Diwali', note: 'Lakshmi Puja day', nextDate: '2027-10-29T00:00:00.000Z', occasionId: null },
    ])
    vi.mocked(listFamilies).mockResolvedValue([family('f1', 'Chen family'), family('f2', 'Ms Park', 'SCHOOL')])
    vi.mocked(createGroupOccasion).mockResolvedValue(christmas)
    renderApp(<GroupOccasionForm open onClose={() => {}} groupId="g1" />)

    // Holidays the group already has aren't offered again.
    expect(await screen.findByRole('option', { name: /Diwali/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Christmas/ })).not.toBeInTheDocument()
    expect(screen.getByText('Lakshmi Puja day')).toBeInTheDocument()

    fireEvent.click(await screen.findByLabelText(/Ms Park/))
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(createGroupOccasion).toHaveBeenCalledWith('g1', {
      groupWide: true, holidayKey: 'diwali', budget: null, familyTypeBudgets: {}, includeNewFamilies: true, familyIds: ['f1'],
    }))
  })

  it('adds your own occasion', async () => {
    vi.mocked(getMe).mockResolvedValue(me([membership('g1', 'Mine')]))
    vi.mocked(listHolidays).mockResolvedValue([])
    vi.mocked(listFamilies).mockResolvedValue([family('f1', 'Chen family')])
    vi.mocked(createGroupOccasion).mockResolvedValue(christmas)
    renderApp(<GroupOccasionForm open onClose={() => {}} groupId="g1" />)
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Teacher appreciation' } })
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2027-05-04' } })
    fireEvent.change(screen.getByLabelText('Budget per family'), { target: { value: '15' } })
    await screen.findByLabelText(/Chen family/)
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(createGroupOccasion).toHaveBeenCalledWith('g1', {
      groupWide: true, type: 'HOLIDAY', name: 'Teacher appreciation', date: '2027-05-04', recursAnnually: true,
      budget: 15, familyTypeBudgets: {}, includeNewFamilies: true, familyIds: ['f1'],
    }))
  })
})
