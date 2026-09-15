-- Sistema Allied | Grupo J.Macedo
-- Migration 0045: libera Métricas > Volumetria e Métricas > Orçamentos
-- pro cargo ALLIED (pedido explícito) — parte "dado" da liberação.
--
-- A parte "página" (menu, gate de acesso, middleware) já foi feita na
-- aplicação, mas sozinha ela não é suficiente: a política RESTRICTIVE
-- "orcamentos_bloqueio_allied" (migration 0035) barra ALLIED de ler a
-- tabela orcamentos por QUALQUER caminho que não seja uma função
-- security definer — e as 4 funções abaixo, usadas pelas duas telas,
-- ainda rodavam com o privilégio de quem chamou (sem security definer).
-- Resultado, sem esse ajuste: a tela abre pro ALLIED, mas os gráficos
-- vêm todos vazios (a RLS devolve zero linhas antes mesmo da função
-- rodar sua lógica).
--
-- As 4 funções abaixo foram revisadas e nenhuma expõe custo de peça ou
-- BID — só datas, status, contagens, Part Number e os dois valores que
-- ALLIED já tem permissão de ver (venda de peça e mão de obra, o mesmo
-- nível de detalhe de orcamentos_allied_listar, migration 0035). Corpo
-- de cada função idêntico ao já existente (0022/0029) — só adicionando
-- security definer + set search_path (mesmo padrão de 0035/0040/0041/
-- 0042) e o grant execute.

-- ---- Métricas > Volumetria (corpo igual à migration 0022) ----

create or replace function public.metricas_reconhecidos_por_periodo(
  p_granularidade text,
  p_inicio date,
  p_fim date
)
returns table (periodo date, quantidade bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    date_trunc(p_granularidade, o.data_reconhecimento)::date as periodo,
    count(*) as quantidade
  from public.orcamentos o
  where o.data_reconhecimento is not null
    and o.data_reconhecimento >= p_inicio
    and o.data_reconhecimento <= p_fim
  group by 1
  order by 1;
$$;

grant execute on function public.metricas_reconhecidos_por_periodo(text, date, date) to authenticated;

create or replace function public.metricas_entradas_status_por_periodo(
  p_granularidade text,
  p_inicio date,
  p_fim date
)
returns table (periodo date, status text, quantidade bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    date_trunc(p_granularidade, h.mudou_em)::date as periodo,
    h.status_novo as status,
    count(*) as quantidade
  from public.orcamento_status_historico h
  where h.mudou_em >= p_inicio::timestamptz
    and h.mudou_em < (p_fim + 1)::timestamptz
  group by 1, 2
  order by 1, 2;
$$;

grant execute on function public.metricas_entradas_status_por_periodo(text, date, date) to authenticated;

-- ---- Métricas > Orçamentos (corpo igual à migration 0029) ----

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
security definer
set search_path = public
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

grant execute on function public.metricas_resultado_orcamentos(date, date) to authenticated;

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
security definer
set search_path = public
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

grant execute on function public.metricas_resultado_pecas(date, date) to authenticated;
