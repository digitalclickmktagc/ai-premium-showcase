-- ============================================================================
--  Migração 006 — Colunas configuráveis do quadro
--  Aplicar DEPOIS de schema.sql e das migrações 001, 003, 004 e 005.
--
--  A ideia que torna isto seguro: uma coluna não é um status novo, é um nome
--  e uma posição para um status que o sistema já entende. `posts.status`
--  continua sendo a verdade — a visão do cliente, as automações de aprovação
--  e o índice de relacionamento seguem lendo só ele e nunca ficam sabendo que
--  colunas personalizadas existem.
--
--  Um calendário sem nenhuma coluna aqui se comporta exatamente como antes.
-- ============================================================================

-- 1. Colunas -----------------------------------------------------------------
create table if not exists public.board_stage (
  id          uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  name        text not null check (length(btrim(name)) between 1 and 40),
  color       text not null default '#94a3b8',
  -- O status pelo qual a coluna responde. 'deleted' fica de fora: lixeira não
  -- é etapa de produção.
  category    text not null check (category in ('todo','done','published','rescheduled')),
  -- `order` é palavra reservada; a coluna se chama `position`.
  position    int  not null default 0,
  created_at  timestamptz not null default now(),
  -- Dois nomes iguais no mesmo quadro só confundem quem arrasta o card.
  constraint board_stage_nome_unico unique (calendar_id, name)
);
create index if not exists board_stage_calendar_idx
  on public.board_stage(calendar_id, position);

-- 2. Em que coluna o card está ----------------------------------------------
--    ON DELETE SET NULL de propósito: apagar uma coluna não pode apagar nem
--    prender card nenhum. Quem perde a coluna volta para a primeira coluna do
--    seu próprio status, regra que vive em src/calendar-app/stages.ts.
alter table public.posts
  add column if not exists stage_id uuid references public.board_stage(id) on delete set null;
create index if not exists posts_stage_idx on public.posts(stage_id);

-- 3. RLS ---------------------------------------------------------------------
--    Interno da agência: o cliente não vê como o quadro é organizado, e
--    `get_public_calendar` não devolve `stage_id`.
alter table public.board_stage enable row level security;

drop policy if exists "admin_all_board_stage" on public.board_stage;
create policy "admin_all_board_stage" on public.board_stage
  for all to authenticated using (true) with check (true);
-- Sem policy para anon.

-- 4. Conferência -------------------------------------------------------------
--  select public.get_public_calendar('<token>')::text ~ 'stageId' as vaza;  -- f
--  select tablename, policyname, roles, cmd from pg_policies
--   where tablename = 'board_stage';                                        -- ALL/{authenticated}
