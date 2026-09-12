-- Sistema Allied | Grupo J.Macedo
-- Migration 0040: "Previsão de Recebimento" (Métricas) — resumo
-- financeiro (Mão de Obra + Venda de Peças) dos aparelhos em
-- "5 - Ag. Peças", "6 - Ag. Reparo" e "7 - Reparo Finalizado". Só
-- nessas 3 etapas o orçamento já foi aprovado pela Allied — é o que
-- vamos efetivamente receber por eles.
--
-- Pra cada aparelho usa o valor VIGENTE no momento (o mesmo que valeria
-- se você abrisse o card dele agora), com a mesma prioridade usada no
-- resto do sistema:
--   1) Reorçamento aprovado (aprovado_reorcamento_em preenchido) ->
--      reorcamento_detalhe (já soma peças originais + adicionais, ver
--      calcularDetalheReorcamento em lib/orcamentos.ts);
--   2) senão, Contra Proposta ajustada (contra_proposta_ajustado) ->
--      soma de contra_proposta_pecas (campo vendaNova de cada peça) +
--      contra_proposta_mao_de_obra;
--   3) senão -> validacao_snapshot (valor original congelado em
--      "Confirmar Envio", Validação de Orçamentos).
--
-- security definer + stable, mesmo padrão das outras funções de
-- métricas (ver 0029_metricas_orcamentos.sql e 0035_cargo_allied.sql) —
-- aqui não expõe nenhum custo/BID, só venda de peça e mão de obra
-- (mesmo nível de detalhe que orcamentos_allied_listar já expõe).
--
-- p_status filtra pra uma etapa só (usado no card do topo de cada tela
-- de status — 5, 6 ou 7); chamada sem argumento (ou null) devolve as 3
-- etapas de uma vez (usado no gráfico de Métricas > Previsão de
-- Recebimento).
create or replace function public.previsao_recebimento_resumo(p_status text default null)
returns table (
  status_operacional text,
  mao_de_obra numeric,
  venda_pecas numeric,
  quantidade bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    o.status_operacional,
    coalesce(sum(
      case
        when o.aprovado_reorcamento_em is not null and o.reorcamento_detalhe is not null
          then coalesce(nullif(o.reorcamento_detalhe->>'maoDeObra', '')::numeric, 0)
        when o.contra_proposta_ajustado and o.contra_proposta_pecas is not null
          then coalesce(o.contra_proposta_mao_de_obra, 0)
        else coalesce(nullif(o.validacao_snapshot->>'maoDeObra', '')::numeric, 0)
      end
    ), 0) as mao_de_obra,
    coalesce(sum(
      case
        when o.aprovado_reorcamento_em is not null and o.reorcamento_detalhe is not null
          then coalesce(nullif(o.reorcamento_detalhe->>'vendaTotalPecas', '')::numeric, 0)
        when o.contra_proposta_ajustado and o.contra_proposta_pecas is not null
          then coalesce((
            select sum(coalesce(nullif(p->>'vendaNova', '')::numeric, 0))
            from jsonb_array_elements(o.contra_proposta_pecas) as p
          ), 0)
        else coalesce(nullif(o.validacao_snapshot->>'vendaTotalPecas', '')::numeric, 0)
      end
    ), 0) as venda_pecas,
    count(*) as quantidade
  from public.orcamentos o
  where o.status_operacional in ('5-ag-pecas', '6-ag-reparo', '7-reparo-finalizado')
    and (p_status is null or o.status_operacional = p_status)
  group by o.status_operacional;
$$;

grant execute on function public.previsao_recebimento_resumo(text) to authenticated;
