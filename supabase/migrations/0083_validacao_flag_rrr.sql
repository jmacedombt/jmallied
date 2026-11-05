-- Sistema Allied | Grupo J.Macedo
-- Migration 0083: flag "RRR - Reincidência" em Validação de Orçamentos
-- (pedido explícito, 05/11/2026). Com a flag ATIVA, a Mão de Obra do
-- orçamento fica ZERADA (não cobra) — na tela e no Confirmar Envio
-- (planilha da Allied + valor gravado).
--   validacao_rrr = null  → segue a marcação automática da importação
--                           (orcamentos.reincidente)
--   validacao_rrr = true/false → ligada/desligada à mão no pop-up
alter table public.orcamentos
  add column if not exists validacao_rrr boolean,
  add column if not exists validacao_rrr_alterado_por uuid references public.usuarios (id),
  add column if not exists validacao_rrr_alterado_em timestamptz;

comment on column public.orcamentos.validacao_rrr is
  'Flag RRR (reincidência) em Validação de Orçamentos: true = Mão de Obra zerada. null = segue orcamentos.reincidente (automático da importação).';
