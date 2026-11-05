# Decisões tomadas — benchmark Orkestrya

Respondido em 2026-11-05. Este arquivo é o registro oficial; substitui o
checklist em aberto.

## Bloqueavam a próxima entrega

| # | Decisão | Resposta |
|---|---|---|
| A1 | Cliente logado no portal decide sem o link | **Sim** |
| A2 | Verificação do decisor | **Sempre pedir código por e-mail** |

> **Leitura combinada de A1 + A2:** acesso pelo link público **sempre** exige
> código por e-mail. O cliente autenticado no hub conta como já verificado
> (`decisor_verificado = verdadeiro`) e decide sem código. Se a intenção for
> pedir código mesmo para quem já está logado, é só avisar.

## Fundação

| # | Decisão | Resposta |
|---|---|---|
| B1 | Provedor de autenticação | **Supabase Auth** (mantido; a resposta tratou de ambição de produto, não do provedor) |
| B2 | Isolamento entre workspaces | **Por coluna** (`workspace_id` + RLS) |
| B3 | Usuário em mais de um workspace | **Não** |
| B4 | Retenção pós-encerramento | **5 anos** (contratos assinados e registros financeiros) |

**Norte de produto:** levar este projeto ao nível da plataforma de referência,
de forma incremental sobre a base atual — não como projeto novo.

## Dependem de terceiro

| # | Decisão | Resposta |
|---|---|---|
| C1 | Enquadramento da assinatura | **Simples** (aceite com evidência: IP, data, agente) |
| C2 | Testemunhas no contrato | **Sim, obrigatórias** |
| C3 | Busca automática de empresas no CRM | **Não usar** (evita custo de API e exposição LGPD) |
| C4 | Emissão de NFS-e | **Fora do escopo por enquanto** |

> C1 e C2 continuam sendo itens para validação de advogado **antes** de a
> assinatura entrar em produção. A decisão está registrada; a conferência
> jurídica segue pendente.

## Demais

| # | Decisão | Resposta |
|---|---|---|
| D1 | Pesos do índice de saúde | Padrão, sem ajuste |
| D2 | O que conta como interação do cliente | Manter (portal, decisão em revisão, e-mail registrado) |
| D3 | "Pausado" ocupa vaga do plano | Sim — **inativo por ora** (não há planos pagos) |
| D4 | Natureza padrão da tarefa | Herdada do modelo |
| D5 | Feriados em dias úteis | **Nacional + distrital (Brasília)** |
| D6 | Excluir arquivadas após | **30 dias** |
| D7 | Calendários externos | Não |
| D8 | Reserva pública exige verificar e-mail | Não |
| D9 | Financeiro no portal do cliente | Não |
| D10 | Domínio próprio no portal | Não |
| D11 | Contrato por proposta ou por item | **Por proposta** |
| D12 | Código de verificação no aceite da proposta | **Sim** |
| D13 | Numeração de propostas | **Automática** |
| D14 | Gatilho operacional | **Assinatura de todas as partes** |
| D15 | Plano de grupos de resultado | Modelo simplificado MEI/ME |
| D16 | Janela de materialização | 35 dias |
| D17 | Leads de anúncios | Onda a definir pelo titular |
| D18 | Vendedor vê negócios de colegas | Não |
| D19 | Onboarding ao fechar venda | **Iniciar sozinho** |
| D20 | Projeto para recorrente sem prazo | Sim |
| D21 | Proposta quando o plano bloqueia | Impedir o aceite — **inativo por ora** |

## Decisões adicionais do titular

1. **Sem cobrança do cliente final.** Não há planos pagos nem gateway de
   pagamento no escopo. Remove F13c (cobrança via gateway) e deixa D3 e D21
   sem efeito prático até que planos existam.
2. **Hub do cliente:** construir, porém **desativado por padrão**, atrás de
   uma chave de funcionalidade, para ativação futura.

## Consequências no escopo

| Item | Situação |
|---|---|
| F13c — Cobrança via gateway | **Fora** |
| Planos pagos / vagas de plano | **Fora** (lógica fica inerte) |
| Hub do cliente (Spec 05) | Construir **desligado** |
| Busca de empresas no CRM (F10 parcial) | **Fora** |
| NFS-e | **Fora** |

## Bloqueio técnico conhecido

A2 ("sempre pedir código por e-mail") exige envio de e-mail, que o sistema
ainda **não** possui. Dois pré-requisitos:

1. **E-mail de contato do cliente** — a entidade `Client` hoje não guarda
   e-mail. Precisa ser adicionado.
2. **Provedor de envio** — o SMTP embutido do Supabase é limitado a poucos
   e-mails por hora e é destinado a teste, não a produção. Para valer é
   preciso SMTP próprio ou um serviço (Resend, SendGrid, Postmark).

Enquanto não houver provedor, a verificação é construída com transporte
plugável: em ambiente de testes o código aparece na tela, e passa a ser
enviado por e-mail assim que a credencial existir.
