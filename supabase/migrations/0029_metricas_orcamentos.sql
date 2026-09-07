-- Sistema Allied | Grupo J.Macedo
-- Migration: métricas de resultado de orçamento (menu Métricas > Orçamentos)
--
-- Classifica cada orçamento FECHADO (resultado já decidido) em 4
-- categorias, usando só o histórico de status que já existe
-- (orcamento_status_historico, migration 0022) — nenhuma coluna nova em
-- orcamentos, e funciona não importa qual rotina mudou o status (o
-- histórico é gravado por trigger, direto na tabela):
--
--   - aprovado_primeira:        nunca passou por "4 - Ag. Resposta de
--                                Reorçamento" e avançou de "3 - Ag.
--                                Resposta de Orçamento" pra "5 - Ag.
--                                Peças" em diante.
--   - reprovado_primeira:       nunca passou por "4" e foi pra "8 -
--                                Orçamento Reprovado".
--   - contra_proposta_aceita:   passou por "4" e depois avançou pra "5 -
--                                Ag. Peças" em diante.
--   - contra_proposta_recusada: passou por "4" e depois foi pra "8 -
--                                Orçamento Reprovado".
--
-- Um orçamento ainda em aberto (parado em qualquer etapa antes de "5 -
-- Ag. Peças" e antes de "8 - Orçamento Reprovado") não entra em nenhuma
-- dessas contagens — só conta quando o resultado já está decidido,
-- senão o percentual do período fica errado enquanto ele ainda "está
-- rolando".
--
-- "fechado_em" (usado pro filtro de período) é a data em que ENTROU na
-- etapa que decidiu o resultado (primeira entrada em "5 - Ag. Peças", ou
-- a mais recente em "8 - Orçamento Reprovado" — mais recente porque, em
-- teoria, um orçamento não deveria ser reprovado duas vezes, mas usar a
-- última entrada protege contra qualquer edição manual).
--
-- Valor (Venda de Peça / Mão de obra) vem do validacao_snapshot, gravado
-- e CONGELADO no momento do "Confirmar Envio" (ver
-- avancar-validacao-em-massa) — nunca recalculado, pra bater com o valor
-- real que foi informado à Allied. Um orçamento reprovado ANTES de
-- chegar em Validação de Orçamentos (reprovado direto em "2 - Ag.
-- Análise", ver reprovar-em-massa/[id]/reprovar) nunca teve preço
-- apurado, então entra na contagem mas fica com valor nulo — a tela
-- trata esse caso mostrando "—" em vez de somar como zero.

create or replace function public.metricas_resultado_orcamentos(
  p_inicio date,
  p_fim date
)
returns table (
  orcamento_id uuid,
  nf_remessa_allied text,
  modelo_comercial text,
  resultado text,
  fechado_em timestamptz,
  venda_total_pecas numeric,
  mao_de_obra numeric,
  valor_total_reparo numeric
)
language sql
stable
as $$
  with fechamento as (
    select
      o.id,
      o.nf_remessa_allied,
      o.modelo_comercial,
      o.status_operacional,
      o.validacao_snapshot,
      exists (
        select 1 from public.orcamento_status_historico h
        where h.orcamento_id = o.id and h.status_novo = '4 - Ag. Resposta de Reorçamento'
      ) as passou_reorcamento,
      case
        when o.status_operacional = '8 - Orçamento Reprovado' then (
          select h.mudou_em from public.orcamento_status_historico h
          where h.orcamento_id = o.id and h.status_novo = '8 - Orçamento Reprovado'
          order by h.mudou_em desc limit 1
        )
        when o.status_operacional in ('5 - Ag. Peças', '6 - Ag. Reparo', '7 - Reparo Finalizado', 'Produto Entregue') then (
          select h.mudou_em from public.orcamento_status_historico h
          where h.orcamento_id = o.id and h.status_novo = '5 - Ag. Peças'
          order by h.mudou_em asc limit 1
        )
        else null
      end as fechado_em
    from public.orcamentos o
    where o.status_operacional = '8 - Orçamento Reprovado'
       or o.status_operacional in ('5 - Ag. Peças', '6 - Ag. Reparo', '7 - Reparo Finalizado', 'Produto Entregue')
  )
  select
    f.id as orcamento_id,
    f.nf_remessa_allied,
    f.modelo_comercial,
    case
      when f.status_operacional = '8 - Orçamento Reprovado' and not f.passou_reorcamento then 'reprovado_primeira'
      when f.status_operacional = '8 - Orçamento Reprovado' and f.passou_reorcamento then 'contra_proposta_recusada'
      when f.status_operacional <> '8 - Orçamento Reprovado' and not f.passou_reorcamento then 'aprovado_primeira'
      else 'contra_proposta_aceita'
    end as resultado,
    f.fechado_em,
    nullif(f.validacao_snapshot->>'vendaTotalPecas', '')::numeric as venda_total_pecas,
    nullif(f.validacao_snapshot->>'maoDeObra', '')::numeric as mao_de_obra,
    case when f.validacao_snapshot is not null then
      coalesce((f.validacao_snapshot->>'vendaTotalPecas')::numeric, 0) + coalesce((f.validacao_snapshot->>'maoDeObra')::numeric, 0)
    else null end as valor_total_reparo
  from fechamento f
  where f.fechado_em is not null
    and f.fechado_em >= p_inicio::timestamptz
    and f.fechado_em < (p_fim + 1)::timestamptz;
$$;

-- Mesma classificação de cima, mas explodindo peca_1..10 + peca_add_1..5
-- em uma linha por Part Number (um orçamento com 3 peças conta 3 vezes,
-- uma pra cada) — base do ranking "Part Number mais aprovado/reprovado/
-- contra-proposta" (análise pedida sobre TODAS as peças do lote, não só
-- a peça 1 de cada orçamento).
create or replace function public.metricas_resultado_pecas(
  p_inicio date,
  p_fim date
)
returns table (
  part_number text,
  resultado text,
  quantidade bigint
)
language sql
stable
as $$
  with fechamento as (
    select
      o.id,
      o.status_operacional,
      o.peca_1, o.peca_2, o.peca_3, o.peca_4, o.peca_5,
      o.peca_6, o.peca_7, o.peca_8, o.peca_9, o.peca_10,
      o.peca_add_1, o.peca_add_2, o.peca_add_3, o.peca_add_4, o.peca_add_5,
      exists (
        select 1 from public.orcamento_status_historico h
        where h.orcamento_id = o.id and h.status_novo = '4 - Ag. Resposta de Reorçamento'
      ) as passou_reorcamento,
      case
        when o.status_operacional = '8 - Orçamento Reprovado' then (
          select h.mudou_em from public.orcamento_status_historico h
          where h.orcamento_id = o.id and h.status_novo = '8 - Orçamento Reprovado'
          order by h.mudou_em desc limit 1
        )
        when o.status_operacional in ('5 - Ag. Peças', '6 - Ag. Reparo', '7 - Reparo Finalizado', 'Produto Entregue') then (
          select h.mudou_em from public.orcamento_status_historico h
          where h.orcamento_id = o.id and h.status_novo = '5 - Ag. Peças'
          order by h.mudou_em asc limit 1
        )
        else null
      end as fechado_em
    from public.orcamentos o
    where o.status_operacional = '8 - Orçamento Reprovado'
       or o.status_operacional in ('5 - Ag. Peças', '6 - Ag. Reparo', '7 - Reparo Finalizado', 'Produto Entregue')
  ),
  classificado as (
    select
      f.*,
      case
        when f.status_operacional = '8 - Orçamento Reprovado' and not f.passou_reorcamento then 'reprovado_primeira'
        when f.status_operacional = '8 - Orçamento Reprovado' and f.passou_reorcamento then 'contra_proposta_recusada'
        when f.status_operacional <> '8 - Orçamento Reprovado' and not f.passou_reorcamento then 'aprovado_primeira'
        else 'contra_proposta_aceita'
      end as resultado
    from fechamento f
    where f.fechado_em is not null
      and f.fechado_em >= p_inicio::timestamptz
      and f.fechado_em < (p_fim + 1)::timestamptz
  ),
  pecas as (
    select resultado, unnest(array[
      peca_1, peca_2, peca_3, peca_4, peca_5,
      peca_6, peca_7, peca_8, peca_9, peca_10,
      peca_add_1, peca_add_2, peca_add_3, peca_add_4, peca_add_5
    ]) as part_number
    from classificado
  )
  select part_number, resultado, count(*) as quantidade
  from pecas
  where part_number is not null and btrim(part_number) <> ''
  group by part_number, resultado
  order by part_number, resultado;
$$;
