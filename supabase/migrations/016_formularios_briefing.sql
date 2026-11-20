-- ============================================================================
--  Migração 016 — Formulários de briefing (ficha 17, item F17b)
--  Aplicar DEPOIS das migrações 001 a 015.
--
--  As regras que importam aqui são sobre histórico, não sobre widgets:
--    • Editar o formulário não encosta nas respostas já dadas. Por isso as
--      perguntas são jsonb no formulário e as respostas guardam o id da
--      pergunta: mudar o enunciado não reescreve o que alguém respondeu.
--    • Tirar uma pergunta não apaga o que responderam a ela. A resposta
--      continua guardada e aparece no resumo como "pergunta removida" —
--      alguém respondeu aquilo, e fingir que não é mentira que a agência
--      conta para si mesma.
--    • Apagar o formulário leva as respostas (ON DELETE CASCADE): é a regra
--      da ficha, e a tela avisa antes.
--    • Link novo invalida o antigo — é para isso que serve "gerar link novo".
-- ============================================================================

create table if not exists public.briefing_form (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(btrim(title)) > 0),
  description text,
  client_id   uuid references public.clients(id) on delete set null,
  questions   jsonb not null default '[]'::jsonb,
  status      text not null default 'ativo' check (status in ('ativo','pausado')),
  share_token text not null unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint briefing_form_perguntas_e_lista check (jsonb_typeof(questions) = 'array')
);

create index if not exists briefing_form_token_idx on public.briefing_form (share_token)
  where status = 'ativo';

create table if not exists public.form_response (
  id         uuid primary key default gen_random_uuid(),
  form_id    uuid not null references public.briefing_form(id) on delete cascade,
  answers    jsonb not null default '{}'::jsonb,
  respondent text,
  at         timestamptz not null default now(),
  constraint form_response_respostas_e_objeto check (jsonb_typeof(answers) = 'object')
);

create index if not exists form_response_form_idx on public.form_response (form_id, at desc);

-- ── A página pública ---------------------------------------------------------
-- Devolve o formulário SEM as respostas de ninguém. Quem responde não vê o
-- que os outros responderam, e o anon não tem grant em tabela alguma.
create or replace function public.public_form(p_token text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare v_f public.briefing_form%rowtype;
begin
  select * into v_f from public.briefing_form
   where share_token = p_token and status = 'ativo';
  -- Formulário pausado é indistinguível de formulário que não existe.
  if not found then return null; end if;
  return jsonb_build_object(
    'id', v_f.id,
    'title', v_f.title,
    'description', v_f.description,
    'questions', v_f.questions
  );
end;
$$;

-- Registra uma resposta. A validação fina é da aplicação; aqui ficam as duas
-- garantias que o banco pode dar sozinho: o formulário existe e está ativo, e
-- a resposta é um objeto.
create or replace function public.public_submit_form(
  p_token      text,
  p_answers    jsonb,
  p_respondent text default null
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare v_f public.briefing_form%rowtype;
begin
  select * into v_f from public.briefing_form
   where share_token = p_token and status = 'ativo';
  if not found then
    raise exception 'Formulário indisponível.';
  end if;
  if jsonb_typeof(coalesce(p_answers, 'null'::jsonb)) <> 'object' then
    raise exception 'Resposta inválida.';
  end if;
  insert into public.form_response (form_id, answers, respondent)
    values (v_f.id, p_answers, nullif(btrim(coalesce(p_respondent, '')), ''));
end;
$$;

-- ── RLS e grants -------------------------------------------------------------
alter table public.briefing_form enable row level security;
alter table public.form_response enable row level security;

do $$
declare t text;
begin
  foreach t in array array['briefing_form','form_response']
  loop
    execute format('drop policy if exists "admin_all_%1$s" on public.%1$I', t);
    execute format(
      'create policy "admin_all_%1$s" on public.%1$I for all to authenticated using (true) with check (true)',
      t);
    execute format('revoke all on public.%1$I from anon', t);
  end loop;
end
$$;

revoke all on function public.public_form(text) from public;
revoke all on function public.public_submit_form(text, jsonb, text) from public;
grant execute on function public.public_form(text) to anon, authenticated;
grant execute on function public.public_submit_form(text, jsonb, text) to anon, authenticated;
