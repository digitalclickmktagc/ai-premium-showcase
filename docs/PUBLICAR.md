# Publicar em produção

Passo a passo para tirar o Calendário Editorial do ambiente de testes e
colocá-lo no ar. São quatro etapas; só a primeira e a segunda dependem de
contas externas.

Ordem importa: o site publicado sem o banco pronto mostra erro de conexão na
tela de login.

---

## 1. Supabase — despausar e aplicar as migrações

O plano gratuito pausa o projeto depois de ~7 dias sem uso.

1. Abra <https://supabase.com/dashboard>, entre no projeto
   `hpfjlwleftckgovkssap` e clique em **Restore project**. A volta leva alguns
   minutos.
2. No **SQL Editor**, rode os arquivos nesta ordem, um de cada vez, conferindo
   que cada um termina em *Success*:

   | Ordem | Arquivo | O que cria |
   |---|---|---|
   | 1 | `supabase/schema.sql` | tabelas, RLS e a visão pública do cliente |
   | 2 | `supabase/migrations/001_aprovacao_externa.sql` | aprovação externa, código de verificação, situação do cliente |
   | 3 | `supabase/migrations/003_automacoes.sql` | regras de automação e histórico |
   | 4 | `supabase/migrations/004_entrega_codigo.sql` | entrega do código por e-mail e reforço de permissões |

   Rodar de novo um arquivo já aplicado é seguro: todos usam
   `if not exists` / `create or replace`.

3. Em **Authentication → Users**, confirme que existe o usuário administrador
   com **Auto Confirm** marcado. É com ele que você entra em `/app/login`.
4. Rode `supabase/verificacao-seguranca.sql` no SQL Editor. Ele confere o
   isolamento inteiro e **termina em ROLLBACK** — nada fica gravado. O próprio
   arquivo lista, no topo, o que precisa aparecer em cada seção.

> **Manter acordado.** Já existe `.github/workflows/keep-supabase-awake.yml`,
> que pinga o projeto todo dia. É paliativo: o GitHub desliga agendamentos de
> repositórios parados por 60 dias, e só o plano pago garante que o projeto
> não pausa.

## 2. Resend — envio do código de verificação

Sem esta etapa o cliente consegue decidir pelo link, mas o código não chega
por e-mail: o app gera o código e avisa na tela que o envio não está
configurado. Nada fica quebrado — fica incompleto, e visivelmente.

1. Crie a conta em <https://resend.com> (grátis: 3.000 e-mails/mês).
2. **Verifique um domínio** seu. Sem domínio verificado o Resend só entrega
   para o e-mail dono da conta, o que não serve para cliente nenhum.
3. Siga `supabase/functions/README.md` para implantar a função
   `send-approval-code` e gravar os segredos `RESEND_API_KEY` e
   `APPROVAL_FROM_EMAIL`.
4. Cadastre o e-mail de cada cliente na ficha dele — é para lá que o código
   vai.

## 3. Gerar o pacote do site

```bash
npm install
npm run package
```

Sai um `calendario-editorial-producao.zip` na raiz do projeto, com o site
inteiro: `index.html`, a pasta `assets/`, os ícones, o `manifest.webmanifest`,
o `sw.js` e o `.htaccess`.

O endereço do Supabase e a chave publicável ficam embutidos no pacote. Isso é
esperado: a chave publicável é pública por natureza, e quem protege os dados é
a RLS no servidor. A chave `service_role` **nunca** entra aqui.

## 4. Hostinger — subir o site

1. Painel da Hostinger → **Gerenciador de Arquivos** → entre em `public_html`.
2. Apague o que estiver lá (ou mova para uma pasta de backup).
3. Envie o `calendario-editorial-producao.zip` e use **Extrair** no próprio
   gerenciador. O conteúdo tem que ficar direto em `public_html`, não dentro
   de uma subpasta.
4. Confirme que o `.htaccess` subiu. O gerenciador esconde arquivos que
   começam com ponto — ligue "mostrar arquivos ocultos". **Sem ele, abrir
   `/app/login` direto ou recarregar a página devolve 404**: é ele que manda
   toda rota para o `index.html`.
5. Confirme que o domínio está com **HTTPS** ativo. O app é um PWA e o
   service worker só funciona em HTTPS.

### Conferir depois de subir

| O que abrir | O que precisa acontecer |
|---|---|
| `seudominio.com.br/app/login` | tela de login, sem a tarja amarela de testes |
| entrar com o usuário admin | cai no painel com os clientes |
| recarregar (F5) dentro do app | continua na mesma tela, sem 404 |
| copiar o link de um cliente e abrir numa aba anônima | calendário só daquele cliente, sem notas internas |
| pelo link, decidir uma aprovação | o código chega no e-mail do cliente |
| pedir o código duas vezes seguidas | a segunda vez avisa para aguardar |

### Publicar uma atualização depois

`npm run package` de novo e repita o passo 4. Os arquivos em `assets/` têm o
nome trocado a cada build, então o navegador não serve versão velha; o
`.htaccess` já manda o `sw.js` ser sempre revalidado.

---

## O que fica de fora por decisão sua

- **Cobrança e planos pagos** — fora do escopo.
- **Hub do cliente** — construído, porém desligado por chave de
  funcionalidade. Para ligar, publique com `VITE_FEATURE_CLIENT_HUB=on`.
