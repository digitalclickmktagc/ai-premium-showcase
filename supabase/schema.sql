-- ============================================================================
--  Editorial Calendar — Supabase / PostgreSQL schema
--  Run this in the Supabase SQL editor (or `supabase db push`) to move the app
--  from the localStorage demo to a real multi-device backend with server-side
--  isolation.
--
--  Security model (mirrors spec §6):
--    • Authenticated users (the agency) have full access to every row.
--    • Anonymous clients have NO direct table access. They read a single
--      calendar only through get_public_calendar(token), which strips
--      internal_notes and hides deleted posts.
-- ============================================================================

-- Extensions ----------------------------------------------------------------
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- Tables --------------------------------------------------------------------
create table if not exists public.clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  color       text not null default '#8b5cf6',
  logo_url    text,
  handle      text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.calendars (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  name         text not null,
  share_token  text not null unique,
  created_at   timestamptz not null default now()
);
create index if not exists calendars_client_id_idx on public.calendars(client_id);
create index if not exists calendars_share_token_idx on public.calendars(share_token);

create table if not exists public.posts (
  id                 uuid primary key default gen_random_uuid(),
  calendar_id        uuid not null references public.calendars(id) on delete cascade,
  title              text not null,
  date               date not null,
  status             text not null default 'todo'
                       check (status in ('todo','done','published','rescheduled','deleted')),
  description        text not null default '',
  content_type       text,
  reference_link     text,
  internal_notes     text,
  reschedule_history jsonb not null default '[]'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists posts_calendar_id_idx on public.posts(calendar_id);
create index if not exists posts_date_idx on public.posts(date);

-- keep updated_at fresh ------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists posts_touch_updated_at on public.posts;
create trigger posts_touch_updated_at
  before update on public.posts
  for each row execute function public.touch_updated_at();

-- Row Level Security --------------------------------------------------------
alter table public.clients   enable row level security;
alter table public.calendars enable row level security;
alter table public.posts     enable row level security;

-- Authenticated agency users get full access. (For a single-operator agency
-- this is enough; for multiple admins, gate on an `admins` table instead.)
drop policy if exists "admin_all_clients" on public.clients;
create policy "admin_all_clients" on public.clients
  for all to authenticated using (true) with check (true);

drop policy if exists "admin_all_calendars" on public.calendars;
create policy "admin_all_calendars" on public.calendars
  for all to authenticated using (true) with check (true);

drop policy if exists "admin_all_posts" on public.posts;
create policy "admin_all_posts" on public.posts
  for all to authenticated using (true) with check (true);

-- NOTE: no policies are granted to the `anon` role, so anonymous clients can
-- never select these tables directly. They use the function below instead.

-- Public share endpoint -----------------------------------------------------
-- SECURITY DEFINER so it can read the tables, but it only ever returns a
-- single calendar's sanitized data for a matching token.
create or replace function public.get_public_calendar(p_token text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select case when cal.id is null then null else jsonb_build_object(
    'calendar', jsonb_build_object('id', cal.id, 'name', cal.name, 'shareToken', cal.share_token),
    'client', jsonb_build_object(
      'id', c.id, 'name', c.name, 'color', c.color,
      'logoUrl', c.logo_url, 'handle', c.handle
    ),
    'posts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'calendarId', p.calendar_id,
        'title', p.title,
        'date', to_char(p.date, 'YYYY-MM-DD'),
        'status', p.status,
        'description', p.description,
        'contentType', p.content_type,
        'referenceLink', p.reference_link,
        'rescheduleHistory', p.reschedule_history,
        'createdAt', p.created_at,
        'updatedAt', p.updated_at
        -- internal_notes deliberately omitted
      ) order by p.date)
      from public.posts p
      where p.calendar_id = cal.id and p.status <> 'deleted'
    ), '[]'::jsonb)
  ) end
  from public.calendars cal
  join public.clients c on c.id = cal.client_id
  where cal.share_token = p_token;
$$;

revoke all on function public.get_public_calendar(text) from public;
grant execute on function public.get_public_calendar(text) to anon, authenticated;
