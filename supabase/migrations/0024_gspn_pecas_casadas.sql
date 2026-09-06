-- Sistema Allied | Grupo J.Macedo
-- Migration: relação de peças casadas na Base GSPN
--
-- Quando um chamado do GSPN casa com um orçamento (mesma OS Reparadora),
-- as peças 1 a 10 daquele chamado são propagadas pra tabela de
-- orçamentos (ver gspn_propagar_pecas, migration 0011). Essa função
-- devolve, pra cada código de peça, quantas vezes ele aparece entre os
-- chamados que casaram — opcionalmente filtrando por uma NF Remessa
-- Allied específica — junto com o percentual de uso em relação ao total
-- de peças contadas nesse recorte.
--
-- "Casou" aqui é sempre definido pelo join orcamentos x gspn_chamados
-- por os_reparadora (não pelo valor atual de orcamentos.peca_1..10, que
-- também pode ter vindo da importação original da Base Orçamentos) —
-- assim a contagem reflete só o que realmente veio do GSPN.
create or replace function public.gspn_pecas_casadas(p_nf_remessa text default null)
returns table (peca text, quantidade bigint, percentual numeric)
language sql
stable
as $$
  with casados as (
    select
      o.nf_remessa_allied,
      unnest(array[g.peca_1, g.peca_2, g.peca_3, g.peca_4, g.peca_5, g.peca_6, g.peca_7, g.peca_8, g.peca_9, g.peca_10]) as peca
    from public.orcamentos o
    join public.gspn_chamados g on g.os_reparadora = o.os_reparadora
    where p_nf_remessa is null or o.nf_remessa_allied = p_nf_remessa
  ),
  filtradas as (
    select peca from casados where peca is not null and peca <> ''
  ),
  total as (
    select count(*)::numeric as total from filtradas
  )
  select
    peca,
    count(*) as quantidade,
    round(count(*) * 100.0 / nullif((select total from total), 0), 2) as percentual
  from filtradas
  group by peca
  order by quantidade desc, peca asc;
$$;

-- lista as NF Remessa Allied que têm pelo menos um orçamento casado com
-- a Base GSPN — alimenta o filtro de remessa da tela (só remessas com
-- dado pra mostrar aparecem no seletor).
create or replace function public.gspn_remessas_casadas()
returns table (nf_remessa_allied text, quantidade_chamados bigint)
language sql
stable
as $$
  select o.nf_remessa_allied, count(distinct o.id) as quantidade_chamados
  from public.orcamentos o
  join public.gspn_chamados g on g.os_reparadora = o.os_reparadora
  group by o.nf_remessa_allied
  order by o.nf_remessa_allied desc;
$$;
