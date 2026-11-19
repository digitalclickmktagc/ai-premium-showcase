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
