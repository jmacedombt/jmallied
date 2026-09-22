-- "Valor recebido da Contra Proposta" (pedido explícito) — quando o
-- upload de "3 - Ag. Resposta de Orçamento" (aprovação de orçamentos)
-- traz status "Contra Proposta"/variações na coluna BQ do arquivo, a
-- coluna BS traz o valor total (peças + mão de obra já somados) que a
-- Allied contra-propôs pra aquele OS Reparadora — guardado aqui só como
-- referência, mostrado em Ag. Contra Proposta ao lado do que a equipe
-- já vinha ajustando peça a peça (não substitui nem altera esse ajuste
-- manual). Ver lib/aprovacaoOrcamentos.ts e a rota
-- /api/operacional/orcamentos/upload-aprovacao.

alter table public.orcamentos
  add column if not exists contra_proposta_valor_recebido_allied numeric;

comment on column public.orcamentos.contra_proposta_valor_recebido_allied is
  'Valor total (peças + mão de obra) que a Allied contra-propôs, lido da coluna BS do arquivo de aprovação de orçamentos quando a coluna BQ (STATUS ORÇAMENTO) vier "Contra Proposta"/variações. Só referência — não participa do ajuste peça a peça feito manualmente em Ag. Contra Proposta (ver PopupPecasContraProposta.tsx).';
