# Decisões pendentes — benchmark Orkestrya

31 decisões extraídas das seções "Decisões em aberto" das 11 especificações.
Nenhuma delas se resolve olhando o sistema original: são escolhas suas de
produto, jurídico ou operação.

**Como responder:** marque `[x]` na opção escolhida, ou escreva ao lado.
Onde há **(padrão)**, não responder = aceitar o padrão.

---

## Grupo A — Bloqueiam a próxima entrega

Só estas duas travam a Spec 03 (aprovação do cliente), que é a candidata a
primeira implementação.

### A1. O cliente logado no portal pode aprovar sem abrir o link de e-mail?
- [ ] Sim — quem está no portal já é o cliente **(padrão sugerido)**
- [ ] Não — decisão só pelo link enviado

### A2. Exigir código de verificação para o cliente decidir?
- [ ] Nenhuma verificação para conteúdo; código só para documentos com valor **(padrão sugerido)**
- [ ] Sempre pedir código por e-mail
- [ ] Nunca pedir código

---

## Grupo B — Bloqueiam a fundação

Só importam se formos construir a plataforma completa (projeto novo). Se
ficarmos no calendário atual, estas já estão resolvidas pelo que existe hoje.

### B1. Provedor de autenticação
- [ ] Supabase Auth — já usamos, sem custo adicional **(recomendo)**
- [ ] Outro: ______________________

### B2. Isolamento entre workspaces
- [ ] Por coluna (`workspace_id` + RLS) — mais simples de operar **(recomendo)**
- [ ] Por schema — isolamento físico, operação mais cara

### B3. Um usuário pode pertencer a mais de um workspace?
(ex.: agência com filiais, freelancer atendendo duas agências)
- [ ] Não — um workspace por usuário, mais simples **(recomendo para começar)**
- [ ] Sim — já nascer multi-workspace

### B4. Prazo de retenção de dados após encerrar um cliente
- [ ] 5 anos para contratos assinados e registros financeiros **(padrão sugerido)**
- [ ] Outro prazo: ______________________

---

## Grupo C — Precisam de um terceiro

Não responda sozinho; estas têm custo ou risco externo.

### C1. 🏛️ Enquadramento jurídico da assinatura eletrônica — **validar com advogado**
- [ ] Simples (aceite com registro de IP/data/evidência)
- [ ] Avançada
- [ ] Integrar certificado ICP-Brasil em casos específicos

### C2. 🏛️ Testemunhas obrigatórias no contrato? — **validar com advogado**
Relevante para o contrato valer como título executivo extrajudicial.
- [ ] Sim, obrigatórias
- [ ] Não

### C3. ⚖️ Fontes de descoberta de empresas no CRM — **custo de API + base legal (LGPD)**
- [ ] Não usar busca automática de empresas (evita o tema por ora) **(recomendo para começar)**
- [ ] Usar — fonte pretendida: ______________________

### C4. 🧾 Emissão de nota fiscal de serviço entra no escopo? — **confirmar com contador**
- [ ] Não por enquanto — lançar o financeiro e emitir fora do sistema **(recomendo)**
- [ ] Sim — integrar com prefeitura/emissor

---

## Grupo D — Podem esperar

Todas têm padrão razoável. Revise quando chegarmos na onda correspondente.

### Clientes
- [ ] **D1.** Pesos do índice de saúde. Padrão: tarefa atrasada −5 (máx. −30);
      recebível vencido −20; revisão reprovada −10 (máx. −20); sem interação
      há 21 dias −15. Ajustar? ______________________
- [ ] **D2.** O que conta como "interação do cliente": mensagem no portal,
      decisão em revisão, e-mail registrado. Incluir/remover algo? ____________
- [ ] **D3.** Cliente "pausado" ocupa vaga do plano? Padrão: **sim**.

### Quadros e tarefas
- [ ] **D4.** Natureza padrão da tarefa por quadro. Padrão: herdada do modelo.
- [ ] **D5.** Feriados no cálculo de dias úteis: nacional apenas, ou nacional +
      municipal (Brasília)? ______________________
- [ ] **D6.** Prazo para excluir tarefas arquivadas: ____ dias.

### Agenda
- [ ] **D7.** Calendários externos além do principal (Google? Outlook?): ______
- [ ] **D8.** Reserva pública exige verificar e-mail? ______

### Portal do cliente
- [ ] **D9.** Mostrar financeiro ao cliente? Padrão: só recebíveis em aberto e
      pagos, **sem custos**.
- [ ] **D10.** Domínio próprio da agência no portal? ______

### Catálogo e propostas
- [ ] **D11.** Um contrato por proposta ou por item? Padrão: **por proposta**.
- [ ] **D12.** Exigir código de verificação no aceite da proposta? ______
- [ ] **D13.** Numeração de propostas automática ou manual? ______

### Contratos
- [ ] **D14.** O que dispara a operação: assinatura do contratante ou de todas
      as partes? ______

### Financeiro
- [ ] **D15.** Plano de grupos de resultado inicial. Padrão: modelo
      simplificado de prestador de serviço MEI/ME.
- [ ] **D16.** Janela de materialização de recorrências. Padrão: **35 dias**
      (até lá a parcela é só projeção, não vira lançamento).

### CRM
- [ ] **D17.** Leads de anúncios entram na onda 3 ou depois? ______
- [ ] **D18.** Vendedor enxerga negócios dos colegas? ______

### Orquestrador venda → operação
- [ ] **D19.** Ao fechar venda, iniciar o onboarding sozinho ou só sugerir? ____
- [ ] **D20.** Criar projeto para serviço recorrente sem prazo definido? ______
- [ ] **D21.** Se o plano do cliente bloquear: aceitar a proposta e aguardar
      upgrade, ou impedir o aceite antes? ______

---

## Resumo

| Grupo | Itens | Quando responder |
|---|---|---|
| A — próxima entrega | 2 | Agora, se formos pela aprovação do cliente |
| B — fundação | 4 | Só se for plataforma nova |
| C — terceiros | 4 | Antes de contratos/CRM/financeiro |
| D — podem esperar | 21 | Na onda correspondente |

Para destravar a próxima implementação bastam **A1 e A2**.
