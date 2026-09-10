-- Sistema Allied | Grupo J.Macedo
-- Migration: fluxo de "5 - Ag. Peças" (pedido/chegada da peça) e
-- "6 - Ag. Reparo" (confirmação do reparo) + nova etapa "OQC - Controle
-- de Qualidade"
--
-- Duas partes:
--   1) nova etapa "OQC - Controle de Qualidade", inserida SEM número
--      entre "6 - Ag. Reparo" e "7 - Reparo Finalizado" — mesmo padrão já
--      usado pra "Validação de Orçamentos" (migration 0013) e "Ag.
--      Contra Proposta" (migration 0033): não renumera nem migra as
--      etapas seguintes, que já têm o número gravado no valor de
--      status_operacional de cada orçamento existente. Por enquanto é só
--      etapa de consulta (o fluxo de aprovação/reprovação de qualidade
--      entra numa próxima rodada).
--   2) campos novos em orcamentos: controle do pedido de peça em
--      "5 - Ag. Peças" (pedido_peca_feito, fica amarelo na tela até a
--      peça chegar de fato) e de quem/quando confirmou o reparo em
--      "6 - Ag. Reparo".

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
      'Produto Entregue'
    )
  );

-- controle do pedido de peça em "5 - Ag. Peças": marcado quando o
-- pedido foi feito (fundo/borda amarela na tela) — dá pra desmarcar se
-- foi clicado por engano. Fica sem efeito assim que o aparelho avança
-- (botão "Peça chegou", que só libera depois que o pedido foi marcado).
alter table public.orcamentos
  add column if not exists pedido_peca_feito boolean not null default false,
  add column if not exists pedido_peca_feito_em timestamptz,
  add column if not exists pedido_peca_feito_por uuid references public.usuarios (id),
  add column if not exists peca_chegou_em timestamptz;

comment on column public.orcamentos.pedido_peca_feito is
  'true = pedido da peça já foi feito em "5 - Ag. Peças" (fundo/borda amarela) — pode ser desmarcado se marcado por engano. O botão "Peça chegou" (avança pra "6 - Ag. Reparo") só libera com esse campo true.';

-- controle do reparo em "6 - Ag. Reparo": quem confirmou e quando,
-- avançando pra "OQC - Controle de Qualidade".
alter table public.orcamentos
  add column if not exists reparo_confirmado_por uuid references public.usuarios (id),
  add column if not exists reparo_confirmado_em timestamptz;
