-- Sistema Allied | Grupo J.Macedo
-- Migration: Reorçamento (peça adicional descoberta durante o reparo)
--
-- Botão "Reorçamento" em "6 - Ag. Reparo" (ao lado de "Reparado"): o
-- técnico descobre, durante o reparo, que precisa de uma peça fora do
-- orçamento original — lança o custo que viu no GSPN (até 5 posições,
-- reaproveitando peca_add_1..5 / custo_peca_add_1..5, já existentes
-- desde a importação — migration 0003) e uma justificativa. O sistema
-- recalcula markup + ICMS de cada peça nova e soma com as peças normais
-- já aprovadas (validacao_snapshot) pra chegar no novo total do reparo,
-- que avança direto pra "4 - Ag. Resposta de Reorçamento".
--
-- reorcamento_detalhe guarda esse cálculo completo (mesmo formato de
-- validacao_snapshot) congelado no momento do pedido — vai ser a base da
-- tela de "4 - Ag. Resposta de Reorçamento" quando ela ganhar uma tela
-- própria (hoje ainda cai no fallback genérico PainelEtapaSimples).

alter table public.orcamentos
  add column if not exists reorcamento_motivo text,
  add column if not exists reorcamento_detalhe jsonb,
  add column if not exists reorcamento_solicitado_por uuid references public.usuarios (id),
  add column if not exists reorcamento_solicitado_em timestamptz;

comment on column public.orcamentos.reorcamento_motivo is
  'Justificativa do técnico ao pedir Reorçamento em "6 - Ag. Reparo" (peça adicional descoberta durante o reparo, fora do orçamento original) — ver PopupReorcamento.tsx.';

comment on column public.orcamentos.reorcamento_detalhe is
  'Cálculo completo do Reorçamento (peças normais já aprovadas + peças adicionais novas + mão de obra recalculada) congelado no momento do pedido — mesmo formato de validacao_snapshot (DetalheValidacaoOrcamento, ver lib/orcamentos.ts calcularDetalheReorcamento).';
