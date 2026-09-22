-- Sistema Allied | Grupo J.Macedo
-- Migration 0062: corrige Métricas > Orçamentos pra reconhecer o NOVO
-- fluxo de Contra Proposta (migration 0060/0061) — "Contra proposta
-- aceita"/"Contra proposta recusada" apareciam sempre zerados no
-- período, mesmo com aparelhos decididos um a um em Ag. Contra Proposta.
--
-- Causa raiz: metricas_resultado_orcamentos/metricas_resultado_pecas
-- (migration 0029/0045) detectavam "passou por Contra Proposta" checando
-- só o histórico de status por `status_novo = '4 - Ag. Resposta de
-- Reorçamento'` — a etapa que o fluxo ANTIGO de "Enviar Contra Proposta"
-- usava (reenviava por e-mail pra Allied reavaliar). O fluxo novo
-- (decisão Aprovado/Reprovado item a item, ver decidir-contra-proposta)
-- NUNCA passa mais por "4" — vai direto de "Ag. Contra Proposta" pra
-- "5 - Ag. Peças" (aceita) ou "8 - Orçamento Reprovado" (recusada). Sem
-- nunca marcar `passou_reorcamento = true`, todo aparelho do fluxo novo
-- caía sempre em "aprovado_primeira"/"reprovado_primeira".
--
-- Não existe nenhuma tabela/coluna com o RESULTADO desse cálculo
-- guardado — as duas funções são `stable`, sem `materialized view` nem
-- cache, recalculam tudo direto de orcamentos + orcamento_status_historico
-- toda vez que a tela é aberta. Corrigindo a função aqui, a métrica do
-- período inteiro (incluindo os lotes que já foram decididos antes dessa
-- correção) já sai certa na próxima vez que a tela carregar — não precisa
-- (e não tem como) "consertar" nenhuma linha gravada errada, porque
-- nenhum resultado fica gravado em lugar nenhum.
--
-- Fix: "passou por Contra Proposta" agora é `passou_reorcamento` (sinal
-- antigo, continua valendo pros lotes que passaram pelo fluxo antigo,
-- histórico real) OU `o.contra_proposta_decisao is not null` (sinal novo
-- — a pessoa decidiu Aprovado/Reprovado aquele item em Ag. Contra
-- Proposta, migration 0060). Com aceita/recusada continuando a ser lido
-- do status_operacional FINAL do aparelho (5+.../8), igual antes — o
-- fluxo novo sempre move decisão Aprovado -> "5 - Ag. Peças" e Reprovado
-- -> "8 - Orçamento Reprovado" juntos, no mesmo passo, então os dois
-- sinais (decisão gravada e etapa final) sempre concordam.

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
      (
        exists (
          select 1 from public.orcamento_status_historico h
          where h.orcamento_id = o.id and h.status_novo = '4 - Ag. Resposta de Reorçamento'
        )
        or o.contra_proposta_decisao is not null
      ) as passou_contra_proposta,
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
      when f.status_operacional = '8 - Orçamento Reprovado' and not f.passou_contra_proposta then 'reprovado_primeira'
      when f.status_operacional = '8 - Orçamento Reprovado' and f.passou_contra_proposta then 'contra_proposta_recusada'
      when f.status_operacional <> '8 - Orçamento Reprovado' and not f.passou_contra_proposta then 'aprovado_primeira'
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
      (
        exists (
          select 1 from public.orcamento_status_historico h
          where h.orcamento_id = o.id and h.status_novo = '4 - Ag. Resposta de Reorçamento'
        )
        or o.contra_proposta_decisao is not null
      ) as passou_contra_proposta,
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
        when f.status_operacional = '8 - Orçamento Reprovado' and not f.passou_contra_proposta then 'reprovado_primeira'
        when f.status_operacional = '8 - Orçamento Reprovado' and f.passou_contra_proposta then 'contra_proposta_recusada'
        when f.status_operacional <> '8 - Orçamento Reprovado' and not f.passou_contra_proposta then 'aprovado_primeira'
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
