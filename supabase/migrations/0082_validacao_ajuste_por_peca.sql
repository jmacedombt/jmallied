-- Sistema Allied | Grupo J.Macedo
-- Migration 0082: Validação de Orçamentos — alterar a VENDA peça por peça,
-- com justificativa obrigatória (pedido explícito, 05/11/2026).
--   validacao_pecas_venda_manual = { "<posição>": <venda>, ... } (só as
--   peças alteradas; "1".."10" e "Extra 1".."Extra 5"). Custo e Imposto
--   da peça não mudam; Venda de Peças e lucros somam a partir daí.
-- Vale na tela E no Confirmar Envio (planilha da Allied + valor gravado).
-- Salvar o ajuste por peça zera o ajuste manual dos totais (migration
-- 0021) daquele aparelho, pra os dois não brigarem.

alter table public.orcamentos
  add column if not exists validacao_pecas_venda_manual jsonb,
  add column if not exists validacao_pecas_justificativa text,
  add column if not exists validacao_pecas_ajustado_por uuid references public.usuarios (id),
  add column if not exists validacao_pecas_ajustado_em timestamptz;

comment on column public.orcamentos.validacao_pecas_venda_manual is
  'Venda de cada peça alterada à mão em Validação de Orçamentos: {"posição": valor}. null = tudo automático.';
