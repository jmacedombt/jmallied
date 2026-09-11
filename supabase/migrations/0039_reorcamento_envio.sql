-- Sistema Allied | Grupo J.Macedo
-- Migration: envio da planilha "COMPLEMENTAR" + aprovação em
-- "4 - Ag. Resposta de Reorçamento"
--
-- O Reorçamento pedido pelo técnico (6 - Ag. Reparo > Reorçamento) cai
-- direto em "4 - Ag. Resposta de Reorçamento" sem passar por nenhum
-- envio pra Allied (diferente da Contra Proposta, que já manda a
-- planilha antes de chegar aqui) — essa migration fecha essa lacuna:
--   1) reorcamento_enviado_em/_por: marca quando a planilha
--      "COMPLEMENTAR" (mesmo formato do envio original, agora com as
--      colunas PEÇA ADD/CUSTO PEÇA ADD preenchidas) foi gerada e
--      mandada pra Allied — null = ainda pendente de envio. Só existe
--      preenchido pra quem tem reorcamento_detalhe (chegou em "4" pelo
--      Reorçamento, não pela Contra Proposta — essa última já chega
--      "enviada" desde antes, não usa essas colunas).
--   2) aprovado_reorcamento_em/_por: quando alguém aprova manualmente
--      (botão "Aprovar", liberado só depois do envio acima — ou direto
--      pra quem veio da Contra Proposta), o aparelho avança pra
--      "5 - Ag. Peças".
--   3) orcamento_envios.tipo passa a aceitar também 'reorcamento'.

alter table public.orcamentos
  add column if not exists reorcamento_enviado_em timestamptz,
  add column if not exists reorcamento_enviado_por uuid references public.usuarios (id),
  add column if not exists aprovado_reorcamento_em timestamptz,
  add column if not exists aprovado_reorcamento_por uuid references public.usuarios (id);

comment on column public.orcamentos.reorcamento_enviado_em is
  'Quando a planilha COMPLEMENTAR desse reorçamento (pedido pelo técnico em 6 - Ag. Reparo) foi gerada e enviada pra Allied — null = ainda pendente. Libera o botão Aprovar em "4 - Ag. Resposta de Reorçamento".';

comment on column public.orcamentos.aprovado_reorcamento_em is
  'Quando o botão Aprovar (4 - Ag. Resposta de Reorçamento) foi clicado — ação individual, sem trava de cargo, igual o Reprovar. Avança pra "5 - Ag. Peças".';

alter table public.orcamento_envios
  drop constraint if exists orcamento_envios_tipo_check;

alter table public.orcamento_envios
  add constraint orcamento_envios_tipo_check check (tipo in ('orcamento', 'contra_proposta', 'reorcamento'));
