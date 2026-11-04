-- Sistema Allied | Grupo J.Macedo
-- Migration 0081 (04/11/2026, pedido explícito): corrige as NFs lançadas
-- com número de teste em 04/11/2026 00:36 nas NFs Remessa 1979290,
-- 1929510, 1940166, 1949727 e 1919924:
--   NF Mão de Obra 999      -> 004     (valor continua R$ 12.800,00)
--   NF Peças       99999-9  -> 3531-2  (valor continua R$ 33.675,82)
-- Corrige nos aparelhos (orcamentos) e no Financeiro.

-- PARTE 1 — CONFERÊNCIA (não muda nada)
select nf_remessa_allied,
       count(*) filter (where nf_mao_de_obra_numero = '999')     as aparelhos_mo_999,
       count(*) filter (where nf_pecas_numero = '99999-9')       as aparelhos_pecas_99999_9
from public.orcamentos
where nf_mao_de_obra_numero = '999' or nf_pecas_numero = '99999-9'
group by nf_remessa_allied
order by nf_remessa_allied;

select id, data_emissao, nf_mao_de_obra_numero, nf_mao_de_obra_valor, nf_pecas_numero, nf_pecas_valor
from public.financeiro_notas_fiscais
where nf_mao_de_obra_numero in ('999', '004') or nf_pecas_numero in ('99999-9', '3531-2');

-- PARTE 2 — CORREÇÃO
begin;

update public.orcamentos set nf_mao_de_obra_numero = '004' where nf_mao_de_obra_numero = '999';
update public.orcamentos set nf_pecas_numero = '3531-2' where nf_pecas_numero = '99999-9';

update public.financeiro_notas_fiscais
set nf_mao_de_obra_numero = '004', atualizado_em = now()
where nf_mao_de_obra_numero = '999';

update public.financeiro_notas_fiscais
set nf_pecas_numero = '3531-2', atualizado_em = now()
where nf_pecas_numero = '99999-9';

commit;
