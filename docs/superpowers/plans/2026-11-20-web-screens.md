# Web Screens (v1) Implementation Plan

**Goal:** Build the React web companion on the v1 API, following the Navigation Tabs Mockup (Home, People, Family profile, Gifts, Ideas) plus the Person screen from the older wireframe. Add the join-link page and group switching.

**Reference:**
- `docs/superpowers/specs/2026-11-18-data-model-realignment.md`
- Bestowd – Navigation Tabs Mockup (claude.ai artifact `365e70df-…`)

**Stack:** React 18, React Router 6, TanStack Query 5, Tailwind 3, Vitest and Testing Library.

## Look (from the mockup)

**Colours:**

| Role | Hex | Tailwind token |
|---|---|---|
| Ground | `#FAFAF7` | `ground` |
| Ink (text) | `#1C1B19` | `ink` |
| Muted text | `#5F5D57` | `muted` |
| Border | `#E7E4DC` | `line` |
| Divider | `#EFEDE7` | `divider` |
| Teal (primary) | `#0F6E68` | `brand` |
| Teal, dark | `#0A524D` | `brand-dark` |
| Teal, light | `#E3F1EF` | `brand-light` |
| Teal, on dark | `#CFE7E4` | `brand-faint` |
| Amber | `#F2B33D` | `amber` |
| Amber, soft | `#FDF0D5` | `amber-soft` |
| Amber, ink | `#8A4B00` | `amber-ink` |
| Red, soft | `#FBE6E2` | `danger-soft` |
| Red, ink | `#9A2A1E` | `danger` |
| Neutral chip | `#EFEDE7` on `#3D3B36` | `chip` |

**Type:** Inter for body text, Plus Jakarta Sans 700 for headings.

**Shapes:** cards are white with a 1px `line` border, 16px corners. Badges are pill-shaped. Touch targets are at least 44px.

**Layout:**
- **Phones:** the content column is about 390px wide, with a fixed bottom tab bar: Home, People, Gifts, Ideas.
- **Wider screens:** a left sidebar with the same four tabs plus Account, and the content centred with a maximum width of 3xl.

## Cross-cutting pieces

1. **Theme:** Tailwind tokens and the Google Fonts link.
2. **`GroupContext`:**
   - It loads `/me` and holds the current group id.
   - It remembers the choice in `localStorage` under `bestowd_group`. The default is the primary group, and it falls back to the primary group if the stored group is gone.
   - It exposes `memberships`, `multipleGroups` and `setGroupId`.
3. **`GroupSwitcher`:** a select shown only when `multipleGroups` is true. It sits in the sidebar or header and appears on the People, Gifts and Ideas tabs. Home doesn't need it, because it already covers every group.
4. **UI kit (`components/ui.tsx`):** `Card`, `Badge` (tone: brand, amber, neutral, danger), `Button` (primary, secondary, ghost), `Segmented`, `Chips`, `Modal` (a native `<dialog>`), `Field`/`TextInput`/`Select`, `EmptyState`, `DateTile`, `Avatar` (initials) and `formatMoney`/`formatDate` helpers. Dates are shown in UTC, because the API stores calendar dates as UTC midnight.
5. **Forms (`components/forms/`):** Family, Person, Occasion, Gift (log given or received), Idea and InviteLink. Each opens in a `Modal`, posts through the API client, and invalidates the related queries.

## Screens

| Route | Screen | Data |
|---|---|---|
| `/` | **Home.** Summary card: number of occasions in 30 days, "N need gifts" and planned spend. Filter chips: All, Birthdays, Holidays, Events. Occasion rows: a date tile, name, subject and family, a status badge, and a group label when you're in more than one group. Plus a "Log a gift" button. | `listHomeOccasions` |
| `/people` | **People.** Search, a Families/Everyone toggle, family cards (type, member count, avatars, next occasion, On Bestowd badge) and an Add family button. | `listFamilies`, `listPeople` |
| `/families/:id` | **Family profile:** <ul><li>status and type chips;</li><li>co-givers;</li><li>stats (given, received, spent);</li><li>members, with next birthday, "In N days" and Add person;</li><li>upcoming occasions, with "See gift ideas" when a gift is needed, and Add occasion;</li><li>gifting notes per person (loves, avoid, sizes, food note);</li><li>a read-only panel of what a connected family shares;</li><li>gift history;</li><li>settings: pause or resume, archive, invite to connect (shows a link to copy), and delete when it isn't your own household.</li></ul> | `getFamily`, `getGroup`, `listGifts?familyId` |
| `/people/:id` | **Person:** <ul><li>age, birthday, likes and avoid;</li><li>a Given/Received toggle, with history by year;</li><li>ideas for this person, with repeat warnings;</li><li>edit, archive, log a gift and add an occasion.</li></ul> | `getPerson`, `listGifts?personId`, `listIdeas?personId` |
| `/gifts` | **Gifts:** <ul><li>year picker;</li><li>Given / Received / Spent totals;</li><li>All / Given / Received / Planned filter. Planned means bought but not yet given;</li><li>gifts grouped by occasion and year;</li><li>"Thank-you due" badge;</li><li>a received value stays hidden until you press "Show value";</li><li>log a gift.</li></ul> | `listGifts` |
| `/ideas` | **Ideas:** <ul><li>a person picker; the header shows the age on the next occasion and the budget;</li><li>repeat notice;</li><li>idea cards, with "Mark as bought" and Dismiss;</li><li>Add idea;</li><li>with no person chosen, every saved idea is listed.</li></ul> | `listPeople`, `listIdeas`, `listOccasions?personId` |
| `/join/:token` | **Join (public).** A preview of who is inviting. If you aren't signed in, you sign in and are returned here. A family invite asks which of your families to connect and which fields to share. A group invite just accepts. | `getInvite`, `acceptInvite` |
| `/account` | **Account:** profile, your groups, group settings (owner only: name, currency, default budgets, reminder days), invite someone to the group, and sign out. | `getMe`, `getGroup`, `updateGroup`, `createInvite` |

**Changes to existing pieces:**
- **Login:** after sign-in, go back to the page you came from, which can be `/join/...`.
- **Old route:** `/dashboard` redirects to `/`.

## Tests (Vitest and Testing Library, with the API client mocked)

- **`GroupContext`:** defaults to the primary group, remembers a choice, and falls back when the stored group is gone.
- **Home:** shows the summary and rows, the type filter changes the query, and group labels appear only for users in several groups.
- **Gifts:** a hidden received value stays hidden until "Show value" is pressed, and the Planned filter asks for `status=BOUGHT`.
- **Ideas:** shows the repeat notice, and "Mark as bought" calls `buyIdea`.
- **Join:** a family invite sends the chosen source family and fields, and a group invite accepts directly.
- **Build:** `pnpm --filter @bestowd/web build` passes.

## Out of scope

- Photo upload: photos are shown when a URL exists.
- AI suggestions: Ideas shows the saved ideas only.
- Calendar view and notifications.
