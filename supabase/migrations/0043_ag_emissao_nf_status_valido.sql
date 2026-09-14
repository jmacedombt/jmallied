-- Sistema Allied | Grupo J.Macedo
-- Migration 0043: libera os 2 status novos de "Ag. Emissão de Nota
-- Fiscal" (ver lib/orcamentos.ts) na constraint
-- orcamentos_status_operacional_valido — sem isso, o "Emitir NF -
-- Envio de Pré Ordem" (7 e 8) sempre falhava com "new row for
-- relation orcamentos violates check constraint
-- orcamentos_status_operacional_valido", porque essa constraint (criada
-- na 0004, redefinida por completo nas migrations 0013/0033/0034) só
-- listava os status que já existiam até a 0034 e ainda não sabia dos 2
-- que a "Ag. Emissão de Nota Fiscal" introduziu.
--
-- Mesma lista da 0034, só acrescentando os 2 novos no final.
alter table public.orcamentos
  drop constraint if exists orcamentos_status_operacional_valido;

alter table public.orcamentos
  add constraint orcamentos_status_operacional_valido check (
    status_operacional in (
      'Ag. Abertura',
      '1 - Ag. Triagem',
      '2 - Ag. Análise',
      'Validação de Orçamentos',
      '3 - Ag. Resposta de Orçamento',
      'Ag. Contra Proposta',
      '4 - Ag. Resposta de Reorçamento',
      '5 - Ag. Peças',
      '6 - Ag. Reparo',
      'OQC - Controle de Qualidade',
      '7 - Reparo Finalizado',
      '8 - Orçamento Reprovado',
      'Ag. NF Retorno (Recusados)',
      'Ag. NF Serviço / Venda / Retorno',
      'Produto Entregue'
    )
  );
