-- ============================================================================
--  Migração 020 — Assistente de IA (ficha 22, com a crítica dela corrigida)
--  Aplicar DEPOIS das migrações 001 a 019.
--
--  A ficha descreve um assistente que "conhece os guias do sistema". A
--  avaliação da própria ficha diz que isso vale pouco: o que ajuda de verdade
--  é a IA olhando os dados reais da agência. É esse o assistente aqui.
--
--  Três decisões ficam gravadas no banco, não só na tela:
--
--   1. Vem DESLIGADO. Ligar é uma escolha de quem administra, feita uma vez,
--      e registrada em ai_settings.
--   2. A IA nunca grava. Não há nenhum caminho deste arquivo que escreva em
--      post, pauta, roteiro ou financeiro. O que ela devolve é texto que uma
--      pessoa lê e aplica com um clique, na tela.
--   3. Toda chamada fica registrada, e o registro não se edita nem se apaga.
--      Quem pagou a conta consegue ver o que foi gasto e em quê.
--
--  A chave da API NÃO mora aqui. Ela fica no segredo da Edge Function
--  (ANTHROPIC_API_KEY), fora do alcance do navegador e deste banco.
-- ============================================================================

-- 1. Configuração (uma linha só) ---------------------------------------------
create table if not exists public.ai_settings (
  id          integer primary key default 1 check (id = 1),
  enabled     boolean not null default false,
  model       text    not null default 'claude-opus-5-5'
                check (length(btrim(model)) > 0),
  effort      text    not null default 'medium'
                check (effort in ('low','medium','high')),
  -- Teto de chamadas por dia, para a conta não fugir do controle.
  daily_limit integer not null default 100 check (daily_limit between 1 and 10000),
  -- Quais ações o administrador liberou. Lista vazia = todas as do catálogo.
  allowed     jsonb   not null default '[]'::jsonb
                check (jsonb_typeof(allowed) = 'array'),
  updated_at  timestamptz not null default now()
);

insert into public.ai_settings (id) values (1) on conflict (id) do nothing;

-- 2. Registro das chamadas (somente inserção) --------------------------------
create table if not exists public.ai_call (
  id            uuid primary key default gen_random_uuid(),
  at            timestamptz not null default now(),
  -- Quem pediu, lido do token pela Edge Function. Sem chave estrangeira
  -- para auth.users de propósito: nenhuma outra tabela deste schema amarra
  -- em auth, e apagar um usuário não pode derrubar o histórico de custo.
  user_id       uuid,
  action        text not null check (length(btrim(action)) > 0),
  client_id     uuid references public.clients(id) on delete set null,
  model         text,
  input_tokens  integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  ok            boolean not null default true,
  -- Mensagem de erro quando deu errado. Nunca o conteúdo enviado: o registro
  -- serve para contar e diagnosticar, não para guardar uma segunda cópia dos
  -- dados do cliente.
  error         text
);
create index if not exists ai_call_dia_idx on public.ai_call (at desc);
create index if not exists ai_call_acao_idx on public.ai_call (action, at desc);

create or replace function public.ai_call_somente_insercao()
returns trigger language plpgsql as $$
begin
  raise exception 'O registro de uso da IA não se edita nem se apaga.';
end;
$$;
drop trigger if exists ai_call_imutavel on public.ai_call;
create trigger ai_call_imutavel before update or delete on public.ai_call
  for each row execute function public.ai_call_somente_insercao();

-- 3. A pergunta que a Edge Function faz antes de gastar ----------------------
--  Devolve se pode chamar, e por que não quando não pode. Roda como dono para
--  conseguir ler a configuração e contar o dia mesmo com RLS ligado.
create or replace function public.ai_pode_chamar(p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cfg   public.ai_settings;
  usado integer;
begin
  select * into cfg from public.ai_settings where id = 1;

  if cfg is null or not cfg.enabled then
    return jsonb_build_object('ok', false, 'reason', 'desligado');
  end if;

  if jsonb_array_length(cfg.allowed) > 0
     and not (cfg.allowed ? p_action) then
    return jsonb_build_object('ok', false, 'reason', 'acao_nao_liberada');
  end if;

  select count(*) into usado
    from public.ai_call
   where ok and at >= date_trunc('day', now());

  if usado >= cfg.daily_limit then
    return jsonb_build_object('ok', false, 'reason', 'limite_diario',
                              'limite', cfg.daily_limit);
  end if;

  return jsonb_build_object('ok', true, 'model', cfg.model, 'effort', cfg.effort,
                            'restantes', cfg.daily_limit - usado);
end
$$;

-- 4. Quem enxerga o quê ------------------------------------------------------
alter table public.ai_settings enable row level security;
alter table public.ai_call     enable row level security;

drop policy if exists "admin_all_ai_settings" on public.ai_settings;
create policy "admin_all_ai_settings" on public.ai_settings
  for all to authenticated using (true) with check (true);

drop policy if exists "admin_read_ai_call" on public.ai_call;
create policy "admin_read_ai_call" on public.ai_call
  for select to authenticated using (true);

drop policy if exists "admin_insert_ai_call" on public.ai_call;
create policy "admin_insert_ai_call" on public.ai_call
  for insert to authenticated with check (true);

-- O visitante de um link público não tem nada que ver aqui, e muito menos
-- gastar a conta de ninguém.
revoke all on public.ai_settings from anon;
revoke all on public.ai_call     from anon;
revoke all on function public.ai_pode_chamar(text) from public, anon;
grant execute on function public.ai_pode_chamar(text) to authenticated, service_role;
