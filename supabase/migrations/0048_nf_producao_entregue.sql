-- Sistema Allied | Grupo J.Macedo
-- Migration 0048: números de NF (Mão de Obra, Peças e Retorno) lançados
-- na tela "Ag. Emissão de Nota Fiscal" antes de mandar o orçamento pra
-- "Produto Entregue" (pedido explícito).
--
-- Guarda os dados DIRETO em cada linha de orcamentos (não numa tabela
-- separada) porque o valor de "NF Mão de Obra"/"NF Peças" é o MESMO pra
-- todos os aparelhos do bloco Aprovados de uma vez (repetido em toda
-- linha do bloco), e "NF Retorno" é o mesmo pra todos os aparelhos de
-- uma mesma NF Remessa (repetido em toda linha daquele lote) — ver
-- PainelAgEmissaoNf.tsx. Fica tudo persistido (não é conferência de
-- sessão como o Upload All Pending) porque é número de nota fiscal de
-- verdade, e precisa sobreviver a refresh/outro usuário/outro dia.
--
-- nf_exportado_em marca quando o botão "Exportar" daquele lote (NF
-- Remessa, dentro de Aprovados OU Recusados) foi clicado de fato e a
-- planilha foi gerada — é o que libera os ícones de NF daquele lote (só
-- depois de exportar é que faz sentido lançar as notas).

alter table public.orcamentos
  add column if not exists nf_mao_de_obra_numero text,
  add column if not exists nf_mao_de_obra_valor numeric,
  add column if not exists nf_pecas_numero text,
  add column if not exists nf_pecas_valor numeric,
  add column if not exists nf_retorno_numero text,
  add column if not exists nf_retorno_valor numeric,
  add column if not exists nf_exportado_em timestamptz;

comment on column public.orcamentos.nf_mao_de_obra_numero is 'Nº da NF de Mão de Obra lançada em Ag. Emissão de Nota Fiscal (bloco Aprovados) — mesmo número em todo aparelho do bloco.';
comment on column public.orcamentos.nf_pecas_numero is 'Nº da NF de Peças lançada em Ag. Emissão de Nota Fiscal (bloco Aprovados) — mesmo número em todo aparelho do bloco.';
comment on column public.orcamentos.nf_retorno_numero is 'Nº da NF de Retorno lançada em Ag. Emissão de Nota Fiscal — mesmo número em todo aparelho da mesma NF Remessa (Aprovados ou Recusados).';
comment on column public.orcamentos.nf_exportado_em is 'Quando o botão Exportar daquele lote (NF Remessa) foi clicado e a planilha gerada — libera o lançamento das NFs daquele lote.';
