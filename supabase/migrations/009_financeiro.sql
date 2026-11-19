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
