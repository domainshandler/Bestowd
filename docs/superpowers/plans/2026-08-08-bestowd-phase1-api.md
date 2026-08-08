# Bestowd Phase 1 — API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Bestowd monorepo foundation and Fastify API covering auth, contacts, connections, events, gifts, product listings, and gift assignments.

**Architecture:** Turborepo monorepo with pnpm workspaces. `apps/api` is a Fastify 4 app with Prisma 5 and PostgreSQL. Shared TypeScript types live in `packages/types`. Google OAuth tokens are verified server-side and exchanged for Bestowd JWTs. The React web app and .NET MAUI mobile app are out of scope — see `2026-08-08-bestowd-phase1-web.md` and `2026-08-08-bestowd-phase1-mobile.md`.

**Tech Stack:** Node.js 20 LTS, TypeScript 5.4, Fastify 4, Prisma 5, PostgreSQL 16, Vitest, supertest, pnpm 9, Turborepo 2, google-auth-library, @fastify/jwt, zod.

## Global Constraints

- Node.js >= 20 LTS; pnpm >= 9
- TypeScript strict mode in all packages
- All API routes require JWT auth except `POST /auth/google` and `GET /health`
- Database: PostgreSQL on Neon.tech; `DATABASE_URL` uses `?pgbouncer=true` suffix
- String-based enum fields only in Prisma (no native enums) for migration flexibility
- Encrypted fields: AES-256-CBC using `ENCRYPTION_KEY` env var (32-byte hex string)
- JWT: `JWT_SECRET` env var, 7-day expiry, algorithm HS256
- CORS: `ALLOWED_ORIGINS` env var (comma-separated list)
- Test DB: `DATABASE_URL_TEST` env var; `prisma migrate deploy` runs against it in CI
- All monetary values stored as `Decimal` in Prisma, returned as strings in JSON

---

## File Map

```
bestowd/                          ← monorepo root
├── package.json                  ← pnpm workspace root
├── pnpm-workspace.yaml
├── turbo.json
├── packages/
│   ├── types/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts          ← re-exports all types
│   │       ├── user.ts
│   │       ├── contact.ts
│   │       ├── event.ts
│   │       ├── gift.ts
│   │       └── assignment.ts
│   └── config/
│       ├── package.json
│       ├── tsconfig.base.json
│       └── eslint.config.js
└── apps/
    └── api/
        ├── package.json
        ├── tsconfig.json
        ├── .env.example
        ├── prisma/
        │   └── schema.prisma
        ├── src/
        │   ├── index.ts          ← starts server on PORT
        │   ├── app.ts            ← Fastify app factory (exported for tests)
        │   ├── config.ts         ← zod env validation, exports typed `env`
        │   ├── db.ts             ← Prisma client singleton
        │   ├── crypto.ts         ← AES-256 encrypt/decrypt helpers
        │   ├── plugins/
        │   │   ├── jwt.ts        ← registers @fastify/jwt, adds `request.user`
        │   │   └── cors.ts       ← registers @fastify/cors
        │   ├── routes/
        │   │   ├── health.ts     ← GET /health
        │   │   ├── auth.ts       ← POST /auth/google, GET /auth/me
        │   │   ├── users.ts      ← PATCH /users/me
        │   │   ├── contacts.ts   ← CRUD /contacts, POST /contacts/:id/claim
        │   │   ├── connections.ts← POST /connections, PATCH /connections/:id
        │   │   ├── events.ts     ← CRUD /events
        │   │   ├── gifts.ts      ← CRUD /gifts
        │   │   ├── listings.ts   ← CRUD /gifts/:giftId/listings
        │   │   └── assignments.ts← CRUD /assignments
        │   └── services/
        │       ├── google-auth.ts← verifyGoogleToken(idToken) → GoogleProfile
        │       ├── next-occurrence.ts ← computeNextOccurrence(date, rule) → Date
        │       └── reminder-job.ts    ← node-cron daily scan, logs upcoming events
        └── tests/
            ├── setup.ts          ← global test setup: migrate DB, seed, cleanup
            ├── helpers.ts        ← createTestUser(), authHeader(), buildApp()
            ├── health.test.ts
            ├── auth.test.ts
            ├── users.test.ts
            ├── contacts.test.ts
            ├── connections.test.ts
            ├── events.test.ts
            ├── next-occurrence.test.ts
            ├── gifts.test.ts
            ├── listings.test.ts
            └── assignments.test.ts
```

---

### Task 1: Monorepo scaffold

**Files:**
- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `packages/config/package.json`
- Create: `packages/config/tsconfig.base.json`
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/.env.example`

**Interfaces:**
- Produces: working `pnpm install` + `pnpm turbo run build` from root

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "bestowd",
  "private": true,
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "test": "turbo run test",
    "lint": "turbo run lint"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.4.0"
  },
  "engines": {
    "node": ">=20",
    "pnpm": ">=9"
  }
}
```

- [ ] **Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [ ] **Step 3: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"],
      "env": ["DATABASE_URL_TEST", "JWT_SECRET", "ENCRYPTION_KEY"]
    },
    "lint": {}
  }
}
```

- [ ] **Step 4: Create packages/config/package.json**

```json
{
  "name": "@bestowd/config",
  "version": "0.0.1",
  "private": true,
  "exports": {
    "./tsconfig.base.json": "./tsconfig.base.json"
  }
}
```

- [ ] **Step 5: Create packages/config/tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 6: Create apps/api/package.json**

```json
{
  "name": "@bestowd/api",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@fastify/cors": "^9.0.0",
    "@fastify/jwt": "^8.0.0",
    "@prisma/client": "^5.14.0",
    "fastify": "^4.28.0",
    "google-auth-library": "^9.11.0",
    "node-cron": "^3.0.3",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@bestowd/config": "workspace:*",
    "@types/node": "^20.0.0",
    "@types/node-cron": "^3.0.11",
    "prisma": "^5.14.0",
    "supertest": "^7.0.0",
    "@types/supertest": "^6.0.2",
    "tsx": "^4.15.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 7: Create apps/api/tsconfig.json**

```json
{
  "extends": "@bestowd/config/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 8: Create apps/api/.env.example**

```
DATABASE_URL=postgresql://user:pass@host/bestowd?pgbouncer=true&connection_limit=1
DATABASE_URL_TEST=postgresql://user:pass@host/bestowd_test
JWT_SECRET=change-me-to-a-32-char-random-string
ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
ALLOWED_ORIGINS=http://localhost:5173
PORT=3000
```

- [ ] **Step 9: Run pnpm install from root**

```bash
pnpm install
```

Expected: lock file created, node_modules populated.

- [ ] **Step 10: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json pnpm-lock.yaml packages/config apps/api/package.json apps/api/tsconfig.json apps/api/.env.example
git commit -m "feat: monorepo scaffold with Turborepo and pnpm workspaces"
```

---

### Task 2: Shared types package

**Files:**
- Create: `packages/types/package.json`
- Create: `packages/types/tsconfig.json`
- Create: `packages/types/src/user.ts`
- Create: `packages/types/src/contact.ts`
- Create: `packages/types/src/event.ts`
- Create: `packages/types/src/gift.ts`
- Create: `packages/types/src/assignment.ts`
- Create: `packages/types/src/index.ts`

**Interfaces:**
- Produces: `@bestowd/types` importable in `apps/api` and `apps/web`

- [ ] **Step 1: Create packages/types/package.json**

```json
{
  "name": "@bestowd/types",
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
  "devDependencies": {
    "@bestowd/config": "workspace:*",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create packages/types/tsconfig.json**

```json
{
  "extends": "@bestowd/config/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create packages/types/src/user.ts**

```typescript
export type IdentitySource = 'google' | 'email'
export type SubscriptionStatus = 'free' | 'premium' | 'past_due' | 'cancelled'

export interface AiProviderConfig {
  provider: 'openai' | 'anthropic' | 'gemini'
  apiKey: string
  model: string
}

export interface User {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  identitySource: IdentitySource
  emailVerified: boolean
  subscriptionStatus: SubscriptionStatus
  createdAt: string
}

export interface UpdateUserBody {
  name?: string
  avatarUrl?: string
  aiProviderConfig?: AiProviderConfig
}
```

- [ ] **Step 4: Create packages/types/src/contact.ts**

```typescript
export interface ContactAttribute {
  label: string
  value: string
  visible: boolean
}

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
  createdAt: string
  updatedAt: string
}

export interface CreateContactBody {
  name: string
  email?: string
  avatarUrl?: string
  notes?: string
  attributes?: ContactAttribute[]
}

export interface UpdateContactBody {
  name?: string
  email?: string
  avatarUrl?: string
  notes?: string
  attributes?: ContactAttribute[]
}
```

- [ ] **Step 5: Create packages/types/src/event.ts**

```typescript
export type EventType = 'birthday' | 'anniversary' | 'christmas' | 'custom'
export type RecurrenceRule = 'once' | 'annual' | string

export interface BestowdEvent {
  id: string
  contactId: string
  type: EventType
  name: string
  date: string
  recurrenceRule: RecurrenceRule
  reminderDays: number[]
  nextOccurrence: string
  createdAt: string
  updatedAt: string
}

export interface CreateEventBody {
  contactId: string
  type: EventType
  name: string
  date: string
  recurrenceRule?: RecurrenceRule
  reminderDays?: number[]
}

export interface UpdateEventBody {
  type?: EventType
  name?: string
  date?: string
  recurrenceRule?: RecurrenceRule
  reminderDays?: number[]
}
```

- [ ] **Step 6: Create packages/types/src/gift.ts**

```typescript
export type GiftType = 'product' | 'basket'
export type Vendor = 'amazon' | 'etsy' | 'target' | 'custom'

export interface ProductListing {
  id: string
  giftId: string
  vendor: Vendor
  vendorProductId: string | null
  vendorUrl: string
  listedPrice: string | null
  currency: string
  createdAt: string
}

export interface Gift {
  id: string
  createdById: string
  type: GiftType
  title: string
  description: string | null
  imageUrl: string | null
  upc: string | null
  tags: string[]
  basketItems: Gift[]
  listings: ProductListing[]
  createdAt: string
  updatedAt: string
}

export interface CreateGiftBody {
  type?: GiftType
  title: string
  description?: string
  imageUrl?: string
  upc?: string
  tags?: string[]
  basketItemIds?: string[]
}

export interface UpdateGiftBody {
  title?: string
  description?: string
  imageUrl?: string
  upc?: string
  tags?: string[]
  basketItemIds?: string[]
}

export interface CreateListingBody {
  vendor: Vendor
  vendorProductId?: string
  vendorUrl: string
  listedPrice?: string
  currency?: string
}
```

- [ ] **Step 7: Create packages/types/src/assignment.ts**

```typescript
export type AssignmentStatus = 'idea' | 'purchased' | 'given'

export interface GiftAssignment {
  id: string
  giftId: string
  giverId: string
  contactId: string
  eventId: string | null
  status: AssignmentStatus
  givenAt: string | null
  purchasePrice: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateAssignmentBody {
  giftId: string
  contactId: string
  eventId?: string
  status?: AssignmentStatus
  notes?: string
}

export interface UpdateAssignmentBody {
  status?: AssignmentStatus
  givenAt?: string
  purchasePrice?: string
  notes?: string
}
```

- [ ] **Step 8: Create packages/types/src/index.ts**

```typescript
export * from './user.js'
export * from './contact.js'
export * from './event.js'
export * from './gift.js'
export * from './assignment.js'
```

- [ ] **Step 9: Add @bestowd/types to api dependencies, build types**

In `apps/api/package.json` dependencies add: `"@bestowd/types": "workspace:*"`

Then run:
```bash
pnpm install
pnpm --filter @bestowd/types build
```

- [ ] **Step 10: Commit**

```bash
git add packages/types apps/api/package.json pnpm-lock.yaml
git commit -m "feat: add shared types package"
```

---

### Task 3: API app scaffold

**Files:**
- Create: `apps/api/src/config.ts`
- Create: `apps/api/src/db.ts`
- Create: `apps/api/src/crypto.ts`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/index.ts`
- Create: `apps/api/src/plugins/cors.ts`
- Create: `apps/api/src/routes/health.ts`
- Create: `apps/api/tests/setup.ts`
- Create: `apps/api/tests/helpers.ts`
- Create: `apps/api/tests/health.test.ts`
- Create: `apps/api/vitest.config.ts`

**Interfaces:**
- Produces: `buildApp()` exported from `app.ts`; `GET /health` returns `{ status: 'ok' }`

- [ ] **Step 1: Write failing health test**

`apps/api/tests/health.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { buildApp } from '../src/app.js'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance

beforeAll(async () => {
  app = await buildApp()
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await supertest(app.server).get('/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && pnpm test
```

Expected: FAIL — module not found errors.

- [ ] **Step 3: Create apps/api/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    poolOptions: {
      forks: { singleFork: true }
    }
  }
})
```

- [ ] **Step 4: Create apps/api/src/config.ts**

```typescript
import { z } from 'zod'

const schema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().length(64),
  GOOGLE_CLIENT_ID: z.string(),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
```

- [ ] **Step 5: Create apps/api/src/db.ts**

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const db = globalForPrisma.prisma ?? new PrismaClient()

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = db
}
```

- [ ] **Step 6: Create apps/api/src/crypto.ts**

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { env } from './config.js'

const ALGORITHM = 'aes-256-cbc'
const KEY = Buffer.from(env.ENCRYPTION_KEY, 'hex')

export function encrypt(text: string): string {
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, KEY, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`
}

export function decrypt(ciphertext: string): string {
  const [ivHex, encHex] = ciphertext.split(':')
  const iv = Buffer.from(ivHex!, 'hex')
  const encrypted = Buffer.from(encHex!, 'hex')
  const decipher = createDecipheriv(ALGORITHM, KEY, iv)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}
```

- [ ] **Step 7: Create apps/api/src/plugins/cors.ts**

```typescript
import fp from 'fastify-plugin'
import cors from '@fastify/cors'
import { env } from '../config.js'

export default fp(async (app) => {
  await app.register(cors, {
    origin: env.ALLOWED_ORIGINS.split(',').map(o => o.trim()),
    credentials: true,
  })
})
```

Add `fastify-plugin` to dependencies: `pnpm --filter @bestowd/api add fastify-plugin`

- [ ] **Step 8: Create apps/api/src/routes/health.ts**

```typescript
import type { FastifyInstance } from 'fastify'

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({ status: 'ok' }))
}
```

- [ ] **Step 9: Create apps/api/src/app.ts**

```typescript
import Fastify from 'fastify'
import corsPlugin from './plugins/cors.js'
import { healthRoutes } from './routes/health.js'

export async function buildApp() {
  const app = Fastify({ logger: process.env['NODE_ENV'] !== 'test' })

  await app.register(corsPlugin)
  await app.register(healthRoutes)

  return app
}
```

- [ ] **Step 10: Create apps/api/src/index.ts**

```typescript
import { buildApp } from './app.js'
import { env } from './config.js'

const app = await buildApp()
await app.listen({ port: env.PORT, host: '0.0.0.0' })
```

- [ ] **Step 11: Create apps/api/tests/setup.ts**

```typescript
import { beforeAll, afterAll } from 'vitest'

// Override DATABASE_URL with test database before any imports load db
process.env['DATABASE_URL'] = process.env['DATABASE_URL_TEST'] ?? process.env['DATABASE_URL']!

beforeAll(async () => {
  // Migrations run via: pnpm prisma migrate deploy before tests
})

afterAll(async () => {
  const { db } = await import('../src/db.js')
  await db.$disconnect()
})
```

- [ ] **Step 12: Create apps/api/tests/helpers.ts**

```typescript
import { buildApp } from '../src/app.js'
import type { FastifyInstance } from 'fastify'

export async function createTestApp(): Promise<FastifyInstance> {
  const app = await buildApp()
  await app.ready()
  return app
}
```

- [ ] **Step 13: Run test to verify it passes**

```bash
cp apps/api/.env.example apps/api/.env
# Fill in DATABASE_URL_TEST with a real test PostgreSQL database
cd apps/api && pnpm test
```

Expected: PASS — `GET /health` returns `{ status: 'ok' }`.

- [ ] **Step 14: Commit**

```bash
git add apps/api/src apps/api/tests apps/api/vitest.config.ts pnpm-lock.yaml
git commit -m "feat: API scaffold with Fastify health endpoint"
```

---

### Task 4: Prisma schema and migrations

**Files:**
- Create: `apps/api/prisma/schema.prisma`

**Interfaces:**
- Produces: `db.user`, `db.contact`, `db.event`, `db.gift`, `db.productListing`, `db.giftAssignment`, `db.userConnection`, `db.exportConfig`, `db.exportRecord` — all Prisma models

- [ ] **Step 1: Create apps/api/prisma/schema.prisma**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id                 String   @id @default(cuid())
  googleId           String?  @unique
  email              String   @unique
  name               String
  avatarUrl          String?
  identitySource     String   @default("google")
  emailVerified      Boolean  @default(false)
  aiProviderConfig   String?
  stripeCustomerId   String?
  subscriptionStatus String   @default("free")
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  ownedContacts       Contact[]        @relation("OwnedContacts")
  linkedContact       Contact?         @relation("LinkedUser")
  sentConnections     UserConnection[] @relation("Requester")
  receivedConnections UserConnection[] @relation("Addressee")
  createdGifts        Gift[]
  giftAssignments     GiftAssignment[] @relation("Giver")
  exportConfigs       ExportConfig[]
}

model UserConnection {
  requesterId String
  addresseeId String
  status      String   @default("pending")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  requester User @relation("Requester", fields: [requesterId], references: [id], onDelete: Cascade)
  addressee User @relation("Addressee", fields: [addresseeId], references: [id], onDelete: Cascade)

  @@id([requesterId, addresseeId])
}

model Contact {
  id           String   @id @default(cuid())
  ownerId      String
  linkedUserId String?  @unique
  name         String
  avatarUrl    String?
  email        String?
  notes        String?
  attributes   Json     @default("[]")
  isManaged    Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  owner       User             @relation("OwnedContacts", fields: [ownerId], references: [id], onDelete: Cascade)
  linkedUser  User?            @relation("LinkedUser", fields: [linkedUserId], references: [id])
  events      Event[]
  assignments GiftAssignment[]
}

model Event {
  id             String   @id @default(cuid())
  contactId      String
  type           String
  name           String
  date           DateTime
  recurrenceRule String   @default("annual")
  reminderDays   Int[]    @default([30, 7, 1])
  nextOccurrence DateTime
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  contact     Contact          @relation(fields: [contactId], references: [id], onDelete: Cascade)
  assignments GiftAssignment[]
}

model Gift {
  id          String   @id @default(cuid())
  createdById String
  type        String   @default("product")
  title       String
  description String?
  imageUrl    String?
  upc         String?
  tags        String[] @default([])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  createdBy   User             @relation(fields: [createdById], references: [id])
  listings    ProductListing[]
  assignments GiftAssignment[]
  basketId    String?
  basket      Gift?            @relation("BasketItems", fields: [basketId], references: [id])
  basketItems Gift[]           @relation("BasketItems")
}

model ProductListing {
  id              String   @id @default(cuid())
  giftId          String
  vendor          String
  vendorProductId String?
  vendorUrl       String
  listedPrice     Decimal?
  currency        String   @default("USD")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  gift Gift @relation(fields: [giftId], references: [id], onDelete: Cascade)
}

model GiftAssignment {
  id            String    @id @default(cuid())
  giftId        String
  giverId       String
  contactId     String
  eventId       String?
  status        String    @default("idea")
  givenAt       DateTime?
  purchasePrice Decimal?
  notes         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  gift    Gift     @relation(fields: [giftId], references: [id])
  giver   User     @relation("Giver", fields: [giverId], references: [id])
  contact Contact  @relation(fields: [contactId], references: [id])
  event   Event?   @relation(fields: [eventId], references: [id])
}

model ExportConfig {
  id          String   @id @default(cuid())
  userId      String
  provider    String
  credentials String
  targetId    String?
  schedule    String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user    User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  records ExportRecord[]
}

model ExportRecord {
  id             String    @id @default(cuid())
  exportConfigId String
  entityType     String
  lastExportedAt DateTime?
  status         String
  createdAt      DateTime  @default(now())

  exportConfig ExportConfig @relation(fields: [exportConfigId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 2: Run migration on dev database**

```bash
cd apps/api
pnpm prisma migrate dev --name init
```

Expected: migration file created under `prisma/migrations/`, Prisma client regenerated.

- [ ] **Step 3: Run migration on test database**

```bash
DATABASE_URL=$DATABASE_URL_TEST pnpm prisma migrate deploy
```

- [ ] **Step 4: Verify Prisma client compiles**

```bash
pnpm prisma generate
pnpm build
```

Expected: no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma
git commit -m "feat: Prisma schema with all Phase 1 models"
```

---

### Task 5: Google OAuth + JWT auth route

**Files:**
- Create: `apps/api/src/services/google-auth.ts`
- Create: `apps/api/src/plugins/jwt.ts`
- Modify: `apps/api/src/app.ts`
- Create: `apps/api/src/routes/auth.ts`
- Create: `apps/api/tests/auth.test.ts`

**Interfaces:**
- Consumes: `db` from `db.ts`; `env` from `config.ts`
- Produces:
  - `verifyGoogleToken(idToken: string): Promise<GoogleProfile>` where `GoogleProfile = { googleId: string; email: string; name: string; avatarUrl: string | null }`
  - `POST /auth/google` → `{ token: string; user: User }`
  - `GET /auth/me` → `User` (requires JWT)
  - `request.user: { userId: string }` added to Fastify request by JWT plugin

- [ ] **Step 1: Write failing auth tests**

`apps/api/tests/auth.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import supertest from 'supertest'
import { buildApp } from '../src/app.js'
import { db } from '../src/db.js'
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && pnpm test tests/auth.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Create apps/api/src/services/google-auth.ts**

```typescript
import { OAuth2Client } from 'google-auth-library'
import { env } from '../config.js'

const client = new OAuth2Client(env.GOOGLE_CLIENT_ID)

export interface GoogleProfile {
  googleId: string
  email: string
  name: string
  avatarUrl: string | null
}

export async function verifyGoogleToken(idToken: string): Promise<GoogleProfile> {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: env.GOOGLE_CLIENT_ID,
  })
  const payload = ticket.getPayload()
  if (!payload?.sub || !payload.email) {
    throw new Error('Invalid Google token payload')
  }
  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name ?? payload.email,
    avatarUrl: payload.picture ?? null,
  }
}
```

- [ ] **Step 4: Create apps/api/src/plugins/jwt.ts**

```typescript
import fp from 'fastify-plugin'
import fjwt from '@fastify/jwt'
import { env } from '../config.js'

export default fp(async (app) => {
  await app.register(fjwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: '7d' },
  })

  app.decorate('authenticate', async (request: any, reply: any) => {
    try {
      await request.jwtVerify()
    } catch {
      reply.status(401).send({ error: 'Unauthorized' })
    }
  })
})

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}
```

- [ ] **Step 5: Create apps/api/src/routes/auth.ts**

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

    const token = app.jwt.sign({ userId: user.id })
    return reply.send({ token, user: toUserDto(user) })
  })

  app.get('/auth/me', { preHandler: [app.authenticate] }, async (request) => {
    const { userId } = request.user as { userId: string }
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } })
    return toUserDto(user)
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

- [ ] **Step 6: Register plugins and routes in app.ts**

```typescript
import Fastify from 'fastify'
import corsPlugin from './plugins/cors.js'
import jwtPlugin from './plugins/jwt.js'
import { healthRoutes } from './routes/health.js'
import { authRoutes } from './routes/auth.js'

export async function buildApp() {
  const app = Fastify({ logger: process.env['NODE_ENV'] !== 'test' })

  await app.register(corsPlugin)
  await app.register(jwtPlugin)
  await app.register(healthRoutes)
  await app.register(authRoutes)

  return app
}
```

- [ ] **Step 7: Update tests/helpers.ts to add auth helper**

```typescript
import { buildApp } from '../src/app.js'
import { db } from '../src/db.js'
import type { FastifyInstance } from 'fastify'

export async function createTestApp(): Promise<FastifyInstance> {
  const app = await buildApp()
  await app.ready()
  return app
}

export async function createTestUser(app: FastifyInstance, overrides: Partial<{
  googleId: string; email: string; name: string
}> = {}) {
  const user = await db.user.create({
    data: {
      googleId: overrides.googleId ?? `google-${Date.now()}`,
      email: overrides.email ?? `test-${Date.now()}@example.com`,
      name: overrides.name ?? 'Test User',
      identitySource: 'google',
      emailVerified: true,
    },
  })
  const token = app.jwt.sign({ userId: user.id })
  return { user, token, authHeader: `Bearer ${token}` }
}
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
cd apps/api && pnpm test tests/auth.test.ts
```

Expected: all auth tests PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/services/google-auth.ts apps/api/src/plugins/jwt.ts apps/api/src/routes/auth.ts apps/api/src/app.ts apps/api/tests/
git commit -m "feat: Google OAuth token exchange and JWT authentication"
```

---

### Task 6: Contacts CRUD

**Files:**
- Create: `apps/api/src/routes/contacts.ts`
- Modify: `apps/api/src/app.ts`
- Create: `apps/api/tests/contacts.test.ts`

**Interfaces:**
- Consumes: `app.authenticate` from JWT plugin; `db` from `db.ts`; `createTestUser()` from helpers
- Produces:
  - `GET /contacts` → `Contact[]` (only contacts owned by the authenticated user)
  - `POST /contacts` → `Contact` (201)
  - `GET /contacts/:id` → `Contact`
  - `PATCH /contacts/:id` → `Contact`
  - `DELETE /contacts/:id` → `204`
  - `POST /contacts/:id/claim` → `Contact` (links unmanaged contact to current user's Google email)

- [ ] **Step 1: Write failing contacts tests**

`apps/api/tests/contacts.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { createTestApp, createTestUser } from './helpers.js'
import { db } from '../src/db.js'
import type { FastifyInstance } from 'fastify'

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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && pnpm test tests/contacts.test.ts
```

Expected: FAIL — routes not registered.

- [ ] **Step 3: Create apps/api/src/routes/contacts.ts**

```typescript
import type { FastifyInstance } from 'fastify'
import { db } from '../db.js'

export async function contactRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  app.get('/contacts', async (request) => {
    const { userId } = request.user as { userId: string }
    return db.contact.findMany({ where: { ownerId: userId }, orderBy: { name: 'asc' } })
  })

  app.post<{ Body: { name: string; email?: string; avatarUrl?: string; notes?: string; attributes?: unknown[] } }>(
    '/contacts',
    {
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1 },
            email: { type: 'string' },
            avatarUrl: { type: 'string' },
            notes: { type: 'string' },
            attributes: { type: 'array' },
          },
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.user as { userId: string }
      const { name, email, avatarUrl, notes, attributes } = request.body
      const contact = await db.contact.create({
        data: {
          ownerId: userId,
          name,
          email,
          avatarUrl,
          notes,
          attributes: (attributes as any) ?? [],
          isManaged: true,
        },
      })
      return reply.status(201).send(contact)
    }
  )

  app.get<{ Params: { id: string } }>('/contacts/:id', async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const contact = await db.contact.findFirst({
      where: { id: request.params.id, ownerId: userId },
    })
    if (!contact) return reply.status(404).send({ error: 'Not found' })
    return contact
  })

  app.patch<{ Params: { id: string }; Body: { name?: string; email?: string; avatarUrl?: string; notes?: string; attributes?: unknown[] } }>(
    '/contacts/:id',
    async (request, reply) => {
      const { userId } = request.user as { userId: string }
      const existing = await db.contact.findFirst({
        where: { id: request.params.id, ownerId: userId },
      })
      if (!existing) return reply.status(404).send({ error: 'Not found' })
      const { name, email, avatarUrl, notes, attributes } = request.body
      return db.contact.update({
        where: { id: request.params.id },
        data: { name, email, avatarUrl, notes, ...(attributes !== undefined ? { attributes: attributes as any } : {}) },
      })
    }
  )

  app.delete<{ Params: { id: string } }>('/contacts/:id', async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const existing = await db.contact.findFirst({
      where: { id: request.params.id, ownerId: userId },
    })
    if (!existing) return reply.status(404).send({ error: 'Not found' })
    await db.contact.delete({ where: { id: request.params.id } })
    return reply.status(204).send()
  })

  // Claim flow: link unmanaged contact to current user if emails match
  app.post<{ Params: { id: string } }>('/contacts/:id/claim', async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } })
    const contact = await db.contact.findUnique({ where: { id: request.params.id } })

    if (!contact) return reply.status(404).send({ error: 'Not found' })
    if (!contact.isManaged) return reply.status(409).send({ error: 'Contact already linked' })
    if (contact.email?.toLowerCase() !== user.email.toLowerCase()) {
      return reply.status(403).send({ error: 'Email does not match contact record' })
    }

    const updated = await db.contact.update({
      where: { id: contact.id },
      data: { linkedUserId: userId, isManaged: false },
    })
    return updated
  })
}
```

- [ ] **Step 4: Register contacts routes in app.ts**

Add to `buildApp()`:
```typescript
import { contactRoutes } from './routes/contacts.js'
// ...
await app.register(contactRoutes)
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/api && pnpm test tests/contacts.test.ts
```

Expected: all contacts tests PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/contacts.ts apps/api/src/app.ts apps/api/tests/contacts.test.ts
git commit -m "feat: contacts CRUD with claim flow"
```

---

### Task 7: UserConnections endpoints

**Files:**
- Create: `apps/api/src/routes/connections.ts`
- Modify: `apps/api/src/app.ts`
- Create: `apps/api/tests/connections.test.ts`

**Interfaces:**
- Produces:
  - `POST /connections` `{ addresseeEmail: string }` → `UserConnection` (201) — sends connection request
  - `PATCH /connections/:requesterId` `{ status: 'accepted' | 'blocked' }` → `UserConnection`
  - `GET /connections` → `UserConnection[]` with status

- [ ] **Step 1: Write failing connections tests**

`apps/api/tests/connections.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { createTestApp, createTestUser } from './helpers.js'
import { db } from '../src/db.js'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance
let userA: { user: any; authHeader: string }
let userB: { user: any; authHeader: string }

beforeAll(async () => {
  app = await createTestApp()
  userA = await createTestUser(app)
  userB = await createTestUser(app)
})

afterAll(async () => {
  await db.userConnection.deleteMany({
    where: { OR: [{ requesterId: userA.user.id }, { addresseeId: userA.user.id }] }
  })
  await db.user.deleteMany({ where: { id: { in: [userA.user.id, userB.user.id] } } })
  await app.close()
})

describe('POST /connections', () => {
  it('creates a pending connection request', async () => {
    const res = await supertest(app.server)
      .post('/connections')
      .set('Authorization', userA.authHeader)
      .send({ addresseeEmail: userB.user.email })

    expect(res.status).toBe(201)
    expect(res.body.requesterId).toBe(userA.user.id)
    expect(res.body.addresseeId).toBe(userB.user.id)
    expect(res.body.status).toBe('pending')
  })

  it('returns 404 when addressee email not found', async () => {
    const res = await supertest(app.server)
      .post('/connections')
      .set('Authorization', userA.authHeader)
      .send({ addresseeEmail: 'nobody@example.com' })
    expect(res.status).toBe(404)
  })

  it('returns 409 when connection already exists', async () => {
    const res = await supertest(app.server)
      .post('/connections')
      .set('Authorization', userA.authHeader)
      .send({ addresseeEmail: userB.user.email })
    expect(res.status).toBe(409)
  })
})

describe('PATCH /connections/:requesterId', () => {
  it('addressee can accept the connection', async () => {
    const res = await supertest(app.server)
      .patch(`/connections/${userA.user.id}`)
      .set('Authorization', userB.authHeader)
      .send({ status: 'accepted' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('accepted')
  })
})

describe('GET /connections', () => {
  it('returns connections for the authenticated user', async () => {
    const res = await supertest(app.server)
      .get('/connections')
      .set('Authorization', userA.authHeader)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && pnpm test tests/connections.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Create apps/api/src/routes/connections.ts**

```typescript
import type { FastifyInstance } from 'fastify'
import { db } from '../db.js'

export async function connectionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  app.post<{ Body: { addresseeEmail: string } }>(
    '/connections',
    {
      schema: {
        body: {
          type: 'object',
          required: ['addresseeEmail'],
          properties: { addresseeEmail: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.user as { userId: string }
      const addressee = await db.user.findUnique({ where: { email: request.body.addresseeEmail } })
      if (!addressee) return reply.status(404).send({ error: 'User not found' })
      if (addressee.id === userId) return reply.status(400).send({ error: 'Cannot connect to yourself' })

      const existing = await db.userConnection.findUnique({
        where: { requesterId_addresseeId: { requesterId: userId, addresseeId: addressee.id } },
      })
      if (existing) return reply.status(409).send({ error: 'Connection already exists' })

      const connection = await db.userConnection.create({
        data: { requesterId: userId, addresseeId: addressee.id, status: 'pending' },
      })
      return reply.status(201).send(connection)
    }
  )

  app.patch<{ Params: { requesterId: string }; Body: { status: 'accepted' | 'blocked' } }>(
    '/connections/:requesterId',
    async (request, reply) => {
      const { userId } = request.user as { userId: string }
      const connection = await db.userConnection.findUnique({
        where: { requesterId_addresseeId: { requesterId: request.params.requesterId, addresseeId: userId } },
      })
      if (!connection) return reply.status(404).send({ error: 'Not found' })

      const updated = await db.userConnection.update({
        where: { requesterId_addresseeId: { requesterId: request.params.requesterId, addresseeId: userId } },
        data: { status: request.body.status },
      })
      return updated
    }
  )

  app.get('/connections', async (request) => {
    const { userId } = request.user as { userId: string }
    return db.userConnection.findMany({
      where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
    })
  })
}
```

- [ ] **Step 4: Register in app.ts**

```typescript
import { connectionRoutes } from './routes/connections.js'
await app.register(connectionRoutes)
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/api && pnpm test tests/connections.test.ts
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/connections.ts apps/api/src/app.ts apps/api/tests/connections.test.ts
git commit -m "feat: user connections with pending/accepted/blocked flow"
```

---

### Task 8: Events CRUD + nextOccurrence

**Files:**
- Create: `apps/api/src/services/next-occurrence.ts`
- Create: `apps/api/src/routes/events.ts`
- Modify: `apps/api/src/app.ts`
- Create: `apps/api/tests/next-occurrence.test.ts`
- Create: `apps/api/tests/events.test.ts`

**Interfaces:**
- Consumes: `db`; `app.authenticate`
- Produces:
  - `computeNextOccurrence(date: Date, rule: string): Date`
  - `GET /events` → `BestowdEvent[]` (all events for contacts owned by user)
  - `POST /events` → `BestowdEvent` (201)
  - `GET /events/:id` → `BestowdEvent`
  - `PATCH /events/:id` → `BestowdEvent`
  - `DELETE /events/:id` → 204

- [ ] **Step 1: Write failing nextOccurrence unit tests**

`apps/api/tests/next-occurrence.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { computeNextOccurrence } from '../src/services/next-occurrence.js'

describe('computeNextOccurrence', () => {
  it('returns the date unchanged for once rule', () => {
    const date = new Date('2027-06-15')
    const result = computeNextOccurrence(date, 'once')
    expect(result.getFullYear()).toBe(2027)
    expect(result.getMonth()).toBe(5)
    expect(result.getDate()).toBe(15)
  })

  it('returns current year occurrence when it has not passed yet', () => {
    const date = new Date('1990-12-31')
    const result = computeNextOccurrence(date, 'annual')
    const now = new Date()
    expect(result.getMonth()).toBe(11)
    expect(result.getDate()).toBe(31)
    expect(result.getFullYear()).toBeGreaterThanOrEqual(now.getFullYear())
  })

  it('returns next year when annual date already passed this year', () => {
    const pastDate = new Date(new Date().getFullYear() - 1, 0, 1) // Jan 1 last year
    const result = computeNextOccurrence(pastDate, 'annual')
    expect(result.getFullYear()).toBeGreaterThanOrEqual(new Date().getFullYear())
  })
})
```

- [ ] **Step 2: Run to verify fails**

```bash
cd apps/api && pnpm test tests/next-occurrence.test.ts
```

- [ ] **Step 3: Create apps/api/src/services/next-occurrence.ts**

```typescript
export function computeNextOccurrence(date: Date, recurrenceRule: string): Date {
  if (recurrenceRule === 'once') {
    return new Date(date)
  }

  if (recurrenceRule === 'annual') {
    const now = new Date()
    const thisYear = new Date(now.getFullYear(), date.getMonth(), date.getDate())
    if (thisYear > now) return thisYear
    return new Date(now.getFullYear() + 1, date.getMonth(), date.getDate())
  }

  // Unknown rule — return original date
  return new Date(date)
}
```

- [ ] **Step 4: Write failing events tests**

`apps/api/tests/events.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { createTestApp, createTestUser } from './helpers.js'
import { db } from '../src/db.js'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance
let authHeader: string
let userId: string
let contactId: string

beforeAll(async () => {
  app = await createTestApp()
  const result = await createTestUser(app)
  authHeader = result.authHeader
  userId = result.user.id
  const contact = await db.contact.create({ data: { ownerId: userId, name: 'Eve' } })
  contactId = contact.id
})

afterAll(async () => {
  await db.contact.delete({ where: { id: contactId } })
  await db.user.delete({ where: { id: userId } })
  await app.close()
})

describe('POST /events', () => {
  it('creates an event and computes nextOccurrence', async () => {
    const res = await supertest(app.server)
      .post('/events')
      .set('Authorization', authHeader)
      .send({
        contactId,
        type: 'birthday',
        name: "Eve's Birthday",
        date: '1990-03-15T00:00:00.000Z',
        recurrenceRule: 'annual',
        reminderDays: [30, 7],
      })

    expect(res.status).toBe(201)
    expect(res.body.name).toBe("Eve's Birthday")
    expect(res.body.nextOccurrence).toBeDefined()
  })

  it('returns 403 when contactId belongs to another user', async () => {
    const other = await createTestUser(app)
    const otherContact = await db.contact.create({ data: { ownerId: other.user.id, name: 'X' } })

    const res = await supertest(app.server)
      .post('/events')
      .set('Authorization', authHeader)
      .send({ contactId: otherContact.id, type: 'custom', name: 'Test', date: '2027-01-01T00:00:00.000Z' })

    expect(res.status).toBe(403)
    await db.contact.delete({ where: { id: otherContact.id } })
    await db.user.delete({ where: { id: other.user.id } })
  })
})

describe('GET /events', () => {
  it('returns events for the user contacts', async () => {
    const res = await supertest(app.server)
      .get('/events')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })
})
```

- [ ] **Step 5: Create apps/api/src/routes/events.ts**

```typescript
import type { FastifyInstance } from 'fastify'
import { db } from '../db.js'
import { computeNextOccurrence } from '../services/next-occurrence.js'

export async function eventRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  app.get('/events', async (request) => {
    const { userId } = request.user as { userId: string }
    const contacts = await db.contact.findMany({ where: { ownerId: userId }, select: { id: true } })
    const contactIds = contacts.map(c => c.id)
    return db.event.findMany({
      where: { contactId: { in: contactIds } },
      orderBy: { nextOccurrence: 'asc' },
    })
  })

  app.post<{
    Body: {
      contactId: string; type: string; name: string; date: string;
      recurrenceRule?: string; reminderDays?: number[]
    }
  }>(
    '/events',
    {
      schema: {
        body: {
          type: 'object',
          required: ['contactId', 'type', 'name', 'date'],
          properties: {
            contactId: { type: 'string' },
            type: { type: 'string' },
            name: { type: 'string' },
            date: { type: 'string' },
            recurrenceRule: { type: 'string' },
            reminderDays: { type: 'array', items: { type: 'integer' } },
          },
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.user as { userId: string }
      const { contactId, type, name, date, recurrenceRule = 'annual', reminderDays = [30, 7, 1] } = request.body

      const contact = await db.contact.findFirst({ where: { id: contactId, ownerId: userId } })
      if (!contact) return reply.status(403).send({ error: 'Contact not found or not owned by you' })

      const parsedDate = new Date(date)
      const nextOccurrence = computeNextOccurrence(parsedDate, recurrenceRule)

      const event = await db.event.create({
        data: { contactId, type, name, date: parsedDate, recurrenceRule, reminderDays, nextOccurrence },
      })
      return reply.status(201).send(event)
    }
  )

  app.get<{ Params: { id: string } }>('/events/:id', async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const event = await db.event.findUnique({
      where: { id: request.params.id },
      include: { contact: { select: { ownerId: true } } },
    })
    if (!event || event.contact.ownerId !== userId) return reply.status(404).send({ error: 'Not found' })
    return event
  })

  app.patch<{ Params: { id: string }; Body: { type?: string; name?: string; date?: string; recurrenceRule?: string; reminderDays?: number[] } }>(
    '/events/:id',
    async (request, reply) => {
      const { userId } = request.user as { userId: string }
      const event = await db.event.findUnique({
        where: { id: request.params.id },
        include: { contact: { select: { ownerId: true } } },
      })
      if (!event || event.contact.ownerId !== userId) return reply.status(404).send({ error: 'Not found' })

      const { type, name, date, recurrenceRule, reminderDays } = request.body
      const parsedDate = date ? new Date(date) : event.date
      const rule = recurrenceRule ?? event.recurrenceRule
      const nextOccurrence = computeNextOccurrence(parsedDate, rule)

      return db.event.update({
        where: { id: request.params.id },
        data: { type, name, date: parsedDate, recurrenceRule: rule, reminderDays, nextOccurrence },
      })
    }
  )

  app.delete<{ Params: { id: string } }>('/events/:id', async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const event = await db.event.findUnique({
      where: { id: request.params.id },
      include: { contact: { select: { ownerId: true } } },
    })
    if (!event || event.contact.ownerId !== userId) return reply.status(404).send({ error: 'Not found' })
    await db.event.delete({ where: { id: request.params.id } })
    return reply.status(204).send()
  })
}
```

- [ ] **Step 6: Register in app.ts**

```typescript
import { eventRoutes } from './routes/events.js'
await app.register(eventRoutes)
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
cd apps/api && pnpm test tests/next-occurrence.test.ts tests/events.test.ts
```

Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/services/next-occurrence.ts apps/api/src/routes/events.ts apps/api/src/app.ts apps/api/tests/
git commit -m "feat: events CRUD with nextOccurrence computation"
```

---

### Task 9: Reminder cron job

**Files:**
- Create: `apps/api/src/services/reminder-job.ts`
- Modify: `apps/api/src/index.ts`

**Interfaces:**
- Consumes: `db`; `node-cron`
- Produces: `startReminderJob()` — registers daily 9am cron, logs upcoming events (push notifications are Phase 4)

- [ ] **Step 1: Create apps/api/src/services/reminder-job.ts**

```typescript
import cron from 'node-cron'
import { db } from '../db.js'

export function startReminderJob() {
  // Runs every day at 9:00am server time
  cron.schedule('0 9 * * *', async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const events = await db.event.findMany({
      include: { contact: { include: { owner: true } } },
    })

    for (const event of events) {
      const daysUntil = Math.ceil(
        (event.nextOccurrence.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      )

      if (event.reminderDays.includes(daysUntil)) {
        console.log(
          `[reminder] ${event.contact.owner.email}: "${event.name}" for ${event.contact.name} in ${daysUntil} day(s)`
        )
        // Phase 4: send push notification here
      }

      // Advance nextOccurrence for annual events that have passed
      if (event.nextOccurrence < today && event.recurrenceRule === 'annual') {
        const next = new Date(
          today.getFullYear() + 1,
          event.nextOccurrence.getMonth(),
          event.nextOccurrence.getDate()
        )
        await db.event.update({ where: { id: event.id }, data: { nextOccurrence: next } })
      }
    }
  })

  console.log('[reminder] Daily reminder job scheduled')
}
```

- [ ] **Step 2: Start the job in index.ts**

```typescript
import { buildApp } from './app.js'
import { env } from './config.js'
import { startReminderJob } from './services/reminder-job.js'

const app = await buildApp()
startReminderJob()
await app.listen({ port: env.PORT, host: '0.0.0.0' })
```

- [ ] **Step 3: Verify it compiles**

```bash
cd apps/api && pnpm build
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/services/reminder-job.ts apps/api/src/index.ts
git commit -m "feat: daily reminder cron job for upcoming events"
```

---

### Task 10: Gifts CRUD

**Files:**
- Create: `apps/api/src/routes/gifts.ts`
- Modify: `apps/api/src/app.ts`
- Create: `apps/api/tests/gifts.test.ts`

**Interfaces:**
- Produces:
  - `GET /gifts` → `Gift[]` (gifts created by user)
  - `POST /gifts` → `Gift` (201) — supports type='basket' with basketItemIds
  - `GET /gifts/:id` → `Gift` with listings and basketItems
  - `PATCH /gifts/:id` → `Gift`
  - `DELETE /gifts/:id` → 204

- [ ] **Step 1: Write failing gifts tests**

`apps/api/tests/gifts.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { createTestApp, createTestUser } from './helpers.js'
import { db } from '../src/db.js'
import type { FastifyInstance } from 'fastify'

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
  await db.gift.deleteMany({ where: { createdById: userId } })
  await db.user.delete({ where: { id: userId } })
  await app.close()
})

describe('POST /gifts', () => {
  it('creates a product gift', async () => {
    const res = await supertest(app.server)
      .post('/gifts')
      .set('Authorization', authHeader)
      .send({ title: 'Kindle Paperwhite', tags: ['reading', 'tech'], type: 'product' })

    expect(res.status).toBe(201)
    expect(res.body.title).toBe('Kindle Paperwhite')
    expect(res.body.type).toBe('product')
    expect(res.body.createdById).toBe(userId)
  })

  it('creates a basket gift containing other gifts', async () => {
    const item1 = await db.gift.create({ data: { createdById: userId, title: 'Book', type: 'product' } })
    const item2 = await db.gift.create({ data: { createdById: userId, title: 'Mug', type: 'product' } })

    const res = await supertest(app.server)
      .post('/gifts')
      .set('Authorization', authHeader)
      .send({ title: 'Book + Mug Bundle', type: 'basket', basketItemIds: [item1.id, item2.id] })

    expect(res.status).toBe(201)
    expect(res.body.type).toBe('basket')
    expect(res.body.basketItems).toHaveLength(2)
  })

  it('returns 400 when title is missing', async () => {
    const res = await supertest(app.server)
      .post('/gifts')
      .set('Authorization', authHeader)
      .send({ tags: ['x'] })
    expect(res.status).toBe(400)
  })
})

describe('GET /gifts/:id', () => {
  it('returns gift with listings and basketItems', async () => {
    const gift = await db.gift.create({ data: { createdById: userId, title: 'Test Gift', type: 'product' } })

    const res = await supertest(app.server)
      .get(`/gifts/${gift.id}`)
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.listings).toBeDefined()
    expect(res.body.basketItems).toBeDefined()
  })
})
```

- [ ] **Step 2: Run to verify fails**

```bash
cd apps/api && pnpm test tests/gifts.test.ts
```

- [ ] **Step 3: Create apps/api/src/routes/gifts.ts**

```typescript
import type { FastifyInstance } from 'fastify'
import { db } from '../db.js'

export async function giftRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  app.get('/gifts', async (request) => {
    const { userId } = request.user as { userId: string }
    return db.gift.findMany({
      where: { createdById: userId },
      include: { listings: true, basketItems: true },
      orderBy: { createdAt: 'desc' },
    })
  })

  app.post<{
    Body: { title: string; type?: string; description?: string; imageUrl?: string; upc?: string; tags?: string[]; basketItemIds?: string[] }
  }>(
    '/gifts',
    {
      schema: {
        body: {
          type: 'object',
          required: ['title'],
          properties: {
            title: { type: 'string', minLength: 1 },
            type: { type: 'string', enum: ['product', 'basket'] },
            description: { type: 'string' },
            imageUrl: { type: 'string' },
            upc: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            basketItemIds: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.user as { userId: string }
      const { title, type = 'product', description, imageUrl, upc, tags = [], basketItemIds = [] } = request.body

      const gift = await db.gift.create({
        data: {
          createdById: userId,
          title,
          type,
          description,
          imageUrl,
          upc,
          tags,
          ...(basketItemIds.length > 0
            ? { basketItems: { connect: basketItemIds.map(id => ({ id })) } }
            : {}),
        },
        include: { listings: true, basketItems: true },
      })
      return reply.status(201).send(gift)
    }
  )

  app.get<{ Params: { id: string } }>('/gifts/:id', async (request, reply) => {
    const gift = await db.gift.findUnique({
      where: { id: request.params.id },
      include: { listings: true, basketItems: { include: { listings: true } } },
    })
    if (!gift) return reply.status(404).send({ error: 'Not found' })
    return gift
  })

  app.patch<{ Params: { id: string }; Body: { title?: string; description?: string; imageUrl?: string; upc?: string; tags?: string[]; basketItemIds?: string[] } }>(
    '/gifts/:id',
    async (request, reply) => {
      const { userId } = request.user as { userId: string }
      const existing = await db.gift.findFirst({ where: { id: request.params.id, createdById: userId } })
      if (!existing) return reply.status(404).send({ error: 'Not found' })

      const { title, description, imageUrl, upc, tags, basketItemIds } = request.body
      return db.gift.update({
        where: { id: request.params.id },
        data: {
          title, description, imageUrl, upc, tags,
          ...(basketItemIds !== undefined
            ? { basketItems: { set: basketItemIds.map(id => ({ id })) } }
            : {}),
        },
        include: { listings: true, basketItems: true },
      })
    }
  )

  app.delete<{ Params: { id: string } }>('/gifts/:id', async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const existing = await db.gift.findFirst({ where: { id: request.params.id, createdById: userId } })
    if (!existing) return reply.status(404).send({ error: 'Not found' })
    await db.gift.delete({ where: { id: request.params.id } })
    return reply.status(204).send()
  })
}
```

- [ ] **Step 4: Register in app.ts**

```typescript
import { giftRoutes } from './routes/gifts.js'
await app.register(giftRoutes)
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/api && pnpm test tests/gifts.test.ts
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/gifts.ts apps/api/src/app.ts apps/api/tests/gifts.test.ts
git commit -m "feat: gifts CRUD supporting product and basket types"
```

---

### Task 11: ProductListings CRUD

**Files:**
- Create: `apps/api/src/routes/listings.ts`
- Modify: `apps/api/src/app.ts`
- Create: `apps/api/tests/listings.test.ts`

**Interfaces:**
- Produces:
  - `GET /gifts/:giftId/listings` → `ProductListing[]`
  - `POST /gifts/:giftId/listings` → `ProductListing` (201)
  - `PATCH /gifts/:giftId/listings/:id` → `ProductListing`
  - `DELETE /gifts/:giftId/listings/:id` → 204

- [ ] **Step 1: Write failing listings tests**

`apps/api/tests/listings.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { createTestApp, createTestUser } from './helpers.js'
import { db } from '../src/db.js'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance
let authHeader: string
let userId: string
let giftId: string

beforeAll(async () => {
  app = await createTestApp()
  const result = await createTestUser(app)
  authHeader = result.authHeader
  userId = result.user.id
  const gift = await db.gift.create({ data: { createdById: userId, title: 'Watch', type: 'product' } })
  giftId = gift.id
})

afterAll(async () => {
  await db.gift.delete({ where: { id: giftId } })
  await db.user.delete({ where: { id: userId } })
  await app.close()
})

describe('POST /gifts/:giftId/listings', () => {
  it('adds a vendor listing to a gift', async () => {
    const res = await supertest(app.server)
      .post(`/gifts/${giftId}/listings`)
      .set('Authorization', authHeader)
      .send({
        vendor: 'amazon',
        vendorProductId: 'B0ABC123',
        vendorUrl: 'https://amazon.com/dp/B0ABC123',
        listedPrice: '49.99',
        currency: 'USD',
      })

    expect(res.status).toBe(201)
    expect(res.body.vendor).toBe('amazon')
    expect(res.body.giftId).toBe(giftId)
  })
})

describe('GET /gifts/:giftId/listings', () => {
  it('returns all listings for a gift', async () => {
    const res = await supertest(app.server)
      .get(`/gifts/${giftId}/listings`)
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify fails**

```bash
cd apps/api && pnpm test tests/listings.test.ts
```

- [ ] **Step 3: Create apps/api/src/routes/listings.ts**

```typescript
import type { FastifyInstance } from 'fastify'
import { db } from '../db.js'

export async function listingRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  app.get<{ Params: { giftId: string } }>('/gifts/:giftId/listings', async (request, reply) => {
    const gift = await db.gift.findUnique({ where: { id: request.params.giftId } })
    if (!gift) return reply.status(404).send({ error: 'Gift not found' })
    return db.productListing.findMany({ where: { giftId: request.params.giftId } })
  })

  app.post<{
    Params: { giftId: string }
    Body: { vendor: string; vendorProductId?: string; vendorUrl: string; listedPrice?: string; currency?: string }
  }>(
    '/gifts/:giftId/listings',
    {
      schema: {
        body: {
          type: 'object',
          required: ['vendor', 'vendorUrl'],
          properties: {
            vendor: { type: 'string', enum: ['amazon', 'etsy', 'target', 'custom'] },
            vendorProductId: { type: 'string' },
            vendorUrl: { type: 'string' },
            listedPrice: { type: 'string' },
            currency: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.user as { userId: string }
      const gift = await db.gift.findFirst({ where: { id: request.params.giftId, createdById: userId } })
      if (!gift) return reply.status(404).send({ error: 'Gift not found' })

      const { vendor, vendorProductId, vendorUrl, listedPrice, currency = 'USD' } = request.body
      const listing = await db.productListing.create({
        data: {
          giftId: gift.id,
          vendor,
          vendorProductId,
          vendorUrl,
          listedPrice: listedPrice ? parseFloat(listedPrice) : undefined,
          currency,
        },
      })
      return reply.status(201).send(listing)
    }
  )

  app.patch<{
    Params: { giftId: string; id: string }
    Body: { vendor?: string; vendorProductId?: string; vendorUrl?: string; listedPrice?: string; currency?: string }
  }>('/gifts/:giftId/listings/:id', async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const gift = await db.gift.findFirst({ where: { id: request.params.giftId, createdById: userId } })
    if (!gift) return reply.status(404).send({ error: 'Gift not found' })

    const { vendor, vendorProductId, vendorUrl, listedPrice, currency } = request.body
    return db.productListing.update({
      where: { id: request.params.id },
      data: {
        vendor, vendorProductId, vendorUrl, currency,
        listedPrice: listedPrice ? parseFloat(listedPrice) : undefined,
      },
    })
  })

  app.delete<{ Params: { giftId: string; id: string } }>('/gifts/:giftId/listings/:id', async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const gift = await db.gift.findFirst({ where: { id: request.params.giftId, createdById: userId } })
    if (!gift) return reply.status(404).send({ error: 'Gift not found' })
    await db.productListing.delete({ where: { id: request.params.id } })
    return reply.status(204).send()
  })
}
```

- [ ] **Step 4: Register in app.ts**

```typescript
import { listingRoutes } from './routes/listings.js'
await app.register(listingRoutes)
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/api && pnpm test tests/listings.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/listings.ts apps/api/src/app.ts apps/api/tests/listings.test.ts
git commit -m "feat: product listings CRUD nested under gifts"
```

---

### Task 12: GiftAssignments CRUD

**Files:**
- Create: `apps/api/src/routes/assignments.ts`
- Modify: `apps/api/src/app.ts`
- Create: `apps/api/tests/assignments.test.ts`

**Interfaces:**
- Produces:
  - `GET /assignments?contactId=&eventId=` → `GiftAssignment[]`
  - `POST /assignments` → `GiftAssignment` (201)
  - `GET /assignments/:id` → `GiftAssignment`
  - `PATCH /assignments/:id` → `GiftAssignment`
  - `DELETE /assignments/:id` → 204

- [ ] **Step 1: Write failing assignments tests**

`apps/api/tests/assignments.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { createTestApp, createTestUser } from './helpers.js'
import { db } from '../src/db.js'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance
let authHeader: string
let userId: string
let contactId: string
let giftId: string

beforeAll(async () => {
  app = await createTestApp()
  const result = await createTestUser(app)
  authHeader = result.authHeader
  userId = result.user.id
  const contact = await db.contact.create({ data: { ownerId: userId, name: 'Recipient' } })
  contactId = contact.id
  const gift = await db.gift.create({ data: { createdById: userId, title: 'Headphones' } })
  giftId = gift.id
})

afterAll(async () => {
  await db.giftAssignment.deleteMany({ where: { giverId: userId } })
  await db.gift.deleteMany({ where: { createdById: userId } })
  await db.contact.deleteMany({ where: { ownerId: userId } })
  await db.user.delete({ where: { id: userId } })
  await app.close()
})

describe('POST /assignments', () => {
  it('creates a gift assignment', async () => {
    const res = await supertest(app.server)
      .post('/assignments')
      .set('Authorization', authHeader)
      .send({ giftId, contactId, status: 'idea', notes: 'For Christmas' })

    expect(res.status).toBe(201)
    expect(res.body.giftId).toBe(giftId)
    expect(res.body.contactId).toBe(contactId)
    expect(res.body.giverId).toBe(userId)
    expect(res.body.status).toBe('idea')
  })

  it('returns 404 when contact not owned by user', async () => {
    const other = await createTestUser(app)
    const otherContact = await db.contact.create({ data: { ownerId: other.user.id, name: 'Z' } })

    const res = await supertest(app.server)
      .post('/assignments')
      .set('Authorization', authHeader)
      .send({ giftId, contactId: otherContact.id })

    expect(res.status).toBe(404)
    await db.contact.delete({ where: { id: otherContact.id } })
    await db.user.delete({ where: { id: other.user.id } })
  })
})

describe('GET /assignments', () => {
  it('returns assignments filtered by contactId', async () => {
    const res = await supertest(app.server)
      .get(`/assignments?contactId=${contactId}`)
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    res.body.forEach((a: any) => expect(a.contactId).toBe(contactId))
  })
})

describe('PATCH /assignments/:id', () => {
  it('updates assignment status to given with givenAt timestamp', async () => {
    const assignment = await db.giftAssignment.create({
      data: { giftId, giverId: userId, contactId, status: 'purchased' }
    })
    const givenAt = new Date().toISOString()

    const res = await supertest(app.server)
      .patch(`/assignments/${assignment.id}`)
      .set('Authorization', authHeader)
      .send({ status: 'given', givenAt, purchasePrice: '79.99' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('given')
    expect(res.body.purchasePrice).toBe('79.99')
  })
})
```

- [ ] **Step 2: Run to verify fails**

```bash
cd apps/api && pnpm test tests/assignments.test.ts
```

- [ ] **Step 3: Create apps/api/src/routes/assignments.ts**

```typescript
import type { FastifyInstance } from 'fastify'
import { db } from '../db.js'

export async function assignmentRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  app.get<{ Querystring: { contactId?: string; eventId?: string } }>('/assignments', async (request) => {
    const { userId } = request.user as { userId: string }
    const { contactId, eventId } = request.query
    return db.giftAssignment.findMany({
      where: {
        giverId: userId,
        ...(contactId ? { contactId } : {}),
        ...(eventId ? { eventId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    })
  })

  app.post<{
    Body: { giftId: string; contactId: string; eventId?: string; status?: string; notes?: string }
  }>(
    '/assignments',
    {
      schema: {
        body: {
          type: 'object',
          required: ['giftId', 'contactId'],
          properties: {
            giftId: { type: 'string' },
            contactId: { type: 'string' },
            eventId: { type: 'string' },
            status: { type: 'string', enum: ['idea', 'purchased', 'given'] },
            notes: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.user as { userId: string }
      const { giftId, contactId, eventId, status = 'idea', notes } = request.body

      const contact = await db.contact.findFirst({ where: { id: contactId, ownerId: userId } })
      if (!contact) return reply.status(404).send({ error: 'Contact not found' })

      const gift = await db.gift.findUnique({ where: { id: giftId } })
      if (!gift) return reply.status(404).send({ error: 'Gift not found' })

      const assignment = await db.giftAssignment.create({
        data: { giftId, giverId: userId, contactId, eventId, status, notes },
      })
      return reply.status(201).send(assignment)
    }
  )

  app.get<{ Params: { id: string } }>('/assignments/:id', async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const assignment = await db.giftAssignment.findFirst({
      where: { id: request.params.id, giverId: userId },
    })
    if (!assignment) return reply.status(404).send({ error: 'Not found' })
    return assignment
  })

  app.patch<{
    Params: { id: string }
    Body: { status?: string; givenAt?: string; purchasePrice?: string; notes?: string }
  }>('/assignments/:id', async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const existing = await db.giftAssignment.findFirst({ where: { id: request.params.id, giverId: userId } })
    if (!existing) return reply.status(404).send({ error: 'Not found' })

    const { status, givenAt, purchasePrice, notes } = request.body
    const updated = await db.giftAssignment.update({
      where: { id: request.params.id },
      data: {
        status,
        notes,
        givenAt: givenAt ? new Date(givenAt) : undefined,
        purchasePrice: purchasePrice ? parseFloat(purchasePrice) : undefined,
      },
    })
    // Return purchasePrice as string to match Decimal serialization
    return { ...updated, purchasePrice: updated.purchasePrice?.toString() ?? null }
  })

  app.delete<{ Params: { id: string } }>('/assignments/:id', async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const existing = await db.giftAssignment.findFirst({ where: { id: request.params.id, giverId: userId } })
    if (!existing) return reply.status(404).send({ error: 'Not found' })
    await db.giftAssignment.delete({ where: { id: request.params.id } })
    return reply.status(204).send()
  })
}
```

- [ ] **Step 4: Register in app.ts**

```typescript
import { assignmentRoutes } from './routes/assignments.js'
await app.register(assignmentRoutes)
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/api && pnpm test tests/assignments.test.ts
```

- [ ] **Step 6: Run all tests**

```bash
cd apps/api && pnpm test
```

Expected: all test suites PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/assignments.ts apps/api/src/app.ts apps/api/tests/assignments.test.ts
git commit -m "feat: gift assignments CRUD with status tracking"
```

---

### Task 13: User profile endpoint

**Files:**
- Create: `apps/api/src/routes/users.ts`
- Modify: `apps/api/src/app.ts`
- Create: `apps/api/tests/users.test.ts`

**Interfaces:**
- Consumes: `encrypt` / `decrypt` from `crypto.ts`
- Produces:
  - `PATCH /users/me` → `User` — update name, avatarUrl, aiProviderConfig (encrypted)

- [ ] **Step 1: Write failing users tests**

`apps/api/tests/users.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { createTestApp, createTestUser } from './helpers.js'
import { db } from '../src/db.js'
import type { FastifyInstance } from 'fastify'

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
  await db.user.delete({ where: { id: userId } })
  await app.close()
})

describe('PATCH /users/me', () => {
  it('updates user name', async () => {
    const res = await supertest(app.server)
      .patch('/users/me')
      .set('Authorization', authHeader)
      .send({ name: 'Updated Name' })

    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Updated Name')
  })

  it('stores aiProviderConfig encrypted and does not return the raw apiKey', async () => {
    const res = await supertest(app.server)
      .patch('/users/me')
      .set('Authorization', authHeader)
      .send({ aiProviderConfig: { provider: 'openai', apiKey: 'sk-secret', model: 'gpt-4o' } })

    expect(res.status).toBe(200)
    // aiProviderConfig is not returned in user DTO
    expect(res.body.aiProviderConfig).toBeUndefined()

    // Verify it was encrypted in DB
    const dbUser = await db.user.findUnique({ where: { id: userId } })
    expect(dbUser?.aiProviderConfig).not.toBe('sk-secret')
    expect(dbUser?.aiProviderConfig).toContain(':') // AES format: iv:cipher
  })
})
```

- [ ] **Step 2: Run to verify fails**

```bash
cd apps/api && pnpm test tests/users.test.ts
```

- [ ] **Step 3: Create apps/api/src/routes/users.ts**

```typescript
import type { FastifyInstance } from 'fastify'
import { db } from '../db.js'
import { encrypt } from '../crypto.js'

export async function userRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  app.patch<{
    Body: {
      name?: string
      avatarUrl?: string
      aiProviderConfig?: { provider: string; apiKey: string; model: string }
    }
  }>('/users/me', async (request) => {
    const { userId } = request.user as { userId: string }
    const { name, avatarUrl, aiProviderConfig } = request.body

    const user = await db.user.update({
      where: { id: userId },
      data: {
        name,
        avatarUrl,
        ...(aiProviderConfig
          ? { aiProviderConfig: encrypt(JSON.stringify(aiProviderConfig)) }
          : {}),
      },
    })

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
  })
}
```

- [ ] **Step 4: Register in app.ts**

```typescript
import { userRoutes } from './routes/users.js'
await app.register(userRoutes)
```

- [ ] **Step 5: Run all tests**

```bash
cd apps/api && pnpm test
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/users.ts apps/api/src/app.ts apps/api/tests/users.test.ts
git commit -m "feat: user profile PATCH with encrypted AI provider config"
```
