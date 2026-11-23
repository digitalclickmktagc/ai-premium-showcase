-- ============================================================================
--  Verificação de segurança — rode depois de `supabase/instalacao-completa.sql`
--  (ou do schema.sql mais as migrações 001 a 019, na ordem)
--
--  COMO RODAR (SQL Editor do Supabase, ou psql):
--      \i supabase/verificacao-seguranca.sql
--
--  É SEGURO RODAR EM PRODUÇÃO: tudo acontece dentro de uma transação que
--  termina em ROLLBACK. Os dados de teste não sobrevivem ao fim do arquivo.
--
--  O QUE PRECISA APARECER:
--    1  grants       → entrega só para service_role; núcleo privado para ninguém
--    2  entrega      → código de 6 dígitos + e-mail real (só para service_role)
--    3  intervalo    → ERRO "Aguarde N segundos"
--    4  anônimo      → vaza_codigo = f
--    5  anônimo      → ERRO "permission denied" nas duas funções internas
--    6  tabelas      → 0 linhas em tudo, para o anônimo
--    7  outro calendário → ERRO "Post não encontrado neste calendário."
--    8  visão pública → vaza_nota, vaza_checklist, vaza_comentario,
--                       vaza_anexo e vaza_tempo todos = f
--    9  histórico    → UPDATE 0 e DELETE 0; chave de evento repetida é recusada
--   10  dossiê       → seção interna fora da página do cliente; link pausado
--                      indistinguível de inexistente
--   11  formulário   → pausado não responde; resposta que não é objeto é recusada
--   12  roteiro      → observação de cena não aparece na visão pública do card
--   13  webhooks     → anon não executa o enfileirador (senão forjaria evento
--                      assinado com o nosso segredo)
--   14  tabelas novas → anon sem grant em dossiê, roteiro, extrato, webhooks,
--                       análise, pauta e formulários
--
--  Qualquer linha diferente disso é regressão de segurança.
--
--  NUM POSTGRES LOCAL (fora do Supabase), rode isto uma vez antes — são os
--  papéis e permissões que o Supabase já cria sozinho, e sem eles a seção 6
--  dá "permission denied" em vez de devolver zero linhas:
--    create role anon;  create role authenticated;  create role service_role;
--    grant usage on schema public to anon, authenticated, service_role;
--    grant all on all tables in schema public to anon, authenticated, service_role;
-- ============================================================================
\pset pager off
\set ON_ERROR_STOP off

begin;

\echo ''
\echo '### 1. Quem pode executar cada função'
select p.proname as funcao,
       has_function_privilege('anon', p.oid, 'execute')          as anon,
       has_function_privilege('authenticated', p.oid, 'execute') as autenticado,
       has_function_privilege('service_role', p.oid, 'execute')  as service_role
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('approval_code_issue','issue_approval_code',
                     'issue_approval_code_delivery','submit_approval_decision',
                     'get_public_calendar','request_approval',
                     'peek_approval_code_expiry')
 order by p.proname;

-- Dados descartáveis -------------------------------------------------------
insert into public.clients (id, name, color, email) values
  ('00000000-0000-4000-8000-00000000c001', 'ZZ Teste A', '#f97316', 'teste-a@exemplo.com'),
  ('00000000-0000-4000-8000-00000000c002', 'ZZ Teste B', '#3b82f6', 'teste-b@exemplo.com');
insert into public.calendars (id, client_id, name, share_token) values
  ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000c001', 'ZZ Cal A', 'ZZ_TOKEN_A'),
  ('00000000-0000-4000-8000-00000000a002', '00000000-0000-4000-8000-00000000c002', 'ZZ Cal B', 'ZZ_TOKEN_B');
insert into public.posts (id, calendar_id, title, date, status, internal_notes,
                          checklist, comments, attachments, time_entries) values
  ('00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000a001', 'ZZ Post A', current_date, 'done', 'ZZ_NOTA_INTERNA',
   '[{"id":"c1","text":"ZZ_CHECKLIST","done":false}]',
   '[{"id":"m1","author":"Equipe","body":"ZZ_COMENTARIO","at":"2026-01-01T00:00:00Z"}]',
   '[{"id":"a1","name":"ZZ_ANEXO","url":"https://exemplo.com","at":"2026-01-01T00:00:00Z"}]',
   '[{"id":"t1","minutes":30,"note":"ZZ_TEMPO","at":"2026-01-01T00:00:00Z"}]'),
  ('00000000-0000-4000-8000-00000000b002', '00000000-0000-4000-8000-00000000a002', 'ZZ Post B', current_date, 'done', null,
   '[]','[]','[]','[]');
select public.request_approval('00000000-0000-4000-8000-00000000b001', null);
select public.request_approval('00000000-0000-4000-8000-00000000b002', null);

\echo ''
\echo '### 2. service_role recebe o código; 3. o segundo pedido seguido é barrado'
set role service_role;
select (public.issue_approval_code_delivery('ZZ_TOKEN_A','00000000-0000-4000-8000-00000000b001')->>'code') ~ '^[0-9]{6}$'
         as codigo_6_digitos;
savepoint s3;
select public.issue_approval_code_delivery('ZZ_TOKEN_A','00000000-0000-4000-8000-00000000b001');
rollback to s3;
reset role;

\echo ''
\echo '### 4. O anônimo nunca recebe o código em claro'
update public.approval_code set created_at = now() - interval '5 minutes'
 where post_id = '00000000-0000-4000-8000-00000000b001';
set role anon;
select public.issue_approval_code('ZZ_TOKEN_A','00000000-0000-4000-8000-00000000b001') ? 'code' as vaza_codigo;

\echo ''
\echo '### 5. Funções internas fora do alcance do anônimo'
savepoint s5a;
select public.issue_approval_code_delivery('ZZ_TOKEN_A','00000000-0000-4000-8000-00000000b001');
rollback to s5a;
savepoint s5b;
select public.approval_code_issue('ZZ_TOKEN_A','00000000-0000-4000-8000-00000000b001');
rollback to s5b;

\echo ''
\echo '### 6. Tabelas: a RLS não devolve nada ao anônimo'
select (select count(*) from public.posts)           as posts,
       (select count(*) from public.clients)         as clientes,
       (select count(*) from public.calendars)       as calendarios,
       (select count(*) from public.approval_code)   as codigos,
       (select count(*) from public.automation_rule) as regras,
       (select count(*) from public.automation_run)  as execucoes;

\echo ''
\echo '### 7. Um token não alcança o post de outro calendário'
savepoint s7;
select public.issue_approval_code('ZZ_TOKEN_A','00000000-0000-4000-8000-00000000b002');
rollback to s7;

\echo ''
\echo '### 8. A visão pública não carrega nada interno'
select public.get_public_calendar('ZZ_TOKEN_A')::text as pub \gset
select :'pub' like '%ZZ_NOTA_INTERNA%' as vaza_nota,
       :'pub' like '%ZZ_CHECKLIST%'    as vaza_checklist,
       :'pub' like '%ZZ_COMENTARIO%'   as vaza_comentario,
       :'pub' like '%ZZ_ANEXO%'        as vaza_anexo,
       :'pub' like '%ZZ_TEMPO%'        as vaza_tempo;
reset role;

\echo ''
\echo '### 9. O histórico de automação não pode ser reescrito'
insert into public.automation_rule (id, calendar_id, trigger, action) values
  ('00000000-0000-4000-8000-00000000d001','00000000-0000-4000-8000-00000000a001',
   '{"type":"review_decided","result":"approved"}','{"type":"move_to_stage","stage":"published"}');
set role authenticated;
insert into public.automation_run (rule_id, post_id, result, event_key) values
  ('00000000-0000-4000-8000-00000000d001','00000000-0000-4000-8000-00000000b001','applied','zz:evento');
savepoint s9;
insert into public.automation_run (rule_id, post_id, result, event_key) values
  ('00000000-0000-4000-8000-00000000d001','00000000-0000-4000-8000-00000000b001','applied','zz:evento');
rollback to s9;
update public.automation_run set result = 'skipped' where event_key = 'zz:evento';
delete from public.automation_run where event_key = 'zz:evento';
select count(*) as execucoes_que_sobreviveram
  from public.automation_run where event_key = 'zz:evento';
reset role;

\echo ''
\echo '### 10. Dossiê: seção interna não sai, link pausado some'
insert into public.dossier_template (id, name, sections) values
  ('00000000-0000-4000-8000-00000000e001', 'ZZ Modelo',
   '[{"id":"visao","title":"Visão","kind":"texto","defaultVisibility":"cliente"},
     {"id":"raiox","title":"Raio-X","kind":"texto","defaultVisibility":"interno"}]');
insert into public.dossier (id, client_id, template_id, share_token, share_enabled, sections) values
  ('00000000-0000-4000-8000-00000000e002','00000000-0000-4000-8000-00000000c001',
   '00000000-0000-4000-8000-00000000e001','ZZ_TOKEN_DOSSIE', true,
   '[{"sectionId":"visao","visibility":"cliente","text":"ZZ_PUBLICO"},
     {"sectionId":"raiox","visibility":"interno","text":"ZZ_SEGREDO"}]');
set role anon;
select public.public_dossier('ZZ_TOKEN_DOSSIE')::text like '%ZZ_PUBLICO%' as mostra_o_que_e_do_cliente,
       public.public_dossier('ZZ_TOKEN_DOSSIE')::text like '%ZZ_SEGREDO%' as vaza_secao_interna;
reset role;
update public.dossier set share_enabled = false where id = '00000000-0000-4000-8000-00000000e002';
set role anon;
select public.public_dossier('ZZ_TOKEN_DOSSIE') is null as pausado_some,
       public.public_dossier('ZZ_NAO_EXISTE')   is null as inexistente_some;
reset role;

\echo ''
\echo '### 11. Formulário: pausado não responde, resposta precisa ser objeto'
insert into public.briefing_form (id, title, questions, share_token, status) values
  ('00000000-0000-4000-8000-00000000f001','ZZ Briefing',
   '[{"id":"q1","kind":"texto","label":"ZZ","required":false}]','ZZ_TOKEN_FORM','pausado');
set role anon;
select public.public_form('ZZ_TOKEN_FORM') is null as pausado_some;
savepoint s11;
select public.public_submit_form('ZZ_TOKEN_FORM', '{"q1":"x"}'::jsonb);
rollback to s11;
reset role;
update public.briefing_form set status = 'ativo' where id = '00000000-0000-4000-8000-00000000f001';
set role anon;
savepoint s11b;
select public.public_submit_form('ZZ_TOKEN_FORM', '"texto solto"'::jsonb);
rollback to s11b;
reset role;

\echo ''
\echo '### 12. Roteiro: observação de cena não atravessa para o cliente'
insert into public.script (post_id, kind, title, scenes) values
  ('00000000-0000-4000-8000-00000000b001','video','ZZ Roteiro',
   '[{"id":"c1","speech":"fala","notes":"ZZ_OBSERVACAO_INTERNA"}]');
set role anon;
select public.get_public_calendar('ZZ_TOKEN_A')::text like '%ZZ_OBSERVACAO_INTERNA%' as vaza_roteiro;
reset role;

\echo ''
\echo '### 13. Webhooks: o anônimo não enfileira evento nenhum'
select has_function_privilege('anon','public.enqueue_webhook(text,jsonb)','execute') as anon_enfileira,
       has_function_privilege('authenticated','public.enqueue_webhook(text,jsonb)','execute') as equipe_enfileira;

\echo ''
\echo '### 14. Tabelas novas: nenhum grant para o anônimo'
select table_name,
       bool_or(grantee = 'anon') as tem_grant_anon
  from information_schema.role_table_grants
 where table_name in ('dossier','dossier_template','script','statement_line',
                      'webhook_subscription','webhook_delivery','assessment',
                      'assessment_template','pauta_item','monthly_plan',
                      'briefing_form','form_response','idea','project','squad')
 group by table_name
 order by table_name;

rollback;
\echo ''
\echo '### Fim — transação revertida, nada ficou gravado.'
