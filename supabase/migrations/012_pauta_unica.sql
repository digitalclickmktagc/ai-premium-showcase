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
