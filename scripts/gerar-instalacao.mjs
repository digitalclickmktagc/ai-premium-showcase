/**
 * Gera supabase/instalacao-completa.sql a partir dos arquivos individuais.
 *
 * Existe para que ninguém monte o arquivo à mão e esqueça uma migração: rode
 * `node scripts/gerar-instalacao.mjs` sempre que criar uma migração nova.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const dir = join(root, "supabase");
const migrations = readdirSync(join(dir, "migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort();

const first = migrations[0].slice(0, 3);
const last = migrations[migrations.length - 1].slice(0, 3);

const header = `-- ============================================================================
--  INSTALAÇÃO COMPLETA — Calendário Editorial / Orkestrya
--
--  Este arquivo é a concatenação, NA ORDEM CERTA, de:
--      supabase/schema.sql
--      supabase/migrations/${first} … ${last}
--
--  COMO USAR
--    1. Supabase → SQL Editor → New query.
--    2. Cole este arquivo inteiro e rode uma vez.
--    3. Confira que terminou em "Success". Se parar no meio, o erro mostra
--       em qual trecho parou: corrija e rode de novo — nada aqui apaga dado.
--
--  É SEGURO RODAR MAIS DE UMA VEZ. Tudo usa \`if not exists\`,
--  \`create or replace\` e \`drop policy if exists\` antes de criar. Rodar duas
--  vezes não duplica tabela, não apaga linha e não reseta permissão.
--
--  DEPOIS DE RODAR, rode também \`supabase/verificacao-seguranca.sql\`: ele
--  confere o isolamento inteiro e termina em ROLLBACK, sem gravar nada.
--
--  Gerado por scripts/gerar-instalacao.mjs; se divergir dos arquivos
--  individuais, os individuais mandam.
-- ============================================================================

`;

const parts = [header];
for (const rel of ["schema.sql", ...migrations.map((m) => `migrations/${m}`)]) {
  parts.push(
    `\n\n-- ####################################################################\n` +
      `-- #  supabase/${rel}\n` +
      `-- ####################################################################\n\n`,
  );
  parts.push(readFileSync(join(dir, rel), "utf8"));
}

writeFileSync(join(dir, "instalacao-completa.sql"), parts.join(""));
console.log(
  `instalacao-completa.sql: schema.sql + ${migrations.length} migrações (${first}–${last}).`,
);
