# Bestowd — Design Spec

**Date:** 2026-08-08  
**Status:** Approved  

---

## 1. Overview

Bestowd is a gift management platform that helps users track contacts, upcoming events, and gifts — with AI-powered suggestions, vendor product search, gift history, and collaborative gifting. It targets both web and mobile, sharing a single backend API.

---

## 2. Architecture

### Stack

| Layer | Technology |
|---|---|
| Web app | React / TypeScript |
| Mobile app | .NET MAUI (iOS + Android) |
| API | Node.js / TypeScript (Fastify) |
| Database | PostgreSQL (Neon.tech) |
| ORM | Prisma |
| Auth | Google OAuth 2.0 + JWT |
| Billing | Stripe |
| Background jobs | node-cron |

### Monorepo Structure (Turborepo)

```
bestowd/
├── apps/
│   ├── web/          ← React web app
│   ├── api/          ← Node.js Fastify API
│   └── mobile/       ← .NET MAUI (separate solution, consumes API via HTTP)
└── packages/
    ├── api-client/   ← typed fetch wrappers, shared by web and future apps
    ├── types/        ← shared TypeScript DTOs (API ↔ clients)
    ├── ui/           ← shared React component library
    └── config/       ← shared ESLint, TypeScript, Tailwind configs
```

The `.NET MAUI` mobile app is a separate solution inside `apps/mobile/`. It does not consume TypeScript packages but shares the same API contract via the `types/` package (used as a reference for generating C# DTOs).

### System Diagram

```
┌─────────────────────────────────────────────────────┐
│                      Clients                        │
│   React/TypeScript Web  │  .NET MAUI (iOS/Android)  │
└────────────┬────────────┴────────────┬──────────────┘
             │   HTTPS / REST + JWT    │
             ▼                         ▼
┌─────────────────────────────────────────────────────┐
│           Node.js / TypeScript API (Fastify)        │
│  Auth │ Contacts │ Events │ Gifts │ Export │ Billing │
└────────────────────────┬────────────────────────────┘
                         │
          ┌──────────────┼───────────────┐
          ▼              ▼               ▼
     PostgreSQL    External APIs      Stripe
     (Neon.tech)  ├─ Google OAuth
                  ├─ AI Providers (OpenAI / Anthropic / Gemini)
                  ├─ Amazon PA API (premium)
                  └─ Google Sheets / export targets
```

---

## 3. Authentication & Identity

### Flow
1. User taps "Sign in with Google" on web or mobile.
2. Google returns an OAuth token → client sends to Bestowd API.
3. API exchanges token with Google, upserts `User` record, returns a signed JWT.
4. All subsequent requests carry `Authorization: Bearer <token>`.

### Identity Trust Levels

```
User
├── identitySource: 'google' | 'email'
└── emailVerified: boolean
```

Google-authenticated users are always `emailVerified: true` (Google guarantees it). A "Google Verified" badge is shown in the UI. Future email/password login requires a separate email confirmation step.

---

## 4. Data Model

### User

```
User
├── id
├── googleId
├── email
├── name, avatarUrl
├── identitySource: 'google' | 'email'
├── emailVerified: boolean
├── aiProviderConfig (encrypted JSON):
│     provider: 'openai' | 'anthropic' | 'gemini'
│     apiKey: string (AES-256 encrypted at rest)
│     model: string
├── stripeCustomerId
├── subscriptionStatus: 'free' | 'premium' | 'past_due' | 'cancelled'
└── exportConfigs → ExportConfig[]
```

### UserConnection

```
UserConnection
├── requesterId (→ User)
├── addresseeId (→ User)
└── status: 'pending' | 'accepted' | 'blocked'
```

### Contact

```
Contact
├── id
├── ownerId (→ User)
├── linkedUserId? (→ User, if they have a Bestowd account)
├── name, avatarUrl, email, notes
├── attributes: JSON  ← [{ label: string, value: string }]
│                        e.g. "Shoe size: 10", "Loves: hiking"
└── isManaged: boolean  ← true = creator owns all data; false = linked user controls theirs
```

**Linked contact attribute visibility:** linked users self-manage their attributes with per-attribute opt-in visibility for connections. Unmanaged contact attributes are fully owned by the creator.

**Claim flow (unmanaged → linked):**
1. Contact creator enters email for unmanaged contact and optionally sends a Bestowd invite.
2. Recipient signs in with Google — email must match the contact record.
3. System auto-links; `isManaged` flips to `false` (real user now controls their own data).
4. Email mismatch → no auto-link; creator is notified to confirm manually.

### Event

```
Event
├── id
├── contactId (→ Contact)
├── type: 'birthday' | 'anniversary' | 'christmas' | 'custom'
├── name, date
├── recurrenceRule: 'once' | 'annual' | iCal RRULE string
├── reminderDays: number[]  ← e.g. [30, 7, 1]
└── nextOccurrence: Date    ← computed, cached for efficient querying
```

### Gift

```
Gift
├── id
├── createdBy (→ User)
├── type: 'product' | 'basket'
├── title, description, imageUrl
├── upc?        ← GTIN/UPC-A/EAN-13 — vendor-agnostic product identity
├── tags: string[]
└── basketItems → Gift[]   ← populated only when type = 'basket'
```

A `GiftBasket` IS a `Gift` with `type = 'basket'`. Its `id` can be used as `giftId` in `GiftAssignment` just like any other gift.

### ProductListing

```
ProductListing
├── id
├── giftId (→ Gift)
├── vendor: 'amazon' | 'etsy' | 'target' | 'custom'
├── vendorProductId   ← ASIN for Amazon, SKU/slug for others
├── vendorUrl
├── listedPrice
└── currency
```

Amazon PA API price history is stored/fetched at the `ProductListing` level (premium feature).

### GiftAssignment

```
GiftAssignment
├── id
├── giftId (→ Gift)          ← can point to a product or a basket
├── giverId (→ User)
├── contactId (→ Contact)    ← always required
├── eventId? (→ Event)       ← null = ad-hoc gift
├── status: 'idea' | 'purchased' | 'given'
├── givenAt?
├── purchasePrice?            ← actual amount paid
└── notes
```

The same `Gift` record can appear in multiple `GiftAssignment` rows (different recipients, different occasions), avoiding duplication while preserving full history.

### ExportConfig / ExportRecord

```
ExportConfig
├── id, userId
├── provider: 'google_sheets' | 'notion' | 'airtable' | 'csv'
├── credentials (encrypted)
├── targetId
└── schedule?

ExportRecord
├── exportConfigId
├── entityType: 'contacts' | 'events' | 'gifts' | 'assignments'
├── lastExportedAt
└── status: 'success' | 'failed'
```

---

## 5. Gift Suggestions

### AI Engine (pluggable)

The API constructs a prompt from:
- Contact's `attributes` (interests, sizes, preferences)
- Recent `GiftAssignment` history for that contact
- Event type and occasion context

The prompt is sent to the user's configured AI provider (OpenAI / Anthropic / Gemini) using their own API key. The response returns a list of gift ideas with title, description, price range, and search keywords.

### Vendor Product Search

AI-generated keywords drive searches against Amazon PA API (and future vendors), returning real `ProductListing` records with prices, images, and deep-link URLs for direct purchase.

**Deep-link purchase:** product URLs link directly to the vendor's product page or pre-filled cart. No in-app payment processing.

### Deduplication Warning

Before returning suggestions, the API queries `GiftAssignment` by `contactId`. Any suggestion whose title/tags have significant token overlap with a previously given gift triggers a warning: _"⚠ Similar to [gift] given on [date]."_ Simple token overlap — no ML required.

---

## 6. Premium Subscription

| Feature | Free | Premium |
|---|---|---|
| Contacts, Events, Gifts | ✅ | ✅ |
| AI suggestions (own API key) | ✅ | ✅ |
| Vendor product search | ✅ | ✅ |
| Deep-link purchase | ✅ | ✅ |
| Export (Google Sheets, etc.) | ✅ | ✅ |
| Amazon PA API price history | ❌ | ✅ |

**Billing:** Stripe recurring subscription (monthly/annual). Stripe webhooks update `User.subscriptionStatus` in real time. Premium gating is enforced server-side — the API checks `subscriptionStatus === 'premium'` before making Amazon PA API calls.

**Mobile checkout:** Stripe SDK for MAUI or redirect to web Stripe Checkout.

---

## 7. Export System

Each provider implements:

```typescript
interface IExporter {
  export(userId: string, config: ExportConfig, data: ExportPayload): Promise<void>
}
```

**Launch provider:** Google Sheets (full export: contacts, events, gifts, assignments).  
**Future providers:** Notion, Airtable, CSV — added by implementing the interface, no core changes.

Exports are triggered manually by the user or on a user-configured schedule.

---

## 8. Notifications & Reminders

A `node-cron` daily job:
1. Queries Events where `nextOccurrence` falls within any configured `reminderDays`.
2. Sends notifications to the event owner.
3. **Web:** browser push notifications (Web Push API).
4. **Mobile:** Firebase Cloud Messaging (FCM).

---

## 9. Phasing

### Phase 1 — Foundation
- Monorepo (Turborepo), Node.js API, PostgreSQL/Prisma schema
- Google OAuth, JWT auth, User profiles
- Contacts (linked + unmanaged), UserConnections, trust/claim flow
- Events + reminders (node-cron background job)
- Gift, GiftAssignment, GiftBasket CRUD
- React web app (core screens), .NET MAUI mobile (core screens)

### Phase 2 — Gift Intelligence
- AI suggestion engine (pluggable provider, encrypted API key config)
- Vendor product search (Amazon PA API)
- Deduplication warnings
- Deep-link purchase URLs

### Phase 3 — Premium & Export
- Stripe subscription billing
- Amazon PA API price history (premium gate)
- Google Sheets export + pluggable exporter interface

### Phase 4 — Polish
- Additional export providers (Notion, Airtable, CSV)
- Push notifications (Web Push + FCM)
- `packages/ui` component library extraction
- Additional AI providers

---

## 10. Security Considerations

- AI provider API keys and export credentials are AES-256 encrypted at rest.
- Premium gating enforced server-side only.
- Gift history for a contact is never exposed to that contact — visible only to givers.
- Google OAuth email verification prevents impersonation for linked users.
- Unmanaged contact linking requires email match to the claimant's Google account.
