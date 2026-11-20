-- ============================================================================
--  Migração 015 — Conciliação de extrato (ficha 13, item F13b)
--  Aplicar DEPOIS das migrações 001 a 014.
--
--  Duas regras da ficha moldam a tabela:
--    • O sistema SUGERE, nunca decide. Dois lançamentos de mesmo valor são
--      escolha de gente. Por isso a ligação é uma coluna comum, preenchida
--      por ação explícita, e não um vínculo calculado.
--    • Conciliação confirmada dá baixa NA DATA DO BANCO. O banco é o fato.
--
--  `settled_entry` guarda se foi a conciliação que deu a baixa. É o que faz
--  o desfazer ser seguro: conciliação nunca desfaz baixa feita por pessoa.
-- ============================================================================

-- O extrato também cria lançamento: 'extrato' entra na lista de origens.
alter table public.finance_entry drop constraint if exists finance_entry_origin_check;
alter table public.finance_entry
  add constraint finance_entry_origin_check
  check (origin in ('manual','serie','contrato','extrato'));

create table if not exists public.statement_line (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references public.finance_account(id) on delete cascade,
  -- Identidade da transação: o id do banco (FITID) ou data+valor+texto.
  key           text not null,
  date          date not null,
  description   text not null default '',
  -- Com sinal: negativo é dinheiro saindo. O sinal do banco é guardado como
  -- o banco o escreveu, e não traduzido para natureza na importação.
  amount_cents  bigint not null check (amount_cents <> 0),
  status        text not null default 'a_conferir'
                  check (status in ('a_conferir','conferida','ignorada')),
  entry_id      uuid references public.finance_entry(id) on delete set null,
  settled_entry boolean,
  reconciled_at timestamptz,
  created_at    timestamptz not null default now(),
  -- Importar o mesmo arquivo duas vezes é coisa que todo mundo faz: tem de
  -- ser chato, não destrutivo.
  constraint statement_line_unica unique (account_id, key),
  -- Linha conferida tem lançamento; linha ignorada não tem.
  constraint statement_line_conferida_tem_lancamento
    check ((status = 'conferida') = (entry_id is not null))
);

create index if not exists statement_line_conta_idx  on public.statement_line (account_id, date desc);
create index if not exists statement_line_status_idx on public.statement_line (status);
create index if not exists statement_line_entry_idx  on public.statement_line (entry_id);

-- Apagar o lançamento solta a linha (ON DELETE SET NULL) — e então ela não
-- pode continuar dizendo "conferida": volta a "a conferir", para aparecer de
-- novo na fila de quem concilia.
create or replace function public.statement_line_sem_lancamento_volta()
returns trigger language plpgsql as $$
begin
  if new.entry_id is null and new.status = 'conferida' then
    new.status := 'a_conferir';
    new.settled_entry := null;
    new.reconciled_at := null;
  end if;
  return new;
end
$$;

drop trigger if exists statement_line_sem_lancamento_volta on public.statement_line;
create trigger statement_line_sem_lancamento_volta
  before update of entry_id on public.statement_line
  for each row execute function public.statement_line_sem_lancamento_volta();

alter table public.statement_line enable row level security;
drop policy if exists "admin_all_statement_line" on public.statement_line;
create policy "admin_all_statement_line" on public.statement_line
  for all to authenticated using (true) with check (true);
revoke all on public.statement_line from anon;
