# Joining and leaving groups

Status: built (API, web, mobile), 2026-11-23. This supersedes the "joining keeps your personal group" note in `2026-11-18-data-model-realignment.md`.

Everyone who signs in to a group is a person in its household (`Person.userId`). Joining a group can bring your own things along, with the owner's approval. Leaving a group lets you take a copy of families and their gift history. The group always keeps its own data.

## Joining

1. **You join at once.** Accepting a group invite adds you as a member and puts you in the group's household. The joined group becomes the one the app opens to.
2. **You choose what to bring.** If you own a group that nobody else is in and that holds anything, the join screen lists its families, holidays and ideas, all ticked. Your selection becomes a `MoveRequest` (PENDING). Later requests can be sent from Settings → Bring my things. Only one request per source group can be pending.
3. **The owner reviews it** on `/move-requests/:id`:
   - **Untick items.** The owner can narrow the request but never widen it.
   - **Look-alike families and people** are flagged. They match when their names are equal after ignoring case, accents, a leading "the", a trailing "family" or "household", and a plural "s". Look-alikes combine by default, or the owner chooses "keep both".
   - **Holidays both groups track** always become one occasion. If the budgets differ, the owner picks whose to keep.
   - **The receiving group's settings never change.** A different currency gets a warning, and amounts aren't converted.
4. **What happens on approval:**
   - Families move with their people, their gifts and their own occasions, such as birthdays.
   - Links to anything left behind are cut. A moved gift for a holiday that stays loses that holiday, unless the receiving group tracks the same one.
   - The source group is deleted once nothing is left in it.
5. **Decline or withdraw.** If the owner declines, or the requester withdraws, nothing moves.

## Leaving: the standard

Leaving happens from Settings → Leave group (the web modal or the mobile Leave screen). The standard is:

1. **Ask what to take a copy of.**
   - Every family in the group is listed with its people and gift counts, all ticked, so nothing is lost by accident. The household is listed as "the household's people".
   - A copy carries:
     - the family's people and their own occasions, such as birthdays;
     - every gift for them, given and received, keeping who logged it and the co-giver credits;
     - the holidays those gifts were for.
   - Gift ideas tagged with the copied people come too, with a tick box to leave them out.
   - **Where copies go:** a group you own by default, or a group of your choice, or "a new group of my own".
   - **Look-alikes:** if the destination has a family or person with the same name, the copy is combined with it. You are never duplicated: your entry maps to your own household entry.
2. **The group keeps everything.** Copies are copies. Nothing is removed from the people who stay.
3. **You stay listed in its household as a plain person**, so past gifts keep your name. "Remove my details" keeps the name but clears your birthday, likes, sizes, food notes, photo and notes, and deletes your own occasions in that group.
4. **Someone stays in charge.** An owner names who takes over. An owner who is the only member deletes the group, after typing "delete".
5. **Tidy up.**
   - Pending move requests from you, or from the group you leave, are cancelled.
   - Reminders for that group stop, because they go to members only.
   - If it was your last group, you get a fresh one.
6. **Tell the group.** The people who stay see a dismissible notice on Home for 30 days, e.g. "Sheldon left the group and took a copy of 2 families. Renny is now the owner." Copies don't need the owner's approval, because the leaver could already see all of it.
7. **No syncing afterwards.** The copies and the originals are independent. If you rejoin, you reclaim your old household entry by name. Bringing your copies back goes through the owner's review, which flags look-alikes.

Not included:
- **Family connections** (profiles shared from another family's own account) stay with the group. Reconnect them from the new group.
- **An owner removing a member** isn't built yet.

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /invites/:token/movable` | What you could bring when joining |
| `POST /invites/:token/accept` `{ bring? }` | Join, optionally with a move request |
| `GET/POST /groups/:id/movable`, `/groups/:id/move-requests` | Settings: what's left to bring, send a request, list pending requests |
| `GET /move-requests/:id`, `POST …/approve`, `…/decline`, `…/cancel` | Review and decide |
| `GET /groups/:id/leave-options` | Families to copy, idea count, your other groups |
| `POST /groups/:id/leave` `{ newOwnerId?, deleteGroup?, forgetMe?, copy?: { familyIds, ideas?, toGroupId? \| toNewGroup? } }` | Leave |
| `POST /groups` | Start a new group |
| `GET /groups/:id/notices`, `POST /notices/:id/dismiss` | Group notices |

The code lives in `apps/api/src/services/move.ts` (join), `apps/api/src/services/copy.ts` (leave) and `apps/api/src/routes/{moves,groups}.ts`. The tests are in `apps/api/tests/join-move.test.ts`.
