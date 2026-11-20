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
