-- Sistema Allied | Grupo J.Macedo
-- Migration 0078: reverte a importação ERRADA do botão "Carregar BID" de
-- 26/10/2026 — arquivo "ServiceOrderList_26_10_2026 (3).xls" (lista de
-- OS do GSPN, não é BID: o "Número" virou Modelo, o "SO Nro." virou Part
-- Number e o "ASC Job No." virou Peça Solução). Conferência feita antes:
-- 521 peças criadas por ela, 0 peças antigas alteradas.
--
-- NÃO mexe na importação "BID SANTOS 26102026_1115.xlsx" (11:49 do mesmo
-- dia), que é um BID de verdade — decisão do usuário: manter.
--
-- Só pega importação de 26/10/2026 (Brasília) cujo arquivo começa com
-- "ServiceOrderList". Tudo numa transação: se der erro, nada é aplicado.

-- PARTE 1 — CONFERÊNCIA (opcional, não muda nada)
select i.arquivo_nome,
       to_char(i.importado_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') as importado_em,
       (select count(*) from public.bid_pecas p where p.bid_importacao_id = i.id) as pecas_que_serao_apagadas
from public.bid_importacoes i
where (i.importado_em at time zone 'America/Sao_Paulo')::date = date '2026-10-26'
  and i.arquivo_nome ilike 'ServiceOrderList%';

-- PARTE 2 — REVERSÃO
begin;

create temporary table tmp_bid_imp_errada on commit drop as
  select id from public.bid_importacoes
  where (importado_em at time zone 'America/Sao_Paulo')::date = date '2026-10-26'
    and arquivo_nome ilike 'ServiceOrderList%';

delete from public.bid_reconciliacoes r
using public.bid_pecas p
where r.bid_peca_id = p.id
  and p.bid_importacao_id in (select id from tmp_bid_imp_errada)
  and (p.criado_em at time zone 'America/Sao_Paulo')::date = date '2026-10-26';

-- as Peças Solução e o histórico dessas peças saem juntos (cascata)
delete from public.bid_pecas p
where p.bid_importacao_id in (select id from tmp_bid_imp_errada)
  and (p.criado_em at time zone 'America/Sao_Paulo')::date = date '2026-10-26';

delete from public.bid_importacoes where id in (select id from tmp_bid_imp_errada);

commit;
