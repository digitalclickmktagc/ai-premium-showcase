-- ============================================================================
--  Migração 005 — Workspace do card: checklist, comentários, anexos e tempo
--  Aplicar DEPOIS de schema.sql e das migrações 001, 003 e 004.
--
--  São quatro campos INTERNOS da agência. O que garante que não vazam para o
--  cliente é `get_public_calendar`, que monta a resposta campo a campo e não
--  inclui nenhum deles — a mesma proteção que já vale para `internal_notes`.
--  A conferência no fim deste arquivo é o que prova isso.
-- ============================================================================

-- 1. Campos -----------------------------------------------------------------
--    jsonb em vez de tabelas próprias: são listas curtas, sempre lidas junto
--    com o card e nunca consultadas por conta própria. Tabela separada aqui
--    só traria join e nenhuma pergunta nova que alguém vá fazer.
alter table public.posts add column if not exists checklist    jsonb not null default '[]'::jsonb;
alter table public.posts add column if not exists comments     jsonb not null default '[]'::jsonb;
alter table public.posts add column if not exists attachments  jsonb not null default '[]'::jsonb;
alter table public.posts add column if not exists time_entries jsonb not null default '[]'::jsonb;

-- Precisam ser listas: um objeto solto aqui quebraria a leitura no app.
alter table public.posts drop constraint if exists posts_workspace_arrays;
alter table public.posts add constraint posts_workspace_arrays check (
  jsonb_typeof(checklist) = 'array'
  and jsonb_typeof(comments) = 'array'
  and jsonb_typeof(attachments) = 'array'
  and jsonb_typeof(time_entries) = 'array'
);

-- 2. Conferência -------------------------------------------------------------
--  Depois de aplicar, confirme que a visão pública continua limpa. Troque o
--  token e rode:
--    select public.get_public_calendar('<token>')::text ~ '(checklist|timeEntries|internal)'
--      as vaza;
--  O esperado é `f`. O arquivo supabase/verificacao-seguranca.sql faz essa
--  conferência junto com todas as outras.
