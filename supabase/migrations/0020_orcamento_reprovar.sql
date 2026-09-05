-- Sistema Allied | Grupo J.Macedo
-- Migration: reprovar orçamento manualmente
--
-- Novo ícone de cancelamento, disponível em qualquer etapa do
-- Operacional antes de "8 - Orçamento Reprovado"/"Produto Entregue" —
-- abre um pop-up com uma justificativa (por padrão "Orçamento recusado -
-- Alto Custo", editável) e, ao salvar, avança o orçamento direto pra
-- "8 - Orçamento Reprovado" (ver PopupReprovarOrcamento.tsx e
-- api/operacional/orcamentos/[id]/reprovar).
--
-- motivo_reprova já existia (preenchido só na importação da planilha de
-- Orçamentos, ver 0003_orcamentos.sql) — passa a ser gravado/editado
-- também por essa ação manual. reprovado_por/reprovado_em registram quem
-- reprovou e quando, mesmo padrão já usado em
-- analise_confirmada_por/em (0013_validacao_orcamentos.sql).

alter table public.orcamentos
  add column if not exists reprovado_por uuid references public.usuarios (id),
  add column if not exists reprovado_em timestamptz;

comment on column public.orcamentos.reprovado_em is
  'Quando o orçamento foi reprovado manualmente (ícone de cancelamento, disponível nas etapas antes de "8 - Orçamento Reprovado"). NULL = nunca reprovado por essa ação (o orçamento ainda pode estar em "8 - Orçamento Reprovado" se veio assim direto da importação da planilha).';
