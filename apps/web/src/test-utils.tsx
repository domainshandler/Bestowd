import type { ReactElement, ReactNode } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Me, Membership, Occasion, Gift, Idea } from '@bestowd/types'
import { AuthContext } from './auth/AuthContext.tsx'
import { GroupProvider } from './groups/GroupContext.tsx'

export const user = { id: 'u1', email: 'renny@example.com', name: 'Renny Sheldon', avatarUrl: null, identitySource: 'google' as const, emailVerified: true, createdAt: '2026-01-01T00:00:00.000Z' }

export function membership(groupId: string, groupName: string, role: Membership['role'] = 'OWNER'): Membership {
  return { groupId, groupName, role, memberCount: 1 }
}

export function me(memberships: Membership[], primaryGroupId = memberships[0]?.groupId ?? null): Me {
  return { user, primaryGroupId, memberships }
}

/** Renders inside query client, router, a signed-in auth context and the group provider. */
export function renderApp(ui: ReactElement, { route = '/', path = '*', token = 'tok' }: { route?: string; path?: string; token?: string | null } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={{ user: token ? user : null, token, login: async () => {}, logout: () => {} }}>
        <MemoryRouter initialEntries={[route]}>
          <GroupProvider>
            <Routes><Route path={path} element={children} /></Routes>
          </GroupProvider>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  )
  return { client, ...render(ui, { wrapper }) }
}

export function occasion(over: Partial<Occasion> = {}): Occasion {
  return {
    id: 'o1', groupId: 'g1', groupName: "Renny's group", currency: 'CAD', personId: 'p1', familyId: null, scope: 'SUBJECT', holidayKey: null, type: 'BIRTHDAY',
    name: "Maya's birthday", date: '2019-11-22T00:00:00.000Z', recursAnnually: true, recurrenceEndsAt: null,
    nextOccurrence: '2026-11-22T00:00:00.000Z', budget: null, familyTypeBudgets: {}, includeNewFamilies: true, status: 'NOT_STARTED', needsCard: false, cardDone: false,
    reminderDays: [], partyAt: null, location: null, rsvp: 'NONE', hostGiftRequest: null,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    subjectName: 'Maya', subjectFamilyId: 'f1', subjectFamilyName: 'Chen family', effectiveBudget: 40, spent: 0, overBudget: false, needsGift: true, coverage: null,
    ...over,
  }
}

export function gift(over: Partial<Gift> = {}): Gift {
  return {
    id: 'gift1', groupId: 'g1', direction: 'GIVEN', title: 'Art easel', brand: null, store: null, url: null, category: null, occasionId: null, occasionDate: null, occasionName: null,
    date: '2026-03-09T00:00:00.000Z', personId: 'p1', familyId: null, counterpartyName: 'Maya', amount: 45, status: 'GIVEN',
    valueHidden: false, hasGiftReceipt: false, returnBy: null, thankYouSent: false, thankYouDueAt: null, reaction: null,
    photoUrl: null, notes: null, ideaId: null, credits: [], createdById: 'u1', createdAt: '2026-03-09T00:00:00.000Z', updatedAt: '2026-03-09T00:00:00.000Z',
    ...over,
  }
}

export function idea(over: Partial<Idea> = {}): Idea {
  return {
    id: 'i1', groupId: 'g1', title: 'Watercolour kit', brand: null, store: null, category: 'Art', url: null, imageUrl: null, price: 35, notes: null,
    ageMin: null, ageMax: null, status: 'SAVED', occasionId: null, people: [{ id: 'p1', name: 'Maya' }], createdById: 'u1',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', repeat: null,
    ...over,
  }
}
