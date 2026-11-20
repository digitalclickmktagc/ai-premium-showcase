-- ============================================================================
--  Migração 013 — Dossiê estratégico (ficha 16)
--  Aplicar DEPOIS das migrações 001 a 012.
--
--  A crítica da ficha é a razão do desenho: lá as oito seções são fixas no
--  código. Aqui as seções são um MODELO que a agência edita (`dossier_template`),
--  e o dossiê de cada cliente guarda só o conteúdo.
--
--  Cada seção diz quem pode ler. O raio-X de um perfil costuma ser franco, e
--  anotação honesta vale mais que anotação diplomática — então a seção pode
--  ser interna e ficar fora do link do cliente, em vez de o time suavizar o
--  que escreve. Essa separação é feita DENTRO do banco, pela função
--  `public_dossier`: o anon não tem grant na tabela, então a seção interna
--  não sai daqui nem por engano de tela.
-- ============================================================================

create table if not exists public.dossier_template (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) > 0),
  sections   jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dossier_template_secoes_e_lista check (jsonb_typeof(sections) = 'array')
);

create table if not exists public.dossier (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients(id) on delete cascade,
  template_id   uuid not null references public.dossier_template(id) on delete restrict,
  sections      jsonb not null default '[]'::jsonb,
  share_token   text unique,
  share_enabled boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Um dossiê por cliente: dois seriam duas estratégias para a mesma marca.
  constraint dossier_um_por_cliente unique (client_id),
  constraint dossier_secoes_e_lista check (jsonb_typeof(sections) = 'array'),
  -- Link ligado exige token. Sem isto, "ligado" sem endereço é um estado que
  -- promete uma página que não existe.
  constraint dossier_ligado_tem_token check (not share_enabled or share_token is not null)
);

create index if not exists dossier_token_idx on public.dossier (share_token)
  where share_enabled;

-- ── A página pública ---------------------------------------------------------
-- Devolve o cliente, o nome do modelo e APENAS as seções marcadas 'cliente'
-- que têm conteúdo. Seção interna e seção vazia não saem do banco.
create or replace function public.public_dossier(p_token text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_d   public.dossier%rowtype;
  v_t   public.dossier_template%rowtype;
  v_cli public.clients%rowtype;
  v_defs jsonb;
  v_secs jsonb;
begin
  select * into v_d from public.dossier
   where share_token = p_token and share_enabled;
  -- Link pausado é indistinguível de link que nunca existiu.
  if not found then return null; end if;

  select * into v_t   from public.dossier_template where id = v_d.template_id;
  select * into v_cli from public.clients          where id = v_d.client_id;
  if not found then return null; end if;

  -- As seções visíveis, na ordem do modelo.
  with modelo as (
    select d.value as def, d.ordinality as pos
      from jsonb_array_elements(v_t.sections) with ordinality as d(value, ordinality)
  ), conteudo as (
    select s.value as sec
      from jsonb_array_elements(v_d.sections) as s(value)
  ), visiveis as (
    select m.def, c.sec, m.pos
      from modelo m
      join conteudo c on c.sec->>'sectionId' = m.def->>'id'
     where coalesce(c.sec->>'visibility', m.def->>'defaultVisibility') = 'cliente'
       and (
         length(btrim(coalesce(c.sec->>'text',''))) > 0
         or coalesce(jsonb_array_length(c.sec->'list'), 0) > 0
         or coalesce(jsonb_array_length(c.sec->'images'), 0) > 0
         or coalesce(jsonb_array_length(c.sec->'rows'), 0) > 0
         or exists (
           select 1 from jsonb_each_text(coalesce(c.sec->'values','{}'::jsonb)) v
            where length(btrim(v.value)) > 0
         )
       )
  )
  select coalesce(jsonb_agg(def order by pos), '[]'::jsonb),
         coalesce(jsonb_agg(sec order by pos), '[]'::jsonb)
    into v_defs, v_secs
    from visiveis;

  return jsonb_build_object(
    'client', jsonb_build_object(
      'name', v_cli.name, 'logoUrl', v_cli.logo_url, 'color', v_cli.color),
    'template', jsonb_build_object('name', v_t.name, 'sections', v_defs),
    'sections', v_secs
  );
end;
$$;

-- ── RLS e grants -------------------------------------------------------------
alter table public.dossier_template enable row level security;
alter table public.dossier          enable row level security;

do $$
declare t text;
begin
  foreach t in array array['dossier_template','dossier']
  loop
    execute format('drop policy if exists "admin_all_%1$s" on public.%1$I', t);
    execute format(
      'create policy "admin_all_%1$s" on public.%1$I for all to authenticated using (true) with check (true)',
      t);
    -- O anon NUNCA toca nestas tabelas. O único caminho é a função acima.
    execute format('revoke all on public.%1$I from anon', t);
  end loop;
end
$$;

revoke all on function public.public_dossier(text) from public;
grant execute on function public.public_dossier(text) to anon, authenticated;
