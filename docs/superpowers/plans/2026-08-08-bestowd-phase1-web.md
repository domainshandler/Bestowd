# Bestowd Phase 1 — React Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Bestowd React web app with Google Sign-In, protected routing, and core screens for contacts, events, gifts, assignments, and account settings.

**Architecture:** Vite + React 18 + TypeScript in `apps/web`. Shared API types from `@bestowd/types`. Fetch wrapper from `packages/api-client`. React Router v6 for routing. TanStack Query for server state. Tailwind CSS for styling. Google Identity Services (`@react-oauth/google`) for Sign-In. JWT stored in `localStorage`.

**Prerequisites:** The API plan (`2026-08-08-bestowd-phase1-api.md`) must be completed and the API must be running locally on port 3000.

**Tech Stack:** React 18, TypeScript 5.4, Vite 5, Tailwind CSS 3, React Router 6, TanStack Query 5, @react-oauth/google, Vitest, React Testing Library, pnpm 9.

## Global Constraints

- TypeScript strict mode
- All API calls go through `@bestowd/api-client` — no raw fetch in components
- JWT stored in `localStorage` under key `bestowd_token`
- Unauthenticated users are redirected to `/login`
- All monetary values displayed with 2 decimal places and currency symbol
- Tailwind for all styling — no inline styles, no CSS modules

---

## File Map

```
packages/api-client/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts          ← re-exports all client functions
    ├── client.ts         ← base fetch with JWT injection and error handling
    ├── auth.ts           ← googleLogin(), getMe()
    ├── contacts.ts       ← listContacts(), createContact(), updateContact(), deleteContact(), claimContact()
    ├── connections.ts    ← listConnections(), createConnection(), updateConnection()
    ├── events.ts         ← listEvents(), createEvent(), updateEvent(), deleteEvent()
    ├── gifts.ts          ← listGifts(), createGift(), updateGift(), deleteGift()
    ├── listings.ts       ← listListings(), createListing(), updateListing(), deleteListing()
    └── assignments.ts    ← listAssignments(), createAssignment(), updateAssignment(), deleteAssignment()

apps/web/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── index.html
└── src/
    ├── main.tsx
    ├── App.tsx           ← router + providers
    ├── auth/
    │   ├── AuthContext.tsx    ← React context: user, token, login(), logout()
    │   ├── useAuth.ts         ← hook to consume AuthContext
    │   └── ProtectedRoute.tsx ← redirects to /login if unauthenticated
    ├── pages/
    │   ├── LoginPage.tsx
    │   ├── DashboardPage.tsx
    │   ├── ContactsPage.tsx
    │   ├── ContactDetailPage.tsx
    │   ├── EventsPage.tsx
    │   ├── GiftsPage.tsx
    │   ├── GiftDetailPage.tsx
    │   └── AccountPage.tsx
    └── components/
        ├── Layout.tsx        ← nav sidebar + page wrapper
        ├── ContactCard.tsx
        ├── EventCard.tsx
        ├── GiftCard.tsx
        ├── AssignmentStatusBadge.tsx
        └── forms/
            ├── ContactForm.tsx
            ├── EventForm.tsx
            ├── GiftForm.tsx
            └── AssignmentForm.tsx
```

---

### Task 1: api-client package

**Files:**
- Create: `packages/api-client/package.json`
- Create: `packages/api-client/tsconfig.json`
- Create: `packages/api-client/src/client.ts`
- Create: `packages/api-client/src/auth.ts`
- Create: `packages/api-client/src/contacts.ts`
- Create: `packages/api-client/src/connections.ts`
- Create: `packages/api-client/src/events.ts`
- Create: `packages/api-client/src/gifts.ts`
- Create: `packages/api-client/src/listings.ts`
- Create: `packages/api-client/src/assignments.ts`
- Create: `packages/api-client/src/index.ts`

**Interfaces:**
- Consumes: `@bestowd/types`
- Produces: all client functions importable as `import { listContacts } from '@bestowd/api-client'`

- [ ] **Step 1: Create packages/api-client/package.json**

```json
{
  "name": "@bestowd/api-client",
  "version": "0.0.1",
  "private": true,
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@bestowd/types": "workspace:*"
  },
  "devDependencies": {
    "@bestowd/config": "workspace:*",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create packages/api-client/tsconfig.json**

```json
{
  "extends": "@bestowd/config/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "lib": ["ES2022", "DOM"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create packages/api-client/src/client.ts**

```typescript
const API_BASE = import.meta.env?.VITE_API_URL ?? 'http://localhost:3000'
const TOKEN_KEY = 'bestowd_token'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(res.status, (body as any).error ?? res.statusText)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}
```

- [ ] **Step 4: Create packages/api-client/src/auth.ts**

```typescript
import { apiFetch } from './client.js'
import type { User } from '@bestowd/types'

export function googleLogin(idToken: string): Promise<{ token: string; user: User }> {
  return apiFetch('/auth/google', { method: 'POST', body: JSON.stringify({ idToken }) })
}

export function getMe(): Promise<User> {
  return apiFetch('/auth/me')
}
```

- [ ] **Step 5: Create packages/api-client/src/contacts.ts**

```typescript
import { apiFetch } from './client.js'
import type { Contact, CreateContactBody, UpdateContactBody } from '@bestowd/types'

export function listContacts(): Promise<Contact[]> {
  return apiFetch('/contacts')
}

export function getContact(id: string): Promise<Contact> {
  return apiFetch(`/contacts/${id}`)
}

export function createContact(body: CreateContactBody): Promise<Contact> {
  return apiFetch('/contacts', { method: 'POST', body: JSON.stringify(body) })
}

export function updateContact(id: string, body: UpdateContactBody): Promise<Contact> {
  return apiFetch(`/contacts/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function deleteContact(id: string): Promise<void> {
  return apiFetch(`/contacts/${id}`, { method: 'DELETE' })
}

export function claimContact(id: string): Promise<Contact> {
  return apiFetch(`/contacts/${id}/claim`, { method: 'POST' })
}
```

- [ ] **Step 6: Create packages/api-client/src/connections.ts**

```typescript
import { apiFetch } from './client.js'

export interface UserConnection {
  requesterId: string
  addresseeId: string
  status: 'pending' | 'accepted' | 'blocked'
  createdAt: string
}

export function listConnections(): Promise<UserConnection[]> {
  return apiFetch('/connections')
}

export function createConnection(addresseeEmail: string): Promise<UserConnection> {
  return apiFetch('/connections', { method: 'POST', body: JSON.stringify({ addresseeEmail }) })
}

export function updateConnection(requesterId: string, status: 'accepted' | 'blocked'): Promise<UserConnection> {
  return apiFetch(`/connections/${requesterId}`, { method: 'PATCH', body: JSON.stringify({ status }) })
}
```

- [ ] **Step 7: Create packages/api-client/src/events.ts**

```typescript
import { apiFetch } from './client.js'
import type { BestowdEvent, CreateEventBody, UpdateEventBody } from '@bestowd/types'

export function listEvents(): Promise<BestowdEvent[]> {
  return apiFetch('/events')
}

export function getEvent(id: string): Promise<BestowdEvent> {
  return apiFetch(`/events/${id}`)
}

export function createEvent(body: CreateEventBody): Promise<BestowdEvent> {
  return apiFetch('/events', { method: 'POST', body: JSON.stringify(body) })
}

export function updateEvent(id: string, body: UpdateEventBody): Promise<BestowdEvent> {
  return apiFetch(`/events/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function deleteEvent(id: string): Promise<void> {
  return apiFetch(`/events/${id}`, { method: 'DELETE' })
}
```

- [ ] **Step 8: Create packages/api-client/src/gifts.ts**

```typescript
import { apiFetch } from './client.js'
import type { Gift, CreateGiftBody, UpdateGiftBody, ProductListing, CreateListingBody } from '@bestowd/types'

export function listGifts(): Promise<Gift[]> {
  return apiFetch('/gifts')
}

export function getGift(id: string): Promise<Gift> {
  return apiFetch(`/gifts/${id}`)
}

export function createGift(body: CreateGiftBody): Promise<Gift> {
  return apiFetch('/gifts', { method: 'POST', body: JSON.stringify(body) })
}

export function updateGift(id: string, body: UpdateGiftBody): Promise<Gift> {
  return apiFetch(`/gifts/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function deleteGift(id: string): Promise<void> {
  return apiFetch(`/gifts/${id}`, { method: 'DELETE' })
}
```

- [ ] **Step 9: Create packages/api-client/src/listings.ts**

```typescript
import { apiFetch } from './client.js'
import type { ProductListing, CreateListingBody } from '@bestowd/types'

export function listListings(giftId: string): Promise<ProductListing[]> {
  return apiFetch(`/gifts/${giftId}/listings`)
}

export function createListing(giftId: string, body: CreateListingBody): Promise<ProductListing> {
  return apiFetch(`/gifts/${giftId}/listings`, { method: 'POST', body: JSON.stringify(body) })
}

export function deleteListing(giftId: string, id: string): Promise<void> {
  return apiFetch(`/gifts/${giftId}/listings/${id}`, { method: 'DELETE' })
}
```

- [ ] **Step 10: Create packages/api-client/src/assignments.ts**

```typescript
import { apiFetch } from './client.js'
import type { GiftAssignment, CreateAssignmentBody, UpdateAssignmentBody } from '@bestowd/types'

export function listAssignments(params: { contactId?: string; eventId?: string } = {}): Promise<GiftAssignment[]> {
  const qs = new URLSearchParams(params as Record<string, string>).toString()
  return apiFetch(`/assignments${qs ? `?${qs}` : ''}`)
}

export function createAssignment(body: CreateAssignmentBody): Promise<GiftAssignment> {
  return apiFetch('/assignments', { method: 'POST', body: JSON.stringify(body) })
}

export function updateAssignment(id: string, body: UpdateAssignmentBody): Promise<GiftAssignment> {
  return apiFetch(`/assignments/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function deleteAssignment(id: string): Promise<void> {
  return apiFetch(`/assignments/${id}`, { method: 'DELETE' })
}
```

- [ ] **Step 11: Create packages/api-client/src/index.ts**

```typescript
export * from './auth.js'
export * from './contacts.js'
export * from './connections.js'
export * from './events.js'
export * from './gifts.js'
export * from './listings.js'
export * from './assignments.js'
export { ApiError } from './client.js'
```

- [ ] **Step 12: Build the package**

```bash
pnpm install
pnpm --filter @bestowd/api-client build
```

Expected: `packages/api-client/dist/` created with no errors.

- [ ] **Step 13: Commit**

```bash
git add packages/api-client pnpm-lock.yaml
git commit -m "feat: api-client package with typed fetch wrappers for all API endpoints"
```

---

### Task 2: React web app scaffold

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/components/Layout.tsx`

**Interfaces:**
- Produces: `pnpm --filter @bestowd/web dev` starts on port 5173

- [ ] **Step 1: Create apps/web/package.json**

```json
{
  "name": "@bestowd/web",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@bestowd/api-client": "workspace:*",
    "@bestowd/types": "workspace:*",
    "@react-oauth/google": "^0.12.1",
    "@tanstack/react-query": "^5.45.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.24.0"
  },
  "devDependencies": {
    "@bestowd/config": "workspace:*",
    "@testing-library/jest-dom": "^6.4.6",
    "@testing-library/react": "^16.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.39",
    "tailwindcss": "^3.4.4",
    "typescript": "^5.4.0",
    "vite": "^5.3.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create apps/web/tsconfig.json**

```json
{
  "extends": "@bestowd/config/tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "noEmit": true,
    "allowImportingTsExtensions": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create apps/web/vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
})
```

- [ ] **Step 4: Create apps/web/tailwind.config.ts**

```typescript
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#7C3AED', light: '#EDE9FE', dark: '#5B21B6' },
      },
    },
  },
  plugins: [],
} satisfies Config
```

- [ ] **Step 5: Create apps/web/index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Bestowd</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create apps/web/src/main.tsx**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GoogleOAuthProvider } from '@react-oauth/google'
import App from './App.tsx'
import './index.css'

const queryClient = new QueryClient()
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <QueryClient.Provider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClient.Provider>
    </GoogleOAuthProvider>
  </React.StrictMode>
)
```

Fix the QueryClientProvider import — it comes from TanStack directly:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GoogleOAuthProvider } from '@react-oauth/google'
import App from './App.tsx'
import './index.css'

const queryClient = new QueryClient()
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>
)
```

- [ ] **Step 7: Create apps/web/src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 8: Create apps/web/src/App.tsx (skeleton)**

```tsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext.tsx'
import ProtectedRoute from './auth/ProtectedRoute.tsx'
import Layout from './components/Layout.tsx'
import LoginPage from './pages/LoginPage.tsx'
import DashboardPage from './pages/DashboardPage.tsx'
import ContactsPage from './pages/ContactsPage.tsx'
import ContactDetailPage from './pages/ContactDetailPage.tsx'
import EventsPage from './pages/EventsPage.tsx'
import GiftsPage from './pages/GiftsPage.tsx'
import GiftDetailPage from './pages/GiftDetailPage.tsx'
import AccountPage from './pages/AccountPage.tsx'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/contacts" element={<ContactsPage />} />
            <Route path="/contacts/:id" element={<ContactDetailPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/gifts" element={<GiftsPage />} />
            <Route path="/gifts/:id" element={<GiftDetailPage />} />
            <Route path="/account" element={<AccountPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  )
}
```

- [ ] **Step 9: Create apps/web/src/components/Layout.tsx**

```tsx
import { NavLink, Outlet } from 'react-router-dom'

const links = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/contacts', label: 'Contacts' },
  { to: '/events', label: 'Events' },
  { to: '/gifts', label: 'Gifts' },
  { to: '/account', label: 'Account' },
]

export default function Layout() {
  return (
    <div className="flex h-screen">
      <nav className="w-56 bg-brand-dark text-white flex flex-col gap-1 p-4 shrink-0">
        <p className="text-xl font-bold mb-6">Bestowd</p>
        {links.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-brand text-white' : 'text-purple-200 hover:bg-purple-700'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8">
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 10: Create stub pages (so App.tsx compiles)**

Create each of these as a minimal stub:

`apps/web/src/pages/DashboardPage.tsx`:
```tsx
export default function DashboardPage() {
  return <h1 className="text-2xl font-bold">Dashboard</h1>
}
```

`apps/web/src/pages/ContactsPage.tsx`:
```tsx
export default function ContactsPage() {
  return <h1 className="text-2xl font-bold">Contacts</h1>
}
```

`apps/web/src/pages/ContactDetailPage.tsx`:
```tsx
export default function ContactDetailPage() {
  return <h1 className="text-2xl font-bold">Contact Detail</h1>
}
```

`apps/web/src/pages/EventsPage.tsx`:
```tsx
export default function EventsPage() {
  return <h1 className="text-2xl font-bold">Events</h1>
}
```

`apps/web/src/pages/GiftsPage.tsx`:
```tsx
export default function GiftsPage() {
  return <h1 className="text-2xl font-bold">Gifts</h1>
}
```

`apps/web/src/pages/GiftDetailPage.tsx`:
```tsx
export default function GiftDetailPage() {
  return <h1 className="text-2xl font-bold">Gift Detail</h1>
}
```

`apps/web/src/pages/AccountPage.tsx`:
```tsx
export default function AccountPage() {
  return <h1 className="text-2xl font-bold">Account</h1>
}
```

`apps/web/src/pages/LoginPage.tsx`:
```tsx
export default function LoginPage() {
  return <h1 className="text-2xl font-bold">Sign In</h1>
}
```

- [ ] **Step 11: Create apps/web/.env.local**

```
VITE_API_URL=http://localhost:3000
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

- [ ] **Step 12: Create apps/web/src/test-setup.ts**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 13: Run dev server to verify it compiles**

```bash
pnpm install
pnpm --filter @bestowd/web dev
```

Expected: browser opens at `http://localhost:5173` — redirects to `/login`.

- [ ] **Step 14: Commit**

```bash
git add apps/web packages/api-client pnpm-lock.yaml
git commit -m "feat: React web app scaffold with Vite, Tailwind, and routing"
```

---

### Task 3: Google Sign-In and AuthContext

**Files:**
- Create: `apps/web/src/auth/AuthContext.tsx`
- Create: `apps/web/src/auth/useAuth.ts`
- Create: `apps/web/src/auth/ProtectedRoute.tsx`
- Modify: `apps/web/src/pages/LoginPage.tsx`
- Create: `apps/web/src/auth/AuthContext.test.tsx`

**Interfaces:**
- Produces:
  - `useAuth()` → `{ user: User | null, token: string | null, login(idToken: string): Promise<void>, logout(): void }`
  - `<ProtectedRoute />` → renders `<Outlet />` if authenticated, else `<Navigate to="/login" />`

- [ ] **Step 1: Write failing auth context test**

`apps/web/src/auth/AuthContext.test.tsx`:
```tsx
import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from './AuthContext.tsx'
import { useAuth } from './useAuth.ts'

vi.mock('@bestowd/api-client', () => ({
  googleLogin: vi.fn().mockResolvedValue({
    token: 'test-jwt',
    user: { id: '1', email: 'alice@example.com', name: 'Alice', subscriptionStatus: 'free', identitySource: 'google', emailVerified: true, createdAt: new Date().toISOString() },
  }),
  getMe: vi.fn(),
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
```

- [ ] **Step 2: Run to verify fails**

```bash
cd apps/web && pnpm test
```

Expected: FAIL — AuthContext not found.

- [ ] **Step 3: Create apps/web/src/auth/AuthContext.tsx**

```tsx
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { googleLogin, getMe } from '@bestowd/api-client'
import type { User } from '@bestowd/types'

const TOKEN_KEY = 'bestowd_token'

interface AuthContextValue {
  user: User | null
  token: string | null
  login: (idToken: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))

  useEffect(() => {
    if (token && !user) {
      getMe().then(setUser).catch(() => {
        localStorage.removeItem(TOKEN_KEY)
        setToken(null)
      })
    }
  }, [token])

  async function login(idToken: string) {
    const result = await googleLogin(idToken)
    localStorage.setItem(TOKEN_KEY, result.token)
    setToken(result.token)
    setUser(result.user)
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export { AuthContext }
```

- [ ] **Step 4: Create apps/web/src/auth/useAuth.ts**

```typescript
import { useContext } from 'react'
import { AuthContext } from './AuthContext.tsx'

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
```

- [ ] **Step 5: Create apps/web/src/auth/ProtectedRoute.tsx**

```tsx
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './useAuth.ts'

export default function ProtectedRoute() {
  const { token } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  return <Outlet />
}
```

- [ ] **Step 6: Implement LoginPage.tsx**

```tsx
import { useGoogleLogin } from '@react-oauth/google'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.ts'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      await login(tokenResponse.access_token)
      navigate('/dashboard')
    },
    onError: () => console.error('Google login failed'),
  })

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-light">
      <div className="bg-white rounded-2xl shadow-lg p-10 flex flex-col items-center gap-6 w-full max-w-sm">
        <h1 className="text-3xl font-bold text-brand-dark">Bestowd</h1>
        <p className="text-gray-500 text-sm text-center">Smart gift giving, made thoughtful.</p>
        <button
          onClick={() => handleGoogleLogin()}
          className="flex items-center gap-3 bg-white border border-gray-300 rounded-lg px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm w-full justify-center"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4" />
          Sign in with Google
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
cd apps/web && pnpm test
```

Expected: auth tests PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/auth apps/web/src/pages/LoginPage.tsx
git commit -m "feat: Google Sign-In with AuthContext and protected routing"
```

---

### Task 4: Dashboard screen

**Files:**
- Modify: `apps/web/src/pages/DashboardPage.tsx`
- Create: `apps/web/src/components/EventCard.tsx`

**Interfaces:**
- Consumes: `listEvents()` from `@bestowd/api-client`; `useAuth()`
- Produces: Dashboard showing user greeting + upcoming events sorted by `nextOccurrence`

- [ ] **Step 1: Create apps/web/src/components/EventCard.tsx**

```tsx
import type { BestowdEvent } from '@bestowd/types'

interface Props {
  event: BestowdEvent
}

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

export default function EventCard({ event }: Props) {
  const days = daysUntil(event.nextOccurrence)
  const urgency = days <= 7 ? 'text-red-600 bg-red-50' : days <= 30 ? 'text-amber-600 bg-amber-50' : 'text-green-600 bg-green-50'

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
      <div>
        <p className="font-medium text-gray-900">{event.name}</p>
        <p className="text-xs text-gray-400 mt-0.5 capitalize">{event.type}</p>
      </div>
      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${urgency}`}>
        {days === 0 ? 'Today!' : `${days}d`}
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Implement DashboardPage.tsx**

```tsx
import { useQuery } from '@tanstack/react-query'
import { listEvents } from '@bestowd/api-client'
import { useAuth } from '../auth/useAuth.ts'
import EventCard from '../components/EventCard.tsx'

export default function DashboardPage() {
  const { user } = useAuth()
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: listEvents,
  })

  const upcoming = [...events]
    .sort((a, b) => new Date(a.nextOccurrence).getTime() - new Date(b.nextOccurrence).getTime())
    .slice(0, 10)

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        Welcome back, {user?.name?.split(' ')[0]}
      </h1>
      <p className="text-gray-500 mb-8">Here's what's coming up.</p>

      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Upcoming Events
        </h2>
        {isLoading && <p className="text-sm text-gray-400">Loading…</p>}
        {!isLoading && upcoming.length === 0 && (
          <p className="text-sm text-gray-400">No upcoming events. Add contacts and events to get started.</p>
        )}
        <div className="flex flex-col gap-2">
          {upcoming.map(event => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/DashboardPage.tsx apps/web/src/components/EventCard.tsx
git commit -m "feat: dashboard with upcoming events"
```

---

### Task 5: Contacts screens

**Files:**
- Modify: `apps/web/src/pages/ContactsPage.tsx`
- Modify: `apps/web/src/pages/ContactDetailPage.tsx`
- Create: `apps/web/src/components/ContactCard.tsx`
- Create: `apps/web/src/components/forms/ContactForm.tsx`

**Interfaces:**
- Consumes: `listContacts()`, `createContact()`, `updateContact()`, `deleteContact()` from `@bestowd/api-client`
- Produces: list view with add button; detail view with edit form and attribute list

- [ ] **Step 1: Create apps/web/src/components/ContactCard.tsx**

```tsx
import { Link } from 'react-router-dom'
import type { Contact } from '@bestowd/types'

export default function ContactCard({ contact }: { contact: Contact }) {
  return (
    <Link
      to={`/contacts/${contact.id}`}
      className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 hover:shadow-md transition-shadow"
    >
      {contact.avatarUrl ? (
        <img src={contact.avatarUrl} alt={contact.name} className="w-10 h-10 rounded-full object-cover" />
      ) : (
        <div className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center text-brand font-semibold">
          {contact.name[0]?.toUpperCase()}
        </div>
      )}
      <div>
        <p className="font-medium text-gray-900">{contact.name}</p>
        {contact.email && <p className="text-xs text-gray-400">{contact.email}</p>}
      </div>
      {!contact.isManaged && (
        <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Verified</span>
      )}
    </Link>
  )
}
```

- [ ] **Step 2: Create apps/web/src/components/forms/ContactForm.tsx**

```tsx
import { useState } from 'react'
import type { CreateContactBody, ContactAttribute } from '@bestowd/types'

interface Props {
  initial?: Partial<CreateContactBody>
  onSubmit: (data: CreateContactBody) => void
  onCancel: () => void
  loading?: boolean
}

export default function ContactForm({ initial = {}, onSubmit, onCancel, loading }: Props) {
  const [name, setName] = useState(initial.name ?? '')
  const [email, setEmail] = useState(initial.email ?? '')
  const [notes, setNotes] = useState(initial.notes ?? '')
  const [attributes, setAttributes] = useState<ContactAttribute[]>(initial.attributes ?? [])
  const [attrLabel, setAttrLabel] = useState('')
  const [attrValue, setAttrValue] = useState('')

  function addAttribute() {
    if (!attrLabel || !attrValue) return
    setAttributes(prev => [...prev, { label: attrLabel, value: attrValue, visible: true }])
    setAttrLabel('')
    setAttrValue('')
  }

  function removeAttribute(index: number) {
    setAttributes(prev => prev.filter((_, i) => i !== index))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit({ name, email: email || undefined, notes: notes || undefined, attributes })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
        <input
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          value={name} onChange={e => setName(e.target.value)} required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          value={email} onChange={e => setEmail(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          rows={2} value={notes} onChange={e => setNotes(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Interests & Attributes</label>
        <div className="flex gap-2 mb-2">
          <input
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Label (e.g. Loves)" value={attrLabel} onChange={e => setAttrLabel(e.target.value)}
          />
          <input
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Value (e.g. hiking)" value={attrValue} onChange={e => setAttrValue(e.target.value)}
          />
          <button type="button" onClick={addAttribute} className="px-3 py-2 bg-brand text-white rounded-lg text-sm">+</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {attributes.map((attr, i) => (
            <span key={i} className="bg-brand-light text-brand text-xs px-2 py-1 rounded-full flex items-center gap-1">
              {attr.label}: {attr.value}
              <button type="button" onClick={() => removeAttribute(i)} className="ml-1 text-brand-dark hover:text-red-500">×</button>
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 3: Implement ContactsPage.tsx**

```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listContacts, createContact } from '@bestowd/api-client'
import ContactCard from '../components/ContactCard.tsx'
import ContactForm from '../components/forms/ContactForm.tsx'
import type { CreateContactBody } from '@bestowd/types'

export default function ContactsPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const { data: contacts = [], isLoading } = useQuery({ queryKey: ['contacts'], queryFn: listContacts })

  const create = useMutation({
    mutationFn: createContact,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contacts'] }); setShowForm(false) },
  })

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
        <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium">
          + Add Contact
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
          <h2 className="text-base font-semibold mb-4">New Contact</h2>
          <ContactForm
            onSubmit={(data: CreateContactBody) => create.mutate(data)}
            onCancel={() => setShowForm(false)}
            loading={create.isPending}
          />
        </div>
      )}

      {isLoading && <p className="text-sm text-gray-400">Loading…</p>}
      <div className="flex flex-col gap-2">
        {contacts.map(contact => <ContactCard key={contact.id} contact={contact} />)}
      </div>
      {!isLoading && contacts.length === 0 && (
        <p className="text-sm text-gray-400">No contacts yet. Add your first one above.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Implement ContactDetailPage.tsx**

```tsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getContact, updateContact, deleteContact, listAssignments } from '@bestowd/api-client'
import ContactForm from '../components/forms/ContactForm.tsx'
import type { UpdateContactBody } from '@bestowd/types'

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)

  const { data: contact, isLoading } = useQuery({
    queryKey: ['contacts', id],
    queryFn: () => getContact(id!),
  })

  const { data: assignments = [] } = useQuery({
    queryKey: ['assignments', id],
    queryFn: () => listAssignments({ contactId: id }),
    enabled: !!id,
  })

  const update = useMutation({
    mutationFn: (body: UpdateContactBody) => updateContact(id!, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contacts'] }); setEditing(false) },
  })

  const remove = useMutation({
    mutationFn: () => deleteContact(id!),
    onSuccess: () => navigate('/contacts'),
  })

  if (isLoading) return <p className="text-sm text-gray-400">Loading…</p>
  if (!contact) return <p className="text-sm text-red-500">Contact not found.</p>

  return (
    <div className="max-w-2xl">
      <button onClick={() => navigate(-1)} className="text-sm text-brand mb-4 hover:underline">← Back</button>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-brand-light flex items-center justify-center text-xl text-brand font-bold">
              {contact.name[0]?.toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{contact.name}</h1>
              {contact.email && <p className="text-sm text-gray-500">{contact.email}</p>}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditing(true)} className="text-sm text-brand hover:underline">Edit</button>
            <button onClick={() => remove.mutate()} className="text-sm text-red-500 hover:underline">Delete</button>
          </div>
        </div>

        {contact.notes && <p className="text-sm text-gray-600 mb-4">{contact.notes}</p>}

        {contact.attributes.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Interests</p>
            <div className="flex flex-wrap gap-2">
              {contact.attributes.map((a, i) => (
                <span key={i} className="bg-brand-light text-brand text-xs px-3 py-1 rounded-full">
                  {a.label}: {a.value}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {editing && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
          <ContactForm
            initial={{ name: contact.name, email: contact.email ?? '', notes: contact.notes ?? '', attributes: contact.attributes }}
            onSubmit={(data) => update.mutate(data)}
            onCancel={() => setEditing(false)}
            loading={update.isPending}
          />
        </div>
      )}

      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Gift History</h2>
        {assignments.length === 0 ? (
          <p className="text-sm text-gray-400">No gifts recorded yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {assignments.map(a => (
              <div key={a.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">{a.giftId}</p>
                  {a.givenAt && <p className="text-xs text-gray-400">Given {new Date(a.givenAt).toLocaleDateString()}</p>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  a.status === 'given' ? 'bg-green-100 text-green-700'
                  : a.status === 'purchased' ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600'
                }`}>{a.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/ContactsPage.tsx apps/web/src/pages/ContactDetailPage.tsx apps/web/src/components/
git commit -m "feat: contacts list and detail screens with attribute management"
```

---

### Task 6: Events screen

**Files:**
- Modify: `apps/web/src/pages/EventsPage.tsx`
- Create: `apps/web/src/components/forms/EventForm.tsx`

**Interfaces:**
- Consumes: `listEvents()`, `createEvent()`, `deleteEvent()`; `listContacts()` for contact picker

- [ ] **Step 1: Create apps/web/src/components/forms/EventForm.tsx**

```tsx
import { useState } from 'react'
import type { Contact } from '@bestowd/types'
import type { CreateEventBody } from '@bestowd/types'

interface Props {
  contacts: Contact[]
  onSubmit: (data: CreateEventBody) => void
  onCancel: () => void
  loading?: boolean
}

const EVENT_TYPES = ['birthday', 'anniversary', 'christmas', 'custom'] as const

export default function EventForm({ contacts, onSubmit, onCancel, loading }: Props) {
  const [contactId, setContactId] = useState('')
  const [type, setType] = useState<string>('birthday')
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [recurrenceRule, setRecurrenceRule] = useState<string>('annual')
  const [reminderDays, setReminderDays] = useState('30,7,1')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit({
      contactId,
      type: type as any,
      name,
      date: new Date(date).toISOString(),
      recurrenceRule,
      reminderDays: reminderDays.split(',').map(d => parseInt(d.trim())).filter(Boolean),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Contact *</label>
        <select
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          value={contactId} onChange={e => setContactId(e.target.value)} required
        >
          <option value="">Select a contact…</option>
          {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            value={type} onChange={e => setType(e.target.value)}
          >
            {EVENT_TYPES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Recurrence</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            value={recurrenceRule} onChange={e => setRecurrenceRule(e.target.value)}
          >
            <option value="annual">Annual</option>
            <option value="once">Once</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Event Name *</label>
        <input
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          value={name} onChange={e => setName(e.target.value)} required
          placeholder={type === 'birthday' ? "Alice's Birthday" : 'Event name'}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
        <input
          type="date"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          value={date} onChange={e => setDate(e.target.value)} required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Remind me (days before, comma-separated)</label>
        <input
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          value={reminderDays} onChange={e => setReminderDays(e.target.value)}
        />
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
        <button type="submit" disabled={loading} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium disabled:opacity-50">
          {loading ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Implement EventsPage.tsx**

```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listEvents, createEvent, deleteEvent, listContacts } from '@bestowd/api-client'
import EventCard from '../components/EventCard.tsx'
import EventForm from '../components/forms/EventForm.tsx'
import type { CreateEventBody } from '@bestowd/types'

export default function EventsPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const { data: events = [], isLoading } = useQuery({ queryKey: ['events'], queryFn: listEvents })
  const { data: contacts = [] } = useQuery({ queryKey: ['contacts'], queryFn: listContacts })

  const create = useMutation({
    mutationFn: createEvent,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); setShowForm(false) },
  })

  const remove = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  })

  const sorted = [...events].sort(
    (a, b) => new Date(a.nextOccurrence).getTime() - new Date(b.nextOccurrence).getTime()
  )

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Events</h1>
        <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium">
          + Add Event
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
          <h2 className="text-base font-semibold mb-4">New Event</h2>
          <EventForm
            contacts={contacts}
            onSubmit={(data: CreateEventBody) => create.mutate(data)}
            onCancel={() => setShowForm(false)}
            loading={create.isPending}
          />
        </div>
      )}

      {isLoading && <p className="text-sm text-gray-400">Loading…</p>}
      <div className="flex flex-col gap-2">
        {sorted.map(event => (
          <div key={event.id} className="relative group">
            <EventCard event={event} />
            <button
              onClick={() => remove.mutate(event.id)}
              className="absolute top-3 right-3 text-xs text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      {!isLoading && events.length === 0 && (
        <p className="text-sm text-gray-400">No events yet. Add contacts first, then create events for them.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/EventsPage.tsx apps/web/src/components/forms/EventForm.tsx
git commit -m "feat: events screen with create and list"
```

---

### Task 7: Gifts and Assignments screens

**Files:**
- Modify: `apps/web/src/pages/GiftsPage.tsx`
- Modify: `apps/web/src/pages/GiftDetailPage.tsx`
- Create: `apps/web/src/components/GiftCard.tsx`
- Create: `apps/web/src/components/AssignmentStatusBadge.tsx`
- Create: `apps/web/src/components/forms/GiftForm.tsx`
- Create: `apps/web/src/components/forms/AssignmentForm.tsx`

**Interfaces:**
- Consumes: `listGifts()`, `createGift()`, `getGift()`, `listAssignments()`, `createAssignment()`, `updateAssignment()`, `listContacts()`, `listEvents()`

- [ ] **Step 1: Create apps/web/src/components/AssignmentStatusBadge.tsx**

```tsx
import type { AssignmentStatus } from '@bestowd/types'

const styles: Record<AssignmentStatus, string> = {
  idea: 'bg-gray-100 text-gray-600',
  purchased: 'bg-blue-100 text-blue-700',
  given: 'bg-green-100 text-green-700',
}

export default function AssignmentStatusBadge({ status }: { status: AssignmentStatus }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${styles[status]}`}>
      {status}
    </span>
  )
}
```

- [ ] **Step 2: Create apps/web/src/components/GiftCard.tsx**

```tsx
import { Link } from 'react-router-dom'
import type { Gift } from '@bestowd/types'

export default function GiftCard({ gift }: { gift: Gift }) {
  return (
    <Link
      to={`/gifts/${gift.id}`}
      className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 hover:shadow-md transition-shadow"
    >
      {gift.imageUrl ? (
        <img src={gift.imageUrl} alt={gift.title} className="w-12 h-12 rounded-lg object-cover" />
      ) : (
        <div className="w-12 h-12 rounded-lg bg-purple-50 flex items-center justify-center text-2xl">🎁</div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">{gift.title}</p>
        <div className="flex gap-1 mt-1 flex-wrap">
          {gift.tags.slice(0, 3).map(tag => (
            <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{tag}</span>
          ))}
        </div>
      </div>
      {gift.type === 'basket' && (
        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full shrink-0">Basket</span>
      )}
    </Link>
  )
}
```

- [ ] **Step 3: Create apps/web/src/components/forms/GiftForm.tsx**

```tsx
import { useState } from 'react'
import type { CreateGiftBody } from '@bestowd/types'

interface Props {
  onSubmit: (data: CreateGiftBody) => void
  onCancel: () => void
  loading?: boolean
}

export default function GiftForm({ onSubmit, onCancel, loading }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [upc, setUpc] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [type, setType] = useState<'product' | 'basket'>('product')

  function addTag() {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t)) setTags(prev => [...prev, t])
    setTagInput('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit({ title, description: description || undefined, imageUrl: imageUrl || undefined, upc: upc || undefined, tags, type })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex gap-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="radio" value="product" checked={type === 'product'} onChange={() => setType('product')} />
          Product
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="radio" value="basket" checked={type === 'basket'} onChange={() => setType('basket')} />
          Basket
        </label>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
        <input
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          value={title} onChange={e => setTitle(e.target.value)} required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          rows={2} value={description} onChange={e => setDescription(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
        <input
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          value={imageUrl} onChange={e => setImageUrl(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">UPC / GTIN</label>
        <input
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          value={upc} onChange={e => setUpc(e.target.value)} placeholder="Optional product barcode"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
        <div className="flex gap-2 mb-2">
          <input
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="e.g. tech, books" value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
          />
          <button type="button" onClick={addTag} className="px-3 py-2 bg-brand text-white rounded-lg text-sm">+</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {tags.map(tag => (
            <span key={tag} className="bg-brand-light text-brand text-xs px-2 py-1 rounded-full flex items-center gap-1">
              {tag}
              <button type="button" onClick={() => setTags(prev => prev.filter(t => t !== tag))}>×</button>
            </span>
          ))}
        </div>
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
        <button type="submit" disabled={loading} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium disabled:opacity-50">
          {loading ? 'Saving…' : 'Save Gift'}
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 4: Create apps/web/src/components/forms/AssignmentForm.tsx**

```tsx
import { useState } from 'react'
import type { Contact, BestowdEvent, Gift } from '@bestowd/types'
import type { CreateAssignmentBody } from '@bestowd/types'

interface Props {
  gifts: Gift[]
  contacts: Contact[]
  events: BestowdEvent[]
  onSubmit: (data: CreateAssignmentBody) => void
  onCancel: () => void
  loading?: boolean
}

export default function AssignmentForm({ gifts, contacts, events, onSubmit, onCancel, loading }: Props) {
  const [giftId, setGiftId] = useState('')
  const [contactId, setContactId] = useState('')
  const [eventId, setEventId] = useState('')
  const [status, setStatus] = useState<string>('idea')
  const [notes, setNotes] = useState('')

  const contactEvents = events.filter(e => e.contactId === contactId)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit({ giftId, contactId, eventId: eventId || undefined, status: status as any, notes: notes || undefined })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Gift *</label>
        <select
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          value={giftId} onChange={e => setGiftId(e.target.value)} required
        >
          <option value="">Select a gift…</option>
          {gifts.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Recipient *</label>
        <select
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          value={contactId} onChange={e => { setContactId(e.target.value); setEventId('') }} required
        >
          <option value="">Select a contact…</option>
          {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {contactId && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Event (optional)</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            value={eventId} onChange={e => setEventId(e.target.value)}
          >
            <option value="">Ad-hoc gift (no event)</option>
            {contactEvents.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
        <select
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          value={status} onChange={e => setStatus(e.target.value)}
        >
          <option value="idea">Idea</option>
          <option value="purchased">Purchased</option>
          <option value="given">Given</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          rows={2} value={notes} onChange={e => setNotes(e.target.value)}
        />
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
        <button type="submit" disabled={loading} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium disabled:opacity-50">
          {loading ? 'Saving…' : 'Assign Gift'}
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 5: Implement GiftsPage.tsx**

```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listGifts, createGift, listContacts, listEvents, createAssignment } from '@bestowd/api-client'
import GiftCard from '../components/GiftCard.tsx'
import GiftForm from '../components/forms/GiftForm.tsx'
import AssignmentForm from '../components/forms/AssignmentForm.tsx'

export default function GiftsPage() {
  const qc = useQueryClient()
  const [showGiftForm, setShowGiftForm] = useState(false)
  const [showAssignForm, setShowAssignForm] = useState(false)

  const { data: gifts = [], isLoading } = useQuery({ queryKey: ['gifts'], queryFn: listGifts })
  const { data: contacts = [] } = useQuery({ queryKey: ['contacts'], queryFn: listContacts })
  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: listEvents })

  const createGiftMutation = useMutation({
    mutationFn: createGift,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gifts'] }); setShowGiftForm(false) },
  })

  const createAssignmentMutation = useMutation({
    mutationFn: createAssignment,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assignments'] }); setShowAssignForm(false) },
  })

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Gifts</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowAssignForm(true)} className="px-4 py-2 border border-brand text-brand rounded-lg text-sm font-medium hover:bg-brand-light">
            Assign Gift
          </button>
          <button onClick={() => setShowGiftForm(true)} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium">
            + Add Gift
          </button>
        </div>
      </div>

      {showGiftForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
          <h2 className="text-base font-semibold mb-4">New Gift</h2>
          <GiftForm
            onSubmit={data => createGiftMutation.mutate(data)}
            onCancel={() => setShowGiftForm(false)}
            loading={createGiftMutation.isPending}
          />
        </div>
      )}

      {showAssignForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
          <h2 className="text-base font-semibold mb-4">Assign Gift to Contact</h2>
          <AssignmentForm
            gifts={gifts}
            contacts={contacts}
            events={events}
            onSubmit={data => createAssignmentMutation.mutate(data)}
            onCancel={() => setShowAssignForm(false)}
            loading={createAssignmentMutation.isPending}
          />
        </div>
      )}

      {isLoading && <p className="text-sm text-gray-400">Loading…</p>}
      <div className="flex flex-col gap-2">
        {gifts.map(gift => <GiftCard key={gift.id} gift={gift} />)}
      </div>
      {!isLoading && gifts.length === 0 && (
        <p className="text-sm text-gray-400">No gifts yet. Add your first gift idea above.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Implement GiftDetailPage.tsx**

```tsx
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getGift, deleteGift, listAssignments, updateAssignment, listListings } from '@bestowd/api-client'
import AssignmentStatusBadge from '../components/AssignmentStatusBadge.tsx'
import type { AssignmentStatus } from '@bestowd/types'

export default function GiftDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: gift, isLoading } = useQuery({ queryKey: ['gifts', id], queryFn: () => getGift(id!) })
  const { data: assignments = [] } = useQuery({
    queryKey: ['assignments-by-gift', id],
    queryFn: () => listAssignments(),
    select: data => data.filter(a => a.giftId === id),
    enabled: !!id,
  })
  const { data: listings = [] } = useQuery({
    queryKey: ['listings', id],
    queryFn: () => listListings(id!),
    enabled: !!id,
  })

  const remove = useMutation({
    mutationFn: () => deleteGift(id!),
    onSuccess: () => navigate('/gifts'),
  })

  const updateStatus = useMutation({
    mutationFn: ({ assignmentId, status }: { assignmentId: string; status: AssignmentStatus }) =>
      updateAssignment(assignmentId, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assignments-by-gift', id] }),
  })

  if (isLoading) return <p className="text-sm text-gray-400">Loading…</p>
  if (!gift) return <p className="text-sm text-red-500">Gift not found.</p>

  return (
    <div className="max-w-2xl">
      <button onClick={() => navigate(-1)} className="text-sm text-brand mb-4 hover:underline">← Back</button>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-gray-900">{gift.title}</h1>
              {gift.type === 'basket' && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Basket</span>
              )}
            </div>
            {gift.description && <p className="text-sm text-gray-600 mb-3">{gift.description}</p>}
            {gift.upc && <p className="text-xs text-gray-400">UPC: {gift.upc}</p>}
          </div>
          <button onClick={() => remove.mutate()} className="text-sm text-red-500 hover:underline shrink-0">Delete</button>
        </div>

        {gift.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {gift.tags.map(tag => (
              <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{tag}</span>
            ))}
          </div>
        )}

        {gift.type === 'basket' && gift.basketItems.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Basket Contents</p>
            <div className="flex flex-col gap-1">
              {gift.basketItems.map(item => (
                <div key={item.id} className="text-sm text-gray-700 pl-3 border-l-2 border-brand-light">{item.title}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {listings.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Where to Buy</h2>
          <div className="flex flex-col gap-2">
            {listings.map(listing => (
              <div key={listing.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800 capitalize">{listing.vendor}</p>
                  {listing.listedPrice && (
                    <p className="text-xs text-gray-500">${parseFloat(listing.listedPrice).toFixed(2)} {listing.currency}</p>
                  )}
                </div>
                <a href={listing.vendorUrl} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-brand hover:underline font-medium">
                  View →
                </a>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Assignments</h2>
        {assignments.length === 0 ? (
          <p className="text-sm text-gray-400">This gift hasn't been assigned yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {assignments.map(a => (
              <div key={a.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">Contact: {a.contactId}</p>
                  {a.givenAt && <p className="text-xs text-gray-400">Given: {new Date(a.givenAt).toLocaleDateString()}</p>}
                  {a.purchasePrice && <p className="text-xs text-gray-400">Paid: ${parseFloat(a.purchasePrice).toFixed(2)}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <AssignmentStatusBadge status={a.status as any} />
                  {a.status !== 'given' && (
                    <button
                      onClick={() => updateStatus.mutate({ assignmentId: a.id, status: a.status === 'idea' ? 'purchased' : 'given' })}
                      className="text-xs text-brand hover:underline"
                    >
                      → {a.status === 'idea' ? 'Mark Purchased' : 'Mark Given'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/pages/GiftsPage.tsx apps/web/src/pages/GiftDetailPage.tsx apps/web/src/components/
git commit -m "feat: gifts and assignments screens with vendor listings"
```

---

### Task 8: Account screen

**Files:**
- Modify: `apps/web/src/pages/AccountPage.tsx`

**Interfaces:**
- Consumes: `useAuth()`, `PATCH /users/me` via api-client

- [ ] **Step 1: Implement AccountPage.tsx**

```tsx
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.ts'
import { apiFetch } from '@bestowd/api-client'

// apiFetch is not exported from api-client yet — add to src/index.ts: export { apiFetch } from './client.js'

export default function AccountPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [aiProvider, setAiProvider] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [saved, setSaved] = useState(false)

  const saveAi = useMutation({
    mutationFn: () =>
      apiFetch('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ aiProviderConfig: { provider: aiProvider, apiKey, model } }),
      }),
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2000) },
  })

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Account</h1>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex items-center gap-4">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name} className="w-14 h-14 rounded-full" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-brand-light flex items-center justify-center text-2xl font-bold text-brand">
              {user?.name[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-semibold text-gray-900">{user?.name}</p>
            <p className="text-sm text-gray-500">{user?.email}</p>
            <p className="text-xs mt-1 text-green-600 font-medium">
              {user?.emailVerified ? '✓ Google Verified' : 'Unverified'}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
        <h2 className="font-semibold text-gray-800 mb-4">AI Provider</h2>
        <p className="text-xs text-gray-400 mb-4">
          Your API key is encrypted and stored securely. It is never shared with other users.
        </p>
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={aiProvider} onChange={e => setAiProvider(e.target.value)}
            >
              <option value="">Select provider…</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="gemini">Google Gemini</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
            <input
              type="password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="sk-…" value={apiKey} onChange={e => setApiKey(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. gpt-4o, claude-sonnet-4-6" value={model} onChange={e => setModel(e.target.value)}
            />
          </div>
          <button
            onClick={() => saveAi.mutate()}
            disabled={!aiProvider || !apiKey || !model || saveAi.isPending}
            className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium disabled:opacity-50 self-start"
          >
            {saved ? '✓ Saved' : saveAi.isPending ? 'Saving…' : 'Save AI Config'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-gray-800 mb-4">Subscription</h2>
        <p className="text-sm text-gray-600 mb-1">
          Plan: <span className="font-medium capitalize">{user?.subscriptionStatus ?? 'free'}</span>
        </p>
        <p className="text-xs text-gray-400">Upgrade to Premium to unlock Amazon price history.</p>
      </div>

      <button
        onClick={handleLogout}
        className="mt-6 text-sm text-red-500 hover:text-red-700 hover:underline"
      >
        Sign out
      </button>
    </div>
  )
}
```

Also add `apiFetch` export to `packages/api-client/src/index.ts`:
```typescript
export { apiFetch, ApiError } from './client.js'
```

- [ ] **Step 2: Rebuild api-client**

```bash
pnpm --filter @bestowd/api-client build
```

- [ ] **Step 3: Run full test suite**

```bash
pnpm test
```

Expected: all tests PASS.

- [ ] **Step 4: Start dev servers and test in browser**

```bash
# Terminal 1
pnpm --filter @bestowd/api dev

# Terminal 2
pnpm --filter @bestowd/web dev
```

Verify in browser:
- [ ] Navigate to `http://localhost:5173` → redirected to `/login`
- [ ] Sign in with Google → redirected to `/dashboard`
- [ ] Create a contact with attributes
- [ ] Add an event for the contact
- [ ] Add a gift and assign it to the contact
- [ ] Check contact detail page shows gift history
- [ ] Set AI config in Account page — verify no API key shown after save

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/AccountPage.tsx packages/api-client/src/index.ts
git commit -m "feat: account screen with AI provider config and subscription status"
```
