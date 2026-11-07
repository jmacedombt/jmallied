-- Sistema Allied | Grupo J.Macedo
-- Migration 0086: Métricas > Devolução por Lotes — reprovados passam a
-- contar como "realizados" (pedido explícito, 07/11/2026): a avaliação foi
-- feita e devolvida, então conta pra meta se feita em até 7 dias.
-- Data final de cada aparelho:
--   * passou por "8 - Orçamento Reprovado" → 1ª entrada nesse status
--     (vale mesmo se depois foi pra Ag. NF Retorno / Produto Entregue);
--   * senão, em "Produto Entregue" → última entrada nesse status.
-- Sem data final = em aberto. `reprovados` = quantos realizados vieram de
-- reprovação. `recebidos` = todos os aparelhos do lote.
create or replace function public.metricas_devolucao_por_lote(p_inicio date, p_fim date)
returns table (
  nf_remessa_allied text,
  data_reconhecimento date,
  recebidos bigint,
  entregues bigint,
  ate_7 bigint,
  ate_14 bigint,
  ate_21 bigint,
  ate_28 bigint,
  acima_28 bigint,
  em_aberto bigint,
  aberto_atrasado bigint,
  aberto_max_dias integer,
  reprovados bigint,
  soma_dias bigint,
  dias_entregues integer[],
  ultima_entrega date
)
language sql
stable
security definer
set search_path = public
as $$
  with hoje as (
    select (now() at time zone 'America/Sao_Paulo')::date as d
  ),
  base as (
    select
      o.nf_remessa_allied,
      o.data_reconhecimento,
      o.status_operacional,
      (
        select (min(h.mudou_em) at time zone 'America/Sao_Paulo')::date
        from public.orcamento_status_historico h
        where h.orcamento_id = o.id
          and h.status_novo = '8 - Orçamento Reprovado'
      ) as data_reprovacao,
      (
        select (max(h.mudou_em) at time zone 'America/Sao_Paulo')::date
        from public.orcamento_status_historico h
        where h.orcamento_id = o.id
          and h.status_novo = 'Produto Entregue'
      ) as data_entregue
    from public.orcamentos o
    where o.nf_remessa_allied is not null
      and o.data_reconhecimento is not null
      and o.data_reconhecimento >= p_inicio
      and o.data_reconhecimento <= p_fim
  ),
  fim as (
    select
      b.*,
      case
        when b.data_reprovacao is not null then b.data_reprovacao
        when b.status_operacional = '8 - Orçamento Reprovado' then (select d from hoje)
        when b.status_operacional = 'Produto Entregue' then coalesce(b.data_entregue, (select d from hoje))
      end as data_fim,
      (b.data_reprovacao is not null or b.status_operacional = '8 - Orçamento Reprovado') as via_reprovacao
    from base b
  ),
  calc as (
    select
      f.*,
      case when f.data_fim is not null then greatest(f.data_fim - f.data_reconhecimento, 0) end as dias_entrega,
      case when f.data_fim is null then greatest((select d from hoje) - f.data_reconhecimento, 0) end as dias_aberto
    from fim f
  )
  select
    c.nf_remessa_allied,
    min(c.data_reconhecimento) as data_reconhecimento,
    count(*) as recebidos,
    count(c.dias_entrega) as entregues,
    count(*) filter (where c.dias_entrega <= 7) as ate_7,
    count(*) filter (where c.dias_entrega between 8 and 14) as ate_14,
    count(*) filter (where c.dias_entrega between 15 and 21) as ate_21,
    count(*) filter (where c.dias_entrega between 22 and 28) as ate_28,
    count(*) filter (where c.dias_entrega > 28) as acima_28,
    count(c.dias_aberto) as em_aberto,
    count(*) filter (where c.dias_aberto > 7) as aberto_atrasado,
    max(c.dias_aberto) as aberto_max_dias,
    count(*) filter (where c.dias_entrega is not null and c.via_reprovacao) as reprovados,
    coalesce(sum(c.dias_entrega), 0) as soma_dias,
    coalesce(array_agg(c.dias_entrega) filter (where c.dias_entrega is not null), '{}') as dias_entregues,
    max(c.data_fim) as ultima_entrega
  from calc c
  group by c.nf_remessa_allied
  order by min(c.data_reconhecimento) desc, c.nf_remessa_allied;
$$;

grant execute on function public.metricas_devolucao_por_lote(date, date) to authenticated;
