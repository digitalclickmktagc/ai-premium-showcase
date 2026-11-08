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
