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
