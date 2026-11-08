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
