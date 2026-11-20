-- ============================================================================
--  Migração 019 — Análise de perfil e de concorrência (ficha 17, item F17d)
--  Aplicar DEPOIS das migrações 001 a 018.
--
--  A ficha elogia uma coisa do original — perguntas e pesos como dado
--  configurável — e deixa dois problemas: as faixas que transformam nota em
--  veredito não são documentadas, e a análise vive separada da estratégia do
--  cliente. Os dois foram tratados: as faixas são editáveis e aparecem ao
--  lado do número, e a análise concluída é levada para as seções do dossiê,
--  em vez de virar uma segunda verdade divergente.
--
--  A nota é média ponderada de notas 0–5, normalizada para 0–100. Critério
--  não avaliado fica FORA da média, em vez de valer zero: não ter olhado não
--  é a mesma coisa que estar ruim.
-- ============================================================================

create table if not exists public.assessment_template (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) > 0),
  questions  jsonb not null default '[]'::jsonb,
  bands      jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_template_listas check (
    jsonb_typeof(questions) = 'array' and jsonb_typeof(bands) = 'array'
  )
);

create table if not exists public.assessment (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  template_id  uuid not null references public.assessment_template(id) on delete restrict,
  title        text not null check (length(btrim(title)) > 0),
  subjects     jsonb not null default '[]'::jsonb,
  scores       jsonb not null default '{}'::jsonb,
  conclusions  text,
  status       text not null default 'em_andamento'
                 check (status in ('em_andamento','concluida')),
  concluded_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint assessment_sujeitos_e_lista check (jsonb_typeof(subjects) = 'array'),
  constraint assessment_notas_e_objeto  check (jsonb_typeof(scores) = 'object'),
  -- Até 3 concorrentes mais o próprio cliente: comparação com mais do que
  -- isso ninguém lê, e a tela já diz isso.
  constraint assessment_ate_quatro_perfis check (jsonb_array_length(subjects) <= 4)
);

create index if not exists assessment_cliente_idx on public.assessment (client_id, created_at desc);

-- Nota fora de 0–5 não entra. É a garantia que o banco consegue dar sozinho
-- sobre um jsonb de notas, e evita que uma régua errada em uma tela vire
-- média errada em todas as outras.
create or replace function public.assessment_notas_validas()
returns trigger language plpgsql as $$
declare v_nota numeric;
begin
  for v_nota in
    select nota.valor::numeric
      from jsonb_each(new.scores) as sujeito(perfil, notas),
           jsonb_each_text(sujeito.notas) as nota(criterio, valor)
  loop
    if v_nota < 0 or v_nota > 5 then
      raise exception 'As notas da análise vão de 0 a 5 (recebi %).', v_nota;
    end if;
  end loop;
  return new;
end
$$;

drop trigger if exists assessment_notas_validas on public.assessment;
create trigger assessment_notas_validas
  before insert or update of scores on public.assessment
  for each row execute function public.assessment_notas_validas();

alter table public.assessment_template enable row level security;
alter table public.assessment          enable row level security;

do $$
declare t text;
begin
  foreach t in array array['assessment_template','assessment']
  loop
    execute format('drop policy if exists "admin_all_%1$s" on public.%1$I', t);
    execute format(
      'create policy "admin_all_%1$s" on public.%1$I for all to authenticated using (true) with check (true)',
      t);
    -- Diagnóstico franco é interno. O que vai ao cliente é o dossiê, e lá a
    -- seção tem visibilidade própria.
    execute format('revoke all on public.%1$I from anon', t);
  end loop;
end
$$;
