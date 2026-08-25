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

### Demo access

The app ships in **demo mode** (data stored in the browser via `localStorage`)
and is seeded with example clients and posts on first load.

- **E-mail:** `admin@digitalclick.com`
- **Senha:** `nexa2026`

(Configurable via `VITE_ADMIN_EMAIL` / `VITE_ADMIN_PASSWORD`.)

> In demo mode data is per-browser. A client share link opens the seeded data in
> the **same** browser only. For real cross-device sharing, connect Supabase
> (below).

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

The demo `localStorage` layer implements the same `DataService` interface as a
real backend, so switching is a drop-in.

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor (tables + RLS + the public
   `get_public_calendar` function).
3. In **Auth**, create your agency admin user (email/password).
4. Install the client and rename the adapter template:
   ```sh
   bun add @supabase/supabase-js
   mv src/calendar-app/services/supabaseService.ts.example \
      src/calendar-app/services/supabaseService.ts
   ```
5. Uncomment the Supabase branch in `src/calendar-app/services/index.ts`.
6. Set env vars (see `.env.example`):
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```

That's it — the same UI now runs on Postgres with real multi-device sharing and
server-enforced isolation.

---

## Architecture

```
src/calendar-app/
├─ types.ts                # domain model
├─ status.ts               # status labels + colors
├─ utils.ts                # dates, ids, tokens, formatting
├─ services/
│  ├─ DataService.ts       # storage-agnostic contract
│  ├─ localStorageService.ts (+ .test.ts)  # demo adapter (default)
│  ├─ supabaseService.ts.example           # production adapter template
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
