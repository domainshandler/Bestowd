# Data-model Realignment (API) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the API's user → contacts → events → gifts model with the v1 model from the spec:
- group → families → people → occasions;
- a two-way gift log;
- ideas;
- budgets;
- minimal family connections.

All of it is behind group-membership access checks.

**Architecture:**
- **Schema:** one Prisma baseline migration replaces all existing migrations. The dev and test databases get reset.
- **Groups:** every domain row carries `groupId`. A single `requireMember` helper guards every route.
- **Sign-in:** first sign-in silently provisions a personal group and an own-household family.
- **Routes:** grouped by entity under `src/routes/`, with pure logic in `src/services/`.
  - Pure logic means next occurrence, age, status advance, repeat check and totals.
  - Services are unit-tested without the database where possible.
- **Shared packages and web:** `packages/types` and `packages/api-client` are rewritten. The web app is cut down to Home and Account so it still builds; the full web screens get their own plan.

**Tech Stack:** Fastify 4, Prisma 5, PostgreSQL, Vitest, supertest, React 18, TanStack Query.

**Reference:** `docs/superpowers/specs/2026-11-18-data-model-realignment.md`

## Global Constraints

- **Database reset is approved** (decision 3). Delete `apps/api/prisma/migrations/*` and create one migration, `20261118120000_init_v1`. Never write data-migration code.
- **Missing access returns 404, not 403.** A user who isn't a member of the owning group gets **404**. The one exception: a member who isn't an `OWNER` gets **403** on owner-only actions.
- **Ids from the request body must belong to the same group** as the route's group. This covers `personId`, `familyId`, `occasionId` and `ideaId`; a mismatch returns **400**.
- **Exactly one subject or counterparty:** `Occasion` and `GiftEntry` take exactly one of `personId` or `familyId`. The API enforces it with a 400, and DB check constraints enforce it too.
- **Money:**
  - Stored as `Decimal(10,2)` and serialised to JSON as `number | null`.
  - Dates are serialised as ISO strings.
- **Received gifts** default to `valueHidden: true` when the body doesn't set it. Totals for received value include only gifts where `valueHidden = false`.
- **Occasion status:**
  - It only moves forward automatically (`NOT_STARTED < IDEA_SAVED < BOUGHT < GIVEN`).
  - A PATCH can set any value.
  - The reminder job resets it to `NOT_STARTED` when a recurring occasion rolls to its next year.
- **Tests:**
  - Every route file gets a supertest test file.
  - Tests create their own users through `createTestUser`, which provisions a group, and delete them in `afterAll`. Deleting a group cascades to everything in it.
  - The mailer stays mocked wherever it's imported.
- **Running tests:** `. <env file> && pnpm --filter @bestowd/api test` against `bestowd_test`.
- **Keep:** `mailer.ts`, `crypto.ts` and the `ENCRYPTION_KEY` config.
- **Commits:** one commit per task, conventional prefix (`feat:`, `refactor:`, `chore:`). Never commit `packages/types/dist` or `packages/types/node_modules`.

### Deviations from the spec (made while planning, so the schema stays Prisma-native)

| Spec | Plan | Why |
|---|---|---|
| `GroupMembership.isPrimary` + partial unique index | `User.primaryGroupId` (nullable FK) | Prisma can't model partial indexes, and `migrate dev` would try to drop them. |
| `Family.isOwnHousehold` + partial unique index | `Family.householdOfGroupId String? @unique` | Same reason. Postgres allows many NULLs in a unique column. |
| `Occasion.reminderDays Int[]?` | `Int[] @default([])`, where empty means "use group default" | Prisma scalar lists can't be optional. |
| `FamilyConnection.revokedAt` | Revoking deletes the row | Unique `familyId` would otherwise block reconnecting. |
| "PATCH /ideas/:id … mark bought" | `POST /ideas/:id/buy` | Buying creates a gift entry; that side effect gets its own endpoint. |
| (not in spec) | `GET /groups/:g/spend?year=` | Scope's "spend per month/year/family". |

Task 1 updates the spec to match this table.

---

## File Map

```
apps/api/
├── prisma/
│   ├── schema.prisma                         ← rewrite
│   └── migrations/
│       ├── 2026080902…, 2026080916…, 2026111803…  ← delete
│       └── 20261118120000_init_v1/migration.sql   ← create
├── src/
│   ├── app.ts                                ← modify: register new routes, error handler
│   ├── http-error.ts                         ← create
│   ├── dto.ts                                ← create: serialisers
│   ├── services/
│   │   ├── access.ts                         ← create: requireMember, requireOwner, assertSubject, loadOr404
│   │   ├── groups.ts                         ← create: provisionPersonalGroup
│   │   ├── next-occurrence.ts                ← rewrite
│   │   ├── age.ts                            ← create
│   │   ├── occasion-status.ts                ← create: advanceOccasionStatus
│   │   ├── budgets.ts                        ← create: effectiveBudget
│   │   ├── repeats.ts                        ← create: findRepeat
│   │   ├── reminder-job.ts                   ← rewrite
│   │   └── tokens.ts                         ← create
│   └── routes/
│       ├── auth.ts                           ← modify: provision group, drop auto-link
│       ├── me.ts                             ← create: /me, /me/occasions
│       ├── groups.ts                         ← create
│       ├── families.ts                       ← create
│       ├── people.ts                         ← create
│       ├── occasions.ts                      ← create
│       ├── gifts.ts                          ← rewrite
│       ├── ideas.ts                          ← create
│       ├── invites.ts                        ← create
│       ├── users.ts                          ← modify: drop aiProviderConfig
│       └── contacts.ts, events.ts, listings.ts, assignments.ts, connections.ts  ← delete
└── tests/
    ├── helpers.ts                            ← modify
    ├── auth.test.ts, users.test.ts, reminders.test.ts, next-occurrence.test.ts, gifts.test.ts  ← rewrite
    ├── me.test.ts, groups.test.ts, families.test.ts, people.test.ts, occasions.test.ts,
    │   ideas.test.ts, invites.test.ts, services.test.ts     ← create
    └── contacts.test.ts, events.test.ts, listings.test.ts, assignments.test.ts, connections.test.ts  ← delete

packages/types/src/        ← rewrite: user, group, family, person, occasion, gift, idea, invite
packages/api-client/src/   ← rewrite to match routes
apps/web/src/              ← cut down to Home + Account (Task 12)
docs/superpowers/specs/2026-11-18-data-model-realignment.md  ← modify (Task 1)
```

---

### Task 1: Schema reset and removal of the old model

**Files:**
- Rewrite: `apps/api/prisma/schema.prisma`
- Delete: the three old migration folders. Create `20261118120000_init_v1/migration.sql`.
- Delete:
  - routes: `contacts.ts`, `events.ts`, `listings.ts`, `assignments.ts`, `connections.ts`;
  - the matching tests;
  - the current `gifts.ts` route and its test (rewritten in Task 8).
- Modify:
  - `src/app.ts`: register only `health`, `auth`, `users`.
  - `src/routes/auth.ts`: remove `autoLinkContact` and the `Prisma` import. Drop `subscriptionStatus` from `toUserDto`.
  - `src/routes/users.ts`: drop `aiProviderConfig`, the `encrypt` import and `subscriptionStatus`.
  - `tests/auth.test.ts`: delete the auto-link tests.
  - `tests/users.test.ts`: delete the AI-config assertions.
  - `tests/reminders.test.ts`, `tests/next-occurrence.test.ts`: delete for now (rewritten in Task 10).
  - `src/services/reminder-job.ts`: temporarily make `scanUpcomingEvents` a no-op returning `[]`, so `index.ts` still compiles.
- Modify the spec: replace the affected spec fields with the deviations from the table above.

- [ ] **Step 1: Write the new schema**

Replace `apps/api/prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

enum MembershipRole {
  OWNER
  MEMBER
}

enum FamilyType {
  FAMILY
  FRIENDS
  SCHOOL
  OTHER
}

enum FamilyStatus {
  ACTIVE
  PAUSED
  ARCHIVED
}

enum OccasionType {
  BIRTHDAY
  HOLIDAY
  ONE_OFF
}

enum OccasionStatus {
  NOT_STARTED
  IDEA_SAVED
  BOUGHT
  GIVEN
}

enum Rsvp {
  NONE
  YES
  NO
  MAYBE
}

enum GiftDirection {
  GIVEN
  RECEIVED
}

enum GiftStatus {
  BOUGHT
  GIVEN
}

enum Reaction {
  LOVED_IT
  LIKED_IT
  ALREADY_HAD_IT
  NOT_A_HIT
}

enum IdeaStatus {
  SAVED
  BOUGHT
  DISMISSED
}

enum InviteKind {
  FAMILY
  GROUP
}

model User {
  id             String   @id @default(cuid())
  googleId       String?  @unique
  email          String   @unique
  name           String
  avatarUrl      String?
  identitySource String   @default("google")
  emailVerified  Boolean  @default(false)
  primaryGroupId String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  primaryGroup    Group?            @relation("PrimaryGroup", fields: [primaryGroupId], references: [id], onDelete: SetNull)
  memberships     GroupMembership[]
  createdGifts    GiftEntry[]       @relation("GiftCreatedBy")
  createdIdeas    Idea[]            @relation("IdeaCreatedBy")
  createdInvites  InviteLink[]      @relation("InviteCreatedBy")
  acceptedInvites InviteLink[]      @relation("InviteAcceptedBy")
}

model Group {
  id                  String   @id @default(cuid())
  name                String
  currency            String   @default("CAD")
  defaultBudgets      Json     @default("{}")
  defaultReminderDays Int[]    @default([14, 3])
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  memberships     GroupMembership[]
  primaryFor      User[]            @relation("PrimaryGroup")
  families        Family[]          @relation("GroupFamilies")
  householdFamily Family?           @relation("GroupHousehold")
  people          Person[]
  occasions       Occasion[]
  gifts           GiftEntry[]
  ideas           Idea[]
  invites         InviteLink[]
}

model GroupMembership {
  groupId   String
  userId    String
  role      MembershipRole @default(MEMBER)
  createdAt DateTime       @default(now())

  group Group @relation(fields: [groupId], references: [id], onDelete: Cascade)
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([groupId, userId])
  @@index([userId])
}

model Family {
  id                 String       @id @default(cuid())
  groupId            String
  householdOfGroupId String?      @unique
  name               String
  type               FamilyType   @default(FAMILY)
  status             FamilyStatus @default(ACTIVE)
  photoUrl           String?
  notes              String?
  createdAt          DateTime     @default(now())
  updatedAt          DateTime     @updatedAt

  group             Group              @relation("GroupFamilies", fields: [groupId], references: [id], onDelete: Cascade)
  householdOf       Group?             @relation("GroupHousehold", fields: [householdOfGroupId], references: [id], onDelete: Cascade)
  people            Person[]
  occasions         Occasion[]
  gifts             GiftEntry[]
  invites           InviteLink[]
  connection        FamilyConnection?  @relation("ConnectedFamily")
  sharedConnections FamilyConnection[] @relation("SourceFamily")

  @@index([groupId])
}

model Person {
  id           String    @id @default(cuid())
  groupId      String
  familyId     String
  name         String
  relationship String?
  birthMonth   Int?
  birthDay     Int?
  birthYear    Int?
  likes        String[]  @default([])
  avoid        String[]  @default([])
  sizes        Json      @default("{}")
  foodNotes    String?
  photoUrl     String?
  notes        String?
  archivedAt   DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  group     Group        @relation(fields: [groupId], references: [id], onDelete: Cascade)
  family    Family       @relation(fields: [familyId], references: [id], onDelete: Cascade)
  occasions Occasion[]
  gifts     GiftEntry[]
  credits   GiftCredit[]
  ideaTags  IdeaPerson[]

  @@index([familyId])
}

model Occasion {
  id               String         @id @default(cuid())
  groupId          String
  personId         String?
  familyId         String?
  type             OccasionType
  name             String
  date             DateTime
  recursAnnually   Boolean        @default(true)
  recurrenceEndsAt DateTime?
  nextOccurrence   DateTime?
  budget           Decimal?       @db.Decimal(10, 2)
  status           OccasionStatus @default(NOT_STARTED)
  needsCard        Boolean        @default(false)
  cardDone         Boolean        @default(false)
  reminderDays     Int[]          @default([])
  partyAt          DateTime?
  location         String?
  rsvp             Rsvp           @default(NONE)
  hostGiftRequest  String?
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  group  Group       @relation(fields: [groupId], references: [id], onDelete: Cascade)
  person Person?     @relation(fields: [personId], references: [id], onDelete: Cascade)
  family Family?     @relation(fields: [familyId], references: [id], onDelete: Cascade)
  gifts  GiftEntry[]
  ideas  Idea[]

  @@index([groupId, nextOccurrence])
}

model GiftEntry {
  id             String        @id @default(cuid())
  groupId        String
  direction      GiftDirection
  title          String
  category       String?
  occasionId     String?
  occasionDate   DateTime?
  date           DateTime
  personId       String?
  familyId       String?
  amount         Decimal?      @db.Decimal(10, 2)
  status         GiftStatus?
  valueHidden    Boolean       @default(false)
  hasGiftReceipt Boolean       @default(false)
  returnBy       DateTime?
  thankYouSent   Boolean       @default(false)
  thankYouDueAt  DateTime?
  reaction       Reaction?
  photoUrl       String?
  notes          String?
  ideaId         String?
  createdById    String
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  group     Group        @relation(fields: [groupId], references: [id], onDelete: Cascade)
  occasion  Occasion?    @relation(fields: [occasionId], references: [id], onDelete: SetNull)
  person    Person?      @relation(fields: [personId], references: [id], onDelete: Cascade)
  family    Family?      @relation(fields: [familyId], references: [id], onDelete: Cascade)
  idea      Idea?        @relation(fields: [ideaId], references: [id], onDelete: SetNull)
  createdBy User         @relation("GiftCreatedBy", fields: [createdById], references: [id])
  credits   GiftCredit[]

  @@index([groupId, date])
}

model GiftCredit {
  giftEntryId String
  personId    String

  giftEntry GiftEntry @relation(fields: [giftEntryId], references: [id], onDelete: Cascade)
  person    Person    @relation(fields: [personId], references: [id], onDelete: Cascade)

  @@id([giftEntryId, personId])
}

model Idea {
  id          String     @id @default(cuid())
  groupId     String
  title       String
  category    String?
  url         String?
  imageUrl    String?
  price       Decimal?   @db.Decimal(10, 2)
  notes       String?
  ageMin      Int?
  ageMax      Int?
  status      IdeaStatus @default(SAVED)
  occasionId  String?
  createdById String
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  group     Group        @relation(fields: [groupId], references: [id], onDelete: Cascade)
  occasion  Occasion?    @relation(fields: [occasionId], references: [id], onDelete: SetNull)
  createdBy User         @relation("IdeaCreatedBy", fields: [createdById], references: [id])
  tags      IdeaPerson[]
  gifts     GiftEntry[]

  @@index([groupId])
}

model IdeaPerson {
  ideaId   String
  personId String

  idea   Idea   @relation(fields: [ideaId], references: [id], onDelete: Cascade)
  person Person @relation(fields: [personId], references: [id], onDelete: Cascade)

  @@id([ideaId, personId])
}

model InviteLink {
  id           String     @id @default(cuid())
  token        String     @unique
  kind         InviteKind
  groupId      String
  familyId     String?
  createdById  String
  expiresAt    DateTime
  acceptedAt   DateTime?
  acceptedById String?
  createdAt    DateTime   @default(now())

  group      Group   @relation(fields: [groupId], references: [id], onDelete: Cascade)
  family     Family? @relation(fields: [familyId], references: [id], onDelete: Cascade)
  createdBy  User    @relation("InviteCreatedBy", fields: [createdById], references: [id], onDelete: Cascade)
  acceptedBy User?   @relation("InviteAcceptedBy", fields: [acceptedById], references: [id], onDelete: SetNull)
}

model FamilyConnection {
  id             String   @id @default(cuid())
  familyId       String   @unique
  sourceFamilyId String
  sharedFields   String[]
  createdAt      DateTime @default(now())

  family       Family @relation("ConnectedFamily", fields: [familyId], references: [id], onDelete: Cascade)
  sourceFamily Family @relation("SourceFamily", fields: [sourceFamilyId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 2: Generate the baseline migration**

```bash
cd apps/api
rm -rf prisma/migrations/2026*
mkdir -p prisma/migrations/20261118120000_init_v1
pnpm exec prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script \
  > prisma/migrations/20261118120000_init_v1/migration.sql
cat >> prisma/migrations/20261118120000_init_v1/migration.sql <<'SQL'

-- Exactly one subject / counterparty (not expressible in Prisma schema; ignored by migrate diff)
ALTER TABLE "Occasion"  ADD CONSTRAINT "Occasion_one_subject"       CHECK (num_nonnulls("personId", "familyId") = 1);
ALTER TABLE "GiftEntry" ADD CONSTRAINT "GiftEntry_one_counterparty" CHECK (num_nonnulls("personId", "familyId") = 1);
SQL
```

Keep `migration_lock.toml`.

- [ ] **Step 3: Remove the old code** listed under Files above. Then check that nothing still references the removed models:

```bash
grep -rnE "db\.(contact|event|gift|productListing|giftAssignment|userConnection|exportConfig)\b|subscriptionStatus|aiProviderConfig" apps/api/src apps/api/tests
```

Expected: no output.

- [ ] **Step 4: Reset the test database and run what's left**

```bash
. <env file>
cd apps/api && pnpm exec prisma migrate reset --force --skip-seed   # DATABASE_URL must point at bestowd_test
pnpm exec prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "$DATABASE_URL" --exit-code
pnpm test && pnpm exec tsc --noEmit
```

Expected:
- The migrate diff prints "No difference detected", which shows the check constraints don't cause drift.
- The health, auth and users tests pass, and `tsc` has no errors.

- [ ] **Step 5: Update the spec** to match the deviations table. Then commit: `refactor!: reset schema to v1 group/family/person model`.

---

### Task 2: HTTP errors, access helpers, DTO helpers

**Files:**
- Create: `src/http-error.ts`, `src/services/access.ts`, `src/dto.ts`
- Modify: `src/app.ts`

**Interfaces produced** (used by every later task):

```ts
// src/http-error.ts
export class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message) }
}
export const notFound = () => new HttpError(404, 'Not found')
export const badRequest = (m: string) => new HttpError(400, m)
export const forbidden = () => new HttpError(403, 'Forbidden')
export const conflict = (m: string) => new HttpError(409, m)
export const gone = (m: string) => new HttpError(410, m)
```

```ts
// src/services/access.ts
import type { FastifyRequest } from 'fastify'
import type { MembershipRole } from '@prisma/client'
import { db } from '../db.js'
import { notFound, forbidden, badRequest } from '../http-error.js'

export function userIdOf(request: FastifyRequest): string {
  return (request.user as { userId: string }).userId
}

export async function requireMember(userId: string, groupId: string): Promise<MembershipRole> {
  const m = await db.groupMembership.findUnique({ where: { groupId_userId: { groupId, userId } } })
  if (!m) throw notFound()
  return m.role
}

export async function requireOwner(userId: string, groupId: string): Promise<void> {
  if ((await requireMember(userId, groupId)) !== 'OWNER') throw forbidden()
}

/** Load a group-owned row by id, 404 if missing or caller is not a member of its group. */
export async function loadOr404<T extends { groupId: string }>(userId: string, row: T | null): Promise<T> {
  if (!row) throw notFound()
  await requireMember(userId, row.groupId)
  return row
}

/** Exactly one of personId / familyId, and it must be in groupId. */
export async function assertSubject(groupId: string, s: { personId?: string | null; familyId?: string | null }): Promise<void> {
  const given = [s.personId, s.familyId].filter(Boolean)
  if (given.length !== 1) throw badRequest('Provide exactly one of personId or familyId')
  const row = s.personId
    ? await db.person.findUnique({ where: { id: s.personId } })
    : await db.family.findUnique({ where: { id: s.familyId! } })
  if (!row || row.groupId !== groupId) throw badRequest('Person or family not in this group')
}

/** Every id must exist with this groupId; throws 400 otherwise. */
export async function assertInGroup(model: 'person' | 'occasion' | 'idea' | 'family', groupId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const count = await (db[model] as any).count({ where: { id: { in: ids }, groupId } })
  if (count !== new Set(ids).size) throw badRequest(`${model} not in this group`)
}
```

`src/dto.ts` holds `money(d: Prisma.Decimal | null): number | null`, `iso(d: Date | null): string | null`, and one `toXDto` per model. They're added as each later task needs them. Each DTO returns every scalar column, with `Decimal` turned into a number and `Date` into an ISO string.

`src/app.ts`: register an error handler.

```ts
app.setErrorHandler((err, _req, reply) => {
  const status = err.statusCode ?? 500
  if (status >= 500) app.log.error(err)
  reply.code(status).send({ error: status >= 500 ? 'Internal Server Error' : err.message })
})
```

This keeps the `{ error }` body shape that `apiFetch` reads. It also covers Fastify validation errors, which carry `statusCode: 400`.

- [ ] **Step 1:** Implement the files. Their tests depend on users having groups, so they come in Task 3.
- [ ] **Step 2:** Add a test to `tests/health.test.ts` for the error body shape: `POST /auth/google` with an empty body returns 400 with `{ error: string }`. Run `pnpm exec tsc --noEmit` and the existing tests. Commit `feat: http errors and group access helpers`.

---

### Task 3: Provision a personal group at sign-in; test helpers

**Files:**
- Create: `src/services/groups.ts`
- Modify: `src/routes/auth.ts`, `tests/helpers.ts`, `tests/auth.test.ts`

```ts
// src/services/groups.ts
import { db } from '../db.js'

class AlreadyProvisioned extends Error {}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'My'
}

/** Idempotent: returns the user's primary group id, creating group + membership + household if missing. */
export async function provisionPersonalGroup(user: { id: string; name: string; primaryGroupId: string | null }): Promise<string> {
  if (user.primaryGroupId) return user.primaryGroupId
  const first = firstName(user.name)
  try {
    return await db.$transaction(async (tx) => {
      const group = await tx.group.create({
        data: { name: `${first}'s group`, memberships: { create: { userId: user.id, role: 'OWNER' } } },
      })
      await tx.family.create({
        data: { groupId: group.id, householdOfGroupId: group.id, name: `${first}'s household`, type: 'FAMILY' },
      })
      // Guards concurrent first sign-ins: only one transaction can claim the null primaryGroupId.
      const claimed = await tx.user.updateMany({ where: { id: user.id, primaryGroupId: null }, data: { primaryGroupId: group.id } })
      if (claimed.count === 0) throw new AlreadyProvisioned()
      return group.id
    })
  } catch (err) {
    if (!(err instanceof AlreadyProvisioned)) throw err
    const fresh = await db.user.findUniqueOrThrow({ where: { id: user.id } })
    return fresh.primaryGroupId!
  }
}
```

`auth.ts`: after the upsert, call `await provisionPersonalGroup(user)`.

`tests/helpers.ts`:
- `createTestUser` calls `provisionPersonalGroup` and returns `{ user, token, authHeader, groupId, householdId }`.
- Add `cleanupUser(userId)`. It deletes every group where the user is `OWNER`, which cascades, then deletes the user.

Tests (`auth.test.ts`):
- [ ] First sign-in creates exactly one group. The user is `OWNER` of it, `primaryGroupId` is set, and the group has one family with `householdOfGroupId = group.id`.
- [ ] A second sign-in by the same Google account creates no new group.
- [ ] `provisionPersonalGroup` called twice in parallel (`Promise.all`) leaves one membership for the user. Note that the losing transaction rolls back its group.
- [ ] The group is named "Alice's group" for the name "Alice Smith".

Then put the `assertSubject` tests from Task 2 in `tests/services.test.ts`:
- [ ] Both ids, or neither, → 400.
- [ ] A person from another group → 400.
- [ ] A person in the same group passes.

Commit `feat: provision personal group and household on first sign-in`.

---

### Task 4: `/me` and group settings

**Files:**
- Create: `src/routes/me.ts`, `src/routes/groups.ts`, `tests/me.test.ts`, `tests/groups.test.ts`

Routes:
- `GET /me` → `{ user, primaryGroupId, memberships: [{ groupId, groupName, role, memberCount }] }`, ordered primary first, then by `createdAt`. `/auth/me` stays as is for the web's `AuthContext`.
- `GET /groups/:groupId` → the group DTO plus `members: [{ userId, name, avatarUrl, role }]` (the "co-givers"). Member only.
- `PATCH /groups/:groupId` → OWNER only. It accepts:
  - `name`;
  - `currency`: a three-letter uppercase code matching `^[A-Z]{3}$`;
  - `defaultBudgets`: an object whose keys are limited to `BIRTHDAY|HOLIDAY|ONE_OFF` and whose values are numbers ≥ 0;
  - `defaultReminderDays`: integers from 0 to 365, at most 5 of them.

Tests:
- [ ] `GET /me` lists the provisioned group.
- [ ] `GET /groups/:id` for another user's group → 404.
- [ ] `PATCH` by OWNER updates currency and defaultBudgets.
- [ ] `PATCH` by a MEMBER → 403. Add the membership directly with `db.groupMembership.create`.
- [ ] `PATCH` with `currency: "cad"` → 400.

Register both routes in `app.ts`. Commit `feat: me and group settings routes`.

---

### Task 5: Families and people

**Files:**
- Create: `src/services/age.ts`, `src/routes/families.ts`, `src/routes/people.ts`, `tests/families.test.ts`, `tests/people.test.ts`

```ts
// src/services/age.ts
export function ageOn(p: { birthYear: number | null; birthMonth: number | null; birthDay: number | null }, on: Date): number | null {
  if (p.birthYear == null) return null
  let age = on.getUTCFullYear() - p.birthYear
  if (p.birthMonth != null) {
    const m = on.getUTCMonth() + 1, d = on.getUTCDate()
    if (m < p.birthMonth || (m === p.birthMonth && d < (p.birthDay ?? 1))) age -= 1
  }
  return Math.max(age, 0)
}
```

Family routes:
- `GET /groups/:g/families?status=ACTIVE|PAUSED|ARCHIVED`. The default is everything except `ARCHIVED`.
  - Returns each family DTO with `memberCount` (people not archived), `isOwnHousehold` (`householdOfGroupId != null`) and `nextOccasion`.
  - `nextOccasion` is the earliest `nextOccurrence ≥ today` among the family's own occasions and its people's occasions: `{ id, name, nextOccurrence, personName | null }`, or null if there isn't one.
  - Ordering: the own household first, then by name.
- `POST /groups/:g/families`: `name` (required, 1–100 characters), `type`, `photoUrl`, `notes`. Returns 201.
- `GET /families/:id` returns the profile:
  - The family DTO.
  - `people`: each person DTO plus `age` (today) and `nextBirthday` (the next occurrence of their `BIRTHDAY` occasion, if any).
  - `occasions`: upcoming, with `nextOccurrence` within 365 days, ordered. Each includes `needsGift` (status `NOT_STARTED`).
  - `totals`. Gifts count toward the family when their counterparty is the family, one of its people, or a person credited via `GiftCredit`. The totals are:
    - `givenCount`;
    - `receivedCount`;
    - `spent`: the sum of `amount` over GIVEN gifts;
    - `receivedValue`: the sum over RECEIVED gifts where `valueHidden = false`;
    - `hiddenReceivedCount`.
  - `connection`: `null` for now (Task 11 fills it in).
- `PATCH /families/:id`: `name`, `type`, `status`, `photoUrl`, `notes`.
- `DELETE /families/:id` returns 204. Deleting the own household returns 409 `"Can't delete your own household"`.

People routes:
- `POST /families/:id/people` takes:
  - `name` (required);
  - `relationship`;
  - `birthMonth` (1–12), `birthDay` (1–31), `birthYear` (1900 to the current year);
  - `likes`, `avoid` (arrays of strings, each ≤ 100 characters, at most 50 items);
  - `sizes` (an object of string → string);
  - `foodNotes`, `photoUrl`, `notes`.

  `groupId` is copied from the family. `birthDay` without `birthMonth` returns 400.
- `GET /people/:id` returns the DTO plus `age`, `familyName`, and `history`. `history` is the 10 most recent gift entries where the counterparty is this person or the person is credited, each `{ id, direction, title, date, reaction }`.
- `PATCH /people/:id`: the same fields as POST, plus `archived: boolean` (sets or clears `archivedAt`) and `familyId`, which moves the person to another family **in the same group** (otherwise 400).
- `DELETE /people/:id` returns 204.

Tests:
- [ ] Create a family, then list it. The own household comes first, and the new family has `memberCount 0`.
- [ ] A family in another group: GET, PATCH and DELETE all return 404.
- [ ] Archived families are hidden by default and listed with `?status=ARCHIVED`.
- [ ] Deleting the own household returns 409.
- [ ] Add a person with birthMonth 3, birthDay 9 and birthYear 2019. `GET /people/:id` returns `age` as computed by `ageOn`.
- [ ] Unit tests for `ageOn`:
  - the day before the birthday;
  - on the birthday;
  - no year → null;
  - year only → simple subtraction.
- [ ] Moving a person to a family in another group returns 400.
- [ ] Family totals: a received gift with `valueHidden` true is counted in `hiddenReceivedCount`, not in `receivedValue`. Insert it via `db.giftEntry.create`.

Commit `feat: families and people routes`.

---

### Task 6: Occasions, next occurrence, budgets, status advance

**Files:**
- Rewrite: `src/services/next-occurrence.ts`, `tests/next-occurrence.test.ts`
- Create: `src/services/budgets.ts`, `src/services/occasion-status.ts`, `src/routes/occasions.ts`, `tests/occasions.test.ts`

```ts
// src/services/next-occurrence.ts
export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

/** Next occurrence on or after today (UTC). Feb 29 in a non-leap year falls on Mar 1 (Date.UTC rollover). */
export function computeNextOccurrence(
  o: { date: Date; recursAnnually: boolean; recurrenceEndsAt: Date | null },
  now: Date = new Date(),
): Date | null {
  const today = startOfUtcDay(now)
  let next: Date
  if (!o.recursAnnually) {
    next = startOfUtcDay(o.date)
  } else {
    const m = o.date.getUTCMonth(), d = o.date.getUTCDate()
    next = new Date(Date.UTC(today.getUTCFullYear(), m, d))
    if (next < today) next = new Date(Date.UTC(today.getUTCFullYear() + 1, m, d))
    if (next < startOfUtcDay(o.date)) next = startOfUtcDay(o.date)
  }
  if (next < today) return null
  if (o.recurrenceEndsAt && next > o.recurrenceEndsAt) return null
  return next
}
```

```ts
// src/services/budgets.ts
import type { OccasionType, Prisma } from '@prisma/client'
export function effectiveBudget(budget: Prisma.Decimal | null, type: OccasionType, defaults: Prisma.JsonValue): number | null {
  if (budget != null) return Number(budget)
  const v = (defaults as Record<string, unknown> | null)?.[type]
  return typeof v === 'number' ? v : null
}
```

```ts
// src/services/occasion-status.ts
import type { OccasionStatus } from '@prisma/client'
import { db } from '../db.js'
export const STATUS_ORDER: OccasionStatus[] = ['NOT_STARTED', 'IDEA_SAVED', 'BOUGHT', 'GIVEN']

/** Move status forward to `to`; never backwards. */
export async function advanceOccasionStatus(occasionId: string, to: OccasionStatus): Promise<void> {
  const lower = STATUS_ORDER.slice(0, STATUS_ORDER.indexOf(to))
  await db.occasion.updateMany({ where: { id: occasionId, status: { in: lower } }, data: { status: to } })
}
```

Routes:
- `POST /groups/:g/occasions` takes `type`, `name`, `date` (ISO date), `personId | familyId` (`assertSubject`), `recursAnnually`, `recurrenceEndsAt`, `budget` (≥ 0 or null), `needsCard`, `reminderDays`, `partyAt`, `location`, `rsvp` and `hostGiftRequest`.
  - `recursAnnually` defaults to `type !== 'ONE_OFF'`.
  - The server sets `nextOccurrence = computeNextOccurrence(...)`.
  - Returns 201.
- `GET /groups/:g/occasions?from=&to=&type=&personId=&familyId=`:
  - `from` defaults to today and `to` to today + 30 days. The filter applies to `nextOccurrence`.
  - `familyId` matches the family's own occasions and its people's.
  - Response: `{ currency, occasions: OccasionDto[], plannedSpend }`. `plannedSpend` is the sum of the occasions' `effectiveBudget`.
  - Each `OccasionDto` includes `subjectName` (person or family name), `familyId`/`familyName` (the person's family when the subject is a person), `effectiveBudget`, `spent` and `overBudget`:
    - `spent` is the sum of GIVEN `GiftEntry.amount` where `occasionId` matches and `occasionDate = nextOccurrence`;
    - `overBudget` is `effectiveBudget != null && spent > effectiveBudget`.
- `PATCH /occasions/:id`: any field from POST, plus `status` and `cardDone`. If `date`, `recursAnnually` or `recurrenceEndsAt` changes, recompute `nextOccurrence`. Changing the subject re-runs `assertSubject`.
- `DELETE /occasions/:id` returns 204.

Tests:
- [ ] Unit tests for `computeNextOccurrence`, with a fixed `now = 2026-11-18`:
  - a birthday on 2019-03-09 → 2027-03-09;
  - a birthday on 2019-11-18 (today) → 2026-11-18;
  - a one-off in the past → null;
  - a one-off on 2027-01-05 → 2027-01-05;
  - annual ending 2026-12-31 with a date in March → null;
  - annual with a first date of 2028-05-01 → 2028-05-01.
- [ ] Unit tests for `effectiveBudget`:
  - an override wins;
  - otherwise the group default applies;
  - no default → null.
- [ ] POST with both personId and familyId → 400.
- [ ] POST with neither → 400.
- [ ] POST with a person from another group → 400.
- [ ] A `ONE_OFF` defaults to `recursAnnually` false.
- [ ] GET within the default window returns the occasion with `effectiveBudget` from the group defaults. `plannedSpend` sums correctly.
- [ ] `advanceOccasionStatus(id, 'BOUGHT')` from `GIVEN` leaves `GIVEN`; from `NOT_STARTED` it sets `BOUGHT`.
- [ ] PATCH `status: 'NOT_STARTED'` from `GIVEN` is allowed (manual).
- [ ] Another group's occasion: PATCH and DELETE → 404.

Commit `feat: occasions with budgets, status and next occurrence`.

---

### Task 7: Fold the family profile's occasions onto the shared serialiser

Tasks 5 and 6 build occasion output separately. Move `toOccasionDto` together with `spent`, `effectiveBudget` and `overBudget` into `src/dto.ts` as `serialiseOccasions(occasions, group)`. This batch-loads gifts with one `findMany` (`occasionId in ids`, `direction GIVEN`) and is used by the family profile, `/groups/:g/occasions` and (later) `/me/occasions`. This removes the duplication.

- [ ] Refactor, and add a family-profile test asserting that `occasions[0].effectiveBudget` is present.
- [ ] Commit `refactor: share occasion serialisation`.

---

### Task 8: Two-way gift log and spend

**Files:**
- Rewrite: `src/routes/gifts.ts`, `tests/gifts.test.ts`

**Routes:**

`POST /groups/:g/gifts` creates a gift entry and returns 201.
- Fields:
  - `direction` (required), `title` (required), `date` (required);
  - `personId | familyId` (`assertSubject`);
  - `category`, `occasionId`, `occasionDate`, `amount` (≥ 0);
  - `status`: GIVEN only, default `GIVEN`. Rejected with 400 when `RECEIVED`;
  - `valueHidden`, `hasGiftReceipt`, `returnBy`, `thankYouSent`, `thankYouDueAt`: RECEIVED only, otherwise 400;
  - `reaction`, `photoUrl`, `notes`, `ideaId`, `creditPersonIds: string[]`.
- Defaults the server applies:
  - `valueHidden` defaults to `true` when the direction is `RECEIVED`.
  - `thankYouDueAt` defaults to `date + 14 days` when `RECEIVED` and `thankYouSent` is false.
  - `occasionDate` defaults to `occasion.nextOccurrence ?? occasion.date` when `occasionId` is given.
- `occasionId`, `ideaId` and `creditPersonIds` are checked with `assertInGroup`.
- After it's created: if `direction = GIVEN` and `occasionId` is set and `occasionDate` equals `occasion.nextOccurrence`, call `advanceOccasionStatus(occasionId, status)`.

`GET /groups/:g/gifts?year=&direction=&personId=&familyId=&status=` returns `{ currency, gifts, totals }`.
- `year` filters on `date` in UTC.
- `personId` includes credits. `familyId` includes the family's people and credits.
- Each gift is its DTO plus `counterpartyName`, `occasionName` and `credits: [{ personId, name }]`, ordered by `date` desc.
- `totals = { givenCount, receivedCount, spent, receivedValue, hiddenReceivedCount, thankYouDueCount }`.
  - These are computed over the same filters, but ignoring `direction`, so the Given/Received toggle doesn't change the header.
  - `thankYouDueCount` counts RECEIVED gifts with `thankYouSent` false.

`PATCH /gifts/:id` takes the same fields as POST except `direction`.
- `creditPersonIds` replaces all credits, in a transaction.
- Revealing a value is just `valueHidden: false`.
- Status advance applies as for POST.

`DELETE /gifts/:id` returns 204. Occasion status is not moved back.

`GET /groups/:g/spend?year=` (default: the current year) returns `{ currency, year, total, byMonth: number[12], byFamily: [{ familyId, familyName, total }] }`.
- It covers GIVEN gifts only.
- `byFamily` attributes a gift to the person's family, or to the family when the counterparty is a family.

Tests:
- [ ] RECEIVED without `valueHidden` is stored as hidden. `totals.receivedValue` excludes it and `hiddenReceivedCount` is 1.
- [ ] PATCH `valueHidden: false` makes it count in `receivedValue`.
- [ ] GIVEN with `hasGiftReceipt` → 400.
- [ ] RECEIVED with `status` → 400.
- [ ] GIVEN with `status: BOUGHT` against an occasion's current occurrence → the occasion becomes `BOUGHT`. A later GIVEN entry → `GIVEN`.
- [ ] A GIVEN gift for last year's `occasionDate` → the occasion status is unchanged.
- [ ] `creditPersonIds` with a person from another group → 400.
- [ ] Credits make the gift appear in `?personId=` for the credited person.
- [ ] `?year=2025` excludes 2026 gifts.
- [ ] `/spend` puts a March gift in `byMonth[2]` and attributes it to the person's family.
- [ ] Another group's gift → 404.

Commit `feat: two-way gift log, totals and spend`.

---

### Task 9: Ideas and repeat check

**Files:**
- Create: `src/services/repeats.ts`, `src/routes/ideas.ts`, `tests/ideas.test.ts`

```ts
// src/services/repeats.ts
import { db } from '../db.js'
export interface Repeat { giftEntryId: string; title: string; date: string }

/** Most recent GIVEN gift to this person (direct or credited) with the same category, case-insensitive. */
export async function findRepeat(personId: string, category: string | null): Promise<Repeat | null> {
  if (!category?.trim()) return null
  const g = await db.giftEntry.findFirst({
    where: {
      direction: 'GIVEN',
      category: { equals: category.trim(), mode: 'insensitive' },
      OR: [{ personId }, { credits: { some: { personId } } }],
    },
    orderBy: { date: 'desc' },
  })
  return g ? { giftEntryId: g.id, title: g.title, date: g.date.toISOString() } : null
}
```

**Routes:**

`POST /groups/:g/ideas` returns 201.
- Fields: `title` (required), `category`, `url` (must be http or https), `imageUrl`, `price`, `notes`, `ageMin`, `ageMax` (0–120, `ageMin ≤ ageMax`, otherwise 400), `personIds: string[]` and `occasionId`.
- `occasionId` and `personIds` are checked with `assertInGroup`.
- If `occasionId` is set, call `advanceOccasionStatus(occasionId, 'IDEA_SAVED')`.

`GET /groups/:g/ideas?personId=&occasionId=&status=` (status defaults to `SAVED`).
- Without `personId`, it lists all ideas in the group. Each is its DTO plus `people: [{ id, name }]`.
- With `personId`, it returns only ideas that match the person.
  - Ideas tagged to the person always match.
  - Ideas with an age range match when the person's age falls in range. Age comes from `ageOn` on the occasion's `nextOccurrence` when `occasionId` is given, otherwise today.
  - Each idea gets `repeat: Repeat | null` from `findRepeat`.
  - The response also carries `{ person: { id, name, age } }` for the picker header.

`PATCH /ideas/:id`: the POST fields plus `status`.
- `personIds` replaces the tags.
- Setting `occasionId` advances the occasion to `IDEA_SAVED`.

`POST /ideas/:id/buy` takes `{ personId | familyId, occasionId?, amount?, date? }`.
- The defaults:
  - `occasionId` falls back to the idea's `occasionId`;
  - `amount` falls back to the idea's `price`;
  - `date` falls back to today.
- In a transaction, it creates a GIVEN `GiftEntry` with status `BOUGHT`, `ideaId` set, and the same `title` and `category`, then sets the idea to `BOUGHT`.
- Then it advances the occasion as in Task 8, using the shared helper.
- Returns `{ idea, gift }`.

`DELETE /ideas/:id` returns 204.

Extract the "create gift and advance status" logic from Task 8 into `src/services/gift-log.ts` (`createGiftEntry(groupId, userId, body)`) so both routes use it.

Tests:
- [ ] Idea tagged to Mia is returned for `?personId=mia`. An idea tagged to Leo isn't.
- [ ] An idea with ages 5–7 is returned for a 6-year-old and not for a 9-year-old.
- [ ] The age is measured on the occasion date when `occasionId` is given: the person turns 7 on that date, and an idea with ages 7–9 is returned.
- [ ] Repeat: a GIVEN gift to Mia in category "Puzzle" (Dec 2025) plus an idea with category "puzzle" → `repeat.title` is set. A different category → null.
- [ ] A repeat through a credit (a family gift credited to Mia) is detected.
- [ ] `ageMin > ageMax` → 400.
- [ ] POST with `occasionId` → the occasion is `IDEA_SAVED`.
- [ ] `/buy` creates a gift with `ideaId` and status BOUGHT, the idea becomes BOUGHT and the occasion becomes BOUGHT.
- [ ] Another group's idea → 404.

Commit `feat: ideas board with age matching and repeat check`.

---

### Task 10: Home across groups and the reminder job

**Files:**
- Modify: `src/routes/me.ts`
- Rewrite: `src/services/reminder-job.ts`, `tests/reminders.test.ts`
- Modify: `src/index.ts` (call site name)

`GET /me/occasions?from=&to=&type=`:
- Same window defaults as Task 6, over every group the user belongs to:
  ```ts
  where: { group: { memberships: { some: { userId } } }, nextOccurrence: { gte, lte } }
  ```
- Occasions in paused or archived families, or for archived people, are excluded.
- Response:
  - `{ occasions: (OccasionDto & { groupId, groupName })[], plannedSpend: [{ currency, amount }], multipleGroups: boolean }`.
  - `plannedSpend` is grouped by currency.
  - `multipleGroups` tells clients whether to show group labels.
- The group-scoped `GET /groups/:g/occasions` gets the same paused/archived exclusion.

```ts
// src/services/reminder-job.ts
import cron from 'node-cron'
import { db } from '../db.js'
import { computeNextOccurrence, startOfUtcDay } from './next-occurrence.js'

export interface DueReminder { userId: string; email: string; groupId: string; occasionId: string; occasionName: string; daysUntil: number }
const DAY = 86_400_000

export async function runReminderScan(now: Date = new Date()): Promise<DueReminder[]> {
  const today = startOfUtcDay(now)

  // 1. Roll passed occurrences forward; a new year of a recurring occasion starts NOT_STARTED.
  const passed = await db.occasion.findMany({ where: { nextOccurrence: { lt: today } } })
  for (const o of passed) {
    const next = computeNextOccurrence(o, now)
    await db.occasion.update({
      where: { id: o.id },
      data: { nextOccurrence: next, ...(next ? { status: 'NOT_STARTED', cardDone: false } : {}) },
    })
  }

  // 2. Due reminders, skipping paused/archived families and archived people.
  const active = { status: 'ACTIVE' as const }
  const occasions = await db.occasion.findMany({
    where: {
      nextOccurrence: { gte: today },
      OR: [
        { family: { is: active } },
        { person: { is: { archivedAt: null, family: { is: active } } } },
      ],
    },
    include: { group: { include: { memberships: { include: { user: true } } } } },
  })

  const due: DueReminder[] = []
  for (const o of occasions) {
    const daysUntil = Math.round((o.nextOccurrence!.getTime() - today.getTime()) / DAY)
    const days = o.reminderDays.length ? o.reminderDays : o.group.defaultReminderDays
    if (!days.includes(daysUntil)) continue
    for (const m of o.group.memberships) {
      due.push({ userId: m.userId, email: m.user.email, groupId: o.groupId, occasionId: o.id, occasionName: o.name, daysUntil })
      console.log(`[reminder] ${m.user.email}: "${o.name}" in ${daysUntil} day(s)`) // push delivery: roadmap step 4
    }
  }
  return due
}

export function startReminderJob() {
  cron.schedule('0 9 * * *', () => { void runReminderScan() })
  console.log('[reminder] Daily reminder job scheduled')
}
```

Tests (pass a fixed `now`, and create the occasions with an explicit `nextOccurrence`):
- [ ] An occasion 14 days out with group defaults [14, 3] → one reminder per group member. Add a second member to check that both get it.
- [ ] `reminderDays: [7]` on the occasion overrides the default: 14 days out → none, 7 days out → one.
- [ ] A paused family → no reminder. An archived person → no reminder.
- [ ] A recurring occasion with yesterday's `nextOccurrence` and status `GIVEN` → rolled forward one year, `NOT_STARTED`, `cardDone` false.
- [ ] A one-off occasion in the past → `nextOccurrence` null.
- [ ] `/me/occasions`:
  - a user in two groups sees occasions from both, with `groupName`, and `multipleGroups` true;
  - a user in one group sees `multipleGroups` false;
  - an occasion in a paused family is excluded.

Commit `feat: cross-group home occasions and v1 reminder scan`.

---

### Task 11: Invite links, joining groups, family connections

**Files:**
- Create: `src/services/tokens.ts`, `src/routes/invites.ts`, `tests/invites.test.ts`
- Modify: `src/routes/families.ts` (connection in profile)

```ts
// src/services/tokens.ts
import { randomBytes } from 'node:crypto'
export const newToken = () => randomBytes(32).toString('base64url')
export const INVITE_TTL_MS = 14 * 86_400_000
export const SHAREABLE_FIELDS = ['birthday', 'likes', 'avoid', 'sizes', 'foodNotes', 'photo'] as const
export const DEFAULT_SHARED_FIELDS = ['birthday', 'likes', 'avoid']
```

**Routes:**

`POST /groups/:g/invites` takes `{ kind, familyId? }` and is member only.
- `FAMILY` needs a `familyId` in this group. It can't be the own household (400), and the family must not already be connected (409).
- `GROUP` must not have a `familyId`.
- Returns `{ token, url: \`${config.WEB_APP_URL}/join/${token}\`, expiresAt }`.

`GET /invites/:token` is **public**, with no authentication.
- It returns `{ kind, inviterName, groupName, familyName | null, expiresAt }` and nothing more.
- Unknown token → 404. Expired or already accepted → 410.

`POST /invites/:token/accept` requires authentication.
- Expired or already accepted → 410.
- **`GROUP`:**
  - Create a `MEMBER` membership. If the user is already a member, return 200 with `alreadyMember: true`.
  - Mark the invite accepted.
  - Return `{ groupId }`.
- **`FAMILY`:**
  - Body `{ sourceFamilyId, sharedFields? }`.
  - The user must be a member of the source family's group, otherwise 400.
  - The source family can't be in the invite's own group, otherwise 400.
  - `sharedFields` must be a subset of `SHAREABLE_FIELDS`, otherwise 400, and defaults to `DEFAULT_SHARED_FIELDS`.
  - In a transaction: check `acceptedAt` is still null with `updateMany where: { id, acceptedAt: null }` (count 0 → 410), then create the `FamilyConnection`. A P2002 on `familyId` → 409.
  - Return `{ connectionId }`.

`DELETE /family-connections/:id` returns 204. It's allowed for members of either the connected family's group or the source family's group; anyone else gets 404.

The family profile (`GET /families/:id`) gets a `connection` field, `{ id, sourceFamilyName, sharedFields, people }`.
- `people` is the source family's non-archived people.
- Each person shows only `id` and `name` plus the fields in `sharedFields`:
  - `birthday` → `birthMonth`, `birthDay`, `birthYear`;
  - `photo` → `photoUrl`;
  - the other field names map to the column of the same name.
- The list also gets `onBestowd: boolean` per family. It's true when a `FamilyConnection` exists for the family.

Tests:
- [ ] The full family flow:
  - A creates an invite for "Chen family", and the public GET shows the names.
  - B accepts with B's household and `sharedFields: ['likes']`.
  - A's profile shows the connection: B's people with `likes` and no `birthYear`.
  - A's family list shows `onBestowd: true`.
- [ ] Accepting twice → 410.
- [ ] An expired token (set `expiresAt` in the past) → 410 on both the GET and the accept.
- [ ] B tries to use A's family as `sourceFamilyId` → 400.
- [ ] `sharedFields: ['email']` → 400.
- [ ] Inviting for a family that's already connected → 409.
- [ ] Inviting for the own household → 400.
- [ ] The group invite flow: B accepts, `/me` lists two memberships, and B's primary group is unchanged.
- [ ] B can revoke the connection, and A's profile then shows `connection: null`. A third user → 404.
- [ ] `POST /groups/:g/invites` for a group the user isn't in → 404.

Commit `feat: invite links, group joining and minimal family connections`.

---

### Task 12: Shared types, API client, and a web app that still builds

**Files:**
- Rewrite `packages/types/src/`:
  - `user.ts` (no subscription/AI);
  - `group.ts`, `family.ts`, `person.ts`, `occasion.ts`, `gift.ts`, `idea.ts`, `invite.ts`;
  - `index.ts`.
  - Delete `contact.ts`, `event.ts`, `assignment.ts`.
- Rewrite `packages/api-client/src/`:
  - one file per route group, with functions named after the routes: `getMe`, `getGroup`, `updateGroup`, `listFamilies`, `createFamily`, `getFamily`, `updateFamily`, `deleteFamily`, `createPerson`, `getPerson`, `updatePerson`, `deletePerson`, `listOccasions`, `listHomeOccasions`, `createOccasion`, `updateOccasion`, `deleteOccasion`, `listGifts`, `createGift`, `updateGift`, `deleteGift`, `getSpend`, `listIdeas`, `createIdea`, `updateIdea`, `buyIdea`, `deleteIdea`, `createInvite`, `getInvite`, `acceptInvite`, `revokeConnection`;
  - keep `googleLogin`, `getAuthMe` (renamed from the current `getMe`) and `updateMe`.
- Web (`apps/web/src`):
  - Delete these pages: Contacts, ContactDetail, Events, Gifts and GiftDetail.
  - Delete these components: `ContactCard`, `EventCard`, `GiftCard`, `AssignmentStatusBadge` and `forms/*`.
  - `DashboardPage` becomes a simple list of `listHomeOccasions()`. Each entry shows the name, date, status and effective budget, plus the group name when `multipleGroups` is true.
  - `AccountPage`: remove the AI Provider section.
  - `Layout`: links to Home and Account only.
  - `App.tsx`: routes `/dashboard` and `/account` only.
  - `AuthContext`: switch to `getAuthMe`.

The types must match the DTOs exactly: copy the field lists from `src/dto.ts`. Enums become string-literal unions (for example `type OccasionStatus = 'NOT_STARTED' | 'IDEA_SAVED' | 'BOUGHT' | 'GIVEN'`).

- [ ] Run `pnpm build` at the root. All packages and the web app must build with no type errors.
- [ ] Run `pnpm --filter @bestowd/api test`; everything must pass.
- [ ] Manual smoke test: run the API and web against the dev database after a `migrate reset`. Sign in with Google, then check that Home loads with no occasions and that `GET /me` shows one group.
- [ ] Commit `feat: v1 shared types and api client; trim web to home and account`. Check that `git status` doesn't stage `packages/types/dist` or `node_modules`.

---

## After this plan

- **The user** runs `prisma migrate reset` on the dev database. This is approved, and it deletes all dev data.
- **Next plans:**
  - the web screens (Home, People, Family profile, Person, Gifts, Ideas, the `/join/:token` page and the group switcher);
  - then the MAUI app with push delivery (device tokens, sending `DueReminder`s).
