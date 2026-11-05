-- ============================================================================
--  Migração 003 — Automações de etapa
--  Aplicar DEPOIS de supabase/schema.sql e de 001_aprovacao_externa.sql.
--
--  Modelo de segurança:
--    • Regras e histórico são INTERNOS da agência. Nenhuma policy para `anon`:
--      quem tem o link de compartilhamento não lê nem escreve nestas tabelas,
--      e `get_public_calendar()` não devolve nada daqui.
--    • O histórico é somente-inserção para o admin: nada de update/delete, para
--      que o registro do que aconteceu com um post real não possa ser reescrito.
--    • Apagar uma regra não apaga o histórico dela (on delete set null) — o que
--      já aconteceu continua auditável.
-- ============================================================================

-- 1. Regras ------------------------------------------------------------------
create table if not exists public.automation_rule (
  id          uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  -- Gatilho e ação ficam como jsonb: uma regra nova nunca exige migração.
  -- O formato é o de src/calendar-app/automation.ts:
  --   trigger: {"type":"entered_stage","stage":"done"}
  --          | {"type":"review_decided","result":"approved"}
  --   action:  {"type":"move_to_stage","stage":"published"}
  --          | {"type":"send_for_review"} | {"type":"set_due_in_days","days":3}
  trigger     jsonb not null,
  action      jsonb not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  -- Barreira mínima no banco: o resto da validação vive na aplicação, mas
  -- um registro sem `type` nunca deveria entrar.
  constraint automation_rule_trigger_shape check (trigger ? 'type'),
  constraint automation_rule_action_shape  check (action  ? 'type')
);
create index if not exists automation_rule_calendar_idx
  on public.automation_rule(calendar_id, created_at);

-- 2. Histórico de execução ---------------------------------------------------
create table if not exists public.automation_run (
  id         uuid primary key default gen_random_uuid(),
  rule_id    uuid references public.automation_rule(id) on delete set null,
  post_id    uuid not null references public.posts(id) on delete cascade,
  at         timestamptz not null default now(),
  result     text not null check (result in ('applied', 'skipped', 'failed')),
  detail     text,
  -- Identifica o evento que causou a execução. A decisão do cliente é tomada
  -- no navegador dele, onde nada pode mexer no calendário; o app do admin
  -- aplica a regra depois, e esta chave é o que impede aplicar duas vezes.
  event_key  text
);
create index if not exists automation_run_post_idx on public.automation_run(post_id, at desc);
-- Uma mesma regra só pode ter uma execução por evento. É esta restrição que
-- garante a ideia acima no banco, e não apenas na aplicação.
create unique index if not exists automation_run_event_once
  on public.automation_run(rule_id, post_id, event_key)
  where event_key is not null;

-- 3. RLS ---------------------------------------------------------------------
alter table public.automation_rule enable row level security;
alter table public.automation_run  enable row level security;

drop policy if exists "admin_all_automation_rule" on public.automation_rule;
create policy "admin_all_automation_rule" on public.automation_rule
  for all to authenticated using (true) with check (true);

-- Somente-inserção: o admin grava e lê o histórico, mas não o reescreve.
drop policy if exists "admin_insert_automation_run" on public.automation_run;
create policy "admin_insert_automation_run" on public.automation_run
  for insert to authenticated with check (true);

drop policy if exists "admin_read_automation_run" on public.automation_run;
create policy "admin_read_automation_run" on public.automation_run
  for select to authenticated using (true);

-- Sem policy de update/delete em automation_run, e sem policy nenhuma para
-- `anon` nas duas tabelas. Confira depois de aplicar:
--   select tablename, policyname, roles, cmd from pg_policies
--    where tablename in ('automation_rule', 'automation_run');
-- O esperado é: automation_rule → ALL/{authenticated};
--               automation_run  → INSERT e SELECT, ambos /{authenticated}.
