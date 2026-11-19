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
