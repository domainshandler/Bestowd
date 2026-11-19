# Bestowd — Reconciling the build with the v1 Scope Document

**Date:** 2026-11-18
**Compares:** the repo's design spec (`2026-08-08-bestowd-design.md`) and the code as of `f10c150`, against the **Bestowd — Scope Document** (Claude Doc, 2026-11-15), the **Bestowd Wireframe** (Home, Person) and the **Bestowd – Navigation Tabs Mockup** (Home, People, Gifts, Ideas, Chen family profile, 2026-11-16).

**Bottom line:** the technical foundation fits the scope (monorepo, Fastify, Prisma/Postgres, Google OAuth + JWT, React web, MAUI planned). The **domain model does not fit**. The scope is built on *groups → families → people → occasions → gifts both ways*. The code is built on *one user → flat contacts → events → given gifts*, and its Phase 2–3 roadmap (BYO AI keys, Stripe, Amazon price history, Google Sheets export) is mostly outside v1. The next work should be a data-model realignment, not more features on the current model.

---

## 1. What carries over unchanged

- Monorepo (Turborepo, pnpm), `packages/types`, `packages/api-client`.
- API stack: Fastify 4, Prisma 5, PostgreSQL, zod config, Vitest + supertest test suite.
- Google OAuth + JWT auth (scope adds email and Apple, but keeps Google).
- React web app as the desktop companion; .NET MAUI as the primary mobile client. The scope confirms MAUI (decided).
- Reminder cron skeleton and `nextOccurrence` logic (needs new defaults and real push delivery).
- Encryption helper (`crypto.ts`) — still useful for any stored secrets.
- Gmail mailer from the invite work — reusable for email sign-up and invites.

## 2. Domain model: current vs scope

| Concept | Today (code) | Scope / mockups | Change needed |
|---|---|---|---|
| Ownership | Each `User` owns its `Contact`s | A **group** (shared workspace) owns everything; a login has one primary group and optional secondary groups; mockup shows per-family "co-givers: You & Sam" | New `Group` + `GroupMembership`; move ownership from user to group on every entity |
| Families | None — contacts are flat | **Family** (e.g. "Chen family", "Kindergarten class") with a type (Friends, School, Family), members, status Active / Paused / Archived | New `Family`; person belongs to one family; your own household is a family |
| People | `Contact`: name, email, notes, `attributes` JSON | Person: relationship, birthday, birth year/age, likes, **avoid** list, sizes, food notes, photo, notes; archive | Rename/extend `Contact` → `Person` with structured fields; age computed from birth year |
| Occasions | `Event`: tied to one contact, type, date, annual recurrence, reminder days [30, 7, 1] | Tied to a **person or a family**; types birthday / holiday / one-off; budget; status *Not started → Idea saved → Bought → Given*; card checklist; party details (time, location, RSVP, host gift request); end a recurrence from a date | Rename/extend `Event` → `Occasion`; status moves from the gift to the occasion |
| Gifts | `Gift` catalogue item + `GiftAssignment` (given only, giver = user) | Log **given and received**; received has from-person/family, estimated value, gift receipt, return-by, thank-you sent; reaction ("Loved it", "Already had it"); credit a family gift to members | New gift log with `direction`; received-gift fields; member crediting |
| Ideas | `Gift` with tags and listings | Ideas board: one idea tagged to @people and age-range groups; assign to an occasion; repeat check | Rework `Gift` into `Idea` with person tags and age-range tags |
| Gift baskets | `Gift.basketItems` | Not in scope | Drop or park |
| Budgets | None | Default per occasion type, override per occasion, spend per month/year/family, over-budget flag; one currency per account, **CAD default** | New budget fields; currency default changes from USD |
| Connections | `UserConnection`; `Contact.linkedUserId` (unique); claim + email auto-link | Opt-in **family-to-family** profile connection with approval, chosen shared fields, "accept changes?" prompt, private wishlist | Rethink — see section 4 |

## 3. Roadmap items in the repo design spec that conflict with the scope

| Repo design spec | Scope says | Recommendation |
|---|---|---|
| AI with the **user's own API key** (OpenAI/Anthropic/Gemini), stored encrypted; Account screen already saves it | Bestowd runs the AI and pays per request ("AI calls cost money per request, so suggestions are on demand"); provider and cost are open questions | Replace BYO keys with a server-side provider key; remove the AI config from Account |
| AI suggestions as generic ideas + Amazon PA API search | Hybrid engine: rank real store listings (age, budget, availability, history), AI writes reasons and handles free-text interests; Canadian catalogues are an open question | Start with simple rules + one LLM call; pick the catalogue later |
| Phase 3: Stripe premium, Amazon price history | Revenue is a non-goal for v1; price tracking and premium are later phases | Move out of v1 |
| Google Sheets export + pluggable exporters (Notion, Airtable) | Export all data as **CSV** | CSV export only; drop `ExportConfig`/`ExportRecord` for v1 |
| Web Push + FCM in Phase 4 | Push reminders are **v1**, default 14 and 3 days before | Move into v1, via the MAUI app |
| Google sign-in only | Email, Apple and Google sign-in | Add email and Apple; Apple sign-in is required by the App Store when an app offers Google sign-in |
| Web app first, mobile later | Mobile-first; web is a companion | Build the MAUI app as soon as the new model's API is ready |

## 4. The contact-invite feature just built

The invite email and auto-link (commits `bb56726`–`f10c150`) partly match the scope's "invite a family to connect their Bestowd profile". They differ in three ways:

1. The scope invites by **WhatsApp or text link**, not email.
2. The scope connects **families**, not single contacts, and the recipient chooses which fields to share.
3. The scope requires **approval** and an "accept changes?" prompt. Auto-link links silently on sign-in.

Connected profiles are also an open question for v1. Recommendation: keep the code (it is small and tested), but don't build further on it until connected profiles are designed against the family model.

## 5. Screens: mockups vs web app

The newer mockup (2026-11-16) replaces the older wireframe's tab bar (Upcoming · Families · History · Ideas). This document treats the newer one as current.

| Mockup tab / screen | Shows | Web app today |
|---|---|---|
| **Home** | Next-30-days count and planned spend, filter chips (All / Birthdays / Holidays / Events), upcoming occasions with status, one featured AI suggestion, add button | Dashboard with upcoming events; no spend, status or suggestion |
| **People** | Search; Families / Everyone toggle; family cards with type, member count and next occasion; Add family | Flat Contacts list |
| **Family profile** | Status and type, co-givers, given/received/spent totals, members with next birthday and "On Bestowd" badge, upcoming occasions with "Needs gift", per-person notes (Loves, Avoid, size, food note, wishlist), history with reactions, reminders / share / pause / archive settings | None |
| **Person** | Age, birthday, likes; Given / Received toggle; history by year; ideas filtered for repeats; Log a gift | Contact detail with attributes and gift list (given only) |
| **Gifts** | Year picker; Given / Received / Spent totals; All / Given / Received / Planned filter; history grouped by occasion and year; "Thank-you due" | Gift catalogue list |
| **Ideas** | Pick a person (age on the occasion date, budget); repeat notice ("Skipping puzzles: you gave one in Dec 2025"); top pick with reason; Mark as bought / Save; More ideas | None |

## 6. Recommended order of work

1. **Decide the open questions that shape the model** (section 7). One sitting.
2. **Data-model realignment** (spec, then plan): Group and membership, Family, Person, Occasion, two-way gift log, Idea, budgets, CAD default. Includes migrating or resetting existing data.
3. **API and web screens on the new model**: Home, People, Family profile, Person, Gifts, using the mockup tab bar. Retire the Events and Gifts-catalogue pages.
4. **MAUI app** on the same API: the same tabs, plus push reminders (14 and 3 days by default, a buy reminder, card and thank-you reminders).
5. **Ideas board and suggestions**: manual ideas and repeat warnings first, then server-side AI suggestions, then real store listings.
6. **Account completeness**: email and Apple sign-in, onboarding (create or join a group), address-book import, photo upload, CSV export, account deletion.
7. **Later, if confirmed for v1**: connected family profiles and wishlists, browser clipping / share sheet.

## 7. Questions to settle before step 2

These come from the scope's open questions or from differences between the documents.

- [x] **Sharing unit.** The scope shares by group; the family mockup shows per-family co-givers ("Share with co-givers"). Are both needed, or is group membership enough for v1?
  - Decided 2026-11-18: groups only. Everyone in a group sees everything in it. "Co-givers" on a family is the list of group members; there is no per-family sharing switch. Secondary groups cover "share only some families".
- [x] **Received gifts in v1?** The scope lists it as open, but the mockups and the "gifts both ways" idea depend on it.
  - Decided 2026-11-18: yes, full logging: item, from person or family, occasion, estimated value, photo, gift receipt and return-by date, thank-you sent, thank-you reminder. One gift log with a given/received direction.
  - Decided 2026-11-18: the estimated value of a received gift is stored but hidden by default; the user chooses to reveal it.
- [x] **Existing data.** Is there real data in the dev database to migrate, or can the schema be reset?
  - Decided 2026-11-18: reset. The new model starts from a fresh baseline migration; no data migration.
- [ ] **Adults.** Do we track gifts for adults (teachers, grandparents) in v1, or only children? The family mockup lists parents with birthdays.
- [ ] **AI cost.** Is a Bestowd-paid provider key acceptable for v1, with a monthly cap per user?
- [x] **Connected profiles.** In v1 or after launch? This decides the fate of section 4.
  - Decided 2026-11-18: minimal v1. Invite a family by link; once they accept, the family shows "On Bestowd" and a read-only view of what they share. No "accept changes?" prompts and no wishlist in v1.
  - Consequence: the email auto-link from section 4 links without the recipient accepting, so it gets reworked into the accept step of this invite flow.
- [x] **Web's role.** The scope lists a React web app in Platforms, but "Web companion" under Later phases. Is web in v1 alongside MAUI?
  - Decided 2026-11-18: yes — React web and MAUI both ship in v1 on the same API.
