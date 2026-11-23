# Publicar em produção

Passo a passo para tirar o sistema do ambiente de testes e colocá-lo no ar.
São quatro etapas (mais duas opcionais); só as que envolvem Supabase, Resend e
hospedagem dependem de contas externas.

Ordem importa: o site publicado sem o banco pronto mostra erro de conexão na
tela de login.

> **Só quer mostrar o sistema para alguém?** Não precisa de nada disto. Um
> pacote de demonstração, que roda inteiro no navegador com dados de exemplo e
> sem tocar em servidor nenhum, sai com:
>
> ```bash
> VITE_DEMO=1 VITE_ROUTER=hash VITE_APP_ENV=test \
>   npx vite build --mode preview --outDir dist-demo
> ```
>
> A pasta `dist-demo/` pode ser aberta em qualquer lugar que sirva arquivos
> estáticos. Os dados ficam no navegador de quem abre, e cada pessoa vê a sua
> própria cópia.

---

## 1. Supabase — despausar e aplicar o banco

O plano gratuito pausa o projeto depois de ~7 dias sem uso.

1. Abra <https://supabase.com/dashboard>, entre no projeto
   `hpfjlwleftckgovkssap` e clique em **Restore project**. A volta leva alguns
   minutos.
2. No **SQL Editor** → **New query**, cole o arquivo
   **`supabase/instalacao-completa.sql`** inteiro e rode uma vez.

   Esse arquivo é a concatenação, na ordem certa, do `schema.sql` e das 18
   migrações (001 a 019). Rodar de novo é seguro: tudo usa `if not exists`,
   `create or replace` e `drop policy if exists`, então repetir não duplica
   tabela nem apaga linha. Se parar no meio, o erro diz em qual trecho — foi
   testado em um PostgreSQL 16 limpo, duas vezes seguidas, sem erro.

   Prefere arquivo por arquivo? A ordem é `supabase/schema.sql` e depois
   `supabase/migrations/001 … 019`, do menor para o maior número.

   | Migração | O que entra |
   |---|---|
   | 001 | aprovação externa, código de verificação, situação do cliente |
   | 003 | automações de coluna e histórico insert-only |
   | 004 | entrega do código por e-mail e reforço de permissões |
   | 005 | checklist, comentários, anexos e tempo no card |
   | 006 | colunas configuráveis do quadro |
   | 007 | agenda e agendamento público |
   | 008 | catálogo, propostas e contratos com assinatura |
   | 009 | financeiro (lançamentos, séries, contas, DRE) |
   | 010 | CRM e orquestrador venda → operação |
   | 011 | banco de ideias |
   | 012 | pauta única e planejamento mensal |
   | 013 | dossiê estratégico |
   | 014 | projetos, squads e centro de custo |
   | 015 | conciliação de extrato |
   | 016 | formulários de briefing |
   | 017 | roteiros de vídeo e stories |
   | 018 | webhooks de saída |
   | 019 | análise de perfil e concorrência |

3. Em **Authentication → Users**, confirme que existe o usuário administrador
   com **Auto Confirm** marcado. É com ele que você entra em `/app/login`.
4. Rode `supabase/verificacao-seguranca.sql` no SQL Editor. Ele confere o
   isolamento inteiro — inclusive dossiê, formulário, roteiro e webhooks — e
   **termina em ROLLBACK**: nada fica gravado. O topo do arquivo lista o que
   precisa aparecer em cada seção; qualquer linha diferente é regressão.

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

## 2b. Webhooks — publicar o entregador (opcional)

Só precisa se você for usar a tela **Integrações**. Sem esta etapa os eventos
são enfileirados no banco e **nada sai** — a própria tela avisa isso e mostra
quantas entregas estão paradas.

1. `supabase functions deploy dispatch-webhooks --no-verify-jwt`
2. Agende de minuto em minuto, no SQL Editor:

   ```sql
   select cron.schedule('webhooks', '* * * * *', $$
     select net.http_post(
       url := 'https://<projeto>.supabase.co/functions/v1/dispatch-webhooks',
       headers := jsonb_build_object('Authorization', 'Bearer <anon key>'))
   $$);
   ```

O passo a passo completo, com o jeito de conferir a assinatura do lado de
quem recebe, está em `supabase/functions/README.md`.

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
| `/app/hoje` | o painel do dia carrega com o que está pendente |
| abrir o link de estratégia de um cliente | só as seções marcadas "o cliente vê" |
| abrir o link de um formulário pausado | "formulário indisponível", igual a link inexistente |

### Publicar uma atualização depois

`npm run package` de novo e repita o passo 4. Os arquivos em `assets/` têm o
nome trocado a cada build, então o navegador não serve versão velha; o
`.htaccess` já manda o `sw.js` ser sempre revalidado.

---

## O que fica de fora por decisão sua

- **Cobrança e planos pagos** — fora do escopo.
- **Hub do cliente** — construído, porém desligado por chave de
  funcionalidade. Para ligar, publique com `VITE_FEATURE_CLIENT_HUB=on`.
