/**
 * Prepara dist-demo/ para ser publicado como artefato no claude.ai.
 *
 * Rode `npm run demo` antes. Duas coisas precisam acontecer:
 *
 *  1. O index.html vira um fragmento (sem <html>/<head>/<body>), porque o
 *     visualizador de artefatos embrulha a página no esqueleto dele. Sem
 *     isso, o documento fica aninhado dentro de outro documento.
 *  2. O caractere U+FFFD (o losango com interrogação) é escapado como
 *     `�`. Ele aparece de propósito dentro da biblioteca da Anthropic,
 *     que troca pares substitutos soltos por ele — mas o publicador de
 *     artefatos recusa o caractere cru. O escape é o mesmo caractere para o
 *     JavaScript, e só ASCII para o publicador.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = new URL("../dist-demo/", import.meta.url).pathname;
const assets = join(dir, "assets");

// 1. index.html como fragmento
const built = readFileSync(join(dir, "index.html"), "utf8");
const css = readdirSync(assets).find((f) => f.endsWith(".css"));
const js = built.match(/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0];
if (!css || !js) throw new Error("não achei o CSS ou o JS da demonstração");

writeFileSync(
  join(dir, "index.html"),
  `<title>Orkestrya — demonstração</title>
<meta name="description" content="Demonstração navegável do sistema da agência, com dados de exemplo no seu navegador." />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600&family=Manrope:wght@300;400;500;600;700;800&display=swap"
  rel="stylesheet"
/>
<link rel="stylesheet" crossorigin href="./assets/${css}" />
<style>
  /* A página da demonstração ocupa a janela inteira dentro do visualizador. */
  html, body { margin: 0; padding: 0; min-height: 100%; }
  #root { min-height: 100vh; }
</style>
<div id="root"></div>
<script type="module" crossorigin src="./${js}"></script>
`,
);

// 2. U+FFFD escapado nos pacotes de JavaScript
let patched = 0;
for (const file of readdirSync(assets).filter((f) => f.endsWith(".js"))) {
  const path = join(assets, file);
  const text = readFileSync(path, "utf8");
  if (!text.includes("�")) continue;
  writeFileSync(path, text.replaceAll("�", "\\uFFFD"));
  patched++;
}

console.log(
  `dist-demo pronto para o artefato: index.html como fragmento, ${patched} pacote(s) com U+FFFD escapado.`,
);
