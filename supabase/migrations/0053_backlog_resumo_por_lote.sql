-- Sistema Allied | Grupo J.Macedo
-- Migration 0053: reformulação do Backlog por lote (pedido explícito —
-- "não gostei da última atualização", substitui a matriz de colunas
-- numeradas da migration 0051 por um resumo mais direto).
--
-- A função orcamentos_backlog_por_lote() (migration 0051) tinha o
-- filtro "só as 8 etapas numeradas" embutido — agora ela é redefinida
-- SEM esse filtro (conta QUALQUER status_operacional), porque o pop-up
-- de detalhe de um lote (ao clicar na linha) passou a mostrar TODOS os
-- cards/status, não só os numerados. Como o conjunto de colunas mudou
-- (não tem mais média_rtat_lote_dias), a função precisa ser DROPADA
-- antes de recriada — Postgres não deixa trocar o retorno de uma função
-- existente com CREATE OR REPLACE. Único lugar que chamava essa RPC era
-- a tela de Backlog, que está sendo reescrita junto (ver
-- PainelBacklogPorLote.tsx e operacional/backlog/page.tsx).
drop function if exists public.orcamentos_backlog_por_lote();

create or replace function public.orcamentos_backlog_por_lote()
returns table (
  nf_remessa_allied text,
  status_operacional text,
  quantidade bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select o.nf_remessa_allied, o.status_operacional, count(*) as quantidade
  from public.orcamentos o
  where o.nf_remessa_allied is not null
  group by o.nf_remessa_allied, o.status_operacional;
$$;

grant execute on function public.orcamentos_backlog_por_lote() to authenticated;

-- Resumo por lote pra tabela principal do Backlog: Lote | Total do lote
-- | Pendente (antes do Produto Entregue) | R-TAT médio — pedido
-- explícito. "Pendente" = total do lote MENOS quem já está em "Produto
-- Entregue" MENOS quem já foi definitivamente recusado
-- ("8 - Orçamento Reprovado", nunca vai virar entrega) — só quem ainda
-- está de fato caminhando pro produto ser entregue. R-TAT médio do lote
-- é calculado só sobre esses "pendentes" (mesma fórmula de sempre: média
-- de dias entre a Data Reconhecimento e hoje). Só entram lotes que ainda
-- têm pelo menos 1 pendente — Backlog é o que falta, não o histórico
-- inteiro.
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
      count(*) filter (where status_operacional not in ('Produto Entregue', '8 - Orçamento Reprovado')) as quantidade_pendente,
      count(*) filter (where status_operacional = 'Produto Entregue') as quantidade_entregue,
      count(*) filter (where status_operacional = '8 - Orçamento Reprovado') as quantidade_reprovada
    from base
    group by nf_remessa_allied
    having count(*) filter (where status_operacional not in ('Produto Entregue', '8 - Orçamento Reprovado')) > 0
  ),
  rtat_pendente as (
    select nf_remessa_allied,
      avg((now() at time zone 'America/Sao_Paulo')::date - data_reconhecimento)::numeric as media_rtat_pendente_dias
    from base
    where status_operacional not in ('Produto Entregue', '8 - Orçamento Reprovado')
    group by nf_remessa_allied
  )
  select a.nf_remessa_allied, a.total_lote, a.quantidade_pendente, a.quantidade_entregue, a.quantidade_reprovada, r.media_rtat_pendente_dias
  from agregados a
  left join rtat_pendente r using (nf_remessa_allied);
$$;

grant execute on function public.orcamentos_backlog_resumo_por_lote() to authenticated;
