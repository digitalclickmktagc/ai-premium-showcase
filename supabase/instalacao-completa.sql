-- ============================================================================
--  INSTALAÇÃO COMPLETA — Calendário Editorial / Orkestrya
--
--  Este arquivo é a concatenação, NA ORDEM CERTA, de:
--      supabase/schema.sql
--      supabase/migrations/001 … 019
--
--  COMO USAR
--    1. Supabase → SQL Editor → New query.
--    2. Cole este arquivo inteiro e rode uma vez.
--    3. Confira que terminou em "Success". Se parar no meio, o erro mostra
--       em qual trecho parou: corrija e rode de novo — nada aqui apaga dado.
--
--  É SEGURO RODAR MAIS DE UMA VEZ. Tudo usa `if not exists`,
--  `create or replace` e `drop policy if exists` antes de criar. Rodar duas
--  vezes não duplica tabela, não apaga linha e não reseta permissão.
--
--  DEPOIS DE RODAR, rode também `supabase/verificacao-seguranca.sql`: ele
--  confere o isolamento inteiro e termina em ROLLBACK, sem gravar nada.
--
--  Gerado por script a partir dos arquivos individuais; se divergir deles, os
--  individuais mandam.
-- ============================================================================



-- ####################################################################
-- #  supabase/schema.sql
-- ####################################################################

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


-- ####################################################################
-- #  supabase/migrations/001_aprovacao_externa.sql
-- ####################################################################

-- ============================================================================
--  Migração 001 — Revisão externa (aprovação pelo cliente)
--  Aplicar DEPOIS de supabase/schema.sql.
--
--  Modelo de segurança:
--    • O cliente é anônimo. Ele nunca toca tabela: age só por estas funções.
--    • Toda função pública exige o token e confere que o post pertence ao
--      calendário daquele token — é o que impede um cliente de decidir sobre
--      o post de outro.
--    • O código de verificação é gravado com hash (bcrypt), expira e é de
--      uso único.
--    • `internal_notes` continua fora de qualquer retorno público.
-- ============================================================================

-- 1. Campos novos ------------------------------------------------------------
alter table public.clients add column if not exists email text;
alter table public.posts   add column if not exists approval jsonb;

-- 2. Códigos de verificação --------------------------------------------------
create table if not exists public.approval_code (
  post_id     uuid primary key references public.posts(id) on delete cascade,
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  code_hash   text not null,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);
alter table public.approval_code enable row level security;
-- Sem policy para anon: só as funções SECURITY DEFINER abaixo tocam nela.
drop policy if exists "admin_all_approval_code" on public.approval_code;
create policy "admin_all_approval_code" on public.approval_code
  for all to authenticated using (true) with check (true);

-- 3. Mascarar e-mail ---------------------------------------------------------
create or replace function public.mask_email(p_email text)
returns text language sql immutable as $$
  select case
    when p_email is null or position('@' in p_email) < 2 then null
    else left(split_part(p_email, '@', 1), 2)
         || repeat('*', greatest(length(split_part(p_email, '@', 1)) - 2, 1))
         || '@' || split_part(p_email, '@', 2)
  end;
$$;

-- 4. Admin: abrir uma nova rodada de revisão ---------------------------------
create or replace function public.request_approval(
  p_post_id uuid,
  p_team_message text default null
)
returns setof public.posts
language plpgsql security invoker -- respeita o RLS do admin autenticado
set search_path = public
as $$
declare
  v_round int;
begin
  select coalesce((approval->>'round')::int, 0) + 1 into v_round
  from public.posts where id = p_post_id;
  if v_round is null then
    raise exception 'Post não encontrado.';
  end if;

  return query
  update public.posts
     set approval = jsonb_build_object(
           'round', v_round,
           'requestedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
           'teamMessage', p_team_message,
           'decisions', coalesce(approval->'decisions', '[]'::jsonb)
         )
   where id = p_post_id and status <> 'deleted'
  returning *;
end;
$$;

-- 5. Público: emitir código --------------------------------------------------
create or replace function public.issue_approval_code(p_token text, p_post_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_cal  public.calendars%rowtype;
  v_post public.posts%rowtype;
  v_mail text;
  v_code text;
begin
  select * into v_cal from public.calendars where share_token = p_token;
  if not found then raise exception 'Link inválido ou expirado.'; end if;

  -- o post TEM que pertencer ao calendário do token
  select * into v_post from public.posts
   where id = p_post_id and calendar_id = v_cal.id and status <> 'deleted';
  if not found then raise exception 'Post não encontrado neste calendário.'; end if;

  if coalesce((v_post.approval->>'round')::int, 0) < 1 then
    raise exception 'Este post ainda não foi enviado para aprovação.';
  end if;

  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');

  insert into public.approval_code (post_id, calendar_id, code_hash, expires_at)
  values (p_post_id, v_cal.id, crypt(v_code, gen_salt('bf')), now() + interval '10 minutes')
  on conflict (post_id) do update
    set code_hash = excluded.code_hash,
        expires_at = excluded.expires_at,
        created_at = now();

  select public.mask_email(c.email) into v_mail
    from public.clients c where c.id = v_cal.client_id;

  -- Devolve só o destino mascarado. O código em claro NUNCA sai daqui:
  -- a entrega é feita fora de banda (ver nota no fim do arquivo).
  return jsonb_build_object('masked_email', v_mail);
end;
$$;

-- 6. Público: registrar a decisão -------------------------------------------
create or replace function public.submit_approval_decision(
  p_token      text,
  p_post_id    uuid,
  p_result     text,
  p_decided_by text,
  p_comment    text default null,
  p_code       text default null
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_cal  public.calendars%rowtype;
  v_post public.posts%rowtype;
  v_row  public.approval_code%rowtype;
  v_round int;
begin
  if p_result not in ('approved','changes','rejected') then
    raise exception 'Resultado inválido.';
  end if;
  if coalesce(btrim(p_decided_by), '') = '' then
    raise exception 'Informe seu nome para registrar a decisão.';
  end if;
  if p_result in ('changes','rejected') and coalesce(btrim(p_comment), '') = '' then
    raise exception 'Comentário obrigatório para ajuste ou reprovação.';
  end if;
  if length(coalesce(p_comment, '')) > 2000 then
    raise exception 'Comentário longo demais.';
  end if;

  select * into v_cal from public.calendars where share_token = p_token;
  if not found then raise exception 'Link inválido ou expirado.'; end if;

  select * into v_post from public.posts
   where id = p_post_id and calendar_id = v_cal.id and status <> 'deleted';
  if not found then raise exception 'Post não encontrado neste calendário.'; end if;

  v_round := coalesce((v_post.approval->>'round')::int, 0);
  if v_round < 1 then
    raise exception 'Este post ainda não foi enviado para aprovação.';
  end if;

  -- verificação obrigatória para decisão via link (decisão A2)
  select * into v_row from public.approval_code
   where post_id = p_post_id and calendar_id = v_cal.id;
  if not found then raise exception 'Solicite um código de verificação primeiro.'; end if;
  if v_row.expires_at <= now() then
    delete from public.approval_code where post_id = p_post_id;
    raise exception 'O código expirou. Solicite um novo.';
  end if;
  if p_code is null or v_row.code_hash <> crypt(p_code, v_row.code_hash) then
    raise exception 'Código incorreto.';
  end if;

  update public.posts
     set approval = jsonb_set(
           approval,
           '{decisions}',
           coalesce(approval->'decisions', '[]'::jsonb) || jsonb_build_array(
             jsonb_build_object(
               'id', gen_random_uuid(),
               'round', v_round,
               'result', p_result,
               'comment', nullif(btrim(coalesce(p_comment,'')), ''),
               'decidedByName', btrim(p_decided_by),
               'verified', true,
               'at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
             )
           )
         )
   where id = p_post_id;

  -- uso único
  delete from public.approval_code where post_id = p_post_id;
end;
$$;

-- 7. Paliativo até existir envio de e-mail -----------------------------------
-- Só a agência autenticada pode ler. Permite relatar o código ao cliente por
-- outro canal enquanto não há provedor de e-mail configurado.
create or replace function public.peek_approval_code_expiry(p_post_id uuid)
returns timestamptz
language sql security invoker
set search_path = public
as $$ select expires_at from public.approval_code where post_id = p_post_id; $$;

-- 8. Permissões --------------------------------------------------------------
revoke all on function public.issue_approval_code(text, uuid) from public;
revoke all on function public.submit_approval_decision(text, uuid, text, text, text, text) from public;
grant execute on function public.issue_approval_code(text, uuid) to anon, authenticated;
grant execute on function public.submit_approval_decision(text, uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.request_approval(uuid, text) to authenticated;
grant execute on function public.peek_approval_code_expiry(uuid) to authenticated;

-- 9. Expor a aprovação (sem notas internas) na visão pública -----------------
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
      'logoUrl', c.logo_url, 'handle', c.handle,
      'maskedEmail', public.mask_email(c.email)
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
        'approval', p.approval,
        'createdAt', p.created_at,
        'updatedAt', p.updated_at
        -- internal_notes segue deliberadamente de fora
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

-- ============================================================================
--  NOTA — entrega do código em produção
--  O Postgres não envia e-mail. `issue_approval_code` grava o hash e devolve
--  só o destino mascarado. Para fechar o fluxo em produção é preciso UMA das
--  opções abaixo:
--    (a) Edge Function do Supabase que gere o código, grave o hash aqui e
--        envie por um provedor (Resend, SendGrid, Postmark); ou
--    (b) SMTP próprio configurado no Supabase.
--  Enquanto nenhuma existir, o fluxo completo roda no ambiente de testes
--  (adapter local, que mostra o código na tela).
-- ============================================================================

-- ============================================================================
--  Migração 002 — Clientes: situação, segmento, fixar, índice de saúde
--  (Spec 01. Anexada aqui para ser aplicada na mesma execução.)
-- ============================================================================
alter table public.clients add column if not exists status text not null default 'active'
  check (status in ('active','paused','ended','archived'));
alter table public.clients add column if not exists segment text;
alter table public.clients add column if not exists pinned boolean not null default false;
alter table public.clients add column if not exists served_since date;

-- Registros antigos guardavam só o booleano: deriva a situação a partir dele.
update public.clients set status = case when active then 'active' else 'paused' end
 where status is null;

-- Mantém o espelho `active` coerente com `status`, para telas antigas.
create or replace function public.sync_client_active()
returns trigger language plpgsql as $$
begin
  new.active := (new.status = 'active');
  return new;
end;
$$;
drop trigger if exists clients_sync_active on public.clients;
create trigger clients_sync_active
  before insert or update of status on public.clients
  for each row execute function public.sync_client_active();

create index if not exists clients_status_idx on public.clients(status);


-- ####################################################################
-- #  supabase/migrations/003_automacoes.sql
-- ####################################################################

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


-- ####################################################################
-- #  supabase/migrations/004_entrega_codigo.sql
-- ####################################################################

-- ============================================================================
--  Migração 004 — Entrega do código de verificação por e-mail
--  Aplicar DEPOIS de 001_aprovacao_externa.sql.
--
--  O problema que esta migração resolve:
--    `issue_approval_code` grava o hash do código e devolve só o destino
--    mascarado — o código em claro nunca sai do banco. É a decisão certa para
--    uma função que o anônimo pode chamar, mas significa que, sozinha, ela
--    nunca fecha o fluxo: ninguém jamais fica sabendo o código.
--
--  O desenho:
--    • `approval_code_issue` (privada) gera, grava e DEVOLVE o código.
--    • `issue_approval_code` (anônima) usa a privada e descarta o código.
--    • `issue_approval_code_delivery` (service_role) usa a privada e devolve
--      código + e-mail real, para a Edge Function enviar. Nenhum papel do
--      navegador recebe execute nela.
--
--  Proteção contra abuso: quem tem o link de compartilhamento passa a ser
--  capaz de disparar e-mail para o cliente. Sem limite, isso é uma arma. Há
--  um intervalo mínimo entre pedidos (60 s) aplicado no banco, onde nenhuma
--  chamada consegue contornar.
-- ============================================================================

-- 1. Intervalo mínimo entre pedidos -----------------------------------------
create or replace function public.approval_code_cooldown_seconds()
returns int language sql immutable as $$ select 60 $$;

-- 2. Núcleo privado — gera, grava e devolve o código -------------------------
create or replace function public.approval_code_issue(p_token text, p_post_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_cal     public.calendars%rowtype;
  v_post    public.posts%rowtype;
  v_client  public.clients%rowtype;
  v_code    text;
  v_age     int;
begin
  select * into v_cal from public.calendars where share_token = p_token;
  if not found then raise exception 'Link inválido ou expirado.'; end if;

  -- o post TEM que pertencer ao calendário do token
  select * into v_post from public.posts
   where id = p_post_id and calendar_id = v_cal.id and status <> 'deleted';
  if not found then raise exception 'Post não encontrado neste calendário.'; end if;

  if coalesce((v_post.approval->>'round')::int, 0) < 1 then
    raise exception 'Este post ainda não foi enviado para aprovação.';
  end if;

  -- Intervalo mínimo: impede usar o link para inundar a caixa do cliente.
  select extract(epoch from (now() - created_at))::int into v_age
    from public.approval_code where post_id = p_post_id;
  if v_age is not null and v_age < public.approval_code_cooldown_seconds() then
    raise exception 'Aguarde % segundos para pedir um novo código.',
      public.approval_code_cooldown_seconds() - v_age;
  end if;

  select * into v_client from public.clients where id = v_cal.client_id;

  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');

  insert into public.approval_code (post_id, calendar_id, code_hash, expires_at)
  values (p_post_id, v_cal.id, crypt(v_code, gen_salt('bf')), now() + interval '10 minutes')
  on conflict (post_id) do update
    set code_hash = excluded.code_hash,
        expires_at = excluded.expires_at,
        created_at = now();

  return jsonb_build_object(
    'code', v_code,
    'email', v_client.email,
    'masked_email', public.mask_email(v_client.email),
    'client_name', v_client.name,
    'post_title', v_post.title,
    'calendar_name', v_cal.name,
    'expires_in_minutes', 10
  );
end;
$$;
-- Ninguém chama a privada de fora: nem anônimo, nem admin logado.
revoke all on function public.approval_code_issue(text, uuid) from public, anon, authenticated;

-- 3. Versão anônima — devolve só o destino mascarado -------------------------
create or replace function public.issue_approval_code(p_token text, p_post_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare v_full jsonb;
begin
  v_full := public.approval_code_issue(p_token, p_post_id);
  -- O código em claro morre aqui.
  return jsonb_build_object('masked_email', v_full->>'masked_email');
end;
$$;
revoke all on function public.issue_approval_code(text, uuid) from public;
grant execute on function public.issue_approval_code(text, uuid) to anon, authenticated;

-- 4. Versão para entrega — só a Edge Function (service_role) ----------------
--    Devolve o código e o e-mail real. É a única porta por onde o código sai
--    do banco, e ela não é alcançável com a chave publicável do navegador.
create or replace function public.issue_approval_code_delivery(p_token text, p_post_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
begin
  return public.approval_code_issue(p_token, p_post_id);
end;
$$;
revoke all on function public.issue_approval_code_delivery(text, uuid)
  from public, anon, authenticated;
grant execute on function public.issue_approval_code_delivery(text, uuid) to service_role;

-- 5. Reforço: funções internas fora do alcance do anônimo --------------------
--    `request_approval` e `peek_approval_code_expiry` nasceram com o EXECUTE
--    aberto ao PUBLIC (o padrão do Postgres; a 001 revogou só as duas funções
--    públicas). Hoje isso não causa dano: nenhuma das duas é SECURITY DEFINER,
--    então a RLS as esvazia — um anônimo que chame `request_approval` recebe
--    "Post não encontrado" e nada muda. Conferido em Postgres 16.
--
--    Ainda assim o grant sai daqui, porque é uma armadilha: basta alguém
--    marcar uma delas como SECURITY DEFINER um dia para virar porta aberta.
revoke all on function public.request_approval(uuid, text) from public, anon;
grant execute on function public.request_approval(uuid, text) to authenticated;

revoke all on function public.peek_approval_code_expiry(uuid) from public, anon;
grant execute on function public.peek_approval_code_expiry(uuid) to authenticated;

--    `mask_email` e `approval_code_cooldown_seconds` seguem abertas de
--    propósito: são funções puras sobre o argumento recebido, não leem tabela
--    nenhuma e não têm o que vazar.

-- 6. Conferência -------------------------------------------------------------
--  Depois de aplicar, confirme que o navegador não alcança a função de entrega:
--    select p.proname, r.rolname
--      from pg_proc p
--      join pg_namespace n on n.oid = p.pronamespace
--      cross join lateral (select unnest(array['anon','authenticated','service_role']) as rolname) r
--     where n.nspname = 'public'
--       and p.proname in ('issue_approval_code','issue_approval_code_delivery',
--                         'approval_code_issue','request_approval',
--                         'peek_approval_code_expiry')
--       and has_function_privilege(r.rolname, p.oid, 'execute');
--  O esperado: issue_approval_code → anon e authenticated;
--              issue_approval_code_delivery → service_role apenas;
--              approval_code_issue → nenhum dos três;
--              request_approval e peek_approval_code_expiry → authenticated.


-- ####################################################################
-- #  supabase/migrations/005_workspace_do_card.sql
-- ####################################################################

-- ============================================================================
--  Migração 005 — Workspace do card: checklist, comentários, anexos e tempo
--  Aplicar DEPOIS de schema.sql e das migrações 001, 003 e 004.
--
--  São quatro campos INTERNOS da agência. O que garante que não vazam para o
--  cliente é `get_public_calendar`, que monta a resposta campo a campo e não
--  inclui nenhum deles — a mesma proteção que já vale para `internal_notes`.
--  A conferência no fim deste arquivo é o que prova isso.
-- ============================================================================

-- 1. Campos -----------------------------------------------------------------
--    jsonb em vez de tabelas próprias: são listas curtas, sempre lidas junto
--    com o card e nunca consultadas por conta própria. Tabela separada aqui
--    só traria join e nenhuma pergunta nova que alguém vá fazer.
alter table public.posts add column if not exists checklist    jsonb not null default '[]'::jsonb;
alter table public.posts add column if not exists comments     jsonb not null default '[]'::jsonb;
alter table public.posts add column if not exists attachments  jsonb not null default '[]'::jsonb;
alter table public.posts add column if not exists time_entries jsonb not null default '[]'::jsonb;

-- Precisam ser listas: um objeto solto aqui quebraria a leitura no app.
alter table public.posts drop constraint if exists posts_workspace_arrays;
alter table public.posts add constraint posts_workspace_arrays check (
  jsonb_typeof(checklist) = 'array'
  and jsonb_typeof(comments) = 'array'
  and jsonb_typeof(attachments) = 'array'
  and jsonb_typeof(time_entries) = 'array'
);

-- 2. Conferência -------------------------------------------------------------
--  Depois de aplicar, confirme que a visão pública continua limpa. Troque o
--  token e rode:
--    select public.get_public_calendar('<token>')::text ~ '(checklist|timeEntries|internal)'
--      as vaza;
--  O esperado é `f`. O arquivo supabase/verificacao-seguranca.sql faz essa
--  conferência junto com todas as outras.


-- ####################################################################
-- #  supabase/migrations/006_colunas_do_quadro.sql
-- ####################################################################

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


-- ####################################################################
-- #  supabase/migrations/007_agenda.sql
-- ####################################################################

-- ============================================================================
--  Migração 007 — Agenda, disponibilidade e reserva pública (spec 04)
--  Aplicar DEPOIS de schema.sql e das migrações 001, 003, 004, 005 e 006.
--
--  A agenda é uma projeção: ela quase não guarda nada. Compromissos e
--  reservas são dela; data de publicação e aprovação pendente são lidas de
--  quem já é dono. Não há tabela de projeção — o critério de aceite da spec é
--  que a projeção reconstruída do zero seja igual à incremental, e o jeito
--  mais barato de passar nesse teste para sempre é não ter cópia incremental.
--
--  Calendário externo (`conexao_calendario`) ficou de fora por decisão do
--  titular (D7). Oferecer a tabela prometeria uma sincronização que não existe.
-- ============================================================================

create extension if not exists btree_gist; -- exclusão por intervalo, abaixo

-- 1. Compromissos ------------------------------------------------------------
create table if not exists public.appointment (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references public.clients(id) on delete set null,
  title       text not null check (length(btrim(title)) > 0),
  description text,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  location    text,
  status      text not null default 'marcado' check (status in ('marcado','cancelado')),
  source      text not null default 'manual' check (source in ('manual','reserva')),
  done        boolean not null default false,
  created_at  timestamptz not null default now(),
  constraint appointment_fim_depois_do_inicio check (ends_at > starts_at)
);
create index if not exists appointment_quando_idx on public.appointment(starts_at);

-- 2. Datas marcantes que a agência escolheu manter --------------------------
--    O catálogo em si é calculado no app (feriados móveis saem da Páscoa),
--    então aqui ficam só as escolhidas e as criadas à mão.
create table if not exists public.marked_date (
  id         text primary key,
  date       date not null,
  name       text not null,
  category   text not null,
  color      text,
  sensitive  boolean not null default false,
  custom     boolean not null default false
);
create index if not exists marked_date_date_idx on public.marked_date(date);

-- 3. Disponibilidade e página de reserva (uma por agência) ------------------
create table if not exists public.booking_config (
  id               int primary key default 1 check (id = 1),
  weekdays         jsonb not null default '{}'::jsonb,
  duration_minutes int  not null default 30 check (duration_minutes between 5 and 480),
  notice_hours     int  not null default 12 check (notice_hours >= 0),
  gap_minutes      int  not null default 15 check (gap_minutes >= 0),
  link_id          text not null unique,
  active           boolean not null default false,
  title            text not null default 'Agendar uma conversa',
  intro            text
);

-- 4. Reservas ----------------------------------------------------------------
create table if not exists public.booking (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(btrim(name)) > 0),
  email        text not null,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  status       text not null default 'confirmada' check (status in ('confirmada','cancelada')),
  manage_token text not null unique,
  note         text,
  created_at   timestamptz not null default now(),
  constraint booking_fim_depois_do_inicio check (ends_at > starts_at),
  -- Duas reservas simultâneas para o mesmo horário: só uma confirma. Isto é
  -- uma trava do banco, não uma checagem do aplicativo — duas requisições no
  -- mesmo milissegundo não têm como furá-la.
  constraint booking_sem_sobreposicao
    exclude using gist (tstzrange(starts_at, ends_at) with &&)
    where (status = 'confirmada')
);

-- 5. RLS ---------------------------------------------------------------------
alter table public.appointment     enable row level security;
alter table public.marked_date     enable row level security;
alter table public.booking_config  enable row level security;
alter table public.booking         enable row level security;

drop policy if exists "admin_all_appointment" on public.appointment;
create policy "admin_all_appointment" on public.appointment
  for all to authenticated using (true) with check (true);
drop policy if exists "admin_all_marked_date" on public.marked_date;
create policy "admin_all_marked_date" on public.marked_date
  for all to authenticated using (true) with check (true);
drop policy if exists "admin_all_booking_config" on public.booking_config;
create policy "admin_all_booking_config" on public.booking_config
  for all to authenticated using (true) with check (true);
drop policy if exists "admin_all_booking" on public.booking;
create policy "admin_all_booking" on public.booking
  for all to authenticated using (true) with check (true);
-- Nenhuma policy para anon: o visitante só enxerga pelas funções abaixo.

-- 6. Página pública ----------------------------------------------------------
--    Pausada responde igual a inexistente: o visitante não consegue nem saber
--    que o link um dia valeu.
create or replace function public.public_booking_page(p_link text)
returns jsonb
language sql security definer
set search_path = public
as $$
  select case when c.id is null then null else jsonb_build_object(
    'title', c.title,
    'intro', c.intro,
    'durationMinutes', c.duration_minutes,
    'noticeHours', c.notice_hours,
    'gapMinutes', c.gap_minutes,
    'weekdays', c.weekdays
  ) end
  from public.booking_config c
  where c.link_id = p_link and c.active;
$$;

--    Horários ocupados, sem um pingo de detalhe: só início e fim. O visitante
--    precisa saber quando NÃO dá; quem está do outro lado não é da conta dele.
create or replace function public.public_booking_busy(p_link text, p_from date, p_to date)
returns jsonb
language sql security definer
set search_path = public
as $$
  select case when not exists (
      select 1 from public.booking_config where link_id = p_link and active
    ) then null else coalesce((
    select jsonb_agg(jsonb_build_object('start', s, 'end', e) order by s)
    from (
      select starts_at as s, ends_at as e from public.appointment
       where status = 'marcado' and starts_at::date between p_from and p_to
      union all
      select starts_at, ends_at from public.booking
       where status = 'confirmada' and starts_at::date between p_from and p_to
    ) q
  ), '[]'::jsonb) end;
$$;

create or replace function public.public_create_booking(
  p_link  text,
  p_name  text,
  p_email text,
  p_start timestamptz,
  p_note  text default null
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_cfg   public.booking_config%rowtype;
  v_end   timestamptz;
  v_token text;
  v_id    uuid;
begin
  select * into v_cfg from public.booking_config where link_id = p_link and active;
  if not found then raise exception 'Página de agendamento indisponível.'; end if;

  if length(btrim(coalesce(p_name, ''))) = 0 then raise exception 'Informe seu nome.'; end if;
  if p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Informe um e-mail válido.';
  end if;

  if p_start < now() + make_interval(hours => v_cfg.notice_hours) then
    raise exception 'Esse horário está dentro da antecedência mínima.';
  end if;

  v_end := p_start + make_interval(mins => v_cfg.duration_minutes);

  -- Conflito com compromisso da agência (a sobreposição entre reservas é
  -- barrada pela própria restrição da tabela).
  if exists (
    select 1 from public.appointment
     where status = 'marcado' and tstzrange(starts_at, ends_at) && tstzrange(p_start, v_end)
  ) then
    raise exception 'Esse horário acabou de ser ocupado. Escolha outro.';
  end if;

  v_token := encode(gen_random_bytes(18), 'hex');

  begin
    insert into public.booking (name, email, starts_at, ends_at, manage_token, note)
    values (btrim(p_name), lower(btrim(p_email)), p_start, v_end, v_token, p_note)
    returning id into v_id;
  exception when exclusion_violation then
    -- A outra requisição chegou primeiro.
    raise exception 'Esse horário acabou de ser ocupado. Escolha outro.';
  end;

  insert into public.appointment (title, starts_at, ends_at, source, description)
  values (btrim(p_name) || ' (reserva)', p_start, v_end, 'reserva', lower(btrim(p_email)));

  return jsonb_build_object('id', v_id, 'manageToken', v_token, 'start', p_start, 'end', v_end);
end;
$$;

--    O visitante cancela pelo token que recebeu, sem conta e sem ver mais nada.
create or replace function public.public_cancel_booking(p_token text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare v_b public.booking%rowtype;
begin
  select * into v_b from public.booking where manage_token = p_token;
  if not found then raise exception 'Reserva não encontrada.'; end if;
  if v_b.status = 'cancelada' then return jsonb_build_object('status','cancelada'); end if;

  update public.booking set status = 'cancelada' where id = v_b.id;
  update public.appointment set status = 'cancelado'
   where source = 'reserva' and starts_at = v_b.starts_at and ends_at = v_b.ends_at;

  return jsonb_build_object('status','cancelada');
end;
$$;

revoke all on function public.public_booking_page(text) from public;
revoke all on function public.public_booking_busy(text, date, date) from public;
revoke all on function public.public_create_booking(text, text, text, timestamptz, text) from public;
revoke all on function public.public_cancel_booking(text) from public;
grant execute on function public.public_booking_page(text) to anon, authenticated;
grant execute on function public.public_booking_busy(text, date, date) to anon, authenticated;
grant execute on function public.public_create_booking(text, text, text, timestamptz, text) to anon, authenticated;
grant execute on function public.public_cancel_booking(text) to anon, authenticated;


-- ####################################################################
-- #  supabase/migrations/008_propostas_contratos.sql
-- ####################################################################

-- ============================================================================
--  Migração 008 — Catálogo, propostas e contratos (specs 06 e 07)
--  Aplicar DEPOIS das migrações 001 a 007.
--
--  Duas regras valem mais que todo o resto deste arquivo, e por isso são do
--  banco e não do aplicativo:
--    1. Proposta ACEITA é imutável. É o registro do que foi combinado.
--    2. Texto de contrato não muda depois da primeira assinatura. É o que dá
--       sentido ao hash guardado em cada assinatura.
--  Um gatilho impede as duas coisas, venha a tentativa de onde vier.
-- ============================================================================

-- 1. Catálogo de serviços ----------------------------------------------------
create table if not exists public.service (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (length(btrim(name)) > 0),
  category        text,
  description     text,
  included        jsonb not null default '[]'::jsonb,
  internal_note   text,
  -- Centavos inteiros. Nunca ponto flutuante (invariante da spec 08).
  price_cents     bigint not null default 0 check (price_cents >= 0),
  billing         text not null check (billing in
                    ('mensal','trimestral','semestral','anual','unica','por_hora')),
  execution_days  int,
  active          boolean not null default true,
  public_in_table boolean not null default false,
  position        int not null default 0,
  color           text,
  created_at      timestamptz not null default now()
);

-- 2. Propostas ---------------------------------------------------------------
create table if not exists public.proposal (
  id               uuid primary key default gen_random_uuid(),
  number           text unique,
  title            text not null check (length(btrim(title)) > 0),
  client_id        uuid references public.clients(id) on delete set null,
  lead_name        text,
  cover            text,
  valid_until      date not null,
  min_months       int,
  conditions       text,
  notes            text,
  status           text not null default 'rascunho' check (status in
                     ('rascunho','enviada','ajuste_pedido','aceita','recusada','vencida','arquivada')),
  link_id          text not null unique,
  items            jsonb not null default '[]'::jsonb,
  payment          jsonb,
  views            jsonb not null default '[]'::jsonb,
  sent_at          timestamptz,
  decided_at       timestamptz,
  decider_name     text,
  decider_document text,
  refusal_reason   text,
  version          int not null default 1,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- Para quem é a proposta: cliente cadastrado ou um nome solto.
  constraint proposal_tem_destinatario check (client_id is not null or lead_name is not null)
);
create index if not exists proposal_client_idx on public.proposal(client_id);
create index if not exists proposal_status_idx on public.proposal(status);

-- Proposta aceita é somente leitura, para todo mundo e sem exceção: é o
-- registro do que foi combinado. Corrigir significa fazer outra proposta.
create or replace function public.proposal_imutavel()
returns trigger language plpgsql as $$
begin
  if old.status = 'aceita' then
    raise exception 'Uma proposta aceita não pode ser alterada.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists proposal_imutavel on public.proposal;
create trigger proposal_imutavel before update on public.proposal
  for each row execute function public.proposal_imutavel();

-- 3. Contratos ---------------------------------------------------------------
create table if not exists public.contract (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid references public.clients(id) on delete set null,
  proposal_id        uuid references public.proposal(id) on delete set null,
  title              text not null,
  status             text not null default 'rascunho' check (status in
                       ('rascunho','gerado','aguardando_partes','parcialmente_assinado',
                        'vigente','encerrado','cancelado')),
  final_text         text not null default '',
  text_hash          text not null default '',
  starts_on          date,
  ends_on            date,
  auto_renew         boolean not null default false,
  renew_notice_days  int not null default 30,
  parties            jsonb not null default '[]'::jsonb,
  signatures         jsonb not null default '[]'::jsonb,
  effective_at       timestamptz,
  created_at         timestamptz not null default now()
);
create index if not exists contract_client_idx on public.contract(client_id);

-- O texto congela na primeira assinatura. Corrigir = cancelar e gerar outro.
create or replace function public.contract_texto_congelado()
returns trigger language plpgsql as $$
begin
  if jsonb_array_length(old.signatures) > 0 and new.final_text is distinct from old.final_text then
    raise exception 'O texto não pode mudar depois da primeira assinatura.';
  end if;
  if jsonb_array_length(old.signatures) > 0 and new.text_hash is distinct from old.text_hash then
    raise exception 'O hash do contrato não pode mudar depois da primeira assinatura.';
  end if;
  return new;
end;
$$;
drop trigger if exists contract_texto_congelado on public.contract;
create trigger contract_texto_congelado before update on public.contract
  for each row execute function public.contract_texto_congelado();

-- Contrato com assinatura nunca é removido fisicamente.
create or replace function public.contract_nao_remove_assinado()
returns trigger language plpgsql as $$
begin
  if jsonb_array_length(old.signatures) > 0 then
    raise exception 'Um contrato com assinatura nunca é removido. Cancele-o.';
  end if;
  return old;
end;
$$;
drop trigger if exists contract_nao_remove_assinado on public.contract;
create trigger contract_nao_remove_assinado before delete on public.contract
  for each row execute function public.contract_nao_remove_assinado();

-- 4. RLS ---------------------------------------------------------------------
alter table public.service  enable row level security;
alter table public.proposal enable row level security;
alter table public.contract enable row level security;

drop policy if exists "admin_all_service" on public.service;
create policy "admin_all_service" on public.service
  for all to authenticated using (true) with check (true);
drop policy if exists "admin_all_proposal" on public.proposal;
create policy "admin_all_proposal" on public.proposal
  for all to authenticated using (true) with check (true);
drop policy if exists "admin_all_contract" on public.contract;
create policy "admin_all_contract" on public.contract
  for all to authenticated using (true) with check (true);
-- Sem policy para anon: o cliente só chega pelas funções abaixo.

-- 5. Numeração ---------------------------------------------------------------
--    Sequencial por ano, entregue no primeiro envio. Rascunho não ganha
--    número: um número dado e abandonado vira buraco para explicar.
create or replace function public.send_proposal(p_id uuid)
returns public.proposal
language plpgsql security definer
set search_path = public
as $$
declare
  v_p      public.proposal%rowtype;
  v_num    text;
  v_ano    text := to_char(now(), 'YYYY');
begin
  select * into v_p from public.proposal where id = p_id for update;
  if not found then raise exception 'Proposta não encontrada.'; end if;
  if v_p.status not in ('rascunho','ajuste_pedido','vencida','arquivada') then
    raise exception 'Esta proposta não pode ser enviada agora.';
  end if;

  if v_p.number is null then
    select v_ano || '-' || lpad((coalesce(max(substring(number from 6)::int), 0) + 1)::text, 3, '0')
      into v_num
      from public.proposal
     where number like v_ano || '-%';
  else
    v_num := v_p.number;
  end if;

  update public.proposal
     set number  = v_num,
         status  = 'enviada',
         sent_at = now(),
         version = case when v_p.status = 'ajuste_pedido' then v_p.version + 1 else v_p.version end
   where id = p_id
   returning * into v_p;

  return v_p;
end;
$$;
revoke all on function public.send_proposal(uuid) from public, anon;
grant execute on function public.send_proposal(uuid) to authenticated;

-- 6. Página pública da proposta ----------------------------------------------
--    Rascunho e arquivada não existem para o visitante.
create or replace function public.public_proposal(p_link text, p_agent text default null)
returns public.proposal
language plpgsql security definer
set search_path = public
as $$
declare v_p public.proposal%rowtype;
begin
  select * into v_p from public.proposal
   where link_id = p_link and status not in ('rascunho','arquivada');
  if not found then return null; end if;

  -- Abrir a proposta é um fato que vale guardar (spec 06).
  if v_p.status <> 'aceita' then
    update public.proposal
       set views = views || jsonb_build_object(
             'id', gen_random_uuid(), 'at', now(), 'agent', p_agent)
     where id = v_p.id
     returning * into v_p;
  end if;

  return v_p;
end;
$$;

create or replace function public.public_decide_proposal(
  p_link     text,
  p_result   text,
  p_name     text,
  p_document text default null,
  p_reason   text default null
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare v_p public.proposal%rowtype;
begin
  if p_result not in ('aceita','recusada','ajuste_pedido') then
    raise exception 'Decisão inválida.';
  end if;
  if length(btrim(coalesce(p_name,''))) = 0 then raise exception 'Informe seu nome.'; end if;
  if p_result <> 'aceita' and length(btrim(coalesce(p_reason,''))) = 0 then
    raise exception 'Conte o motivo para a agência saber como ajustar.';
  end if;

  select * into v_p from public.proposal where link_id = p_link for update;
  if not found then raise exception 'Proposta não encontrada.'; end if;
  if v_p.status <> 'enviada' then raise exception 'Esta proposta não aceita mais decisões.'; end if;
  -- Aceitar uma proposta vencida é recusado no link: o preço na tela pode já
  -- não ser o preço.
  if v_p.valid_until < current_date then
    raise exception 'Esta proposta venceu. Peça uma nova à agência.';
  end if;

  update public.proposal
     set status           = p_result,
         decided_at       = now(),
         decider_name     = btrim(p_name),
         decider_document = nullif(btrim(coalesce(p_document,'')), ''),
         refusal_reason   = nullif(btrim(coalesce(p_reason,'')), '')
   where id = v_p.id;
end;
$$;

-- 7. Página pública do contrato ----------------------------------------------
--    Cada parte tem o seu próprio token: um signatário nunca vê o link do outro.
create or replace function public.public_contract(p_token text)
returns jsonb
language sql security definer
set search_path = public
as $$
  select jsonb_build_object(
           'contract', to_jsonb(c) - 'parties' || jsonb_build_object(
             -- A outra parte aparece sem o token dela.
             'parties', (select jsonb_agg(p - 'token') from jsonb_array_elements(c.parties) p)
           ),
           'partyId', (
             select p->>'id' from jsonb_array_elements(c.parties) p
              where p->>'token' = p_token
           )
         )
    from public.contract c
   where c.status not in ('rascunho','cancelado')
     and exists (select 1 from jsonb_array_elements(c.parties) p where p->>'token' = p_token)
   limit 1;
$$;

create or replace function public.public_sign_contract(
  p_token    text,
  p_name     text,
  p_document text,
  p_agent    text default null
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_c       public.contract%rowtype;
  v_party   jsonb;
  v_sigs    jsonb;
  v_pending int;
begin
  select * into v_c from public.contract
   where exists (select 1 from jsonb_array_elements(parties) p where p->>'token' = p_token)
   for update;
  if not found then raise exception 'Contrato não encontrado.'; end if;
  if v_c.status = 'cancelado' then raise exception 'Este contrato foi cancelado.'; end if;

  select p into v_party from jsonb_array_elements(v_c.parties) p where p->>'token' = p_token;
  if exists (select 1 from jsonb_array_elements(v_c.signatures) s
              where s->>'partyId' = v_party->>'id') then
    raise exception 'Esta parte já assinou.';
  end if;

  if length(btrim(coalesce(p_name,''))) < 3 then raise exception 'Digite seu nome completo.'; end if;
  if length(regexp_replace(coalesce(p_document,''), '\D', '', 'g')) not in (11, 14) then
    raise exception 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).';
  end if;

  -- O hash é o do texto como ele está AGORA. É ele que denunciaria qualquer
  -- alteração posterior — que o gatilho acima, de todo modo, já impede.
  v_sigs := v_c.signatures || jsonb_build_object(
    'id', gen_random_uuid(),
    'partyId', v_party->>'id',
    'typedName', btrim(p_name),
    'typedDocument', regexp_replace(p_document, '\D', '', 'g'),
    'at', now(),
    'agent', p_agent,
    'signedTextHash', v_c.text_hash
  );

  select count(*) into v_pending
    from jsonb_array_elements(v_c.parties) p
   where (p->>'required')::boolean
     and not exists (select 1 from jsonb_array_elements(v_sigs) s where s->>'partyId' = p->>'id');

  update public.contract
     set signatures   = v_sigs,
         status       = case when v_pending = 0 then 'vigente' else 'parcialmente_assinado' end,
         effective_at = case when v_pending = 0 and effective_at is null then now() else effective_at end
   where id = v_c.id;
end;
$$;

revoke all on function public.public_proposal(text, text) from public;
revoke all on function public.public_decide_proposal(text, text, text, text, text) from public;
revoke all on function public.public_contract(text) from public;
revoke all on function public.public_sign_contract(text, text, text, text) from public;
grant execute on function public.public_proposal(text, text) to anon, authenticated;
grant execute on function public.public_decide_proposal(text, text, text, text, text) to anon, authenticated;
grant execute on function public.public_contract(text) to anon, authenticated;
grant execute on function public.public_sign_contract(text, text, text, text) to anon, authenticated;


-- ####################################################################
-- #  supabase/migrations/009_financeiro.sql
-- ####################################################################

-- ============================================================================
--  Migração 009 — Financeiro núcleo (spec 08)
--  Aplicar DEPOIS das migrações 001 a 008.
--
--  Duas regras são do banco porque são as que não podem ser negociadas:
--    1. Lançamento liquidado não muda de valor. Corrigir = estornar.
--    2. Lançamento liquidado não é removido fisicamente.
--
--  Recorrência NÃO materializa o futuro: não existe tabela de projeção. As
--  parcelas futuras são calculadas no app (src/calendar-app/finance.ts) e só
--  viram linha aqui quando entram na janela ou quando alguém mexe no mês.
--  O critério de aceite da spec — "projeção de 12 meses não cria linhas" — é
--  satisfeito por construção.
-- ============================================================================

-- 1. Contas -----------------------------------------------------------------
create table if not exists public.finance_account (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null check (length(btrim(name)) > 0),
  kind                  text not null check (kind in ('banco','caixa','carteira')),
  -- Centavos inteiros, sempre. Nenhum cálculo em ponto flutuante.
  initial_balance_cents bigint not null default 0,
  initial_balance_date  date not null default current_date,
  color                 text,
  active                boolean not null default true,
  created_at            timestamptz not null default now()
);

-- 2. Categorias --------------------------------------------------------------
create table if not exists public.finance_category (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null check (length(btrim(name)) > 0),
  nature               text not null check (nature in ('receita','despesa')),
  expense_kind         text check (expense_kind in ('fixa','variavel','imposto','pessoal')),
  monthly_target_cents bigint check (monthly_target_cents is null or monthly_target_cents >= 0),
  color                text,
  active               boolean not null default true
);

-- 3. Séries ------------------------------------------------------------------
create table if not exists public.finance_series (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('parcelada','recorrente')),
  every_months  int  not null default 1 check (every_months >= 1),
  day_of_month  int  not null default 1 check (day_of_month between 1 and 28),
  count         int  check (count is null or count between 2 and 60),
  total_cents   bigint not null check (total_cents > 0),
  start_date    date not null,
  end_date      date,
  skipped       jsonb not null default '[]'::jsonb,
  nature        text not null check (nature in ('receita','despesa')),
  description   text not null,
  category_id   uuid references public.finance_category(id) on delete set null,
  account_id    uuid references public.finance_account(id) on delete set null,
  client_id     uuid references public.clients(id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint finance_series_parcelada_tem_contagem
    check (kind <> 'parcelada' or count is not null),
  constraint finance_series_fim_depois_do_inicio
    check (end_date is null or end_date >= start_date)
);

-- 4. Lançamentos -------------------------------------------------------------
create table if not exists public.finance_entry (
  id              uuid primary key default gen_random_uuid(),
  nature          text not null check (nature in ('receita','despesa')),
  description     text not null check (length(btrim(description)) > 0),
  -- Sempre positivo: quem carrega o sinal é `nature`.
  amount_cents    bigint not null check (amount_cents > 0),
  due_date        date not null,
  competence      text not null check (competence ~ '^\d{4}-\d{2}$'),
  status          text not null default 'pendente'
                    check (status in ('previsto','pendente','liquidado','cancelado')),
  settled_at      date,
  account_id      uuid references public.finance_account(id) on delete restrict,
  category_id     uuid references public.finance_category(id) on delete set null,
  client_id       uuid references public.clients(id) on delete set null,
  method          text,
  document        text,
  note            text,
  series_id       uuid references public.finance_series(id) on delete set null,
  series_position int,
  origin          text not null default 'manual' check (origin in ('manual','serie','contrato')),
  reversal_of     uuid references public.finance_entry(id) on delete set null,
  created_at      timestamptz not null default now(),
  -- Liquidado exige data e conta: sem isso não dá para dizer que o dinheiro
  -- andou, e o saldo passaria a mentir.
  constraint finance_entry_liquidado_completo
    check (status <> 'liquidado' or (settled_at is not null and account_id is not null))
);
create index if not exists finance_entry_due_idx on public.finance_entry(due_date);
create index if not exists finance_entry_comp_idx on public.finance_entry(competence);
create index if not exists finance_entry_series_idx on public.finance_entry(series_id, competence);
-- Uma série não pode ter dois lançamentos para o mesmo mês.
create unique index if not exists finance_entry_serie_mes_unico
  on public.finance_entry(series_id, competence) where series_id is not null;

create or replace function public.finance_entry_liquidado_imutavel()
returns trigger language plpgsql as $$
begin
  if old.status = 'liquidado' and new.amount_cents is distinct from old.amount_cents then
    raise exception 'Um lançamento liquidado não muda de valor. Estorne-o.';
  end if;
  if old.status = 'liquidado' and new.nature is distinct from old.nature then
    raise exception 'Um lançamento liquidado não muda de natureza. Estorne-o.';
  end if;
  return new;
end;
$$;
drop trigger if exists finance_entry_liquidado_imutavel on public.finance_entry;
create trigger finance_entry_liquidado_imutavel before update on public.finance_entry
  for each row execute function public.finance_entry_liquidado_imutavel();

create or replace function public.finance_entry_nao_remove_liquidado()
returns trigger language plpgsql as $$
begin
  if old.status = 'liquidado' then
    raise exception 'Um lançamento liquidado não é removido. Estorne-o.';
  end if;
  return old;
end;
$$;
drop trigger if exists finance_entry_nao_remove_liquidado on public.finance_entry;
create trigger finance_entry_nao_remove_liquidado before delete on public.finance_entry
  for each row execute function public.finance_entry_nao_remove_liquidado();

-- 5. Transferências ----------------------------------------------------------
--    Movem valor entre contas e ficam FORA do resultado, por competência e
--    por caixa. Por isso são tabela própria, e não dois lançamentos.
create table if not exists public.finance_transfer (
  id              uuid primary key default gen_random_uuid(),
  from_account_id uuid not null references public.finance_account(id) on delete restrict,
  to_account_id   uuid not null references public.finance_account(id) on delete restrict,
  amount_cents    bigint not null check (amount_cents > 0),
  date            date not null,
  note            text,
  created_at      timestamptz not null default now(),
  constraint finance_transfer_contas_diferentes check (from_account_id <> to_account_id)
);

-- 6. RLS ---------------------------------------------------------------------
--    Financeiro é o módulo mais sensível da agência. Nenhuma policy para anon,
--    e `get_public_calendar` nunca tocou em nada disto.
alter table public.finance_account  enable row level security;
alter table public.finance_category enable row level security;
alter table public.finance_series   enable row level security;
alter table public.finance_entry    enable row level security;
alter table public.finance_transfer enable row level security;

do $$
declare t text;
begin
  foreach t in array array['finance_account','finance_category','finance_series',
                           'finance_entry','finance_transfer']
  loop
    execute format('drop policy if exists "admin_all_%1$s" on public.%1$I', t);
    execute format(
      'create policy "admin_all_%1$s" on public.%1$I for all to authenticated using (true) with check (true)',
      t);
  end loop;
end
$$;

-- 7. Conferência -------------------------------------------------------------
--  select tablename, policyname, roles from pg_policies
--   where tablename like 'finance\_%';          -- tudo ALL/{authenticated}
--  O anônimo deve devolver 0 linhas em todas elas.


-- ####################################################################
-- #  supabase/migrations/010_crm_orquestrador.sql
-- ####################################################################

-- ============================================================================
--  Migração 010 — CRM e orquestrador venda → operação (specs 09 e 10)
--  Aplicar DEPOIS das migrações 001 a 009.
--
--  Duas coisas valem destaque:
--    • `crm_interaction` é SOMENTE INSERÇÃO, inclusive para o admin. Corrigir
--      uma interação é escrever outra. O que foi dito a uma pessoa não se
--      reescreve.
--    • Todo contato guarda origem, data de coleta e base legal (LGPD). Os
--      campos ficam no jsonb `contacts` do negócio e a aplicação os preenche.
--
--  As etapas do funil são o conjunto padrão calculado em src/calendar-app/
--  crm.ts. Editá-las não está construído, então não há tabela para elas:
--  uma tabela vazia prometeria uma tela que não existe.
-- ============================================================================

-- 1. Negócios ----------------------------------------------------------------
create table if not exists public.crm_deal (
  id              uuid primary key default gen_random_uuid(),
  phase           text not null check (phase in ('prospeccao','oportunidade')),
  stage_id        text not null,
  name            text not null check (length(btrim(name)) > 0),
  company         text,
  document        text,
  segment         text,
  city            text,
  origin          text,
  tags            jsonb not null default '[]'::jsonb,
  recurring_cents bigint not null default 0 check (recurring_cents >= 0),
  one_off_cents   bigint not null default 0 check (one_off_cents >= 0),
  probability     int check (probability is null or probability between 0 and 100),
  score           int check (score is null or score between 0 and 100),
  next_step_on    date,
  last_contact_on date,
  client_id       uuid references public.clients(id) on delete set null,
  proposal_id     uuid references public.proposal(id) on delete set null,
  status          text not null default 'aberto' check (status in ('aberto','ganho','perdido')),
  loss_reason     text,
  contacts        jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Perdido exige motivo: "perdemos" sem porquê não ensina nada a ninguém.
  constraint crm_deal_perdido_tem_motivo
    check (status <> 'perdido' or loss_reason is not null)
);
create index if not exists crm_deal_status_idx on public.crm_deal(status, phase);

-- 2. Interações (somente inserção) -------------------------------------------
create table if not exists public.crm_interaction (
  id       uuid primary key default gen_random_uuid(),
  deal_id  uuid not null references public.crm_deal(id) on delete cascade,
  kind     text not null check (kind in ('ligacao','mensagem','email','reuniao','nota')),
  at       timestamptz not null default now(),
  author   text,
  content  text not null check (length(btrim(content)) > 0),
  answered boolean
);
create index if not exists crm_interaction_deal_idx on public.crm_interaction(deal_id, at desc);

create or replace function public.crm_interaction_somente_insercao()
returns trigger language plpgsql as $$
begin
  raise exception 'Interação não se edita nem se apaga. Registre outra.';
end;
$$;
drop trigger if exists crm_interaction_imutavel on public.crm_interaction;
create trigger crm_interaction_imutavel before update or delete on public.crm_interaction
  for each row execute function public.crm_interaction_somente_insercao();

-- 3. Tarefas comerciais ------------------------------------------------------
create table if not exists public.crm_task (
  id      uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.crm_deal(id) on delete cascade,
  title   text not null check (length(btrim(title)) > 0),
  due_on  date not null,
  note    text,
  done_at timestamptz,
  result  text
);
create index if not exists crm_task_due_idx on public.crm_task(due_on) where done_at is null;

-- 4. Bloqueios de contato (LGPD) ---------------------------------------------
create table if not exists public.crm_block (
  id     uuid primary key default gen_random_uuid(),
  kind   text not null check (kind in ('email','dominio','telefone')),
  value  text not null check (length(btrim(value)) > 0),
  reason text,
  at     timestamptz not null default now(),
  constraint crm_block_unico unique (kind, value)
);

-- 5. Processo de contratação (a saga) ----------------------------------------
create table if not exists public.contracting_process (
  id          text primary key,
  proposal_id uuid not null unique references public.proposal(id) on delete cascade,
  deal_id     uuid references public.crm_deal(id) on delete set null,
  client_id   uuid references public.clients(id) on delete set null,
  status      text not null check (status in
                ('em_andamento','aguardando_assinatura','concluido','falhou','cancelado')),
  steps       jsonb not null default '[]'::jsonb,
  started_at  timestamptz not null default now(),
  finished_at timestamptz
);
-- `proposal_id` é único: um aceite, um processo. É esta restrição que garante
-- o critério de aceite da spec — reprocessar o mesmo evento não cria um
-- segundo cliente, contrato ou série.

-- 6. RLS ---------------------------------------------------------------------
alter table public.crm_deal            enable row level security;
alter table public.crm_interaction     enable row level security;
alter table public.crm_task            enable row level security;
alter table public.crm_block           enable row level security;
alter table public.contracting_process enable row level security;

do $$
declare t text;
begin
  foreach t in array array['crm_deal','crm_task','crm_block','contracting_process']
  loop
    execute format('drop policy if exists "admin_all_%1$s" on public.%1$I', t);
    execute format(
      'create policy "admin_all_%1$s" on public.%1$I for all to authenticated using (true) with check (true)',
      t);
  end loop;
end
$$;

-- Interação: inserir e ler, nunca alterar. A policy acompanha o gatilho.
drop policy if exists "admin_insert_crm_interaction" on public.crm_interaction;
create policy "admin_insert_crm_interaction" on public.crm_interaction
  for insert to authenticated with check (true);
drop policy if exists "admin_read_crm_interaction" on public.crm_interaction;
create policy "admin_read_crm_interaction" on public.crm_interaction
  for select to authenticated using (true);
-- Nenhuma policy para anon em nada disto.


-- ####################################################################
-- #  supabase/migrations/011_banco_de_ideias.sql
-- ####################################################################

-- ============================================================================
--  Migração 011 — Banco de ideias de pauta (ficha 08)
--  Aplicar DEPOIS das migrações 001 a 010.
--
--  A ideia é capturada em uma linha só; `#etiquetas`, `@menções` e o formato
--  saem do próprio texto. A aplicação faz essa leitura (src/calendar-app/
--  ideas.ts) e grava o resultado aqui, para que filtrar por etiqueta seja uma
--  consulta e não uma varredura de texto.
--
--  O elo com o card é guardado dos dois lados — `idea.used_by` e
--  `posts.idea_id`. É a correção da crítica da ficha: no sistema de origem,
--  a ideia que virou card não deixava rastro de onde foi parar.
-- ============================================================================

create table if not exists public.idea (
  id         uuid primary key default gen_random_uuid(),
  text       text not null check (length(btrim(text)) > 0),
  -- Nulo significa "ideia geral": ideia que não é de nenhum cliente.
  client_id  uuid references public.clients(id) on delete cascade,
  tags       jsonb not null default '[]'::jsonb,
  mentions   jsonb not null default '[]'::jsonb,
  format     text,
  status     text not null default 'nova'
               check (status in ('nova','na_pauta','usada','arquivada')),
  votes      jsonb not null default '[]'::jsonb,
  used_by    jsonb not null default '[]'::jsonb,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint idea_tags_e_lista      check (jsonb_typeof(tags) = 'array'),
  constraint idea_mentions_e_lista  check (jsonb_typeof(mentions) = 'array'),
  constraint idea_votes_e_lista     check (jsonb_typeof(votes) = 'array'),
  constraint idea_used_by_e_lista   check (jsonb_typeof(used_by) = 'array')
);

create index if not exists idea_cliente_idx on public.idea (client_id);
create index if not exists idea_status_idx  on public.idea (status, created_at desc);
-- Etiquetas são consultadas por conter: `tags @> '["cafe"]'`.
create index if not exists idea_tags_idx    on public.idea using gin (tags);

-- A outra ponta do elo. ON DELETE SET NULL: apagar a ideia não pode levar
-- junto o card que já está na pauta do cliente.
alter table public.posts
  add column if not exists idea_id uuid references public.idea(id) on delete set null;
create index if not exists posts_idea_idx on public.posts (idea_id);

-- O mesmo voto não conta duas vezes. A aplicação já garante isto, mas o banco
-- é a última linha de defesa: `votes` guarda uma pessoa por entrada.
create or replace function public.idea_votos_unicos()
returns trigger language plpgsql as $$
begin
  if (select count(*) from jsonb_array_elements_text(new.votes)) <>
     (select count(distinct v) from jsonb_array_elements_text(new.votes) v) then
    raise exception 'uma pessoa vota uma vez em cada ideia';
  end if;
  return new;
end
$$;

drop trigger if exists idea_votos_unicos on public.idea;
create trigger idea_votos_unicos
  before insert or update of votes on public.idea
  for each row execute function public.idea_votos_unicos();

-- RLS: equipe autenticada. Nada de anon — o banco de ideias é interno, e
-- nenhuma rota pública o lê.
alter table public.idea enable row level security;
drop policy if exists "admin_all_idea" on public.idea;
create policy "admin_all_idea" on public.idea
  for all to authenticated using (true) with check (true);

-- Cinto e suspensórios: sem policy, o RLS já devolveria zero linhas a anon.
-- Ainda assim tiramos o grant, porque nenhuma rota pública lê ideias e um
-- privilégio que ninguém usa é só superfície de ataque à espera de um erro
-- de policy.
revoke all on public.idea from anon;


-- ####################################################################
-- #  supabase/migrations/012_pauta_unica.sql
-- ####################################################################

-- ============================================================================
--  Migração 012 — Pauta única e planejamento mensal (ficha 17, F17a)
--  Aplicar DEPOIS das migrações 001 a 011.
--
--  A crítica da ficha é o motivo desta migração existir assim: no sistema de
--  origem há cinco calendários de conteúdo (planejamento mensal, planejamento
--  interno, calendário de stories, calendário de aprovação e o de publicação).
--  A mesma pauta é digitada em até cinco lugares e as versões divergem.
--
--  Aqui existe UMA tabela de pauta (`pauta_item`), com visões na aplicação.
--  Quando o time decide produzir, a pauta vira card em `posts` e o card passa
--  a ser a verdade — inclusive para a aprovação do cliente, que continua
--  sendo o serviço único da spec 03, e não mais um fluxo por ferramenta.
-- ============================================================================

-- 1. Planejamento mensal ------------------------------------------------------
create table if not exists public.monthly_plan (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  month        text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  goals        jsonb not null default '[]'::jsonb,
  objectives   jsonb not null default '[]'::jsonb,
  improvements jsonb not null default '[]'::jsonb,
  pillars      jsonb not null default '[]'::jsonb,
  funnel       jsonb not null default '{}'::jsonb,
  actions      jsonb not null default '[]'::jsonb,
  closing      text,
  status       text not null default 'rascunho' check (status in ('rascunho','validado')),
  validated_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- Um planejamento por cliente por mês. Dois seriam duas fontes de verdade
  -- para os mesmos pilares, e a pauta lê de uma delas.
  constraint monthly_plan_unico unique (client_id, month),
  constraint monthly_plan_listas check (
    jsonb_typeof(goals) = 'array' and jsonb_typeof(objectives) = 'array'
    and jsonb_typeof(improvements) = 'array' and jsonb_typeof(pillars) = 'array'
    and jsonb_typeof(actions) = 'array' and jsonb_typeof(funnel) = 'object'
  )
);

-- Os pilares precisam somar 100% — a regra da ficha. Vale para o rascunho
-- também: um pilar com fatia impossível não melhora por ficar guardado.
create or replace function public.monthly_plan_pilares_somam_100()
returns trigger language plpgsql as $$
declare total numeric;
begin
  if jsonb_array_length(new.pillars) = 0 then
    return new;
  end if;
  select coalesce(sum((p->>'share')::numeric), 0) into total
    from jsonb_array_elements(new.pillars) p;
  if total <> 100 then
    raise exception 'os pilares do planejamento precisam somar 100%% (somam %)', total;
  end if;
  return new;
end
$$;

drop trigger if exists monthly_plan_pilares_somam_100 on public.monthly_plan;
create trigger monthly_plan_pilares_somam_100
  before insert or update of pillars on public.monthly_plan
  for each row execute function public.monthly_plan_pilares_somam_100();

-- 2. Pauta --------------------------------------------------------------------
create table if not exists public.pauta_item (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  date        date not null,
  kind        text not null default 'post' check (kind in ('post','story')),
  title       text not null check (length(btrim(title)) > 0),
  channels    jsonb not null default '[]'::jsonb,
  format      text,
  briefing    text,
  caption     text,
  pillar_id   text,
  funnel      text check (funnel is null or funnel in
                ('descoberta','interesse','conversao','fidelizacao')),
  owner       text,
  status      text not null default 'ideia' check (status in ('ideia','pronta','convertida')),
  -- O card é a outra ponta. ON DELETE SET NULL: apagar o card devolve a pauta
  -- ao planejamento em vez de apagar o planejamento junto.
  post_id     uuid references public.posts(id) on delete set null,
  calendar_id uuid references public.calendars(id) on delete set null,
  series_id   uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint pauta_item_canais_e_lista check (jsonb_typeof(channels) = 'array'),
  -- "Convertida" é o estado de quem tem card. Sem card, é plano.
  constraint pauta_item_convertida_tem_card
    check ((status = 'convertida') = (post_id is not null))
);

create index if not exists pauta_item_mes_idx    on public.pauta_item (client_id, date);
create index if not exists pauta_item_serie_idx  on public.pauta_item (series_id);
create index if not exists pauta_item_post_idx   on public.pauta_item (post_id);

-- Apagar o card não pode deixar a pauta dizendo "convertida" sem card: o
-- ON DELETE SET NULL dispara este gatilho, que devolve o item ao estado
-- "pronta". Sem isto, o check acima recusaria a própria exclusão do card.
create or replace function public.pauta_item_sem_card_volta()
returns trigger language plpgsql as $$
begin
  if new.post_id is null and new.status = 'convertida' then
    new.status := 'pronta';
    new.calendar_id := null;
  end if;
  return new;
end
$$;

drop trigger if exists pauta_item_sem_card_volta on public.pauta_item;
create trigger pauta_item_sem_card_volta
  before update of post_id on public.pauta_item
  for each row execute function public.pauta_item_sem_card_volta();

-- 3. RLS ---------------------------------------------------------------------
-- Planejamento e pauta são internos. O cliente vê o resultado como card, pelo
-- serviço de aprovação da spec 03, e nunca a tabela.
alter table public.monthly_plan enable row level security;
alter table public.pauta_item   enable row level security;

do $$
declare t text;
begin
  foreach t in array array['monthly_plan','pauta_item']
  loop
    execute format('drop policy if exists "admin_all_%1$s" on public.%1$I', t);
    execute format(
      'create policy "admin_all_%1$s" on public.%1$I for all to authenticated using (true) with check (true)',
      t);
    execute format('revoke all on public.%1$I from anon', t);
  end loop;
end
$$;


-- ####################################################################
-- #  supabase/migrations/013_dossie_estrategico.sql
-- ####################################################################

-- ============================================================================
--  Migração 013 — Dossiê estratégico (ficha 16)
--  Aplicar DEPOIS das migrações 001 a 012.
--
--  A crítica da ficha é a razão do desenho: lá as oito seções são fixas no
--  código. Aqui as seções são um MODELO que a agência edita (`dossier_template`),
--  e o dossiê de cada cliente guarda só o conteúdo.
--
--  Cada seção diz quem pode ler. O raio-X de um perfil costuma ser franco, e
--  anotação honesta vale mais que anotação diplomática — então a seção pode
--  ser interna e ficar fora do link do cliente, em vez de o time suavizar o
--  que escreve. Essa separação é feita DENTRO do banco, pela função
--  `public_dossier`: o anon não tem grant na tabela, então a seção interna
--  não sai daqui nem por engano de tela.
-- ============================================================================

create table if not exists public.dossier_template (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) > 0),
  sections   jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dossier_template_secoes_e_lista check (jsonb_typeof(sections) = 'array')
);

create table if not exists public.dossier (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients(id) on delete cascade,
  template_id   uuid not null references public.dossier_template(id) on delete restrict,
  sections      jsonb not null default '[]'::jsonb,
  share_token   text unique,
  share_enabled boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Um dossiê por cliente: dois seriam duas estratégias para a mesma marca.
  constraint dossier_um_por_cliente unique (client_id),
  constraint dossier_secoes_e_lista check (jsonb_typeof(sections) = 'array'),
  -- Link ligado exige token. Sem isto, "ligado" sem endereço é um estado que
  -- promete uma página que não existe.
  constraint dossier_ligado_tem_token check (not share_enabled or share_token is not null)
);

create index if not exists dossier_token_idx on public.dossier (share_token)
  where share_enabled;

-- ── A página pública ---------------------------------------------------------
-- Devolve o cliente, o nome do modelo e APENAS as seções marcadas 'cliente'
-- que têm conteúdo. Seção interna e seção vazia não saem do banco.
create or replace function public.public_dossier(p_token text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_d   public.dossier%rowtype;
  v_t   public.dossier_template%rowtype;
  v_cli public.clients%rowtype;
  v_defs jsonb;
  v_secs jsonb;
begin
  select * into v_d from public.dossier
   where share_token = p_token and share_enabled;
  -- Link pausado é indistinguível de link que nunca existiu.
  if not found then return null; end if;

  select * into v_t   from public.dossier_template where id = v_d.template_id;
  select * into v_cli from public.clients          where id = v_d.client_id;
  if not found then return null; end if;

  -- As seções visíveis, na ordem do modelo.
  with modelo as (
    select d.value as def, d.ordinality as pos
      from jsonb_array_elements(v_t.sections) with ordinality as d(value, ordinality)
  ), conteudo as (
    select s.value as sec
      from jsonb_array_elements(v_d.sections) as s(value)
  ), visiveis as (
    select m.def, c.sec, m.pos
      from modelo m
      join conteudo c on c.sec->>'sectionId' = m.def->>'id'
     where coalesce(c.sec->>'visibility', m.def->>'defaultVisibility') = 'cliente'
       and (
         length(btrim(coalesce(c.sec->>'text',''))) > 0
         or coalesce(jsonb_array_length(c.sec->'list'), 0) > 0
         or coalesce(jsonb_array_length(c.sec->'images'), 0) > 0
         or coalesce(jsonb_array_length(c.sec->'rows'), 0) > 0
         or exists (
           select 1 from jsonb_each_text(coalesce(c.sec->'values','{}'::jsonb)) v
            where length(btrim(v.value)) > 0
         )
       )
  )
  select coalesce(jsonb_agg(def order by pos), '[]'::jsonb),
         coalesce(jsonb_agg(sec order by pos), '[]'::jsonb)
    into v_defs, v_secs
    from visiveis;

  return jsonb_build_object(
    'client', jsonb_build_object(
      'name', v_cli.name, 'logoUrl', v_cli.logo_url, 'color', v_cli.color),
    'template', jsonb_build_object('name', v_t.name, 'sections', v_defs),
    'sections', v_secs
  );
end;
$$;

-- ── RLS e grants -------------------------------------------------------------
alter table public.dossier_template enable row level security;
alter table public.dossier          enable row level security;

do $$
declare t text;
begin
  foreach t in array array['dossier_template','dossier']
  loop
    execute format('drop policy if exists "admin_all_%1$s" on public.%1$I', t);
    execute format(
      'create policy "admin_all_%1$s" on public.%1$I for all to authenticated using (true) with check (true)',
      t);
    -- O anon NUNCA toca nestas tabelas. O único caminho é a função acima.
    execute format('revoke all on public.%1$I from anon', t);
  end loop;
end
$$;

revoke all on function public.public_dossier(text) from public;
grant execute on function public.public_dossier(text) to anon, authenticated;


-- ####################################################################
-- #  supabase/migrations/014_projetos_squads.sql
-- ####################################################################

-- ============================================================================
--  Migração 014 — Projetos e squads (ficha 14)
--  Aplicar DEPOIS das migrações 001 a 013.
--
--  O projeto é duas coisas ao mesmo tempo: o agrupamento do trabalho de um
--  cliente com prazo e valor, e o CENTRO DE CUSTO por onde o financeiro
--  responde "este projeto deu lucro?". Por isso `posts` e `finance_entry`
--  apontam para ele — e por isso os dois apontam com ON DELETE SET NULL:
--  apagar um centro de custo não pode apagar o trabalho nem os custos.
--
--  Os pesos do health score ficam em `agency_settings`, como dado. A crítica
--  da ficha é que as fórmulas nunca são explicadas a quem lê o número; aqui
--  elas estão em src/calendar-app/projects.ts, os pesos são editáveis e a
--  tela imprime a conta ao lado do número.
-- ============================================================================

create table if not exists public.squad (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) > 0),
  description text,
  color       text,
  icon        text,
  -- Nomes, não logins: este app tem uma conta só (ver ficha 01 / F00).
  lead        text,
  members     jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint squad_membros_e_lista check (jsonb_typeof(members) = 'array')
);

create table if not exists public.project (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) > 0),
  client_id   uuid not null references public.clients(id) on delete cascade,
  -- Excluir o squad deixa os projetos sem squad; não os apaga (ficha 14).
  squad_id    uuid references public.squad(id) on delete set null,
  service_id  uuid references public.service(id) on delete set null,
  due_date    date,
  value_cents bigint not null default 0 check (value_cents >= 0),
  status      text not null default 'ativo'
                check (status in ('ativo','pausado','concluido','cancelado')),
  color       text,
  -- Um contrato, um projeto: é esta restrição que faz o passo do orquestrador
  -- ser idempotente. Reprocessar o mesmo contrato não abre um segundo projeto.
  contract_id uuid unique references public.contract(id) on delete set null,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists project_cliente_idx on public.project (client_id);
create index if not exists project_squad_idx   on public.project (squad_id);

alter table public.posts
  add column if not exists project_id uuid references public.project(id) on delete set null;
alter table public.finance_entry
  add column if not exists project_id uuid references public.project(id) on delete set null;
-- A série também carrega o centro de custo, senão a cobrança recorrente de um
-- projeto nasce órfã todo mês.
alter table public.finance_series
  add column if not exists project_id uuid references public.project(id) on delete set null;
create index if not exists posts_project_idx         on public.posts (project_id);
create index if not exists finance_entry_project_idx on public.finance_entry (project_id);

-- Configuração da agência: linha única, para os pesos do health score.
create table if not exists public.agency_settings (
  id             int primary key default 1 check (id = 1),
  health_weights jsonb not null default '{"prazo":40,"progresso":40,"entrega":20}'::jsonb,
  updated_at     timestamptz not null default now()
);

-- Os pesos precisam somar 100: um score "sobre 100" feito de pesos que somam
-- 130 é um número que mente sem avisar.
create or replace function public.agency_settings_pesos_somam_100()
returns trigger language plpgsql as $$
declare total numeric;
begin
  select coalesce((new.health_weights->>'prazo')::numeric, 0)
       + coalesce((new.health_weights->>'progresso')::numeric, 0)
       + coalesce((new.health_weights->>'entrega')::numeric, 0)
    into total;
  if total <> 100 then
    raise exception 'os pesos do health score precisam somar 100 (somam %)', total;
  end if;
  return new;
end
$$;

drop trigger if exists agency_settings_pesos_somam_100 on public.agency_settings;
create trigger agency_settings_pesos_somam_100
  before insert or update of health_weights on public.agency_settings
  for each row execute function public.agency_settings_pesos_somam_100();

-- RLS: tudo interno.
alter table public.squad            enable row level security;
alter table public.project          enable row level security;
alter table public.agency_settings  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['squad','project','agency_settings']
  loop
    execute format('drop policy if exists "admin_all_%1$s" on public.%1$I', t);
    execute format(
      'create policy "admin_all_%1$s" on public.%1$I for all to authenticated using (true) with check (true)',
      t);
    execute format('revoke all on public.%1$I from anon', t);
  end loop;
end
$$;


-- ####################################################################
-- #  supabase/migrations/015_conciliacao_extrato.sql
-- ####################################################################

-- ============================================================================
--  Migração 015 — Conciliação de extrato (ficha 13, item F13b)
--  Aplicar DEPOIS das migrações 001 a 014.
--
--  Duas regras da ficha moldam a tabela:
--    • O sistema SUGERE, nunca decide. Dois lançamentos de mesmo valor são
--      escolha de gente. Por isso a ligação é uma coluna comum, preenchida
--      por ação explícita, e não um vínculo calculado.
--    • Conciliação confirmada dá baixa NA DATA DO BANCO. O banco é o fato.
--
--  `settled_entry` guarda se foi a conciliação que deu a baixa. É o que faz
--  o desfazer ser seguro: conciliação nunca desfaz baixa feita por pessoa.
-- ============================================================================

-- O extrato também cria lançamento: 'extrato' entra na lista de origens.
alter table public.finance_entry drop constraint if exists finance_entry_origin_check;
alter table public.finance_entry
  add constraint finance_entry_origin_check
  check (origin in ('manual','serie','contrato','extrato'));

create table if not exists public.statement_line (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references public.finance_account(id) on delete cascade,
  -- Identidade da transação: o id do banco (FITID) ou data+valor+texto.
  key           text not null,
  date          date not null,
  description   text not null default '',
  -- Com sinal: negativo é dinheiro saindo. O sinal do banco é guardado como
  -- o banco o escreveu, e não traduzido para natureza na importação.
  amount_cents  bigint not null check (amount_cents <> 0),
  status        text not null default 'a_conferir'
                  check (status in ('a_conferir','conferida','ignorada')),
  entry_id      uuid references public.finance_entry(id) on delete set null,
  settled_entry boolean,
  reconciled_at timestamptz,
  created_at    timestamptz not null default now(),
  -- Importar o mesmo arquivo duas vezes é coisa que todo mundo faz: tem de
  -- ser chato, não destrutivo.
  constraint statement_line_unica unique (account_id, key),
  -- Linha conferida tem lançamento; linha ignorada não tem.
  constraint statement_line_conferida_tem_lancamento
    check ((status = 'conferida') = (entry_id is not null))
);

create index if not exists statement_line_conta_idx  on public.statement_line (account_id, date desc);
create index if not exists statement_line_status_idx on public.statement_line (status);
create index if not exists statement_line_entry_idx  on public.statement_line (entry_id);

-- Apagar o lançamento solta a linha (ON DELETE SET NULL) — e então ela não
-- pode continuar dizendo "conferida": volta a "a conferir", para aparecer de
-- novo na fila de quem concilia.
create or replace function public.statement_line_sem_lancamento_volta()
returns trigger language plpgsql as $$
begin
  if new.entry_id is null and new.status = 'conferida' then
    new.status := 'a_conferir';
    new.settled_entry := null;
    new.reconciled_at := null;
  end if;
  return new;
end
$$;

drop trigger if exists statement_line_sem_lancamento_volta on public.statement_line;
create trigger statement_line_sem_lancamento_volta
  before update of entry_id on public.statement_line
  for each row execute function public.statement_line_sem_lancamento_volta();

alter table public.statement_line enable row level security;
drop policy if exists "admin_all_statement_line" on public.statement_line;
create policy "admin_all_statement_line" on public.statement_line
  for all to authenticated using (true) with check (true);
revoke all on public.statement_line from anon;


-- ####################################################################
-- #  supabase/migrations/016_formularios_briefing.sql
-- ####################################################################

-- ============================================================================
--  Migração 016 — Formulários de briefing (ficha 17, item F17b)
--  Aplicar DEPOIS das migrações 001 a 015.
--
--  As regras que importam aqui são sobre histórico, não sobre widgets:
--    • Editar o formulário não encosta nas respostas já dadas. Por isso as
--      perguntas são jsonb no formulário e as respostas guardam o id da
--      pergunta: mudar o enunciado não reescreve o que alguém respondeu.
--    • Tirar uma pergunta não apaga o que responderam a ela. A resposta
--      continua guardada e aparece no resumo como "pergunta removida" —
--      alguém respondeu aquilo, e fingir que não é mentira que a agência
--      conta para si mesma.
--    • Apagar o formulário leva as respostas (ON DELETE CASCADE): é a regra
--      da ficha, e a tela avisa antes.
--    • Link novo invalida o antigo — é para isso que serve "gerar link novo".
-- ============================================================================

create table if not exists public.briefing_form (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(btrim(title)) > 0),
  description text,
  client_id   uuid references public.clients(id) on delete set null,
  questions   jsonb not null default '[]'::jsonb,
  status      text not null default 'ativo' check (status in ('ativo','pausado')),
  share_token text not null unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint briefing_form_perguntas_e_lista check (jsonb_typeof(questions) = 'array')
);

create index if not exists briefing_form_token_idx on public.briefing_form (share_token)
  where status = 'ativo';

create table if not exists public.form_response (
  id         uuid primary key default gen_random_uuid(),
  form_id    uuid not null references public.briefing_form(id) on delete cascade,
  answers    jsonb not null default '{}'::jsonb,
  respondent text,
  at         timestamptz not null default now(),
  constraint form_response_respostas_e_objeto check (jsonb_typeof(answers) = 'object')
);

create index if not exists form_response_form_idx on public.form_response (form_id, at desc);

-- ── A página pública ---------------------------------------------------------
-- Devolve o formulário SEM as respostas de ninguém. Quem responde não vê o
-- que os outros responderam, e o anon não tem grant em tabela alguma.
create or replace function public.public_form(p_token text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare v_f public.briefing_form%rowtype;
begin
  select * into v_f from public.briefing_form
   where share_token = p_token and status = 'ativo';
  -- Formulário pausado é indistinguível de formulário que não existe.
  if not found then return null; end if;
  return jsonb_build_object(
    'id', v_f.id,
    'title', v_f.title,
    'description', v_f.description,
    'questions', v_f.questions
  );
end;
$$;

-- Registra uma resposta. A validação fina é da aplicação; aqui ficam as duas
-- garantias que o banco pode dar sozinho: o formulário existe e está ativo, e
-- a resposta é um objeto.
create or replace function public.public_submit_form(
  p_token      text,
  p_answers    jsonb,
  p_respondent text default null
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare v_f public.briefing_form%rowtype;
begin
  select * into v_f from public.briefing_form
   where share_token = p_token and status = 'ativo';
  if not found then
    raise exception 'Formulário indisponível.';
  end if;
  if jsonb_typeof(coalesce(p_answers, 'null'::jsonb)) <> 'object' then
    raise exception 'Resposta inválida.';
  end if;
  insert into public.form_response (form_id, answers, respondent)
    values (v_f.id, p_answers, nullif(btrim(coalesce(p_respondent, '')), ''));
end;
$$;

-- ── RLS e grants -------------------------------------------------------------
alter table public.briefing_form enable row level security;
alter table public.form_response enable row level security;

do $$
declare t text;
begin
  foreach t in array array['briefing_form','form_response']
  loop
    execute format('drop policy if exists "admin_all_%1$s" on public.%1$I', t);
    execute format(
      'create policy "admin_all_%1$s" on public.%1$I for all to authenticated using (true) with check (true)',
      t);
    execute format('revoke all on public.%1$I from anon', t);
  end loop;
end
$$;

revoke all on function public.public_form(text) from public;
revoke all on function public.public_submit_form(text, jsonb, text) from public;
grant execute on function public.public_form(text) to anon, authenticated;
grant execute on function public.public_submit_form(text, jsonb, text) to anon, authenticated;


-- ####################################################################
-- #  supabase/migrations/017_roteiros.sql
-- ####################################################################

-- ============================================================================
--  Migração 017 — Roteiros de vídeo e de stories (ficha 17, item F17c)
--  Aplicar DEPOIS das migrações 001 a 016.
--
--  A crítica da ficha pede UM serviço de aprovação externa para todos os
--  artefatos, em vez de um fluxo por ferramenta. É isso que decide o
--  desenho: o roteiro pertence a um card, e quem vai ao cliente é o card.
--  Não existe link de aprovação do roteiro, não existe segunda decisão para
--  perseguir, e as observações internas de cena não saem da agência — nada
--  do roteiro atravessa para a visão pública.
--
--  `version` é trava otimista: duas pessoas no mesmo roteiro é normal numa
--  agência; sobrescrever uma delas em silêncio não é.
-- ============================================================================

create table if not exists public.script (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  kind       text not null check (kind in ('video','stories')),
  title      text not null check (length(btrim(title)) > 0),
  goal       text,
  audience   text,
  tone       text,
  cta        text,
  hashtags   text,
  caption    text,
  scenes     jsonb not null default '[]'::jsonb,
  fields     jsonb not null default '[]'::jsonb,
  status     text not null default 'rascunho'
               check (status in ('rascunho','em_revisao','aprovado')),
  version    int not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint script_cenas_e_lista  check (jsonb_typeof(scenes) = 'array'),
  constraint script_campos_e_lista check (jsonb_typeof(fields) = 'array'),
  -- Os tetos da ficha: 60 cenas de vídeo, 40 telas de stories.
  constraint script_teto_de_cenas check (
    jsonb_array_length(scenes) <= case when kind = 'stories' then 40 else 60 end
  )
);

create index if not exists script_post_idx on public.script (post_id);

-- Trava otimista no banco: salvar por cima de uma versão mais nova é
-- recusado aqui também, não só na aplicação. Duas abas abertas é o caso
-- comum, e a segunda não pode apagar o trabalho da primeira.
create or replace function public.script_versao_mais_nova()
returns trigger language plpgsql as $$
begin
  if new.version <= old.version then
    raise exception 'Alguém salvou este roteiro enquanto você editava (versão % no banco, % enviada).',
      old.version, new.version;
  end if;
  return new;
end
$$;

drop trigger if exists script_versao_mais_nova on public.script;
create trigger script_versao_mais_nova
  before update on public.script
  for each row execute function public.script_versao_mais_nova();

alter table public.script enable row level security;
drop policy if exists "admin_all_script" on public.script;
create policy "admin_all_script" on public.script
  for all to authenticated using (true) with check (true);
-- Roteiro é interno: o anon não tem nada aqui, nem pela função pública do
-- calendário, que lista coluna por coluna.
revoke all on public.script from anon;


-- ####################################################################
-- #  supabase/migrations/018_webhooks.sql
-- ####################################################################

-- ============================================================================
--  Migração 018 — Webhooks de saída (ficha 22, item F22)
--  Aplicar DEPOIS das migrações 001 a 017.
--
--  Decisões que fazem a diferença entre um webhook confiável e um enfeite:
--
--  • QUEM DECIDE O QUE ACONTECEU É O BANCO, não o navegador. As entregas são
--    enfileiradas por gatilhos nas próprias tabelas, então o evento dispara
--    venha a mudança deste app, do link público do cliente ou de alguém
--    editando a linha na mão.
--  • O payload leva ids e fatos, nunca texto interno. Nada de
--    `internal_notes`, e-mail do cliente ou comentário de card. Quem recebe
--    pergunta à API o que tiver direito de ver.
--  • `webhook_delivery` é fila e histórico ao mesmo tempo: a entrega é
--    inserida pendente e o entregador (Edge Function) atualiza o resultado.
--
--  ATENÇÃO: enfileirar é o que esta migração faz. ENTREGAR depende da Edge
--  Function `dispatch-webhooks` estar publicada e agendada — sem isso a fila
--  cresce e nada sai. A tela diz isso em português.
-- ============================================================================

create table if not exists public.webhook_subscription (
  id          uuid primary key default gen_random_uuid(),
  url         text not null check (url ~* '^https://'),
  events      jsonb not null default '[]'::jsonb,
  -- O segredo assina cada entrega. Fica aqui e não sai para anon nenhum.
  secret      text not null check (length(secret) >= 16),
  active      boolean not null default true,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint webhook_eventos_e_lista check (jsonb_typeof(events) = 'array')
);

create table if not exists public.webhook_delivery (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.webhook_subscription(id) on delete cascade,
  event           text not null,
  payload         jsonb not null,
  status          text not null default 'pendente'
                    check (status in ('pendente','entregue','falhou')),
  attempts        int not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz default now(),
  response_status int,
  error           text,
  delivered_at    timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists webhook_delivery_fila_idx
  on public.webhook_delivery (next_attempt_at)
  where status = 'pendente';
create index if not exists webhook_delivery_sub_idx
  on public.webhook_delivery (subscription_id, created_at desc);

-- ── O enfileirador ------------------------------------------------------------
create or replace function public.enqueue_webhook(p_event text, p_data jsonb)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.webhook_delivery (subscription_id, event, payload)
  select s.id, p_event,
         jsonb_build_object(
           'id', gen_random_uuid(),
           'event', p_event,
           'at', now(),
           'data', p_data)
    from public.webhook_subscription s
   where s.active and s.events ? p_event;
end;
$$;

-- ── Gatilhos por evento --------------------------------------------------------
-- Post: aprovado / ajuste pedido vêm da última decisão do cliente; publicado,
-- da mudança de status. O payload leva id, calendário e data — nunca a
-- legenda, nunca as notas internas.
create or replace function public.webhook_post_eventos()
returns trigger language plpgsql as $$
declare
  v_old jsonb := coalesce(old.approval->'decisions', '[]'::jsonb);
  v_new jsonb := coalesce(new.approval->'decisions', '[]'::jsonb);
  v_last jsonb;
begin
  if jsonb_array_length(v_new) > jsonb_array_length(v_old) then
    v_last := v_new -> (jsonb_array_length(v_new) - 1);
    if v_last->>'result' = 'approved' then
      perform public.enqueue_webhook('post.aprovado', jsonb_build_object(
        'postId', new.id, 'calendarId', new.calendar_id, 'date', new.date));
    elsif v_last->>'result' = 'changes' then
      perform public.enqueue_webhook('post.ajuste_pedido', jsonb_build_object(
        'postId', new.id, 'calendarId', new.calendar_id, 'date', new.date));
    end if;
  end if;

  if new.status = 'published' and old.status is distinct from 'published' then
    perform public.enqueue_webhook('post.publicado', jsonb_build_object(
      'postId', new.id, 'calendarId', new.calendar_id, 'date', new.date));
  end if;
  return new;
end;
$$;

drop trigger if exists webhook_post_eventos on public.posts;
create trigger webhook_post_eventos after update on public.posts
  for each row execute function public.webhook_post_eventos();

create or replace function public.webhook_proposta_aceita()
returns trigger language plpgsql as $$
begin
  if new.status = 'aceita' and old.status is distinct from 'aceita' then
    perform public.enqueue_webhook('proposta.aceita', jsonb_build_object(
      'proposalId', new.id, 'clientId', new.client_id, 'number', new.number));
  end if;
  return new;
end;
$$;

drop trigger if exists webhook_proposta_aceita on public.proposal;
create trigger webhook_proposta_aceita after update on public.proposal
  for each row execute function public.webhook_proposta_aceita();

create or replace function public.webhook_contrato_assinado()
returns trigger language plpgsql as $$
begin
  if new.effective_at is not null and old.effective_at is null then
    perform public.enqueue_webhook('contrato.assinado', jsonb_build_object(
      'contractId', new.id, 'clientId', new.client_id, 'effectiveAt', new.effective_at));
  end if;
  return new;
end;
$$;

drop trigger if exists webhook_contrato_assinado on public.contract;
create trigger webhook_contrato_assinado after update on public.contract
  for each row execute function public.webhook_contrato_assinado();

create or replace function public.webhook_financeiro_liquidado()
returns trigger language plpgsql as $$
begin
  if new.status = 'liquidado' and old.status is distinct from 'liquidado' then
    perform public.enqueue_webhook('financeiro.liquidado', jsonb_build_object(
      'entryId', new.id, 'nature', new.nature, 'amountCents', new.amount_cents,
      'settledAt', new.settled_at, 'clientId', new.client_id, 'projectId', new.project_id));
  end if;
  return new;
end;
$$;

drop trigger if exists webhook_financeiro_liquidado on public.finance_entry;
create trigger webhook_financeiro_liquidado after update on public.finance_entry
  for each row execute function public.webhook_financeiro_liquidado();

-- Agendamento: a reserva nasce pelo link público, então o gatilho é de
-- inserção. Leva horário e duração; não leva nome, e-mail nem telefone de
-- quem marcou — isso é dado pessoal e o webhook não é lugar dele.
create or replace function public.webhook_agendamento_criado()
returns trigger language plpgsql as $$
begin
  perform public.enqueue_webhook('agendamento.criado', jsonb_build_object(
    'bookingId', new.id, 'startsAt', new.starts_at, 'endsAt', new.ends_at));
  return new;
end;
$$;

drop trigger if exists webhook_agendamento_criado on public.booking;
create trigger webhook_agendamento_criado after insert on public.booking
  for each row execute function public.webhook_agendamento_criado();

-- ── RLS e grants ---------------------------------------------------------------
alter table public.webhook_subscription enable row level security;
alter table public.webhook_delivery     enable row level security;

do $$
declare t text;
begin
  foreach t in array array['webhook_subscription','webhook_delivery']
  loop
    execute format('drop policy if exists "admin_all_%1$s" on public.%1$I', t);
    execute format(
      'create policy "admin_all_%1$s" on public.%1$I for all to authenticated using (true) with check (true)',
      t);
    execute format('revoke all on public.%1$I from anon', t);
  end loop;
end
$$;

-- O enfileirador NÃO pode ser chamável por anon: quem pudesse chamá-lo
-- forjaria eventos — "contrato assinado" que nunca foi assinado — já
-- assinados com o nosso segredo. O anon nunca precisa dele: toda ação
-- anônima (o cliente aprovando pelo link, a reserva pública) passa por
-- função SECURITY DEFINER, e dentro dela o usuário corrente é o dono, não
-- o anon. A equipe autenticada, essa sim, chama pelos gatilhos ao editar.
revoke all on function public.enqueue_webhook(text, jsonb) from public, anon;
grant execute on function public.enqueue_webhook(text, jsonb) to authenticated, service_role;


-- ####################################################################
-- #  supabase/migrations/019_analise_perfil.sql
-- ####################################################################

-- ============================================================================
--  Migração 019 — Análise de perfil e de concorrência (ficha 17, item F17d)
--  Aplicar DEPOIS das migrações 001 a 018.
--
--  A ficha elogia uma coisa do original — perguntas e pesos como dado
--  configurável — e deixa dois problemas: as faixas que transformam nota em
--  veredito não são documentadas, e a análise vive separada da estratégia do
--  cliente. Os dois foram tratados: as faixas são editáveis e aparecem ao
--  lado do número, e a análise concluída é levada para as seções do dossiê,
--  em vez de virar uma segunda verdade divergente.
--
--  A nota é média ponderada de notas 0–5, normalizada para 0–100. Critério
--  não avaliado fica FORA da média, em vez de valer zero: não ter olhado não
--  é a mesma coisa que estar ruim.
-- ============================================================================

create table if not exists public.assessment_template (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) > 0),
  questions  jsonb not null default '[]'::jsonb,
  bands      jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_template_listas check (
    jsonb_typeof(questions) = 'array' and jsonb_typeof(bands) = 'array'
  )
);

create table if not exists public.assessment (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  template_id  uuid not null references public.assessment_template(id) on delete restrict,
  title        text not null check (length(btrim(title)) > 0),
  subjects     jsonb not null default '[]'::jsonb,
  scores       jsonb not null default '{}'::jsonb,
  conclusions  text,
  status       text not null default 'em_andamento'
                 check (status in ('em_andamento','concluida')),
  concluded_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint assessment_sujeitos_e_lista check (jsonb_typeof(subjects) = 'array'),
  constraint assessment_notas_e_objeto  check (jsonb_typeof(scores) = 'object'),
  -- Até 3 concorrentes mais o próprio cliente: comparação com mais do que
  -- isso ninguém lê, e a tela já diz isso.
  constraint assessment_ate_quatro_perfis check (jsonb_array_length(subjects) <= 4)
);

create index if not exists assessment_cliente_idx on public.assessment (client_id, created_at desc);

-- Nota fora de 0–5 não entra. É a garantia que o banco consegue dar sozinho
-- sobre um jsonb de notas, e evita que uma régua errada em uma tela vire
-- média errada em todas as outras.
create or replace function public.assessment_notas_validas()
returns trigger language plpgsql as $$
declare v_nota numeric;
begin
  for v_nota in
    select nota.valor::numeric
      from jsonb_each(new.scores) as sujeito(perfil, notas),
           jsonb_each_text(sujeito.notas) as nota(criterio, valor)
  loop
    if v_nota < 0 or v_nota > 5 then
      raise exception 'As notas da análise vão de 0 a 5 (recebi %).', v_nota;
    end if;
  end loop;
  return new;
end
$$;

drop trigger if exists assessment_notas_validas on public.assessment;
create trigger assessment_notas_validas
  before insert or update of scores on public.assessment
  for each row execute function public.assessment_notas_validas();

alter table public.assessment_template enable row level security;
alter table public.assessment          enable row level security;

do $$
declare t text;
begin
  foreach t in array array['assessment_template','assessment']
  loop
    execute format('drop policy if exists "admin_all_%1$s" on public.%1$I', t);
    execute format(
      'create policy "admin_all_%1$s" on public.%1$I for all to authenticated using (true) with check (true)',
      t);
    -- Diagnóstico franco é interno. O que vai ao cliente é o dossiê, e lá a
    -- seção tem visibilidade própria.
    execute format('revoke all on public.%1$I from anon', t);
  end loop;
end
$$;
