# Contact Invite & Auto-Link — Design Spec

**Date:** 2026-08-24
**Status:** Approved

---

## 1. Overview

Today, entering an email address for an unmanaged `Contact` does nothing beyond storing it. The original platform design spec called for an optional invite email and an automatic link between an unmanaged contact and the real user account that later signs up with a matching email — neither exists yet. The server-side `POST /contacts/:id/claim` endpoint that was meant to support linking is unused by the web app and requires the recipient to take a manual action, which never happens in practice.

This feature closes that loop:

1. A contact creator can opt in to sending an invite email to an unmanaged contact.
2. When the invited person (or anyone else) signs in with Google using a matching email, the system automatically links them to that contact record.

Out of scope for this pass: the spec's "creator notified on email mismatch" fallback (no notification infrastructure exists yet — Phase 4 work) and any change to the existing `POST /contacts/:id/claim` endpoint, which is left in place as a manual fallback.

---

## 2. Data Model

Add one field to `Contact`:

```prisma
model Contact {
  // ...existing fields
  invitedAt DateTime?
}
```

`null` = never invited. Set to the current timestamp each time an invite is (re)sent.

---

## 3. Email Sending

New service: `apps/api/src/services/mailer.ts`, using **Nodemailer** over **Gmail SMTP**.

- Sends as `pantrywatson@gmail.com` using a Gmail app password (not the account password).
- New required env vars (added to `apps/api/.env.example` and validated in `config.ts` via the existing zod schema, same pattern as `JWT_SECRET`/`GOOGLE_CLIENT_ID`):
  - `GMAIL_USER` — the sending Gmail address
  - `GMAIL_APP_PASSWORD` — 16-character Gmail app password
  - `WEB_APP_URL` — base URL of the web app, used to build the sign-in link in the email body
- Exported function: `sendContactInvite(to: string, inviterName: string): Promise<void>`
- Email content: plain text + minimal HTML. Subject: "`{inviterName}` invited you to Bestowd". Body: short explanation that they've been added as a gift-planning contact, with a link to `WEB_APP_URL` to sign in with Google. No token or magic link — linking happens purely by email match at sign-in (see §4).
- If the SMTP send throws, the route returns an error and does **not** update `invitedAt`.
- The mailer is mocked in tests (same pattern as `verifyGoogleToken` in `google-auth.ts`), so the test suite never hits real SMTP.

---

## 4. API Changes

### `POST /contacts/:id/invite`

- Auth required; contact must be owned by the requesting user.
- 404 if contact not found / not owned by requester.
- 400 if the contact has no `email` set.
- 409 if the contact is already linked (`isManaged: false`).
- On success: calls `sendContactInvite`, sets `invitedAt = now()`, returns the updated `Contact`.
- Can be called again to resend — no separate "resend" endpoint, same route.

### `POST /auth/google` — auto-link on sign-in

After the existing user upsert step, look up the oldest `Contact` where:
- `email` matches the signed-in user's email (case-insensitive)
- `isManaged: true`
- `linkedUserId: null`

If found, update it: `linkedUserId = user.id`, `isManaged = false`. This runs on **every** login (not just first-time signup), so it also catches contacts added *after* the person already had a Bestowd account.

**Known constraint carried over from the existing schema:** `Contact.linkedUserId` is `@unique`, meaning a given real user can be the linked account for at most one `Contact` record system-wide — not one per relationship. If two different people each added the same friend as an unmanaged contact with a matching email, only the first (oldest) of those contact records auto-links when that friend signs up; the second remains unmanaged with the email still stored. This is a pre-existing constraint, not introduced by this feature; loosening it would be a separate, larger schema change and is out of scope here.

---

## 5. Web App Changes

- `packages/types/src/contact.ts`: add `invitedAt: string | null` to the `Contact` interface.
- `packages/api-client/src/contacts.ts`: add `sendInvite(id: string): Promise<Contact>` calling `POST /contacts/:id/invite`.
- `apps/web/src/pages/ContactDetailPage.tsx`:
  - When `contact.isManaged && contact.email`, show a "Send Invite" button (label becomes "Resend Invite" once `invitedAt` is set).
  - When `invitedAt` is set, show "Invited on `{formatted date}`" near the button.
  - Wired via a `useMutation` calling `sendInvite`, invalidating the `['contacts', id]` query on success, same pattern as the existing `update`/`remove` mutations on that page.

---

## 6. Testing

- `apps/api/tests/contacts.test.ts`: add cases for `POST /contacts/:id/invite` — success sets `invitedAt` and calls the (mocked) mailer; 400 with no email; 404 for a contact owned by another user; 409 if already linked.
- `apps/api/tests/auth.test.ts`: add a case that creates an unmanaged contact with an email matching a not-yet-existing user, then logs in as that user via `POST /auth/google`, and asserts the contact is auto-linked (`isManaged: false`, `linkedUserId` set).
- Mailer is mocked (`vi.mock('../src/services/mailer.js', ...)`) in both test files so no real email is sent during tests.

---

## 7. Error Handling Summary

| Case | Behavior |
|---|---|
| Invite requested, no email on contact | 400, no email sent |
| Invite requested, contact already linked | 409 |
| SMTP send fails | Error returned, `invitedAt` not updated |
| Missing `GMAIL_USER`/`GMAIL_APP_PASSWORD`/`WEB_APP_URL` at boot | App fails to start (existing zod env validation pattern) |
| Sign-in email matches multiple unmanaged contacts across different owners | Only the oldest is auto-linked, per the `linkedUserId` unique constraint (§4) |
| Sign-in email matches no unmanaged contact | No-op, login proceeds normally |
