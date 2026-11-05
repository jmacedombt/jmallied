-- Sistema Allied | Grupo J.Macedo
-- Migration 0084: Métricas > Devolução por Lotes.
-- Por lote (NF Remessa), mede quantos dias cada aparelho levou da Data
-- Reconhecimento até virar "Produto Entregue" (dias corridos, data de
-- Brasília) e distribui nas faixas: até 7 (meta), 8–14, 15–21, 22–28 e
-- acima de 28. Os que ainda não foram entregues entram em "em aberto"
-- (com quantos já passaram de 7 dias). Reprovados (8) ficam fora da
-- conta — só contados à parte.
-- Data da entrega = última vez que o histórico registrou a entrada em
-- "Produto Entregue" (orcamento_status_historico); sem histórico, usa hoje.
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
      case
        when o.status_operacional = 'Produto Entregue' then
          coalesce(
            (
              select (h.mudou_em at time zone 'America/Sao_Paulo')::date
              from public.orcamento_status_historico h
              where h.orcamento_id = o.id
                and h.status_novo = 'Produto Entregue'
              order by h.mudou_em desc
              limit 1
            ),
            (select d from hoje)
          )
      end as data_entrega
    from public.orcamentos o
    where o.nf_remessa_allied is not null
      and o.data_reconhecimento is not null
      and o.data_reconhecimento >= p_inicio
      and o.data_reconhecimento <= p_fim
  ),
  calc as (
    select
      b.*,
      case
        when b.status_operacional = 'Produto Entregue' then greatest(b.data_entrega - b.data_reconhecimento, 0)
      end as dias_entrega,
      case
        when b.status_operacional not in ('Produto Entregue', '8 - Orçamento Reprovado')
          then greatest((select d from hoje) - b.data_reconhecimento, 0)
      end as dias_aberto
    from base b
  )
  select
    c.nf_remessa_allied,
    min(c.data_reconhecimento) as data_reconhecimento,
    count(*) filter (where c.status_operacional <> '8 - Orçamento Reprovado') as recebidos,
    count(c.dias_entrega) as entregues,
    count(*) filter (where c.dias_entrega <= 7) as ate_7,
    count(*) filter (where c.dias_entrega between 8 and 14) as ate_14,
    count(*) filter (where c.dias_entrega between 15 and 21) as ate_21,
    count(*) filter (where c.dias_entrega between 22 and 28) as ate_28,
    count(*) filter (where c.dias_entrega > 28) as acima_28,
    count(c.dias_aberto) as em_aberto,
    count(*) filter (where c.dias_aberto > 7) as aberto_atrasado,
    max(c.dias_aberto) as aberto_max_dias,
    count(*) filter (where c.status_operacional = '8 - Orçamento Reprovado') as reprovados,
    coalesce(sum(c.dias_entrega), 0) as soma_dias,
    coalesce(array_agg(c.dias_entrega) filter (where c.dias_entrega is not null), '{}') as dias_entregues,
    max(c.data_entrega) as ultima_entrega
  from calc c
  group by c.nf_remessa_allied
  order by min(c.data_reconhecimento) desc, c.nf_remessa_allied;
$$;

grant execute on function public.metricas_devolucao_por_lote(date, date) to authenticated;
