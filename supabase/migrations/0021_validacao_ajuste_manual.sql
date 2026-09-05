-- Sistema Allied | Grupo J.Macedo
-- Migration: ajuste manual de valores em Validação de Orçamentos
--
-- No pop-up de peças de um orçamento (PopupPecasValidacao.tsx), um lápis
-- libera a edição de Venda de Peças, Lucro Líquido da Peça, Mão de obra e
-- Lucro Total — os quatro totais do resumo (nunca as peças individuais da
-- tabela, que continuam vindo sempre da Base Peças/BID). Uma vez salvo,
-- esse orçamento passa a usar os valores manuais gravados aqui em vez de
-- recalcular pela Base Peças a cada carregamento da tela — até alguém
-- editar de novo ou restaurar o cálculo automático (ver
-- aplicarAjusteManualValidacao em lib/orcamentos.ts e a rota
-- api/operacional/orcamentos/[id]/ajustar-valores).
--
-- custo/imposto também ficam congelados junto (validacao_custo_manual /
-- validacao_imposto_manual) mesmo sem terem campo de edição próprio —
-- senão uma mudança futura na Base Peças desmontaria a conta (Lucro da
-- Peça = Venda − Custo − Imposto) que já foi fechada manualmente.

alter table public.orcamentos
  add column if not exists validacao_ajustado_manualmente boolean not null default false,
  add column if not exists validacao_venda_manual numeric,
  add column if not exists validacao_custo_manual numeric,
  add column if not exists validacao_imposto_manual numeric,
  add column if not exists validacao_mao_de_obra_manual numeric,
  add column if not exists validacao_ajustado_por uuid references public.usuarios (id),
  add column if not exists validacao_ajustado_em timestamptz;

comment on column public.orcamentos.validacao_ajustado_manualmente is
  'true = os totais de Validação de Orçamentos desse orçamento vêm dos campos validacao_*_manual (editados à mão), não do cálculo automático pela Base Peças/BID.';
