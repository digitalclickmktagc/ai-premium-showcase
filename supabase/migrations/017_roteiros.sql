-- ============================================================================
--  Migração 017 — Roteiros de vídeo e de stories (ficha 17, item F17c)
--  Aplicar DEPOIS das migrações 001 a 016.
--
--  A crítica da ficha pede UM serviço de aprovação externa para todos os
--  artefatos, em vez de um fluxo por ferramenta. É isso que decide o
--  desenho: o roteiro pertence a um card, e quem vai ao cliente é o card.
--  Não existe link de aprovação do roteiro, não existe segunda decisão para
--  perseguir, e as observações internas de cena não saem da agência — nada
--  do roteiro atravessa para a visão pública.
--
--  `version` é trava otimista: duas pessoas no mesmo roteiro é normal numa
--  agência; sobrescrever uma delas em silêncio não é.
-- ============================================================================

create table if not exists public.script (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  kind       text not null check (kind in ('video','stories')),
  title      text not null check (length(btrim(title)) > 0),
  goal       text,
  audience   text,
  tone       text,
  cta        text,
  hashtags   text,
  caption    text,
  scenes     jsonb not null default '[]'::jsonb,
  fields     jsonb not null default '[]'::jsonb,
  status     text not null default 'rascunho'
               check (status in ('rascunho','em_revisao','aprovado')),
  version    int not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint script_cenas_e_lista  check (jsonb_typeof(scenes) = 'array'),
  constraint script_campos_e_lista check (jsonb_typeof(fields) = 'array'),
  -- Os tetos da ficha: 60 cenas de vídeo, 40 telas de stories.
  constraint script_teto_de_cenas check (
    jsonb_array_length(scenes) <= case when kind = 'stories' then 40 else 60 end
  )
);

create index if not exists script_post_idx on public.script (post_id);

-- Trava otimista no banco: salvar por cima de uma versão mais nova é
-- recusado aqui também, não só na aplicação. Duas abas abertas é o caso
-- comum, e a segunda não pode apagar o trabalho da primeira.
create or replace function public.script_versao_mais_nova()
returns trigger language plpgsql as $$
begin
  if new.version <= old.version then
    raise exception 'Alguém salvou este roteiro enquanto você editava (versão % no banco, % enviada).',
      old.version, new.version;
  end if;
  return new;
end
$$;

drop trigger if exists script_versao_mais_nova on public.script;
create trigger script_versao_mais_nova
  before update on public.script
  for each row execute function public.script_versao_mais_nova();

alter table public.script enable row level security;
drop policy if exists "admin_all_script" on public.script;
create policy "admin_all_script" on public.script
  for all to authenticated using (true) with check (true);
-- Roteiro é interno: o anon não tem nada aqui, nem pela função pública do
-- calendário, que lista coluna por coluna.
revoke all on public.script from anon;
