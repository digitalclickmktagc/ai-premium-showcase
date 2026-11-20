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
