# Calendário Editorial (Editorial Calendar PWA)

A responsive, installable PWA for managing social-media editorial calendars for
multiple clients — one calendar per client — with per-calendar sharing so each
client only sees their own content.

It lives **inside this existing Vite + React app** as a self-contained module
under `src/calendar-app/`. The marketing landing page (`/`) is untouched.

---

## Routes

| Route | Who | Description |
|-------|-----|-------------|
| `/app/login` | Admin | Agency login. |
| `/app` | Admin | Dashboard — all clients/calendars, stats, create client, copy share links. |
| `/app/calendars/:calendarId` | Admin | Monthly calendar for one client: create/edit posts, change status, reschedule, filter, share. |
| `/c/:token` | Client | **Isolated, read-only** view of a single calendar via its share token. No login, no other clients, no internal notes. |
| `/` | Public | The original landing page (unchanged). |

### Access

This deployment is connected to **Supabase** (see `.env`), so sign in at
`/app/login` with the admin user created in the Supabase dashboard
(**Authentication → Users**). Data is shared across devices and isolation is
enforced server-side by RLS.

If the Supabase env vars are removed, the app automatically falls back to
**demo mode** (per-browser `localStorage`, seeded with example data), whose
credentials default to `admin@digitalclick.com` / `nexa2026` and are
configurable via `VITE_ADMIN_EMAIL` / `VITE_ADMIN_PASSWORD`.

---

## Data model

- **Client** — `name`, `color` (visual identity), `logoUrl`, `handle`, `active`.
- **Calendar** — one per client, with a unique `shareToken` (the client link).
- **Post** — `title`, `date`, `status`, `description` (caption), `contentType`
  (Feed/Story/Reels/Carrossel/…), `referenceLink`, `internalNotes` (admin-only),
  and `rescheduleHistory` (old date → new date).

### Status colors

| Status | Label | Color |
|--------|-------|-------|
| `todo` | A Fazer | cinza |
| `done` | Feito | azul |
| `published` | Publicado | verde |
| `rescheduled` | Reagendado | amarelo |
| `deleted` | Deletado | vermelho (soft delete, riscado) |

Deleting a post is a **soft delete** — it stays in storage marked `deleted`,
hidden from clients and hidden by default in the admin view (toggle
"Mostrar deletados"). It can be restored.

---

## Security & isolation (spec §6)

- The client route calls a **single** data method, `getPublicView(token)`, which:
  - returns **only** the calendar matching the token,
  - **strips** `internalNotes` from every post,
  - **hides** `deleted` posts,
  - never exposes any list of other clients/calendars.
- Regenerating a share token immediately invalidates the previous link.
- In production (Supabase), this is enforced server-side by Row Level Security:
  anonymous clients have **no** table access and can only call the
  `get_public_calendar(token)` function. See `supabase/schema.sql`.

Unit tests in `src/calendar-app/services/localStorageService.test.ts` cover the
isolation guarantees, reschedule history, and soft delete/restore.

---

## PWA

- `public/manifest.webmanifest`, `public/sw.js`, and SVG icons under
  `public/icons/`.
- The service worker is **conservative**: it is only registered on `/app` and
  `/c` routes (never on the landing page), handles those navigations
  network-first with an offline fallback, and uses stale-while-revalidate only
  for hashed build assets. This guarantees it can't interfere with the existing
  marketing site.
- `start_url` is `/app`, so "Add to home screen" installs the operator app.

---

## Deployment

The app is a static SPA (Vite build → `dist/`).

- **Base path:** `vite.config.ts` uses `base: "/"` so deep links (including the
  client share link `/c/:token`) resolve their assets when opened directly.
  This assumes deployment at the **domain root** (e.g. Hostinger `public_html`).
  For a sub-directory deploy, set `base` to that sub-path.
- **SPA fallback** (so deep links / refreshes serve `index.html`) is provided
  for the common hosts:
  - Apache / Hostinger → `public/.htaccess`
  - Netlify → `public/_redirects`
  - Vercel → `vercel.json`

Build:

```sh
bun install     # or npm install
bun run build   # outputs to dist/
bun run preview # serve the production build locally
```

---

## Going to production with Supabase

The Supabase adapter is already wired in (`src/calendar-app/services/supabaseService.ts`),
implemented with plain `fetch` against Supabase's REST/Auth APIs — **no extra npm
dependency**. It is selected automatically when the two env vars below are
present; otherwise the app falls back to the localStorage demo.

1. Create a Supabase project.
2. In the **SQL Editor**, paste and run `supabase/schema.sql` (tables + RLS +
   the public `get_public_calendar` function).
3. In **Authentication → Users**, add your agency admin (email + password).
4. Provide the env vars at build time — commit a `.env.production`, or set them
   in your host's build settings. The anon key is public by design (protected by
   RLS), so it is safe in the client bundle:
   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY
   ```
5. Rebuild / redeploy.

That's it — the same UI now runs on Postgres with real multi-device sharing and
server-enforced isolation. Log in at `/app/login` with the admin user from
step 3. (The demo credentials only apply to the localStorage fallback.)

---

## Light / dark theme

Both the admin area and the client share view have a sun/moon toggle. The
choice is saved per browser (`editorial-calendar:theme:v1`); until the user
picks one, the app follows the operating system.

Implementation notes:

- The palette is redefined on `body[data-theme="light"]`, not on `:root`, for
  two reasons: the marketing landing page must stay permanently dark, and
  dialogs/dropdowns/toasts render in portals attached to `<body>`, so they only
  inherit the variables if the variables live there.
- The landing page's global rules force light text and `color-scheme: dark` on
  every field. Light mode overrides those, or inputs would render white on
  white. Measured contrast is ~16:1 (light) and ~18:1 (dark).
- Component surfaces use `foreground/<alpha>` rather than `white/<alpha>` so a
  tint flips automatically with the theme.

## Drag to reschedule

On the admin calendar, posts can be dragged between days. The card moves
immediately (optimistic update) and the write happens in the background; if it
fails, the card snaps back and an error is shown. Each move appends to the
post's reschedule history, and a toast offers **Desfazer**.

- Built on Pointer Events, so one implementation covers mouse and touch with
  no drag-and-drop dependency (`hooks/useDragToReschedule.ts`).
- Mouse: a drag begins after ~5px of movement, so a plain click still opens the
  post. Touch: a drag needs a ~260ms hold, so swiping still scrolls the page.
- Dragging keeps the post's status — moving a published post does not silently
  mark it "Reagendado". Change the status in the post dialog when you want that.
- Deleted posts and the read-only client view are not draggable.

## Client approval and relationship health (benchmark specs 03 and 01)

**Approval (Spec 03).** A post can be sent to the client, which opens a
numbered round. The client approves, requests changes or rejects; a comment is
mandatory for the last two. The review state is *derived* from the decisions in
force, never stored, so it cannot drift. Earlier rounds stay as history.

Decisions taken through the public link always require a verification code: six
digits, ten-minute expiry, single use, replaced when re-issued, hashed at rest.
The client's address is only ever shown masked. Every public entry point
resolves the post through the share token and refuses one belonging to another
calendar.

**Delivering the code.** Postgres cannot send e-mail, and the anonymous
`issue_approval_code` discards the plaintext on purpose — so on its own it
never closes the loop. Migration `004_entrega_codigo.sql` splits the function
in two: the anonymous one still returns only the masked address, while
`issue_approval_code_delivery` returns the code and is granted to
`service_role` alone. The Edge Function `send-approval-code` is the only
caller: it runs with a key the browser does not have, and mails the code
through Resend. See `supabase/functions/README.md` to deploy it.

Because the share link can now trigger mail to the client, the database
enforces a 60-second minimum between requests — a limit no caller can route
around.

> **Still needs one manual step:** the Edge Function has to be deployed and
> `RESEND_API_KEY` / `APPROVAL_FROM_EMAIL` set. Until then the app falls back
> to generating the code without delivering it, and the client screen says so
> plainly instead of leaving them waiting for an e-mail that is not coming.

**Clients (Spec 01).** Clients now have a lifecycle (ativo, pausado, encerrado,
arquivado) with the transitions the spec allows, a free-text segment, and
pinning. `active` remains as a derived mirror so older records keep working.

The relationship index scores 0–100 as `max(0, 100 + Σ signal weights)` and
always shows its breakdown, because a number nobody can explain is not
actionable. Active signals: overdue posts (−5 each, max −30), reviews rejected
in the last 30 days (−10 each, max −20), and no client interaction for 21 days
(−15). The spec's "overdue receivable" signal is deliberately absent — there is
no financial module, so it could never fire and listing it would mislead.

## Stage automations (benchmark spec 02)

Each calendar can carry rules of the shape **"when X happens → do Y"**. They are
stored as data (`automation_rule`), not code, so a new rule never means a
deploy. Triggers: a post entering a stage, or the client deciding a review.
Actions: move to a stage, send for client approval, reschedule in N days.

Three presets cover what an agency almost always wants, creatable in one click:
Feito → send for approval; approved → Publicado; changes requested → A Fazer.

Only the triggers and actions the system can really honour are offered. Spec 02
also lists assigning people, labels and checklists; none of those exist here, and
offering them would promise behaviour that never fires.

**Loops.** An action can raise a new event, so two rules pointing at each other
would run forever. A chain stops at depth 5 and no rule runs twice in the same
chain; both limits are recorded in the log as `skipped`, with the reason.

**Failures never roll back the user's own action.** Dragging a card succeeds
even if the automation it triggers fails; the failure is recorded in the log
with its message, which is also what the panel shows.

**Client decisions are applied late, on purpose.** The share link is allowed to
do nothing but record a decision — it has no rights over the calendar — so
"approved → Publicado" cannot run at the moment the client clicks. The agency's
app applies it the next time it loads that calendar. Acting twice is prevented
by the execution log: each run carries the decision's `eventKey`, and
`automation_run` has a unique index on (rule, post, event key).

The log (`automation_run`) is insert-only for the admin and invisible to clients;
deleting a rule keeps its history. Apply
`supabase/migrations/003_automacoes.sql` before using this against Supabase.

## Configurable board columns (benchmark spec 02)

A calendar can replace the four standard stages with its own flow — Roteiro,
Gravação, Edição, Aprovação — up to twelve columns, each with its own name,
colour and position.

**A column is not a new status.** It is a name and a position for one of the
four statuses the system already understands, declared as the column's
category. `post.status` stays the invariant: the client's share view, the
approval automations and the relationship index keep reading it and never
learn that custom columns exist. Dropping a card on "Gravação" writes
`status: "done"` — so "ao entrar em Feito → enviar para aprovação" fires from
a column the rule has never heard of.

That is also what makes the feature safe to add: a calendar with no columns of
its own renders exactly as before, so the blast radius is limited to calendars
that opt in.

A card keeps its column only while that column still exists and still stands
for the card's status. Otherwise the status wins and the card lands in the
first column of its own category — which is what keeps a deleted column, or a
status changed from the edit form, from stranding cards nowhere. Deleting the
last column of a status is refused for the same reason, and "voltar ao padrão"
leaves every card where it is.

Dragging auto-scrolls the board when the card is held near an edge: with up to
twelve columns the target is often off-screen, and a column you cannot see is
a column you cannot drop on.

## The card's production workspace (benchmark spec 02)

Each card carries a checklist, internal comments, attachments and logged time.
They save the moment you act, not when the modal's Save button is pressed: a
ticked box and a written comment are facts, and losing them to a Cancel click
would be the wrong kind of surprise.

All four are **internal**, like `internalNotes`. `PublicPost` omits them, the
local adapter strips them by destructuring (so a new internal field surfaces
as a compile error rather than a leak), and `get_public_calendar` builds its
payload field by field and never includes them. The security script checks all
four by name.

**Attachments are links, not uploaded bytes.** Storing the file itself needs a
Supabase Storage bucket with its own policies; that is a separate step and is
not built. Every attachment URL goes through the same allow-list the
client-facing link uses, so a `javascript:` attachment cannot become a click.

**Time is read the way a person writes it** — `90`, `1h30`, `1:30`, `45min`,
`1,5h` — and refuses more than 24 hours on one card, which is always a typo.

**One editor at a time.** Each list is saved whole, so two people editing the
same card's checklist in the same second would have one overwrite the other.
With a single admin account that cannot happen; it is worth revisiting if
F00 ever brings real multi-user.

## Agenda and public booking (benchmark spec 04)

The agenda at `/app/agenda` is a **projection**: it owns appointments and
bookings and nothing else. A post's publication date and a review waiting on
the client are read from the modules that own them, every time. The spec's
acceptance test is that a rebuilt projection equals the incremental one; the
cheapest way to pass that forever is to keep no incremental copy, which is
what `buildAgenda` does.

Month, week, day and list all read the same projection over a different range.
The per-type counters double as filters, and an item is *late* when its day has
passed and its source is not done — a marked date is never late.

**Marked dates** are computed, not stored: movable feasts come from Easter, so
no year runs out of holidays. Scope is national plus Distrito Federal, as
decided (D5), with the commercial dates an agency actually plans around
(Dia das Mães, Black Friday) beside them. Dates a brand should think twice
about carry a *sensível* badge. Only what the agency keeps shows on the agenda.

**Booking.** The visitor sees when the agency is free and nothing else: busy
blocks arrive with no name, no e-mail, no title. A paused page answers exactly
like one that never existed. The buffer between bookings applies on both sides
of a busy block, and the minimum notice is enforced twice — in the offered
slots and again on the server when the booking is taken.

Two visitors taking the same slot is settled in the database, not in the app:
`booking` carries an exclusion constraint over its time range, so the second
insert loses no matter how close the two requests are. Verified against a real
PostgreSQL, along with the refusals for overlaps, bad e-mail, a paused page,
and anonymous reads of the tables.

External calendar sync (`conexao_calendario` in the spec) is deliberately
absent: the owner decided against it (D7), and the table alone would promise a
sync that never happens.

## Catalogue, proposals and contracts (benchmark specs 06 and 07)

`/app/comercial` holds three tabs, because for a small agency these are three
views of one conversation with one client.

**Money is integer cents everywhere** (`money.ts`), as spec 08 requires. No
figure in a proposal, a contract or the finance module is ever a float, and
instalments always add back up to the total — the remainder goes on the last
one.

**Recurring and one-off stay apart** all the way to the client's screen. An
annual item of R$ 1.200 shows as R$ 100 a month, per the spec's own example;
blending the two into a single number is how a deal ends up disputed.

**A number is handed out on the first send**, never on a draft: a number given
to something abandoned leaves a hole to explain. **An accepted proposal is
immutable** — in the editor, in the adapter, and by a database trigger, so it
cannot be talked around. Accepting a lapsed proposal is refused at the link,
because the price on screen may no longer be the price.

**Contracts** freeze their text and its SHA-256 at generation. Every signature
records the hash of what it signed, and a contract whose signatures disagree
with its text can never take effect. After the first signature the text is
frozen three times over (UI, adapter, database trigger) and a signed contract
is never deleted — only cancelled. Each party gets its own signing link, so a
signatory never sees anyone else's.

The owner chose a **simple** electronic signature with evidence (typed name
and document, timestamp, browser) and mandatory witnesses. Legal review of
that choice is still outstanding — the code models the decision; it does not
pronounce on whether it suffices in court.

## Finance (benchmark spec 08)

`/app/financeiro`. Two decisions shape the whole module.

**Cents, always.** Every amount is an integer, as the spec requires. A cent
lost to floating point does not announce itself — it shows up months later as
a reconciliation that will not close.

**A recurring series does not materialise the future.** Charges are projected
by query and become real rows only when they come inside the 35-day window or
when someone acts on that month. Twelve months of projection write nothing to
the database — the spec's own acceptance test. The month's list mixes real
rows with projections and marks which is which, because a forecast you cannot
tell from a fact is how a cash position quietly becomes fiction. Paying a
projection creates and settles the row in one gesture.

**What is settled is history.** A settled entry never changes value or nature
and is never deleted; correcting one means reversing it with a mirror entry,
and the original stays. Undoing a settlement is allowed and simply puts the
balance back. All three rules are database triggers as well as app checks.

Transfers are their own table rather than two entries, because they move value
between accounts and must stay out of the result — by competence and by cash
alike.

Balances count only settled entries: a bill that exists is not money that
left. The statement rebuilt from the movements agrees with the computed
balance, which is the spec's reconstruction test and is covered in the tests.

## Verifying the security model

`supabase/verificacao-seguranca.sql` re-checks, against a live database, every
isolation property this app claims: who may execute each function, that the
plaintext code never reaches an anonymous caller, that one share token cannot
touch another calendar's post, that RLS returns nothing from the tables, that
internal notes stay out of the public view, and that the automation log cannot
be rewritten. It runs inside a transaction that ends in `ROLLBACK`, so it is
safe to run on production.

It was last run against PostgreSQL 16 with all four migrations applied, and
every check passed. One finding came out of that run and is fixed in migration
004: `request_approval` and `peek_approval_code_expiry` had kept Postgres's
default `EXECUTE` grant to `PUBLIC`. Neither was exploitable — they are not
`SECURITY DEFINER`, so RLS already emptied them for an anonymous caller — but
the grant is gone now, because it would become a real hole the day someone
marks one of them `SECURITY DEFINER`.

## Keeping the Supabase project awake (free plan)

Supabase's **free plan pauses a project after ~7 days of inactivity**. While
paused the API is offline, so admin login fails and client share links stop
working until someone resumes the project in the dashboard (Supabase →
project → **Resume project**; the pt-BR UI mistranslates this button as
"Projeto de currículo"). Resuming keeps the same URL, keys and data, so no
redeploy is needed.

To avoid it recurring, `.github/workflows/keep-supabase-awake.yml` pings the
database once a day (it calls `get_public_calendar`, which runs a real query).
Caveats:

- It is a widely used but **unofficial** workaround — not guaranteed by Supabase.
- GitHub disables scheduled workflows after 60 days with no repository
  activity (it emails the owner; re-enable from the Actions tab).
- For business-critical use, the **Pro plan never pauses** and is the only
  guaranteed fix.

## Architecture

```
src/calendar-app/
├─ types.ts                # domain model
├─ status.ts               # status labels + colors
├─ utils.ts                # dates, ids, tokens, formatting
├─ services/
│  ├─ DataService.ts       # storage-agnostic contract
│  ├─ localStorageService.ts (+ .test.ts)  # demo adapter (default)
│  ├─ supabaseService.ts    # production adapter (fetch-based, no deps)
│  ├─ seed.ts              # demo data
│  └─ index.ts             # adapter selector
├─ store/AppProvider.tsx   # React state, auth session, CRUD actions
├─ components/             # MonthGrid, PostModal, PostView, Sidebar, ...
└─ pages/                  # Login, Dashboard, Calendar, ClientView
```

---

## Roadmap (spec §7 — not in v1)

- Client comments / approve-reject on a post.
- Push notifications (via PWA) on status change.
- Export the month to PDF/image.
- Multiple admin users.

The data model and adapter boundary already leave room for these.
