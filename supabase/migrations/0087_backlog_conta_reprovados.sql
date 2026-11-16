-- Sistema Allied | Grupo J.Macedo
-- Migration 0087: Backlog passa a contar os reprovados como pendentes
-- (pedido explícito, 16/11/2026) — mesma regra do card "Quantidade de
-- orçamentos em aberto" do Operacional: tudo que ainda não está em
-- "Produto Entregue" (o reprovado ainda está na casa até a NF de retorno).
create or replace function public.orcamentos_backlog_resumo_por_lote()
returns table (
  nf_remessa_allied text,
  total_lote bigint,
  quantidade_pendente bigint,
  quantidade_entregue bigint,
  quantidade_reprovada bigint,
  media_rtat_pendente_dias numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select o.nf_remessa_allied, o.status_operacional, o.data_reconhecimento
    from public.orcamentos o
    where o.nf_remessa_allied is not null
  ),
  agregados as (
    select
      nf_remessa_allied,
      count(*) as total_lote,
      count(*) filter (where status_operacional <> 'Produto Entregue') as quantidade_pendente,
      count(*) filter (where status_operacional = 'Produto Entregue') as quantidade_entregue,
      count(*) filter (where status_operacional = '8 - Orçamento Reprovado') as quantidade_reprovada
    from base
    group by nf_remessa_allied
    having count(*) filter (where status_operacional <> 'Produto Entregue') > 0
  ),
  rtat_pendente as (
    select nf_remessa_allied,
      avg((now() at time zone 'America/Sao_Paulo')::date - data_reconhecimento)::numeric as media_rtat_pendente_dias
    from base
    where status_operacional <> 'Produto Entregue'
    group by nf_remessa_allied
  )
  select a.nf_remessa_allied, a.total_lote, a.quantidade_pendente, a.quantidade_entregue, a.quantidade_reprovada, r.media_rtat_pendente_dias
  from agregados a
  left join rtat_pendente r using (nf_remessa_allied);
$$;

grant execute on function public.orcamentos_backlog_resumo_por_lote() to authenticated;
