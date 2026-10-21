-- Sistema Allied | Grupo J.Macedo
-- Migration 0077: corrige no histórico de importações (Bases > Base
-- Orçamentos) as linhas que ficaram com Novos/Modelos/SKUs = 0 porque a
-- importação foi cortada no meio pela Vercel antes do passo final
-- (caso da NF 1969657 em 21/10/2026: 120 de 174 gravados). Recalcula os
-- números a partir dos aparelhos que de fato ficaram ligados a cada
-- importação. Só mexe em linha zerada que tem aparelho ligado — as
-- importações normais não são alteradas. Pode rodar mais de uma vez.

update public.orcamentos_lotes l
set aparelhos_novos_inseridos      = c.novos,
    aparelhos_reincidentes         = c.reincidentes,
    aparelhos_duplicados_ignorados = 0,
    modelos_comerciais_unicos      = c.modelos,
    skus_unicos                    = c.skus
from (
  select lote_id,
         count(*)                                              as novos,
         count(*) filter (where reincidente)                   as reincidentes,
         count(distinct nullif(trim(modelo_comercial), ''))    as modelos,
         count(distinct nullif(trim(sku), ''))                 as skus
  from public.orcamentos
  where lote_id is not null
  group by lote_id
) c
where c.lote_id = l.id
  and l.aparelhos_novos_inseridos = 0
  and l.modelos_comerciais_unicos = 0;
