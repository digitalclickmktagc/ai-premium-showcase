# O que falta — e só você pode fazer

Escrito em 23/11/2026, em linguagem simples e sem termo técnico sem explicação.

O sistema está pronto e testado. O que falta não é programação: são coisas que
dependem de **contas que são suas**, com **senha que é sua** e **cartão que é
seu**. Ninguém consegue fazer por você.

São **4 tarefas obrigatórias** e **3 opcionais**. Faça na ordem.
Tempo total: cerca de **1 hora** na primeira vez.

> **Antes de começar:** nada aqui apaga dado nenhum. Se travar em algum passo,
> pare e me chame — é melhor perguntar do que chutar.

---

## Tarefa 1 — Acordar o banco de dados ⏱️ 5 minutos

**O que é:** o banco é onde os dados moram. Ele está num serviço chamado
Supabase, no plano gratuito. O plano gratuito **coloca o banco para dormir**
depois de uns 7 dias sem ninguém usar.

**O que fazer:**

1. Entre em <https://supabase.com/dashboard>.
2. Clique no projeto `hpfjlwleftckgovkssap`.
3. Se aparecer um botão **"Restore project"**, clique nele e espere uns
   3 minutos.
4. Pronto.

**Como saber que deu certo:** o painel do projeto para de mostrar o aviso de
pausado.

---

## Tarefa 2 — Montar o banco ⏱️ 10 minutos

**O que é:** o banco precisa saber quais "gavetas" existem (clientes, posts,
contas a pagar…). Isso é um arquivo de texto que você cola e manda rodar.

**O que fazer:**

1. No Supabase, menu da esquerda → **SQL Editor** → **New query**.
2. Abra o arquivo `supabase/instalacao-completa.sql` do projeto, selecione
   **tudo** (Ctrl+A), copie (Ctrl+C) e cole lá (Ctrl+V).
3. Clique em **Run**.
4. Espere terminar. Tem que aparecer **"Success"**.

**Pode rodar duas vezes?** Pode. Eu testei: rodar de novo não duplica nada,
não apaga nada e não quebra nada. Se der erro no meio, o erro diz onde —
corrija e rode de novo.

5. Agora confira a segurança: **New query** de novo, cole o arquivo
   `supabase/verificacao-seguranca.sql` e rode.
   Ele testa se um cliente consegue ver os dados de outro (não pode), se as
   observações internas vazam (não podem), e por aí vai.
   **Ele termina em "ROLLBACK" de propósito — isso é o certo**, quer dizer
   que ele testou e desfez tudo, sem gravar nada.

**Como saber que deu certo:** terminou em Success, e no segundo arquivo todas
as seções mostram o resultado esperado (está escrito no topo do arquivo).

---

## Tarefa 3 — Confirmar o seu login ⏱️ 2 minutos

**O que é:** o usuário com que você entra no painel.

**O que fazer:**

1. No Supabase: **Authentication** → **Users**.
2. Veja se o seu e-mail está na lista.
3. Se não estiver: **Add user** → **Create new user**, ponha e-mail e senha, e
   **marque "Auto Confirm User"**. Sem essa marcação, o login não funciona.

---

## Tarefa 4 — Subir o site ⏱️ 20 minutos

**O que é:** transformar o projeto num pacote e colocar na sua hospedagem.

**O que fazer:**

1. No computador, dentro da pasta do projeto, rode:

   ```bash
   npm install
   npm run package
   ```

2. Isso cria um arquivo **`calendario-editorial-producao.zip`**.
3. Entre no painel da **Hostinger** → **Gerenciador de Arquivos** → pasta
   **`public_html`**.
4. Apague o que estiver lá (ou mova para uma pasta `backup`).
5. Envie o zip e use **Extrair** ali mesmo.
   ⚠️ O conteúdo tem que ficar **direto** em `public_html`, não dentro de uma
   subpasta.
6. ⚠️ **O passo que mais dá problema:** ligue "mostrar arquivos ocultos" no
   gerenciador e confirme que subiu um arquivo chamado **`.htaccess`**.
   Sem ele, recarregar a página dentro do sistema devolve "404 não
   encontrado".
7. Confirme que o domínio está com **HTTPS** (cadeado).

**Como saber que deu certo:** abra `seudominio.com.br/app/login`, entre, e
aperte F5. Se continuar na mesma tela em vez de dar 404, está certo.

---

# Opcionais

Estes três são opcionais de verdade: **sem eles o sistema funciona**. Cada um
liga uma coisa a mais.

---

## Opcional A — E-mail do código de aprovação ⏱️ 30 minutos

**Para que serve:** quando o cliente vai aprovar um post pelo link, o sistema
manda um código de 6 dígitos no e-mail dele. É isso que impede que quem só
achou o link decida no lugar do cliente.

**Sem isso:** o cliente ainda vê o calendário pelo link, mas a tela avisa que
o envio de e-mail não está configurado. Nada quebra — fica incompleto, e
visivelmente.

**O que fazer:**

1. Crie conta grátis em <https://resend.com> (3.000 e-mails por mês).
2. **Verifique um domínio seu** lá dentro. ⚠️ Esse passo é obrigatório: sem
   domínio verificado, o Resend só entrega e-mail para você mesmo.
3. Siga o passo a passo em `supabase/functions/README.md`, seção
   `send-approval-code`.
4. No painel, cadastre o e-mail de cada cliente na ficha dele.

---

## Opcional B — Assistente de IA ⏱️ 15 minutos

**Para que serve:** o assistente lê os dados reais da agência e ajuda — resume
seu dia, sugere pautas que respeitam o planejamento, escreve legenda e
roteiro, lê a análise de concorrência e diz o que fazer primeiro, explica o
mês do financeiro em português simples, sugere o próximo passo com um cliente
em potencial.

**Sem isso:** o sistema inteiro funciona igual. Os botões do assistente
explicam que ele está desligado, em vez de dar erro.

**O que fazer:**

1. Crie conta em <https://console.anthropic.com>.
2. ⚠️ **Antes de mais nada, ponha um limite de gasto mensal** na conta
   (Settings → Limits). Comece com US$ 10. É a sua rede de proteção.
3. Em **Settings → API keys**, crie uma chave. Ela começa com `sk-ant-`.
   ⚠️ **Copie na hora**: depois que você fecha a tela, ela não aparece mais.
4. No computador, na pasta do projeto, rode os dois comandos:

   ```bash
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-cole-a-sua-chave-aqui
   supabase functions deploy assistente
   ```

5. Abra o sistema → **Integrações** → **Assistente de IA** → ligue a chavinha.
6. Ali mesmo escolha o **teto de perguntas por dia** (o padrão é 100).

**Quanto custa?** Você paga por pergunta, à Anthropic, por tamanho de texto.
As perguntas daqui são pequenas: na prática, centavos por pergunta. O teto
diário é o que impede uma surpresa.

**Onde a chave fica?** No servidor, num cofre do Supabase. O site nunca a vê,
e ela nunca entra no código.

> **Quer só experimentar antes de publicar?** Na demonstração (que roda no
> navegador, sem servidor), a tela de Integrações aceita colar a chave
> direto. É cômodo para testar e **ruim para valer**: quem abrir aquele
> navegador lê a chave. Apague depois do teste, no mesmo lugar.

---

## Opcional C — Avisar outros sistemas (webhooks) ⏱️ 15 minutos

**Para que serve:** avisar outro sistema seu quando algo acontece aqui — por
exemplo, mandar uma mensagem no WhatsApp quando o cliente aprova um post.

**Sem isso:** os avisos ficam numa fila no banco e não saem. A tela de
Integrações diz isso, com o número de avisos parados.

**O que fazer:** está em `docs/PUBLICAR.md`, seção **2b**.

---

# Duas coisas que não são tarefa, mas você precisa saber

## 1. O advogado

O sistema registra a assinatura do contrato com **aceite simples**: guarda o
IP, a data e o navegador de quem aceitou. Foi a decisão que você tomou.

⚠️ **Antes de usar isso para valer, mostre para um advogado.** Eu posso
garantir que o sistema guarda o que foi decidido guardar; não posso garantir
que isso basta juridicamente para o seu caso.

## 2. O banco gratuito dorme

O plano gratuito do Supabase pausa o projeto depois de ~7 dias sem uso. Já
existe um robô no repositório que cutuca o banco todo dia
(`.github/workflows/keep-supabase-awake.yml`), mas é paliativo: o GitHub
desliga robôs de repositórios parados há 60 dias.

**Se o sistema for entrar em uso de verdade, com cliente mexendo, o plano pago
do Supabase (US$ 25/mês) é o que garante que ele não dorme.** Até lá, se um
dia a tela de login der erro de conexão, quase sempre é isso: volte na
Tarefa 1.

---

# Resumo em uma tabela

| # | Tarefa | Obrigatória? | Tempo | Onde |
|---|---|---|---|---|
| 1 | Acordar o banco | Sim | 5 min | supabase.com |
| 2 | Montar o banco | Sim | 10 min | supabase.com |
| 3 | Confirmar seu login | Sim | 2 min | supabase.com |
| 4 | Subir o site | Sim | 20 min | Hostinger |
| A | E-mail do código | Não | 30 min | resend.com |
| B | Assistente de IA | Não | 15 min | console.anthropic.com |
| C | Avisar outros sistemas | Não | 15 min | computador |

Qualquer passo que travar, me chame e diga **em qual número** travou e
**o que apareceu na tela**. Com isso eu acho o problema rápido.
