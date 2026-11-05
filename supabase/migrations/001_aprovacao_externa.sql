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
