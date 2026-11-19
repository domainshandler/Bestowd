# Bestowd — Data-model realignment (v1)

**Date:** 2026-11-18
**Follows:** `2026-11-18-scope-reconciliation.md` (sections 2, 6 step 2, 7)
**Replaces:** the domain model in `2026-08-08-bestowd-design.md`

## Goal

Move the API from *one user → flat contacts → events → given gifts* to the scope's *group → families → people → occasions → gifts both ways*, with ideas, budgets and minimal family connections. React web and MAUI both build on this API.

## Decisions this spec rests on

| # | Decision | Effect on the model |
|---|---|---|
| 1 | Sharing is by group only | Every domain row carries `groupId`; access = group membership. No per-family sharing. |
| 2 | Received gifts get full logging; their value is hidden by default | One `GiftEntry` table with `direction`; `valueHidden` defaults to true for received gifts. |
| 3 | Reset the dev database | Delete the old migrations and start from one baseline migration. No data migration. |
| 4 | Connected profiles: minimal v1 | Invite by link, accept, "On Bestowd" badge, read-only shared view. No change prompts, no wishlist. |
| 5 | Web and MAUI both in v1 | Shared types in `packages/types`; API stays the single source. |

**Assumptions (questions still open):**

- **Adults.** The model doesn't distinguish children from adults: birth year is optional and age is computed only when it's known. Tracking only children later would be a UI filter, not a schema change.
- **AI cost.** Not modelled here. The AI provider key will be a server environment variable. Usage caps arrive with the Ideas/AI work (step 5).

## Removed

These models go: `Contact`, `Event`, `Gift`, `ProductListing`, `GiftAssignment`, `UserConnection`, `ExportConfig` and `ExportRecord`.

These `User` fields go: `aiProviderConfig`, `stripeCustomerId` and `subscriptionStatus`.

This code goes with them:
- the routes `contacts`, `events`, `gifts`, `listings`, `assignments` and `connections`;
- the email auto-link in `auth.ts`;
- the contact-invite endpoint;
- the web pages Contacts, ContactDetail, Events, Gifts and GiftDetail.

`mailer.ts` stays, because email sign-in will use it.

## Models

Enums are Prisma enums. All money is `Decimal(10,2)` in the group's currency. All ids are `cuid()`.

### User

- Fields: `id`, `email` (unique), `name`, `avatarUrl?`, `googleId?` (unique), `identitySource`, `emailVerified`, timestamps.
- The `appleId` and `passwordHash` columns come in step 6, not now.

### Group and GroupMembership

`Group` is the shared workspace.
- `name`.
- `currency`: default `"CAD"`.
- `defaultBudgets`: JSON keyed by occasion type, e.g. `{ "BIRTHDAY": 40, "HOLIDAY": 30 }`.
- `defaultReminderDays`: `Int[]`, default `[14, 3]`.
- Timestamps.

`GroupMembership` links users to groups.
- `groupId`, `userId`.
- `role`: `OWNER` or `MEMBER`.
- `isPrimary`.
- `createdAt`.
- Primary key is `(groupId, userId)`. A partial unique index allows only one `isPrimary = true` per user.

How groups are created and used:
- On first sign-in a user with no membership gets a group named "\<first name\>'s group". The user is its `OWNER` and it is their primary group, with an own-household family (see below).
- Joining another group (secondary) works through a group invite link. Same token mechanism as family invites, `kind = GROUP`.

How groups look to the user (decided 2026-11-18):
- **There is no onboarding step to create or join a group.** This replaces the scope's "create or join a group" onboarding. The personal group is created silently, and joining another group happens only by accepting an invite link.
- **Users in one group never see the word "group".** Group settings appear in Account only once they invite someone or join another group.
- **Groups never mix data.** People, Gifts, Ideas and family profiles show one group at a time.
  - The app opens to the primary group.
  - A switcher appears only for users in two or more groups.
  - The client remembers the current group, and the API takes it as `:groupId` in the path.
- **Home and push reminders cover all of a user's groups combined.** Each occasion is labelled with its group name, but only when the user is in more than one group. This way a birthday in a group you aren't currently viewing isn't missed.
- **Joining a group keeps your personal group.** It stays as a secondary group and can be left empty.

### Family

- `groupId`, `name`.
- `type`: `FAMILY`, `FRIENDS`, `SCHOOL` or `OTHER`.
- `status`: `ACTIVE`, `PAUSED` or `ARCHIVED`.
  - Paused families send no reminders.
  - Archived families are hidden from lists.
- `isOwnHousehold`: at most one per group, enforced with a partial unique index.
- `photoUrl?`, `notes?`, timestamps.

"Co-givers" in the family profile = the group's members (decision 1).

### Person

- `familyId` (required, cascade). `groupId` is denormalised for access checks.
- `name`, `relationship?` (free text: "Son", "Teacher").
- `birthMonth?`, `birthDay?`, `birthYear?`.
  - Month and day are kept apart from the year so that a birthday with no year still works.
  - Age is computed, never stored.
- `likes String[]`, `avoid String[]`.
- `sizes`: JSON of label → value, e.g. `{ "Shirt": "6T" }`.
- `foodNotes?`, `photoUrl?`, `notes?`.
- `archivedAt?`, timestamps.

A person belongs to exactly one family. The user's own household members are people in the own-household family.

### Occasion

- `groupId`.
- Exactly one of `personId?` or `familyId?`, enforced by a check constraint in the migration SQL.
- `type`: `BIRTHDAY`, `HOLIDAY` or `ONE_OFF`.
- `name`, `date` (the first occurrence).
- `recursAnnually` (default true for `BIRTHDAY` and `HOLIDAY`), `recurrenceEndsAt?`.
- `nextOccurrence?`: kept up to date by the existing `nextOccurrence` logic, which also honours `recurrenceEndsAt`.
- `budget?`: when null, the group's `defaultBudgets[type]` applies.
- `status`: `NOT_STARTED`, `IDEA_SAVED`, `BOUGHT` or `GIVEN`. It refers to the **current occurrence**. The reminder job resets it to `NOT_STARTED` when `nextOccurrence` rolls forward a year.
- `needsCard`, `cardDone`.
- `reminderDays Int[]?`: when null, the group default applies.
- Party details, all optional: `partyAt?`, `location?`, `rsvp` (`NONE`, `YES`, `NO` or `MAYBE`), `hostGiftRequest?`.
- Timestamps.

How the status changes:
- It goes up automatically: saving an idea to the occasion → `IDEA_SAVED`; logging a given gift for it as bought → `BOUGHT`; as given → `GIVEN`.
- It never moves backwards automatically.
- The user can also set it by hand.

### GiftEntry (the two-way gift log)

Common fields:
- `groupId`.
- `direction`: `GIVEN` or `RECEIVED`.
- `title`, `category?`: free text such as "Puzzle", used by the repeat check.
- `occasionId?`, `occasionDate?`: which year's occurrence the gift belongs to, so history groups by occasion and year.
- `date`.
- Counterparty: exactly one of `personId?` or `familyId?`, by check constraint. For given gifts this is the recipient; for received gifts, the giver.
- `amount?`: the price paid, or the estimated value for a received gift.
- `photoUrl?`, `notes?`, `ideaId?` (where it came from), `createdById`, timestamps.

Given gifts only:
- `status`: `BOUGHT` or `GIVEN`.

Received gifts only:
- `valueHidden`: default true.
- `hasGiftReceipt`, `returnBy?`.
- `thankYouSent`, `thankYouDueAt?`.

Both directions:
- `reaction?`: `LOVED_IT`, `LIKED_IT`, `ALREADY_HAD_IT` or `NOT_A_HIT`.

`GiftCredit` (join table: `giftEntryId`, `personId`) credits a family gift to members. "From the Chens" can be credited to Mia and Leo, so it shows in each person's history.

`valueHidden` is a display default and does not restrict access:
- The API returns `amount` either way, so any group member can reveal it.
- The family and Gifts totals for *received* exclude hidden values until they are revealed.

### Idea

- `groupId`, `title`, `category?`, `url?`, `imageUrl?`, `price?`, `notes?`.
- `ageMin?`, `ageMax?`: the age-range tag.
- `status`: `SAVED`, `BOUGHT` or `DISMISSED`.
- `occasionId?`: the occasion it is assigned to.
- `createdById`, timestamps.

`IdeaPerson` (join table: `ideaId`, `personId`) holds the @person tags.

How ideas match people and repeats are flagged:
- An idea matches a person when it has an `IdeaPerson` tag for them, or when their age on the occasion date falls in `[ageMin, ageMax]`.
- An idea is flagged as a repeat when a `GIVEN` `GiftEntry` for that person (direct or via `GiftCredit`) has the same `category`, compared case-insensitively. This drives "Skipping puzzles: you gave one in Dec 2025".

### Family connections (minimal)

`InviteLink` holds invite tokens.
- `token` (unique, random 32 bytes, base64url).
- `kind`: `FAMILY` or `GROUP`.
- `groupId`, `familyId?` (set for `FAMILY`).
- `createdById`, `expiresAt` (14 days).
- `acceptedAt?`, `acceptedById?`.

Sending an invite link:
- The app shares a URL `${WEB_APP_URL}/join/<token>` through the native share sheet (WhatsApp or text).
- Email is optional and not built.

Accepting a `FAMILY` link:
1. The recipient signs in or signs up.
2. They pick which of their families represents them; the default is their own household.
3. They tick which fields to share. The default is names, birthdays, likes and avoid; sizes and food notes are opt-in.
4. Bestowd creates a `FamilyConnection`.

`FamilyConnection` fields:
- `familyId`: the inviter's family, the one that shows "On Bestowd".
- `sourceFamilyId`: the acceptor's family.
- `sharedFields String[]`, `createdAt`, `revokedAt?`.
- Unique on `familyId`.

What a connection shows and allows:
- The inviter's family profile shows a read-only panel of the source family's people, limited to `sharedFields`.
- It is read live, so there is nothing to sync and nothing to "accept changes".
- The acceptor can revoke it.
- This replaces the email auto-link.

## API shape

Every route is authenticated. Group-scoped routes check membership with one helper, `requireMember(groupId)`. The helper returns 404, not 403, so callers can't tell whether a group exists.

```
GET    /me                          user + memberships
GET    /me/occasions                ?from=&to=&type=  Home: across all the user's groups, each with groupId + groupName
GET    /groups/:groupId             settings
PATCH  /groups/:groupId             currency, default budgets, reminder days (OWNER)

GET    /groups/:g/families          ?status=  (with member count, next occasion)
POST   /groups/:g/families
GET    /families/:id                profile: people, occasions, totals, connection
PATCH  /families/:id                incl. status
DELETE /families/:id

POST   /families/:id/people
GET    /people/:id                  incl. age, history summary
PATCH  /people/:id                  incl. archive
DELETE /people/:id

GET    /groups/:g/occasions         ?from=&to=&type=  (one group, e.g. family profile, planned spend)
POST   /groups/:g/occasions
PATCH  /occasions/:id               incl. status, card, party fields
DELETE /occasions/:id

GET    /groups/:g/gifts             ?year=&direction=&personId=&familyId=  + totals
POST   /groups/:g/gifts
PATCH  /gifts/:id
DELETE /gifts/:id

GET    /groups/:g/ideas             ?personId=&occasionId=  (with repeat flags)
POST   /groups/:g/ideas
PATCH  /ideas/:id                   incl. assign to occasion, mark bought (creates GiftEntry)
DELETE /ideas/:id

POST   /groups/:g/invites           { kind, familyId? } → { url }
GET    /invites/:token              preview (who invited, which family)
POST   /invites/:token/accept       { sourceFamilyId, sharedFields } | joins group
DELETE /family-connections/:id      revoke
```

The routes that take an entity id (`/families/:id`, `/people/:id` and so on) check membership through that entity's `groupId`.

## Migration and code steps

1. Replace the contents of `prisma/migrations/` with one baseline migration (`init_v1`).
   - It is generated by Prisma, plus hand-added SQL for the check constraints and partial unique indexes.
   - Run `prisma migrate reset` on the dev and test databases.
2. Update `auth.ts`: create the group and own household on first sign-in, and remove auto-link.
3. Add the membership helper and the new routes, each with Vitest and supertest tests (same pattern as today).
4. Update the reminder job:
   - read `Occasion`, using the occasion's reminder days or the group default;
   - skip paused families;
   - send each due reminder to every member of the occasion's group, so a user gets reminders from all their groups;
   - reset the status on rollover.
   - Push delivery comes in step 4 of the roadmap; for now the job only computes which reminders are due.
5. Replace the types in `packages/types` and the methods in `packages/api-client`.
6. Web: replace the old pages with the mockup's tabs (Home, People, Gifts, Ideas, Family profile, Person). This is a separate plan after the API.

## Out of scope here

- Email and Apple sign-in.
- Push delivery and device tokens.
- AI suggestions and store listings.
- CSV export.
- Photo upload storage. Fields hold URLs for now.
- Wishlists and change prompts.
- Browser clipping.
