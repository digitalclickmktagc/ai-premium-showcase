# Avaliação do sistema — o que existe, o que falta, o que ficou de fora

Escrito em 23/11/2026, depois de varrer o sistema inteiro no navegador e
comparar com a plataforma de referência (Orkestrya).

Este arquivo responde três perguntas:

1. **O que já está pronto?**
2. **O que ficou de fora — e foi de propósito ou foi esquecimento?**
3. **O que ainda depende de você?** (o passo a passo está em
   `docs/O-QUE-FALTA-VOCE-FAZER.md`)

---

## 1. O tamanho da coisa

| | |
|---|---|
| Telas do painel | 23 |
| Páginas públicas (link do cliente) | 7 |
| Módulos de regra, testados um a um | 29 |
| Testes automáticos | **662**, todos passando |
| Tabelas no banco | 42 |
| Migrações de banco | 19 arquivos (001 a 020) |
| Funções de servidor (Edge Functions) | 3 |

Tudo isso roda com um comando só de instalação
(`supabase/instalacao-completa.sql`), conferido duas vezes num banco limpo
sem nenhum erro.

---

## 2. O que já está pronto

### Produção do conteúdo
- **Calendário** por cliente, em mês e em quadro (colunas que você configura).
- **Card completo**: status, descrição, link de referência, observações
  internas (que nunca chegam ao cliente), checklist, comentários, anexos e
  tempo gasto.
- **Pauta única do mês** com planejamento: pilares com fatia percentual,
  foco de funil, objetivos, metas e um panorama de equilíbrio que mostra se
  o mês está puxando demais para um lado.
- **Banco de ideias** com etiquetas, pessoas mencionadas e conversão em pauta.
- **Roteiros** de vídeo e de stories dentro do próprio card, com cenas,
  fala, texto na tela, duração e aviso quando passa do limite do formato.
- **Automações de coluna**: quando um card muda de coluna, dispara o que
  você configurou — com proteção contra laço e registro do que rodou.

### O cliente
- **Link exclusivo** por calendário. O cliente vê só o que é dele, sem login.
- **Aprovação com código por e-mail** — o link sozinho não decide nada.
- **Dossiê estratégico** com seções configuráveis e visibilidade por seção
  (o raio-X fica interno; o resto o cliente pode ver pelo link).
- **Formulários de briefing** com link público, respostas e resumo
  (incluindo NPS, com a fórmula à vista).
- **Reserva pública de horário** na agenda.
- **Hub do cliente** — construído, porém **desligado** por decisão sua.

### O negócio
- **Comercial**: catálogo de serviços, propostas numeradas e contrato com
  aceite registrado (IP, data e agente).
- **Financeiro**: contas, categorias, lançamentos, séries recorrentes,
  liquidação, transferências, saldo e previsão de fim de mês — tudo em
  centavos inteiros, sem erro de arredondamento.
- **Conciliação de extrato** (CSV e OFX): sugere, e quem concilia é você.
  Empate de valor no mesmo dia nunca é conciliado sozinho.
- **CRM**: funil, interações que não se editam, tarefas, cadência de
  retorno, importação de contatos, lista de bloqueio (LGPD) e o
  orquestrador que leva a venda fechada para dentro da operação.
- **Projetos e squads** como centro de custo, com progresso e índice de
  saúde — e a fórmula mostrada ao lado do número.

### Direção
- **Painel do dia**: o que está atrasado, o que aguarda cliente, o que vence
  hoje, e por onde começar.
- **Análise de perfil e concorrência**: critérios e pesos configuráveis,
  faixas documentadas, e a conclusão levada para o dossiê em vez de virar
  uma segunda verdade.
- **Assistente de IA** — veja abaixo.
- **Integrações (webhooks)** assinados, com fila no banco e tentativas
  espaçadas.
- **Ferramentas**: contador de caracteres, tempo de fala, taxa de
  engajamento, gerador de UTM, link de WhatsApp e formatador de legenda.

---

## 3. O assistente de IA

A plataforma de referência tem um assistente que **conhece os guias do
sistema**. A avaliação dessa mesma ficha dizia, com razão, que isso vale
pouco: responder "como faço X" é manual, não é ajuda.

O assistente daqui **lê os dados reais da agência**. São oito ações:

| Ação | Onde fica | O que faz |
|---|---|---|
| Resumir meu dia | Hoje | Lê o que está pendente e diz por onde começar |
| Sugerir pautas do mês | Pauta | Propõe pautas respeitando pilares e funil |
| Escrever legenda | Dentro do card | Gancho, corpo, chamada e hashtags |
| Rascunhar roteiro | Dentro do card | Cenas com fala, texto na tela e duração |
| Escrever conclusões | Análise | Lê as notas e diz o que fazer primeiro |
| Explicar o mês | Financeiro | Traduz o resultado em português simples |
| Sugerir próximo passo | CRM | Próximo passo e rascunho de mensagem |
| Resumir respostas | Formulários | O que as respostas dizem em comum |

Três regras valem para todas, e estão no código, não só na tela:

1. **A IA nunca grava sozinha.** Toda resposta é sugestão; só entra no
   sistema quando uma pessoa clica em "aplicar".
2. **Dá para ver o que vai ser enviado.** Antes de perguntar, a tela mostra
   o texto exato — instrução e dados — do jeito que a IA vai receber.
3. **E-mail, telefone, documento, CPF/CNPJ, token e chave são removidos**
   antes de qualquer coisa sair do navegador. Isso é testado: 37 testes só
   dessa parte.

Vem **desligado**. Ligar é uma escolha sua, em Integrações, e lá também
ficam o modelo, o capricho da resposta, o teto de perguntas por dia e quais
ações estão liberadas.

### O que eu não consegui conferir
Não tenho chave da Anthropic aqui, e este ambiente não permite guardar uma.
Então:

- ✅ **Conferido**: a chamada chega na API da Anthropic (voltou 401 por falta
  de chave, o que prova que a rede, o endereço e o formato do pedido estão
  certos); o formato exato do pedido confere com os tipos da biblioteca
  oficial (versão 1.12.0); chave inválida vira a mensagem em português
  "A chave da Anthropic foi recusada".
- ⚠️ **Não conferido com chave de verdade**: a resposta completa voltando e
  sendo aplicada na tela. Isso só dá para testar com sua chave.
- 🛡️ **Proteção que coloquei por causa disso**: se a API recusar o recurso
  de "resgate de recusa" (`fallbacks`), o sistema repete a chamada sem ele
  em vez de falhar. Perde-se o resgate, não o assistente.

---

## 4. Varredura de botões e de rolagem

Rodei o sistema inteiro no navegador, em tela de celular (390px), celular
baixo (360×560), notebook baixo (1280×600) e desktop (1280×900).

### Consertado nesta rodada

| Problema | Onde | O que era |
|---|---|---|
| **Menu não rolava** | Painel inteiro, em janela baixa | Numa janela de 600px de altura os últimos itens do menu (CRM, Financeiro, Integrações, sair) ficavam fora da tela sem jeito de alcançar. Agora o menu rola e o rodapé da conta fica fixo embaixo. |
| Página escapando para o lado | Pauta (13px) e Análise (128px), no celular | Dava para arrastar a página para o lado. Corrigido. |
| Botão sem nome | Integrações e Análise | Dois botões de lixeira que o leitor de tela anunciava só como "botão". |
| Nota selecionada invisível para leitor de tela | Análise | As seis notas (0 a 5) eram iguais para quem não enxerga a cor. Agora anunciam qual está marcada. |
| Caixa de seleção difícil de acertar no dedo | Pauta, Formulários | 16px de alvo. Agora 28px de área de toque, com o mesmo desenho de 16px. |
| Etiquetas pequenas demais | Ideias, Agenda | 23px de altura. Agora 24px ou mais. |
| Campo de cor sem nome | Ficha do cliente | Corrigido. |
| Agenda ilegível no celular | Agenda | A grade do mês vira sete colunas de 50px num celular. Agora quem abre num aparelho estreito começa na **lista**, e troca para o mês se quiser. |

### Conferido e em ordem
- **Zero erros de JavaScript** em todas as 14 telas do painel, em todos os
  tamanhos de tela.
- As **abas rolam** na horizontal no celular (Financeiro, Comercial, Pauta,
  Formulários) em vez de empurrar a página.
- O **menu lateral rola** inteiro em janela baixa, com o rodapé fixo.
- Todos os botões têm nome para leitor de tela.
- Os diálogos (card, lançamento, negócio, compromisso, assistente) abrem,
  fecham com Esc e não têm campo sem rótulo.

### Limitação conhecida, não corrigida
A **grade do mês da Agenda**, quando aberta de propósito no celular, tem
compromissos de 38×17 pixels. Isso é da natureza de um calendário mensal em
tela estreita: aumentar o tamanho quebraria a grade. A saída é a visão
**Lista**, que agora é a inicial no celular.

---

## 5. O que ficou de fora — e por quê

### Fora por decisão sua (registrado em `docs/decisoes-tomadas.md`)

| Item | Motivo |
|---|---|
| Cobrança e planos pagos (gateway) | Fora do escopo |
| Emissão de NFS-e | Fora do escopo |
| Busca automática de empresas no CRM | Evita custo de API e exposição LGPD |
| Calendários externos (Google Agenda etc.) | Não |
| Financeiro no portal do cliente | Não |
| Domínio próprio no portal do cliente | Não |
| Vendedor ver negócios de colegas | Não (e não há múltiplos usuários) |

### Construído, porém desligado
- **Hub do cliente** (área logada do cliente). Está pronto, atrás de uma
  chave. Para ligar: publique com `VITE_FEATURE_CLIENT_HUB=on`.

### Depende de terceiro, não de código
- **Conferência jurídica** do modelo de assinatura (aceite simples com
  evidência, testemunhas obrigatórias). A decisão está tomada; um advogado
  precisa olhar antes de a assinatura valer em produção.

### Diferenças de fundo em relação à referência
Não são faltas — são escolhas, e vale você saber delas:

1. **Um único usuário.** O sistema tem uma conta de agência, não equipe com
   permissões. A referência tem vários usuários com papéis. Se um dia
   precisar, a base já separa o que é da agência do que é do cliente.
2. **Sem app de celular.** É um site que funciona no celular (PWA, dá para
   instalar na tela inicial), não um aplicativo de loja.
3. **Sem relatório de métricas de redes sociais.** O sistema não puxa dados
   do Instagram/Facebook. O que existe é a análise manual, com notas.
4. **Sem agendamento de publicação automática.** O sistema organiza o que
   vai ao ar; publicar continua sendo manual.

Esses quatro pontos são os únicos lugares onde a referência faz algo que
aqui não existe. Os três primeiros foram decisões; o quarto nunca entrou em
nenhuma ficha e fica registrado aqui como possibilidade futura.
