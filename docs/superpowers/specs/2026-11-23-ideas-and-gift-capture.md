# Ideas and gift logging: details, photos, capture and autofill

Status: built, 2026-11-23 (phases 1–5). Decisions from the user: photos stored on the NAS for now; popular threshold 5 groups / 90 days; **no barcode scanning**; AI key entered in Settings, with a choice of provider (Anthropic, OpenAI or Google). Product requirements are in the scope document (sections 5 and 10, and the Open questions). This file is the technical design and build order.

Today an idea has a name, link, price, image URL and notes, but a logged gift has no brand or link. Buying an idea copies only its title and price. Neither form takes a photo: the API has no uploads. Picking people uses chips, and the people filter on Ideas is one chip per person.

## Requirements

| # | Requirement | Where |
| --- | --- | --- |
| R1 | **Brand** on ideas and gifts, e.g. "Garmin" for a smartwatch | API, web, mobile |
| R2 | **Product link** on gifts. Marking an idea Bought copies its link, brand, price, photo, category and notes into the gift. | API, web, mobile |
| R3 | **Take a photo** with the camera, or pick one, on ideas and gifts | Uploads + web + mobile |
| R4 | **Capture in store:** scan a barcode, photograph the item or price tag, or share a store page. Fill in name, brand, price and picture, then open the normal form to edit. | API lookups + mobile camera |
| R5 | **Add a new recipient** (person or family) from the idea and gift forms | web, mobile |
| R6 | **Type-to-search dropdowns** for people and families on the Ideas filter and the gift recipient picker, narrowing as you type | web, mobile |
| R7 | **Autofill on text fields:** item, brand, store, category | API + web + mobile |

R7's suggestions are ranked in this order:
1. What this user and their group logged before (gifts and ideas), most recent and most used first.
2. What is popular across Bestowd right now, from a cached aggregate.
3. A built-in list per field: well-known brands, stores and categories.

## Design

### R1, R2: fields and carry-over

- **Migration:** add `brand String?` to `Idea` and `GiftEntry`, and `url String?` to `GiftEntry`.
- **`POST /ideas/:id/buy`:** copy `url`, `brand`, `category`, `notes` and the image (`Idea.imageUrl` → `GiftEntry.photoUrl`) along with the title and price. Fields in the request body still win.
- **Forms:** show Brand and Link fields on both forms. Show the link as "Open in store" on the gift and idea screens.

### R5, R6: one picker for people and families

- **Web:** generalise `PeopleSearch` into a `RecipientPicker` combobox. It works in single-select mode (the gift recipient: a person or a family) and multi-select mode (who an idea is for, and the Ideas filter).
  - It groups matches as People and Families, and keeps the word-prefix, accent-insensitive matching.
  - The last row is **"+ Add '<typed text>'"**. It opens a small inline form: name, family (existing, or new with a type), and an optional birthday. It creates the person or family and selects it.
- **Mobile:** the same, as `RecipientPicker` in Core plus a reusable control, extending `PeoplePicker`.
- **Ideas filter:** the chip row is replaced by this combobox. Selected filters show as removable chips beside it.

### R3: photos

- **Storage:** add `POST /uploads` (multipart, image/jpeg|png|heic, ≤ 10 MB). The server re-encodes to JPEG at a maximum of 1600 px and strips EXIF location.
  - Files are stored under `UPLOAD_DIR`, a Docker volume on the NAS for now, as `/<groupId>/<uuid>.jpg`.
  - Files are served through `GET /files/:groupId/:name`, members only. The app fetches them with its token, and web uses short-lived signed URLs.
  - A storage interface keeps this movable to S3 or R2 when there's a real domain.
- **Mobile:** use `MediaPicker.CapturePhotoAsync` / `PickPhotoAsync`, resize on the device before upload, and add Android camera permission.
- **Web:** use `<input type="file" accept="image/*" capture="environment">`, which opens the camera on phones.
- `Idea.imageUrl` and `GiftEntry.photoUrl` hold the served path.

### R4: capture in store

All three routes end the same way: a draft `{ title, brand, price, currency, url, imageUrl }` opens the idea or gift form pre-filled, for the user to edit and save.

1. **Store link** (paste, or share to Bestowd from a browser). `POST /capture/link {url}` fetches the page server-side and reads its schema.org `Product` JSON-LD, then OpenGraph tags. This also delivers the scope's "browser clipping" through the phone's Share button.
   - It has a timeout and a size cap, and only fetches http(s) URLs that don't resolve to private addresses.
2. **Photo of the item or price tag.** `POST /capture/photo` sends the uploaded image to a Claude vision model (`claude-haiku-5-5` for cost). It asks for strict JSON: name, brand, price, currency and a confidence for each.
   - Low-confidence fields are left empty rather than guessed.
   - The photo is kept as the item's picture.
3. ~~Barcode.~~ Dropped: reading the photo covers it, including the price on a tag.

### R7: autofill

- **`GET /groups/:id/suggest?field=brand|title|store|category&q=gar`** returns up to 8 values, ranked:
  1. **Yours:** distinct values from the group's gifts and ideas, matched by word prefix and ranked by count and recency. Inherited history counts too, through copies from the group's families.
  2. **Popular:** a `PopularTerm(field, value, groups, refreshedAt)` table, rebuilt every few hours by a job. It keeps a value only if at least 5 different groups used it in the last 90 days, and stores no recipients or group ids. It's served from an in-memory cache with a TTL of about 1 hour, so trends show up the same day.
  3. **Built-in:** `apps/api/src/suggest/seed/{brands,stores,categories}.json`, a few hundred entries each, extendable like the holiday catalog.
- **Clients:** a debounced (150 ms) combobox on those fields. Typed text is always allowed.

## Build order

| Phase | Scope | Size | Needs from you |
| --- | --- | --- | --- |
| 1 | R1 brand + gift link, R2 idea → gift carry-over | Small (≈ half a day) | Nothing |
| 2 | R5 + R6 recipient picker with "add new", Ideas filter dropdown | Medium (≈ 1 day) | Nothing |
| 3 | R3 photos: uploads, camera on mobile and web | Medium (≈ 1 day) | OK to store photos on the NAS for now |
| 4 | R7 autofill: yours + built-in lists, then the popular aggregate | Medium (≈ 1 day) | The privacy threshold (proposed: 5 groups) |
| 5 | R4 capture: store link first, then photo (AI), then barcode | Medium to large (≈ 2 days) | An Anthropic API key for photo reading. A UPC provider and its cost. |

Phases 1–2 are independent of 3–5. Phase 5 builds on phase 3's uploads.

## Open questions

These are mirrored in the scope document.
- Which UPC provider? Free tiers allow about 100 lookups a day; paid ones cost about $0.01–0.05 a lookup.
- Is sending item photos to the Claude API for reading acceptable? Photos would be sent only when the user taps "Fill in from photo".
- Popular terms: is 5 groups over 90 days the right privacy threshold?


## As built: capture and AI

- **Settings (owner only):** `GET/PUT/DELETE /groups/:id/ai`. The fields are `provider` (`anthropic` | `openai` | `google`), `model` and `apiKey`.
  - The key is encrypted with `ENCRYPTION_KEY` and never returned; only its last 4 characters are shown.
  - Anthropic defaults to `claude-opus-5-5` (about 1 cent a photo). `claude-haiku-5-5` can be entered for less. OpenAI and Google need a model named.
- **`POST /groups/:id/capture/link {url}`** reads schema.org Product JSON-LD, then Open Graph tags. Private, loopback and link-local addresses are refused, including after redirects, with an 8 s timeout and a 2 MB cap. No AI is involved.
- **`POST /groups/:id/capture/photo {photoUrl}`** reads an uploaded photo from this group with the group's AI.
  - **Claude:** the official SDK's `beta.messages.parse` with Zod structured output, effort `low`, and server-side refusal fallback (`fallbacks: "default"`).
  - **OpenAI:** JSON-schema `response_format`.
  - **Gemini:** `responseSchema`.
  - Unreadable fields come back null, and the forms fill only the fields that were found.

## Follow-up: photo first, and editing ideas (2026-11-23)

- **Snap a gift on Home.** A card near the top of Home takes (or chooses) a photo and uploads it before anything else is decided. Then it asks "What is it?": a gift idea, a gift I gave or bought, or a gift we received. That form opens with the photo shown first. When the group has AI it reads the photo straight away, once, and fills what it finds.
- **Every idea can be edited.** Ideas get an Edit button on web and mobile, and `GET /ideas/:id` loads one. This covers ideas with nobody tagged, which before could only be dismissed.
- **"Mark as bought" is always offered.** When the recipient is known (the person being viewed, the idea's only tagged person, or its occasion), it buys straight away as before. Otherwise it opens Log a gift, filled in from the idea and set to "Bought, not given yet", so the user picks who it's for.
- **A gift logged with `ideaId`** (direction GIVEN) marks that idea BOUGHT in the same transaction. A received gift leaves the idea as it was.
