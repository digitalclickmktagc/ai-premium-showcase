# Edge Functions

## `send-approval-code`

Envia por e-mail o código de verificação que o cliente usa para confirmar uma
decisão tomada pelo link de compartilhamento.

### Por que é uma função, e não SQL

O Postgres não envia e-mail. A função anônima `issue_approval_code` grava o
hash e **descarta** o código de propósito — ela é chamável por qualquer um com
o link. Quem busca o código em claro é esta Edge Function, que roda com a
`service_role` (chave que não existe no navegador) e chama
`issue_approval_code_delivery`, criada na migração `004_entrega_codigo.sql`.

### Pré-requisitos

1. Rodar as migrações, nesta ordem: `001_aprovacao_externa.sql`,
   `003_automacoes.sql`, `004_entrega_codigo.sql`.
2. Conta no [Resend](https://resend.com) (o plano grátis cobre 3.000 e-mails por
   mês / 100 por dia) com **um domínio verificado**. Sem domínio verificado o
   Resend só entrega para o e-mail dono da conta, o que não serve para clientes.

### Implantação

```bash
supabase login
supabase link --project-ref hpfjlwleftckgovkssap

# segredos (ficam no servidor; nunca no repositório)
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx
supabase secrets set APPROVAL_FROM_EMAIL="Aprovações <aprovacao@seudominio.com.br>"
# opcional: para onde vão as respostas do cliente
supabase secrets set APPROVAL_REPLY_TO="contato@seudominio.com.br"

# o cliente é anônimo (tem o link, não tem login), então a função não exige JWT
supabase functions deploy send-approval-code --no-verify-jwt
```

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injetadas pelo próprio
Supabase — não as defina à mão.

### Conferir

```bash
curl -i -X POST \
  "https://hpfjlwleftckgovkssap.supabase.co/functions/v1/send-approval-code" \
  -H "Content-Type: application/json" \
  -d '{"token":"<share token>","postId":"<uuid do post>"}'
```

Esperado: `200` com `{"masked_email":"a***@dominio.com","delivered":true}` e o
e-mail na caixa do cliente. Chamando duas vezes seguidas, a segunda deve voltar
`400` com "Aguarde N segundos" — o intervalo mínimo é aplicado no banco.

### Segurança

- A função não exige JWT, mas **não é um endpoint aberto**: o token precisa
  existir, o post precisa pertencer ao calendário daquele token e há intervalo
  mínimo de 60 s entre pedidos, tudo verificado em SQL. O e-mail só pode ir
  para o endereço cadastrado daquele cliente.
- O código em claro nunca é registrado em log, nem em caso de erro.
- Enquanto `RESEND_API_KEY` e `APPROVAL_FROM_EMAIL` não existirem, a função
  responde `501` e o app avisa que o envio não está configurado, em vez de
  fingir que enviou.

## `dispatch-webhooks`

Entrega os eventos que os gatilhos da migração `018_webhooks.sql` enfileiram em
`webhook_delivery`.

### Por que é uma função, e não SQL

O Postgres não faz POST para fora (sem `pg_net`, que o plano grátis não traz
habilitado por padrão). Os gatilhos **enfileiram**; esta função **entrega**.
A separação também é o que torna o evento confiável: quem decide que algo
aconteceu é o banco, não o navegador, então o evento dispara venha a mudança
deste app, do link público do cliente ou de alguém editando a linha na mão.

### O que ela faz

1. Pega até 25 entregas pendentes e vencidas.
2. Assina o corpo exato com HMAC-SHA256 usando o segredo da assinatura, e
   manda em `X-Orkestrya-Signature: sha256=<hex>`.
3. 2xx vira `entregue`. Qualquer outra coisa agenda nova tentativa com espera
   crescente (1 min, 5 min, 30 min, 2 h) e desiste na quinta — endpoint morto
   martelado para sempre é como uma agência leva bloqueio de IP.

### Como publicar e agendar

```bash
supabase functions deploy dispatch-webhooks --no-verify-jwt
```

E um agendamento de minuto em minuto, no SQL editor do projeto:

```sql
select cron.schedule('webhooks', '* * * * *', $$
  select net.http_post(
    url := 'https://<project>.supabase.co/functions/v1/dispatch-webhooks',
    headers := jsonb_build_object('Authorization', 'Bearer <anon key>'))
$$);
```

### Enquanto isso não existir

A fila cresce e **nada sai**. A tela de integrações diz isso em português, com
o número de entregas paradas: promessa de entrega que não entrega é pior do
que não ter webhook nenhum.

### Como quem recebe confere a assinatura

```js
const assinatura = req.headers["x-orkestrya-signature"];
const esperado = "sha256=" + crypto.createHmac("sha256", SEGREDO)
  .update(corpoBruto).digest("hex");
// compare em tempo constante (crypto.timingSafeEqual)
```

O corpo precisa ser o **bruto**, byte a byte: reserializar o JSON muda a
assinatura.

---

## `assistente`

O assistente de IA (ficha 22). É aqui — e só aqui — que a chave da Anthropic
existe em produção.

### Por que é uma função, e não uma chamada do navegador

Chave de API em código de navegador é chave pública: qualquer pessoa abre o
inspetor e copia. A função guarda a chave no servidor, exige o token de quem
está logado, pergunta ao banco se pode gastar e só então chama a Claude.

### O que ela faz

1. Confere se a ação pedida está no catálogo (as oito de `src/calendar-app/ai.ts`).
2. Chama `public.ai_pode_chamar(acao)` com o token de quem pediu. Essa função
   responde `desligado`, `acao_nao_liberada`, `limite_diario` ou `ok`, e é ela
   que carrega o modelo e o capricho configurados em `ai_settings`.
3. Chama a Claude com `fallbacks: "default"` — quando o primeiro modelo recusa
   o pedido por política, a própria API repete em outro, dentro da mesma
   chamada. Sem isso, uma recusa volta vazia para quem perguntou.
4. Grava uma linha em `ai_call`: quem, qual ação, qual modelo, quantos tokens.
   Essa tabela não se edita nem se apaga.

**O que ela não faz:** escrever em qualquer tabela do negócio. O único
`insert` do arquivo é o registro de uso. Toda resposta volta como texto e só
entra no sistema quando alguém clica em "aplicar", na tela.

### Como publicar

```bash
# a chave sai em console.anthropic.com → Settings → API keys
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

# sem --no-verify-jwt: só quem está logado no painel pode chamar
supabase functions deploy assistente
```

Depois, no painel: **Integrações → Assistente de IA → ligar**. Ali também ficam
o modelo, o capricho da resposta, o teto de perguntas por dia e quais ações
estão liberadas.

### Conferir

```bash
curl -i -X POST "https://<projeto>.supabase.co/functions/v1/assistente" \
  -H "Authorization: Bearer <access_token de um login do painel>" \
  -H "apikey: <anon key>" \
  -H "Content-Type: application/json" \
  --data '{"action":"resumo_do_dia","system":"teste","prompt":"Diga oi.","data":{}}'
```

- `403 {"reason":"desligado"}` → a função está de pé; falta ligar em Integrações.
- `503 {"reason":"sem_chave"}` → faltou o `supabase secrets set`.
- `200 {"ok":true,"text":"…"}` → está funcionando.

### Custo

Cada pergunta é cobrada pela Anthropic, por tamanho de texto. Quem segura a
conta é o teto diário em `ai_settings.daily_limit` (padrão 100) — e dá para
conferir o gasto real:

```sql
select action, count(*), sum(input_tokens), sum(output_tokens)
  from public.ai_call
 where at >= date_trunc('month', now())
 group by action order by 2 desc;
```

### Sem servidor

Na demonstração em localStorage não há Edge Function. Para experimentar, a tela
de Integrações aceita uma chave guardada **naquele navegador** — cômodo para
testar, ruim para produção, e a tela diz isso. O teto diário não vale nesse
modo: quem conta é a Anthropic.
