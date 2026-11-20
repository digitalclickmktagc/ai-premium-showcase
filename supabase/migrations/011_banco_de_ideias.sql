-- ============================================================================
--  Migração 011 — Banco de ideias de pauta (ficha 08)
--  Aplicar DEPOIS das migrações 001 a 010.
--
--  A ideia é capturada em uma linha só; `#etiquetas`, `@menções` e o formato
--  saem do próprio texto. A aplicação faz essa leitura (src/calendar-app/
--  ideas.ts) e grava o resultado aqui, para que filtrar por etiqueta seja uma
--  consulta e não uma varredura de texto.
--
--  O elo com o card é guardado dos dois lados — `idea.used_by` e
--  `posts.idea_id`. É a correção da crítica da ficha: no sistema de origem,
--  a ideia que virou card não deixava rastro de onde foi parar.
-- ============================================================================

create table if not exists public.idea (
  id         uuid primary key default gen_random_uuid(),
  text       text not null check (length(btrim(text)) > 0),
  -- Nulo significa "ideia geral": ideia que não é de nenhum cliente.
  client_id  uuid references public.clients(id) on delete cascade,
  tags       jsonb not null default '[]'::jsonb,
  mentions   jsonb not null default '[]'::jsonb,
  format     text,
  status     text not null default 'nova'
               check (status in ('nova','na_pauta','usada','arquivada')),
  votes      jsonb not null default '[]'::jsonb,
  used_by    jsonb not null default '[]'::jsonb,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint idea_tags_e_lista      check (jsonb_typeof(tags) = 'array'),
  constraint idea_mentions_e_lista  check (jsonb_typeof(mentions) = 'array'),
  constraint idea_votes_e_lista     check (jsonb_typeof(votes) = 'array'),
  constraint idea_used_by_e_lista   check (jsonb_typeof(used_by) = 'array')
);

create index if not exists idea_cliente_idx on public.idea (client_id);
create index if not exists idea_status_idx  on public.idea (status, created_at desc);
-- Etiquetas são consultadas por conter: `tags @> '["cafe"]'`.
create index if not exists idea_tags_idx    on public.idea using gin (tags);

-- A outra ponta do elo. ON DELETE SET NULL: apagar a ideia não pode levar
-- junto o card que já está na pauta do cliente.
alter table public.posts
  add column if not exists idea_id uuid references public.idea(id) on delete set null;
create index if not exists posts_idea_idx on public.posts (idea_id);

-- O mesmo voto não conta duas vezes. A aplicação já garante isto, mas o banco
-- é a última linha de defesa: `votes` guarda uma pessoa por entrada.
create or replace function public.idea_votos_unicos()
returns trigger language plpgsql as $$
begin
  if (select count(*) from jsonb_array_elements_text(new.votes)) <>
     (select count(distinct v) from jsonb_array_elements_text(new.votes) v) then
    raise exception 'uma pessoa vota uma vez em cada ideia';
  end if;
  return new;
end
$$;

drop trigger if exists idea_votos_unicos on public.idea;
create trigger idea_votos_unicos
  before insert or update of votes on public.idea
  for each row execute function public.idea_votos_unicos();

-- RLS: equipe autenticada. Nada de anon — o banco de ideias é interno, e
-- nenhuma rota pública o lê.
alter table public.idea enable row level security;
drop policy if exists "admin_all_idea" on public.idea;
create policy "admin_all_idea" on public.idea
  for all to authenticated using (true) with check (true);

-- Cinto e suspensórios: sem policy, o RLS já devolveria zero linhas a anon.
-- Ainda assim tiramos o grant, porque nenhuma rota pública lê ideias e um
-- privilégio que ninguém usa é só superfície de ataque à espera de um erro
-- de policy.
revoke all on public.idea from anon;
