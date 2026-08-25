# Contact Invite & Auto-Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a contact creator send an unmanaged contact an email invite to Bestowd, and automatically link that contact to the recipient's account when they sign in with a matching Google email.

**Architecture:** Add an `invitedAt` timestamp to `Contact`. A new `POST /contacts/:id/invite` route sends the invite email via a Nodemailer/Gmail SMTP service and stamps `invitedAt`. `POST /auth/google` gains a post-upsert step that looks up the oldest unmanaged, unlinked `Contact` matching the signed-in user's email and links it. The web app gets a typed client function and a button on the contact detail page.

**Tech Stack:** Fastify 4, Prisma 5, Vitest, supertest, Nodemailer (Gmail SMTP), React 18, TanStack Query.

**Reference:** `docs/superpowers/specs/2026-08-24-contact-invite-design.md`

## Global Constraints

- New env vars `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `WEB_APP_URL` are required and validated via the existing zod schema in `apps/api/src/config.ts` — the app must fail to boot if any is missing, matching the existing pattern for `JWT_SECRET`/`GOOGLE_CLIENT_ID`.
- The mailer must be mocked in all tests (`vi.mock('../src/services/mailer.js', ...)`) — the test suite must never perform a real SMTP send.
- Auto-link runs on **every** `POST /auth/google` call (login and first-time signup alike), not just first-time signup.
- Because `Contact.linkedUserId` is `@unique` in the schema, auto-link must link at most one contact per sign-in — the oldest matching unmanaged, unlinked contact (`orderBy: { createdAt: 'asc' }`). This is an existing constraint, not something this plan changes.
- Sending an invite must not succeed silently on SMTP failure: if `sendContactInvite` throws, the route must not update `invitedAt`.
- No "creator notified on email mismatch" fallback is in scope — a non-matching sign-in email is simply a no-op for auto-link.
- The existing `POST /contacts/:id/claim` endpoint is untouched — it remains as a manual fallback.

---

## File Map

```
apps/api/
├── prisma/
│   └── schema.prisma            ← modify: add Contact.invitedAt
├── .env.example                 ← modify: add GMAIL_USER, GMAIL_APP_PASSWORD, WEB_APP_URL
├── package.json                 ← modify: add nodemailer, @types/nodemailer
├── src/
│   ├── config.ts                ← modify: zod schema for new env vars
│   ├── services/
│   │   └── mailer.ts            ← create: sendContactInvite(to, inviterName)
│   └── routes/
│       ├── auth.ts              ← modify: auto-link after user upsert
│       └── contacts.ts          ← modify: add POST /contacts/:id/invite
└── tests/
    ├── auth.test.ts             ← modify: add auto-link test
    └── contacts.test.ts         ← modify: add invite endpoint tests, mock mailer

packages/types/src/contact.ts             ← modify: add invitedAt to Contact
packages/api-client/src/contacts.ts       ← modify: add sendInvite(id)
apps/web/src/pages/ContactDetailPage.tsx  ← modify: invite button + status
```

---

### Task 1: Prisma schema — `invitedAt` field

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

**Interfaces:**
- Produces: `db.contact.invitedAt: Date | null` available on all Prisma `Contact` queries/mutations.

- [ ] **Step 1: Add the field to the Contact model**

In `apps/api/prisma/schema.prisma`, in `model Contact`, add `invitedAt` after `isManaged`:

```prisma
model Contact {
  id           String    @id @default(cuid())
  ownerId      String
  linkedUserId String?   @unique
  name         String
  avatarUrl    String?
  email        String?
  notes        String?
  attributes   Json      @default("[]")
  isManaged    Boolean   @default(true)
  invitedAt    DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  owner       User             @relation("OwnedContacts", fields: [ownerId], references: [id], onDelete: Cascade)
  linkedUser  User?            @relation("LinkedUser", fields: [linkedUserId], references: [id])
  events      Event[]
  assignments GiftAssignment[]
}
```

- [ ] **Step 2: Run migration on the dev database**

```bash
cd apps/api
pnpm prisma migrate dev --name add_contact_invited_at
```

Expected: a new migration folder created under `prisma/migrations/`, Prisma client regenerated.

- [ ] **Step 3: Run migration on the test database**

```bash
DATABASE_URL=$DATABASE_URL_TEST pnpm prisma migrate deploy
```

- [ ] **Step 4: Verify the Prisma client compiles**

```bash
pnpm prisma generate
pnpm build
```

Expected: no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma
git commit -m "feat: add invitedAt field to Contact"
```

---

### Task 2: Auto-link on sign-in

**Files:**
- Modify: `apps/api/src/routes/auth.ts`
- Modify: `apps/api/tests/auth.test.ts`

**Interfaces:**
- Consumes: `db.contact` from `db.ts`; `verifyGoogleToken` mock from `google-auth.js` (already mocked in this test file).
- Produces: after `POST /auth/google`, any `Contact` with `isManaged: true`, `linkedUserId: null`, and `email` case-insensitively matching the signed-in user's email gets `linkedUserId` and `isManaged: false` set (oldest match only).

- [ ] **Step 1: Write the failing auto-link test**

In `apps/api/tests/auth.test.ts`, add the `verifyGoogleToken` import and a new `describe` block. The full updated file:

```typescript
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import supertest from 'supertest'
import { buildApp } from '../src/app.js'
import { db } from '../src/db.js'
import { verifyGoogleToken } from '../src/services/google-auth.js'
import { createTestUser } from './helpers.js'
import type { FastifyInstance } from 'fastify'

vi.mock('../src/services/google-auth.js', () => ({
  verifyGoogleToken: vi.fn().mockResolvedValue({
    googleId: 'google-123',
    email: 'alice@example.com',
    name: 'Alice',
    avatarUrl: 'https://example.com/avatar.jpg',
  }),
}))

let app: FastifyInstance

beforeAll(async () => {
  app = await buildApp()
  await app.ready()
})

afterAll(async () => {
  await db.user.deleteMany({ where: { email: 'alice@example.com' } })
  await app.close()
})

describe('POST /auth/google', () => {
  it('creates a user and returns a JWT token', async () => {
    const res = await supertest(app.server)
      .post('/auth/google')
      .send({ idToken: 'fake-google-token' })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('token')
    expect(res.body.user.email).toBe('alice@example.com')
    expect(res.body.user.identitySource).toBe('google')
    expect(res.body.user.emailVerified).toBe(true)
  })

  it('returns 400 when idToken is missing', async () => {
    const res = await supertest(app.server).post('/auth/google').send({})
    expect(res.status).toBe(400)
  })
})

describe('GET /auth/me', () => {
  it('returns the authenticated user', async () => {
    const loginRes = await supertest(app.server)
      .post('/auth/google')
      .send({ idToken: 'fake-google-token' })
    const token: string = loginRes.body.token

    const res = await supertest(app.server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.email).toBe('alice@example.com')
  })

  it('returns 401 without token', async () => {
    const res = await supertest(app.server).get('/auth/me')
    expect(res.status).toBe(401)
  })
})

describe('POST /auth/google auto-link', () => {
  it('auto-links an unmanaged contact with a matching email on sign-in', async () => {
    const owner = await createTestUser(app)
    const contact = await db.contact.create({
      data: { ownerId: owner.user.id, name: 'Bob', email: 'bob-invite@example.com' },
    })

    vi.mocked(verifyGoogleToken).mockResolvedValueOnce({
      googleId: 'google-bob',
      email: 'bob-invite@example.com',
      name: 'Bob',
      avatarUrl: null,
    })

    const res = await supertest(app.server)
      .post('/auth/google')
      .send({ idToken: 'fake-bob-token' })

    expect(res.status).toBe(200)

    const updated = await db.contact.findUniqueOrThrow({ where: { id: contact.id } })
    expect(updated.isManaged).toBe(false)
    expect(updated.linkedUserId).toBe(res.body.user.id)

    await db.contact.delete({ where: { id: contact.id } })
    await db.user.deleteMany({ where: { id: { in: [owner.user.id, res.body.user.id] } } })
  })

  it('is idempotent when the already-linked user logs in again', async () => {
    const owner = await createTestUser(app)
    const linkedUser = await createTestUser(app, { googleId: 'google-linked-repeat', email: 'carol-linked@example.com' })
    const contact = await db.contact.create({
      data: {
        ownerId: owner.user.id,
        name: 'Carol',
        email: 'carol-linked@example.com',
        isManaged: false,
        linkedUserId: linkedUser.user.id,
      },
    })

    vi.mocked(verifyGoogleToken).mockResolvedValueOnce({
      googleId: 'google-linked-repeat',
      email: 'carol-linked@example.com',
      name: 'Carol',
      avatarUrl: null,
    })

    const res = await supertest(app.server)
      .post('/auth/google')
      .send({ idToken: 'fake-carol-repeat-token' })

    expect(res.status).toBe(200)
    expect(res.body.user.id).toBe(linkedUser.user.id)

    const unchanged = await db.contact.findUniqueOrThrow({ where: { id: contact.id } })
    expect(unchanged.linkedUserId).toBe(linkedUser.user.id)
    expect(unchanged.isManaged).toBe(false)

    await db.contact.delete({ where: { id: contact.id } })
    await db.user.deleteMany({ where: { id: { in: [owner.user.id, linkedUser.user.id] } } })
  })
})
```

- [ ] **Step 2: Run tests to verify the new ones fail**

```bash
cd apps/api && pnpm test tests/auth.test.ts
```

Expected: the two new auto-link tests FAIL (contact stays `isManaged: true` / `linkedUserId: null`); the pre-existing tests still PASS.

- [ ] **Step 3: Add the auto-link step to the auth route**

Replace the body of `apps/api/src/routes/auth.ts` with:

```typescript
import type { FastifyInstance } from 'fastify'
import { db } from '../db.js'
import { verifyGoogleToken } from '../services/google-auth.js'

export async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: { idToken: string } }>('/auth/google', {
    schema: {
      body: {
        type: 'object',
        required: ['idToken'],
        properties: { idToken: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const { idToken } = request.body
    const profile = await verifyGoogleToken(idToken)

    const user = await db.user.upsert({
      where: { googleId: profile.googleId },
      create: {
        googleId: profile.googleId,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        identitySource: 'google',
        emailVerified: true,
      },
      update: {
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        email: profile.email,
      },
    })

    await autoLinkContact(user.id, user.email)

    const token = app.jwt.sign({ userId: user.id })
    return reply.send({ token, user: toUserDto(user) })
  })

  app.get('/auth/me', { preHandler: [app.authenticate] }, async (request) => {
    const { userId } = request.user as { userId: string }
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } })
    return toUserDto(user)
  })
}

async function autoLinkContact(userId: string, email: string): Promise<void> {
  const linkableContact = await db.contact.findFirst({
    where: {
      email: { equals: email, mode: 'insensitive' },
      isManaged: true,
      linkedUserId: null,
    },
    orderBy: { createdAt: 'asc' },
  })

  if (!linkableContact) return

  await db.contact.update({
    where: { id: linkableContact.id },
    data: { linkedUserId: userId, isManaged: false },
  })
}

function toUserDto(user: { id: string; email: string; name: string; avatarUrl: string | null; identitySource: string; emailVerified: boolean; subscriptionStatus: string; createdAt: Date }) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    identitySource: user.identitySource,
    emailVerified: user.emailVerified,
    subscriptionStatus: user.subscriptionStatus,
    createdAt: user.createdAt.toISOString(),
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/api && pnpm test tests/auth.test.ts
```

Expected: all tests PASS, including the two new auto-link tests.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/auth.ts apps/api/tests/auth.test.ts
git commit -m "feat: auto-link unmanaged contacts on matching sign-in email"
```

---

### Task 3: Mailer service + invite endpoint

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/config.ts`
- Modify: `apps/api/.env.example`
- Create: `apps/api/src/services/mailer.ts`
- Modify: `apps/api/src/routes/contacts.ts`
- Modify: `apps/api/tests/contacts.test.ts`

**Interfaces:**
- Consumes: `env.GMAIL_USER`, `env.GMAIL_APP_PASSWORD`, `env.WEB_APP_URL` from `config.ts`.
- Produces:
  - `sendContactInvite(to: string, inviterName: string): Promise<void>` exported from `mailer.ts`.
  - `POST /contacts/:id/invite` → `Contact` (200) with `invitedAt` set. 400 if no email, 404 if not owned by requester, 409 if already linked.

- [ ] **Step 1: Write the failing invite tests**

In `apps/api/tests/contacts.test.ts`, add `vi` to the vitest import, mock the mailer, and add a new `describe` block at the end of the file. The full updated file:

```typescript
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import supertest from 'supertest'
import { createTestApp, createTestUser } from './helpers.js'
import { db } from '../src/db.js'
import type { FastifyInstance } from 'fastify'

vi.mock('../src/services/mailer.js', () => ({
  sendContactInvite: vi.fn().mockResolvedValue(undefined),
}))

let app: FastifyInstance
let authHeader: string
let userId: string

beforeAll(async () => {
  app = await createTestApp()
  const result = await createTestUser(app)
  authHeader = result.authHeader
  userId = result.user.id
})

afterAll(async () => {
  await db.contact.deleteMany({ where: { ownerId: userId } })
  await db.user.delete({ where: { id: userId } })
  await app.close()
})

describe('POST /contacts', () => {
  it('creates a contact', async () => {
    const res = await supertest(app.server)
      .post('/contacts')
      .set('Authorization', authHeader)
      .send({ name: 'Bob', email: 'bob@example.com', attributes: [{ label: 'Loves', value: 'hiking', visible: true }] })

    expect(res.status).toBe(201)
    expect(res.body.name).toBe('Bob')
    expect(res.body.ownerId).toBe(userId)
    expect(res.body.isManaged).toBe(true)
    expect(res.body.attributes).toHaveLength(1)
  })

  it('returns 401 without token', async () => {
    const res = await supertest(app.server).post('/contacts').send({ name: 'Bob' })
    expect(res.status).toBe(401)
  })

  it('returns 400 when name is missing', async () => {
    const res = await supertest(app.server)
      .post('/contacts')
      .set('Authorization', authHeader)
      .send({ email: 'bob@example.com' })
    expect(res.status).toBe(400)
  })
})

describe('GET /contacts', () => {
  it('returns only contacts owned by the user', async () => {
    const res = await supertest(app.server)
      .get('/contacts')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    res.body.forEach((c: any) => expect(c.ownerId).toBe(userId))
  })
})

describe('GET /contacts/:id', () => {
  it('returns 404 for a contact owned by another user', async () => {
    const other = await createTestUser(app)
    const contact = await db.contact.create({
      data: { ownerId: other.user.id, name: 'Private' }
    })

    const res = await supertest(app.server)
      .get(`/contacts/${contact.id}`)
      .set('Authorization', authHeader)

    expect(res.status).toBe(404)
    await db.contact.delete({ where: { id: contact.id } })
    await db.user.delete({ where: { id: other.user.id } })
  })
})

describe('PATCH /contacts/:id', () => {
  it('updates a contact', async () => {
    const contact = await db.contact.create({
      data: { ownerId: userId, name: 'Charlie' }
    })

    const res = await supertest(app.server)
      .patch(`/contacts/${contact.id}`)
      .set('Authorization', authHeader)
      .send({ name: 'Charles', notes: 'Updated' })

    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Charles')
    expect(res.body.notes).toBe('Updated')
  })
})

describe('DELETE /contacts/:id', () => {
  it('deletes a contact', async () => {
    const contact = await db.contact.create({
      data: { ownerId: userId, name: 'ToDelete' }
    })

    const res = await supertest(app.server)
      .delete(`/contacts/${contact.id}`)
      .set('Authorization', authHeader)

    expect(res.status).toBe(204)
    const found = await db.contact.findUnique({ where: { id: contact.id } })
    expect(found).toBeNull()
  })
})

describe('POST /contacts/:id/invite', () => {
  it('sends an invite and sets invitedAt', async () => {
    const contact = await db.contact.create({
      data: { ownerId: userId, name: 'Dana', email: 'dana@example.com' },
    })

    const res = await supertest(app.server)
      .post(`/contacts/${contact.id}/invite`)
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.invitedAt).not.toBeNull()

    await db.contact.delete({ where: { id: contact.id } })
  })

  it('returns 400 when the contact has no email', async () => {
    const contact = await db.contact.create({
      data: { ownerId: userId, name: 'NoEmail' },
    })

    const res = await supertest(app.server)
      .post(`/contacts/${contact.id}/invite`)
      .set('Authorization', authHeader)

    expect(res.status).toBe(400)
    await db.contact.delete({ where: { id: contact.id } })
  })

  it('returns 404 for a contact owned by another user', async () => {
    const other = await createTestUser(app)
    const contact = await db.contact.create({
      data: { ownerId: other.user.id, name: 'Private', email: 'private@example.com' },
    })

    const res = await supertest(app.server)
      .post(`/contacts/${contact.id}/invite`)
      .set('Authorization', authHeader)

    expect(res.status).toBe(404)
    await db.contact.delete({ where: { id: contact.id } })
    await db.user.delete({ where: { id: other.user.id } })
  })

  it('returns 409 when the contact is already linked', async () => {
    const contact = await db.contact.create({
      data: { ownerId: userId, name: 'Linked', email: 'linked@example.com', isManaged: false },
    })

    const res = await supertest(app.server)
      .post(`/contacts/${contact.id}/invite`)
      .set('Authorization', authHeader)

    expect(res.status).toBe(409)
    await db.contact.delete({ where: { id: contact.id } })
  })
})
```

- [ ] **Step 2: Run tests to verify the new ones fail**

```bash
cd apps/api && pnpm test tests/contacts.test.ts
```

Expected: FAIL — the mocked `../src/services/mailer.js` module and the `/contacts/:id/invite` route don't exist yet.

- [ ] **Step 3: Add the nodemailer dependency**

In `apps/api/package.json`, add to `dependencies`:

```json
    "nodemailer": "^6.9.0",
```

And to `devDependencies`:

```json
    "@types/nodemailer": "^6.4.0",
```

Then run:

```bash
pnpm install
```

- [ ] **Step 4: Add the new env vars to config.ts**

In `apps/api/src/config.ts`, add to the zod schema (after `GOOGLE_CLIENT_ID`):

```typescript
  GMAIL_USER: z.string().email(),
  GMAIL_APP_PASSWORD: z.string().min(1),
  WEB_APP_URL: z.string().url(),
```

- [ ] **Step 5: Add the new env vars to .env.example**

In `apps/api/.env.example`, add:

```
GMAIL_USER=pantrywatson@gmail.com
GMAIL_APP_PASSWORD=your-16-char-gmail-app-password
WEB_APP_URL=http://localhost:5173
```

Also add real values to your local `apps/api/.env` (gitignored) so `pnpm test` can pass env validation — the mailer is mocked in tests, so the app password value itself doesn't need to be a working one for the test suite, but it must satisfy the zod checks (a non-empty string, a valid-looking email, a valid URL).

- [ ] **Step 6: Create the mailer service**

`apps/api/src/services/mailer.ts`:

```typescript
import nodemailer from 'nodemailer'
import { env } from '../config.js'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: env.GMAIL_USER,
    pass: env.GMAIL_APP_PASSWORD,
  },
})

export async function sendContactInvite(to: string, inviterName: string): Promise<void> {
  await transporter.sendMail({
    from: env.GMAIL_USER,
    to,
    subject: `${inviterName} invited you to Bestowd`,
    text: `${inviterName} added you as a gift-planning contact on Bestowd. Sign in with Google at ${env.WEB_APP_URL} to connect.`,
    html: `<p><strong>${inviterName}</strong> added you as a gift-planning contact on Bestowd.</p><p><a href="${env.WEB_APP_URL}">Sign in with Google</a> to connect.</p>`,
  })
}
```

- [ ] **Step 7: Add the invite route**

In `apps/api/src/routes/contacts.ts`, add the import and the new route (after the `claim` route, before the closing brace of `contactRoutes`):

```typescript
import type { FastifyInstance } from 'fastify'
import { db } from '../db.js'
import { sendContactInvite } from '../services/mailer.js'
```

```typescript
  // Invite flow: email an unmanaged contact a Bestowd sign-up invite
  app.post<{ Params: { id: string } }>('/contacts/:id/invite', async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const contact = await db.contact.findFirst({
      where: { id: request.params.id, ownerId: userId },
    })
    if (!contact) return reply.status(404).send({ error: 'Not found' })
    if (!contact.email) return reply.status(400).send({ error: 'Contact has no email' })
    if (!contact.isManaged) return reply.status(409).send({ error: 'Contact already linked' })

    const owner = await db.user.findUniqueOrThrow({ where: { id: userId } })
    await sendContactInvite(contact.email, owner.name)

    return db.contact.update({
      where: { id: contact.id },
      data: { invitedAt: new Date() },
    })
  })
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
cd apps/api && pnpm test tests/contacts.test.ts
```

Expected: all tests PASS, including the four new invite tests.

- [ ] **Step 9: Commit**

```bash
git add apps/api/package.json apps/api/src/config.ts apps/api/.env.example apps/api/src/services/mailer.ts apps/api/src/routes/contacts.ts apps/api/tests/contacts.test.ts pnpm-lock.yaml
git commit -m "feat: contact invite emails via Gmail SMTP"
```

---

### Task 4: Web app — invite button

**Files:**
- Modify: `packages/types/src/contact.ts`
- Modify: `packages/api-client/src/contacts.ts`
- Modify: `apps/web/src/pages/ContactDetailPage.tsx`

**Interfaces:**
- Consumes: `POST /contacts/:id/invite` via the new `sendInvite` client function.
- Produces: `Contact.invitedAt: string | null` in shared types; `sendInvite(id: string): Promise<Contact>` importable from `@bestowd/api-client`.

- [ ] **Step 1: Add invitedAt to the Contact type**

In `packages/types/src/contact.ts`, add `invitedAt` to the `Contact` interface:

```typescript
export interface Contact {
  id: string
  ownerId: string
  linkedUserId: string | null
  name: string
  avatarUrl: string | null
  email: string | null
  notes: string | null
  attributes: ContactAttribute[]
  isManaged: boolean
  invitedAt: string | null
  createdAt: string
  updatedAt: string
}
```

- [ ] **Step 2: Rebuild the types package**

```bash
pnpm --filter @bestowd/types build
```

- [ ] **Step 3: Add sendInvite to the api-client**

In `packages/api-client/src/contacts.ts`, add after `claimContact`:

```typescript
export function sendInvite(id: string): Promise<Contact> {
  return apiFetch(`/contacts/${id}/invite`, { method: 'POST' })
}
```

- [ ] **Step 4: Rebuild the api-client package**

```bash
pnpm --filter @bestowd/api-client build
```

- [ ] **Step 5: Add the invite button to ContactDetailPage**

Replace `apps/web/src/pages/ContactDetailPage.tsx` with:

```tsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getContact, updateContact, deleteContact, listAssignments, sendInvite } from '@bestowd/api-client'
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

  const invite = useMutation({
    mutationFn: () => sendInvite(id!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts', id] }),
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
          <div className="mb-4">
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

        {contact.isManaged && contact.email && (
          <div className="pt-4 border-t border-gray-100 flex items-center gap-3">
            <button
              onClick={() => invite.mutate()}
              disabled={invite.isPending}
              className="text-sm px-3 py-1.5 bg-brand text-white rounded-lg font-medium disabled:opacity-50"
            >
              {invite.isPending ? 'Sending…' : contact.invitedAt ? 'Resend Invite' : 'Send Invite'}
            </button>
            {contact.invitedAt && (
              <span className="text-xs text-gray-400">
                Invited on {new Date(contact.invitedAt).toLocaleDateString()}
              </span>
            )}
            {invite.isError && (
              <span className="text-xs text-red-500">Failed to send invite.</span>
            )}
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

- [ ] **Step 6: Verify the web app typechecks and builds**

```bash
pnpm --filter @bestowd/web build
```

Expected: no TypeScript errors.

- [ ] **Step 7: Manually verify in the browser**

With the API and web dev servers both running (see Task 3's env vars filled in), open a contact that has an email and `isManaged: true`, click "Send Invite", and confirm the button flips to "Resend Invite" with an "Invited on ..." date after the request completes.

- [ ] **Step 8: Commit**

```bash
git add packages/types/src/contact.ts packages/api-client/src/contacts.ts apps/web/src/pages/ContactDetailPage.tsx
git commit -m "feat: send contact invite button on contact detail page"
```
