-- Sistema Allied | Grupo J.Macedo
-- Migration 0051: nova visualização do Backlog (Operacional > Backlog,
-- pedido explícito) — em vez de só um resumo geral por etapa, mostra uma
-- MATRIZ: linhas = lote (NF Remessa), colunas = as 8 etapas numeradas
-- (as "oficiais", com numeração — 1 a 8), com quantidade + percentual
-- (barra colorida) em cada célula, e o R-TAT médio de cada LOTE (não
-- mais só por etapa).
--
-- Mesma base e mesma fórmula de R-TAT já usada por
-- orcamentos_backlog_resumo() (migration 0035): média de
-- (hoje − data_reconhecimento), em dias, só de quem está PARADO agora
-- numa das 8 etapas numeradas — não mexe na fórmula "oficial" de
-- Métricas > R-TAT (essa usa orcamento_status_historico e período de
-- fechamento, propósito diferente) nem na "R-TAT ao vivo" por card de
-- etapa (lib/metricas.ts) — aqui é o mesmo cálculo do Backlog de hoje,
-- só que agrupado também por lote.
--
-- security definer + grant authenticated: mesmo motivo de
-- orcamentos_backlog_resumo (migration 0035) — a política RESTRICTIVE
-- "orcamentos_bloqueio_allied" barra o cargo ALLIED de ler `orcamentos`
-- por qualquer caminho que não seja uma função security definer, e o
-- Backlog é visível pro ALLIED também. Essa função não expõe custo/BID
-- nenhum — só nf_remessa_allied, status e contagens/médias de dias.
create or replace function public.orcamentos_backlog_por_lote()
returns table (
  nf_remessa_allied text,
  status_operacional text,
  quantidade bigint,
  media_rtat_lote_dias numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with numerados as (
    select o.nf_remessa_allied, o.status_operacional, o.data_reconhecimento
    from public.orcamentos o
    where o.status_operacional ~ '^[0-9]'
      and o.nf_remessa_allied is not null
  ),
  por_status as (
    select nf_remessa_allied, status_operacional, count(*) as quantidade
    from numerados
    group by nf_remessa_allied, status_operacional
  ),
  por_lote as (
    select nf_remessa_allied,
      avg((now() at time zone 'America/Sao_Paulo')::date - data_reconhecimento)::numeric as media_rtat_lote_dias
    from numerados
    group by nf_remessa_allied
  )
  select ps.nf_remessa_allied, ps.status_operacional, ps.quantidade, pl.media_rtat_lote_dias
  from por_status ps
  join por_lote pl using (nf_remessa_allied);
$$;

grant execute on function public.orcamentos_backlog_por_lote() to authenticated;
